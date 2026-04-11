# SPEC-071 — Integracja VoIP i obsługa połączeń serwisowych

**Status**: Conditionally approved for Phase 1 MVP after local POC — implementation target aligned to `itrix-standalone`.

**Powiązane specyfikacje**:
- [SPEC-045 — Integration Marketplace](./SPEC-045-2026-02-24-integration-marketplace.md)
- [SPEC-045d — Communication & Notification Hubs](./SPEC-045d-communication-notification-hubs.md)
- lokalny moduł `src/modules/service_tickets`

## TLDR

Open Mercato standalone ma otrzymać nowy lokalny moduł domenowy `phone_calls` w `src/modules/phone_calls`, który zapisuje połączenia telefoniczne jako pełnoprawne obiekty biznesowe i łączy je z istniejącym modułem `service_tickets`. Integracja z Ringostatem jest realizowana przez Tillio: Open Mercato przechowuje konfigurację Tillio, pobiera listę/szczegóły/nagrania połączeń przez API Tillio i w kolejnej fazie obsługuje webhooki oraz artefakty AI.

Zakres MVP:
- konfiguracja numeru telefonu per użytkownik
- lista i szczegóły połączeń
- konfiguracja klienta Tillio/Ringostat i bezpieczne przechowywanie `X-Token`
- ręczny pull/backfill połączeń przez `GET /api/call`
- zapis metadanych połączenia i opcjonalnego linku do nagrania
- powiązanie połączenia z `customers`/kontaktami i `service_tickets`
- utworzenie nowego `service_ticket` z prefill istniejących pól formularza

Poza MVP / faza 2:
- webhook ingest callbacków `new_call` / `call_finished`
- transkrypcja i podsumowanie AI, ponieważ endpointy Tillio `/trn` i `/sum` są kosztowne oraz wymagają nagrania lub `recordingUrl`
- wersjonowanie transkrypcji i podsumowań
- własny pipeline STT/summary w OM

Najważniejsze decyzje:
- rekord połączenia jest własnością modułu `phone_calls`, a nie Ringostatu ani Tillio
- Tillio jest warstwą integracyjną wobec Ringostat i dostarcza API do listy/szczegółów/nagrań; webhooki są osobnym etapem
- powiązania między `phone_calls`, `customers` i `service_tickets` są wyłącznie przez FK ID, bez relacji ORM cross-module
- nagrania są przechowywane przez `attachments` albo referencjonowane jako zewnętrzny URL do momentu pobrania przez storage; transkrypcje i podsumowania trafiają do wersjonowanych tabel dopiero w fazie 2

Założenie:
- źródłem telefonii jest Ringostat, ale Open Mercato nie integruje się z nim bezpośrednio; kontrakt jest zawierany z Tillio jako warstwą pośrednią
- kolekcja Bruno potwierdza endpointy i przykładowe payloady; implementacja musi używać normalizatora per provider zamiast zakładać jeden uniwersalny JSON callbacku

### POC wynik — 2026-04-11

- `GET /` Tillio zwraca `200 {"status":"alive"}`.
- `GET /api/plugins` zwraca pluginy `Focus`, `P4`, `Ringostat`, `Plus`.
- `GET /api/plugins/Ringostat` zwraca kontrakt metod `GET /api/call`, `GET /api/call/:id/details`, `GET /api/call/:id/rec`, `POST /api/call/:id/trn`, `POST /api/call/:id/sum`.
- `POST /api/config/validate` dla poprawnego Ringostat key zwraca `{"valid": true}`.
- `POST /api/config` zwrócił jednorazowy `X-Token` dla POC tenantu.
- `GET /api/call` z `X-Token` odpowiada `200` z pustą listą połączeń.
- `GET /api/call/async` zwraca `404` dla Ringostat i nie jest częścią MVP.
- Bezpośrednie Ringostat `GET /calls/list?project_id=135049` zwraca `200 []`, więc pusta lista w Tillio nie jest błędem warstwy OM.

## Overview

### A) Cel i zakres

Celem jest skrócenie czasu obsługi zgłoszeń serwisowych przychodzących telefonicznie oraz ograniczenie ręcznego przepisywania danych z rozmowy do karty serwisowej. System ma automatycznie przejąć dane z połączenia, rozpoznać klienta, przygotować podsumowanie i umożliwić natychmiastowe przypięcie lub utworzenie zgłoszenia serwisowego.

W zakresie tej specyfikacji znajdują się:
- nowy moduł `phone_calls` w `src/modules/phone_calls/`
- pull/backfill z Tillio API, retry, idempotencja i deduplikacja rekordów połączeń
- konfiguracja klienta Tillio i zarządzanie tokenem integracyjnym
- ekran konfiguracji numeru użytkownika
- lista i szczegóły połączeń
- integracja z `customers`, `attachments`, `audit_logs` i `service_tickets`
- przygotowanie modelu pod późniejsze generowanie i regenerowanie podsumowań AI
- mapowanie danych z rozmowy do karty serwisowej
- testy unit, integracyjne i e2e

Poza zakresem MVP:
- wykonywanie połączeń wychodzących z UI Open Mercato
- softphone / embedded dialer
- analiza sentymentu i scoring jakości rozmowy
- automatyczne zamykanie zgłoszeń serwisowych na podstawie rozmowy
- pełne wielokanałowe centrum kontaktu

### Kontekst biznesowy

Obecny proces serwisowy wymaga ręcznego odsłuchiwania rozmów, przepisywania kluczowych informacji i osobnego zakładania karty serwisowej. To powoduje:
- opóźnienia w obsłudze zgłoszeń
- ryzyko pomyłki w adresie, terminie lub modelu maszyny
- brak pełnej ścieżki audytowej od rozmowy do zgłoszenia
- duplikowanie danych między telefonią, CRM i modułem serwisowym

### Referencja rynkowa

Na poziomie wzorca produktowego spec czerpie z rozwiązań klasy Aircall, Zendesk Talk, Freshdesk Contact Center oraz modeli integracyjnych Asterisk/FreePBX:
- przyjęto wzorzec: połączenie jako osobny rekord z artefaktami i timeline
- przyjęto wzorzec: powiązanie rozmowy z ticketem/sprawą serwisową
- odrzucono wzorzec: vendor-specific data model w core
- odrzucono wzorzec: przechowywanie nagrań jako surowe blob-y w tabeli połączeń

## Problem Statement

Open Mercato standalone posiada już moduł `service_tickets`, ale nie ma natywnego mechanizmu przejmowania danych o połączeniach z zewnętrznej warstwy telekomunikacyjnej i zamiany ich na ustrukturyzowane dane serwisowe. Brakuje:
- konfiguracji numeru per użytkownik
- konfiguracji klienta Tillio z tokenem i nagłówkami środowiska
- listy połączeń i ich szczegółów
- modelu danych dla transkrypcji i podsumowań
- możliwości powiązania rozmowy ze zgłoszeniem serwisowym
- automatycznego zakładania karty serwisowej z rozmowy
- wersjonowania podsumowań i ręcznej korekty danych AI

Bez tych elementów połączenia pozostają poza głównym workflow serwisowym, a dane krytyczne operacyjnie nie są indeksowalne, audytowalne ani spójne.

## Proposed Solution

### Architektura wysokiego poziomu

Proponowane rozwiązanie składa się z dwóch warstw:

1. `phone_calls` w `src/modules/phone_calls/`
   - właściciel rekordu połączenia, transkrypcji, podsumowań, konfiguracji użytkownika i powiązań z kartą serwisową
2. integracja `Tillio -> Open Mercato`
   - Tillio dostarcza API do pobierania listy połączeń, szczegółów, nagrań oraz endpointy AI dla transkrypcji i podsumowań; callbacki są etapem po MVP

### Decyzje architektoniczne

| Decyzja | Uzasadnienie |
|---|---|
| Utworzyć moduł `phone_calls` zamiast rozszerzać `service_tickets` | Połączenie telefoniczne jest osobnym obiektem domenowym z własnym lifecycle, retry i artefaktami |
| Integracja z Ringostat pozostaje po stronie Tillio | Ogranicza sprzężenie OM z vendor-specific API i upraszcza kontrakt wdrożeniowy |
| MVP oprzeć o pull/backfill `GET /api/call`, a callbacki dodać później | POC potwierdził działające API i pustą listę; webhook wymaga osobnej decyzji o publicznym callback URL i auth |
| Zapisywać nagranie przez `attachments` | Uniknięcie ciężkich blobów w tabelach biznesowych i reuse istniejącej warstwy storage |
| Docelowo trzymać transkrypcję i podsumowania w wersjonowanych tabelach | Wymóg regeneracji, audytu i porównania wersji; poza MVP |
| Link do zgłoszenia serwisowego przez FK ID | Zgodność z zasadą braku relacji ORM między modułami |
| Normalizacja danych z callbacków i endpointów Tillio do kontraktu `phone_calls.call.*` | Odseparowanie core od Ringostat i od szczegółów implementacji Tillio |

### Alternatywy odrzucone

| Alternatywa | Dlaczego odrzucono |
|---|---|
| Dodać pola telefoniczne bezpośrednio do `service_tickets` | Nie obsłuży wielu połączeń dla jednego zgłoszenia ani historii rozmów |
| Trzymać wszystkie artefakty w jednej tabeli `phone_calls` | Brak wersjonowania i rosnące ryzyko ciężkich odczytów |
| Implementować bezpośrednią integrację OM z Ringostat | Zwiększa koszt utrzymania po stronie OM i dubluje odpowiedzialność Tillio |

## User Stories / Use Cases

- Dyspozytor chce zobaczyć listę wszystkich połączeń i od razu utworzyć zgłoszenie serwisowe, aby nie przepisywać danych ręcznie.
- Serwisant lub backoffice chce przypiąć połączenie do istniejącej karty serwisowej, aby zachować pełny kontekst zgłoszenia.
- Menedżer chce ponownie wygenerować podsumowanie rozmowy, aby poprawić jakość danych po zmianie promptu lub modelu AI.
- Administrator chce przypisać numer obsługiwany przez Tillio/Ringostat do użytkownika i kontrolować uprawnienia do odsłuchiwania nagrań.

## Architecture

### Komponenty

- `phone_calls` module
- kontrakt integracyjny `Tillio -> OM`
- `integrations` module dla stanu, credentials i health checks
- `attachments` module dla plików nagrań
- `customers` module dla klienta i kontaktu
- `service_tickets` module dla kart/zleceń serwisowych
- `audit_logs` dla śladu działań użytkownika
- opcjonalny worker/queue dla asynchronicznej transkrypcji i summary AI

### Przepływ danych

1. Ringostat dostarcza dane połączenia do Tillio.
2. Tillio zapisuje konfigurację klienta na podstawie pluginu `Ringostat` i zwraca jednorazowy `X-Token`.
3. OM zapisuje `X-Token` jako sekret powiązany z niezmiennym zestawem `X-System`, `X-Tenant`, `X-Tenant-Domain`.
4. Użytkownik lub worker uruchamia pull/backfill `GET /api/call` z opcjonalnym zakresem `from` / `to`.
5. `phone_calls` zapisuje lub aktualizuje rekord połączenia idempotentnie po `(provider_id, external_call_id, tenant_id, organization_id)`.
6. Jeśli dostępny jest identyfikator nagrania lub URL, OM może pobrać nagranie przez `GET /api/call/:id/rec` i podpiąć je przez `attachments`.
7. Użytkownik może przypiąć istniejące zlecenie `service_tickets` albo utworzyć nowe zlecenie z prefill istniejących pól formularza.
8. W fazie 2 worker może uruchomić `POST /api/call/:id/trn` i `POST /api/call/:id/sum`, zapisując wersje transkrypcji i podsumowania.

### Granice modułów

- `phone_calls` nie przechowuje denormalizowanych danych klienta jako source of truth; trzyma snapshot caller data i FK ID.
- `service_tickets` pozostaje właścicielem zleceń serwisowych.
- Tillio pozostaje systemem integracyjnym i nie jest modelowane w OM jako właściciel domeny połączeń.
- OM nie traktuje callbacku `new_call` jako gwarancji skutecznego połączenia; webhook ingest pozostaje fazą po MVP i musi zostać ustabilizowany danymi z `GET /api/call` albo `GET /api/call/:id/details`.

### Commands & Events

#### Komendy

| Command ID | Cel |
|---|---|
| `phone_calls.call.ingest` | idempotentne przyjęcie callbacku z Tillio |
| `phone_calls.call.pull_details` | pobranie szczegółów połączenia z API Tillio |
| `phone_calls.call.attach_recording` | podpięcie nagrania do połączenia |
| `phone_calls.call.store_transcript` | zapis nowej wersji transkrypcji |
| `phone_calls.summary.generate` | wygenerowanie pierwszego podsumowania |
| `phone_calls.summary.regenerate` | ponowne wygenerowanie podsumowania |
| `phone_calls.service_ticket.link` | przypięcie istniejącego zlecenia serwisowego |
| `phone_calls.service_ticket.unlink` | odpięcie zlecenia serwisowego |
| `phone_calls.service_ticket.create_from_call` | utworzenie nowego zlecenia serwisowego z prefill |
| `phone_calls.user_setting.upsert` | zapis konfiguracji numeru użytkownika |
| `phone_calls.tillio_config.upsert` | zapis konfiguracji klienta Tillio |
| `phone_calls.summary.correct` | zapis ręcznej korekty danych podsumowania |

#### Zdarzenia

| Event ID | Kiedy emitowane |
|---|---|
| `phone_calls.call.received` | utworzono rekord połączenia |
| `phone_calls.call.updated` | zaktualizowano stan połączenia |
| `phone_calls.call.details_pulled` | pobrano szczegóły z API Tillio |
| `phone_calls.recording.attached` | podpięto nagranie |
| `phone_calls.transcript.stored` | zapisano wersję transkrypcji |
| `phone_calls.summary.generated` | zapisano nową wersję podsumowania |
| `phone_calls.summary.regenerated` | zapisano regenerowaną wersję podsumowania |
| `phone_calls.service_ticket.linked` | przypięto zlecenie serwisowe |
| `phone_calls.service_ticket.unlinked` | odpięto zlecenie serwisowe |
| `phone_calls.service_ticket.created` | utworzono zlecenie serwisowe z połączenia |

Wszystkie eventy muszą być deklarowane w `events.ts` przez `createModuleEvents(... as const)`.

## B) Definicje i obiekty domenowe

| Pojęcie | Definicja |
|---|---|
| Połączenie | Jeden rekord rozmowy telefonicznej przychodzącej lub wychodzącej zapisany w `phone_calls` |
| Artefakt połączenia | Nagranie, transkrypcja lub podsumowanie przypisane do połączenia |
| Wersja transkrypcji | Konkretna wersja tekstu rozmowy pochodząca z providera lub z regeneracji |
| Wersja podsumowania | Wynik analizy AI dla połączenia, z wersjonowaniem i statusem aktywna/archiwalna |
| Konfiguracja użytkownika | Powiązanie użytkownika OM z numerem, extension lub identyfikatorem agenta przekazywanym przez Tillio |
| Link serwisowy | Powiązanie połączenia z `service_ticket_id` |
| Snapshot rozmowy | Zbiór znormalizowanych danych z webhooku, zachowany na potrzeby audytu i diagnostyki |
| Konfiguracja klienta Tillio | Tenant-scoped konfiguracja integracyjna z tokenem klienta, pluginem operatora i nagłówkami środowiska |

## C) Role użytkowników i uprawnienia

### Role

- `superadmin`
- `admin`
- `dispatcher`
- `service_manager`
- `service_agent`
- `employee`

### ACL features

| Feature ID | Opis |
|---|---|
| `phone_calls.view` | przegląd listy i szczegółu połączeń |
| `phone_calls.recording.view` | odsłuch i pobieranie nagrań |
| `phone_calls.summary.view` | podgląd transkrypcji i podsumowań |
| `phone_calls.summary.regenerate` | ponowna generacja podsumowania |
| `phone_calls.summary.correct` | ręczna korekta danych AI |
| `phone_calls.service_ticket.link` | przypinanie i odpinanie zgłoszeń serwisowych |
| `phone_calls.service_ticket.create` | tworzenie nowej karty serwisowej z połączenia |
| `phone_calls.settings.manage` | konfiguracja numerów użytkowników i reguł integracji |
| `phone_calls.tillio.manage` | konfiguracja klienta Tillio i tokenów integracyjnych |
| `phone_calls.admin` | pełny dostęp administracyjny |

### Domyślne przypisanie

Założenie:
- `superadmin`: `phone_calls.*`
- `admin`: `phone_calls.*`
- `dispatcher`: `phone_calls.view`, `phone_calls.summary.view`, `phone_calls.service_ticket.link`, `phone_calls.service_ticket.create`
- `service_manager`: `phone_calls.view`, `phone_calls.summary.view`, `phone_calls.summary.regenerate`, `phone_calls.summary.correct`, `phone_calls.service_ticket.link`
- `employee`: brak dostępu domyślnego

## D) Scenariusze end-to-end

### Happy path 1 — nowe połączenie i utworzenie zgłoszenia

1. Klient dzwoni na numer serwisowy.
2. Tillio udostępnia rozmowę w `GET /api/call`.
3. Użytkownik lub worker OM uruchamia ręczny pull/backfill z Tillio.
4. OM pobiera z API Tillio listę i opcjonalnie szczegóły rozmowy oraz nagranie, jeśli jest dostępne.
5. System tworzy rekord połączenia, mapuje numer telefonu i próbuje odnaleźć `customer_id` oraz `contact_id`.
6. W MVP AI nie uruchamia się automatycznie; transkrypcja i summary są fazą 2.
7. Dyspozytor otwiera szczegóły połączenia i wybiera `Utwórz nowe zgłoszenie serwisowe`.
8. Formularz karty serwisowej otwiera się z prefill na podstawie połączenia.
9. Użytkownik zatwierdza zmiany.
10. System tworzy `service_ticket`, zapisuje link do połączenia i log audytowy.

### Happy path 2 — przypięcie istniejącego zgłoszenia

1. Połączenie zostało już zapisane.
2. Użytkownik z listy połączeń wybiera `Przypnij istniejące zgłoszenie`.
3. System pokazuje wyszukiwarkę kart serwisowych ograniczoną do organizacji użytkownika.
4. Po wyborze karty system zapisuje link i emituje event `phone_calls.service_ticket.linked`.

### Happy path 3 — regeneracja podsumowania

1. Użytkownik otwiera szczegóły połączenia.
2. Wybiera `Regeneruj podsumowanie`.
3. System tworzy nową wersję podsumowania, nie nadpisując poprzedniej.
4. Użytkownik porównuje wersję aktywną z poprzednią i może oznaczyć wybraną jako aktywną.

### Edge cases

- brak rozpoznania klienta po numerze telefonu: system tworzy połączenie bez `customer_id` i `contact_id`, oznacza status `unresolved_identity`
- callback `new_call` bez realnego zestawienia rozmowy: system zapisuje event techniczny, ale nie musi jeszcze tworzyć finalnego rekordu biznesowego
- brak nagrania: połączenie jest widoczne, ale bez zakładki nagrania; transkrypcja może zostać dostarczona później
- brak transkrypcji: summary AI nie uruchamia się automatycznie
- wielokrotne dostarczenie tego samego webhooka: system nie tworzy duplikatu połączenia ani wersji artefaktów
- połączenie przerwane przed odebraniem: system zapisuje rekord z odpowiednim statusem i bez danych serwisowych
- użytkownik tworzy zgłoszenie z połączenia już przypiętego do innej karty: system blokuje akcję lub wymaga potwierdzonego prze-linkowania zgodnie z regułą jednolinkową MVP

## E) Wymagania funkcjonalne

### Konfiguracja użytkownika

1. System MUST udostępnić ekran konfiguracji numeru telefonu użytkownika.
2. System MUST pozwolić administratorowi przypisać użytkownikowi co najmniej jeden identyfikator telefonu: numer DID, numer wewnętrzny lub identyfikator agenta providera.
3. System MUST walidować unikalność aktywnego mapowania numeru w obrębie organizacji.
4. System MUST pozwolić oznaczyć jedno mapowanie jako domyślne.

### Konfiguracja klienta Tillio

5. System MUST udostępnić ekran konfiguracji klienta Tillio dla administratora.
6. System MUST zapisywać konfigurację klienta Tillio obejmującą co najmniej: `plugin`, `X-System`, `X-Tenant`, `X-Tenant-Domain`, `X-Api-Key`, `X-Token`.
7. System MUST traktować `X-Token` jako sekret i przechowywać go w formie szyfrowanej.
8. System MUST wymuszać niezmienność `X-System`, `X-Tenant` i `X-Tenant-Domain` dla aktywnego `X-Token`, chyba że administrator świadomie zrotuje konfigurację klienta.

### Rejestr połączeń

9. System MUST zapisywać każde znormalizowane połączenie jako osobny obiekt `phone_call`.
10. System MUST udostępnić listę połączeń z filtrowaniem po dacie, numerze telefonu, użytkowniku, statusie rozpoznania klienta, statusie linku serwisowego i kierunku połączenia.
11. System MUST umożliwić sortowanie listy połączeń malejąco po czasie zakończenia.
12. System MUST wyświetlać na liście co najmniej: numer rozmówcy, kierunek połączenia, czas rozpoczęcia, czas zakończenia, status, użytkownika/numer obsługujący, klienta, kontakt, status podsumowania i status linku serwisowego.
13. System MUST po ręcznej synchronizacji lub callbacku `call_finished` pobrać z API Tillio szczegóły połączenia przed oznaczeniem rekordu jako finalnego.
14. System MUST móc pobrać listę połączeń z API Tillio w celu backfillu lub ręcznej synchronizacji za zakres dat `from`/`to`.

### Szczegóły połączenia

15. Obiekt połączenia MUST przechowywać numer telefonu rozmówcy.
16. Obiekt połączenia MUST umożliwiać powiązanie z `customer_id`.
17. Obiekt połączenia MUST umożliwiać powiązanie z `contact_id`.
18. Obiekt połączenia MUST przechowywać lub referencjonować nagranie.
19. Obiekt połączenia SHOULD przechowywać transkrypcję w wersjonowanej formie w fazie 2.
20. Obiekt połączenia SHOULD przechowywać podsumowanie w wersjonowanej formie w fazie 2.
21. System SHOULD wyświetlać historię wersji transkrypcji i podsumowań dla połączenia w fazie 2.

### Integracja z kartą serwisową

22. Dla połączenia system MUST umożliwiać przypięcie istniejącej karty serwisowej.
23. Dla połączenia system MUST umożliwiać utworzenie nowej karty serwisowej.
24. Tworzenie nowej karty serwisowej MUST automatycznie uzupełniać formularz danymi z połączenia; transkrypcja i aktywne podsumowanie są dodatkowymi źródłami w fazie 2.
25. Połączenie MUST móc być powiązane z kartą serwisową przez `service_ticket_id`.
26. W MVP jedno połączenie MUST mieć co najwyżej jedną aktywną kartę serwisową.

### AI i podsumowania

27. System MUST potrafić zapisać podsumowanie dostarczone przez Tillio jako wersję źródłową typu `provider`.
28. System MUST automatycznie uruchamiać generację podsumowania po otrzymaniu kompletnej transkrypcji tylko wtedy, gdy Tillio nie dostarczył gotowego summary lub gdy konfiguracja tenantu wymaga summary OM.
29. System MUST umożliwiać ręczne ponowne wygenerowanie podsumowania.
30. Regeneracja MUST tworzyć nową wersję podsumowania, nie nadpisując wersji poprzedniej.
31. Podsumowanie MUST wyciągać dane serwisowe co najmniej: maszyna, adres, termin, opis problemu.
32. System MUST przechowywać confidence dla każdego kluczowego pola wyekstrahowanego przez AI.
33. System MUST umożliwiać ręczną korektę pól wyekstrahowanych przez AI bez utraty wersji źródłowej.

### Audyt i bezpieczeństwo

34. Każda akcja użytkownika na połączeniu MUST być audytowana.
35. Dostęp do nagrań MUST być kontrolowany osobnym uprawnieniem.
36. Dane połączeń MUST być izolowane tenantowo i organizacyjnie.
37. Dane dostępowe Tillio MUST być izolowane tenantowo i organizacyjnie.

## F) Reguły biznesowe i walidacje

1. `external_call_id` musi być unikalne w obrębie `(tenant_id, organization_id, provider_id)`.
2. Tylko jedno aktywne powiązanie użytkownika z danym numerem może istnieć w organizacji.
3. Połączenie może mieć zero lub jeden aktywny link do karty serwisowej w MVP.
4. Link do karty serwisowej może wskazywać wyłącznie rekord należący do tej samej organizacji.
5. Regeneracja podsumowania jest dozwolona tylko wtedy, gdy istnieje przynajmniej jedna wersja transkrypcji lub dostępne jest nagranie.
6. Ręczna korekta nie nadpisuje surowego wyniku AI; zapisuje warstwę `manualOverrides`.
7. Usunięcie połączenia fizycznego jest niedozwolone w MVP; dopuszczalne jest wyłącznie soft delete administracyjne.
8. Jeśli numer telefonu nie pasuje do żadnego klienta, system nie blokuje zapisu połączenia.
9. Jeśli AI nie osiągnie minimalnego progu jakości dla pola krytycznego, pole trafia do prefill jako puste z flagą `requires_review`.
10. `new_call` z Tillio może nie oznaczać faktycznie zrealizowanego połączenia i nie może samodzielnie ustawiać finalnego statusu biznesowego rozmowy.
11. Konfiguracja klienta Tillio musi zachować spójność nagłówków `X-System`, `X-Tenant` i `X-Tenant-Domain` z tokenem klienta.

### Walidacje wejścia

- wszystkie payloady API i callbacków muszą być walidowane przez Zod
- numery telefonu muszą być normalizowane do E.164, jeśli provider dostarcza wystarczające dane
- `pageSize` dla listy połączeń nie może przekroczyć `100`
- identyfikatory `customer_id`, `contact_id`, `service_ticket_id`, `attachment_id` muszą być UUID

## G) Model danych

### Zasady ogólne

Wszystkie encje scoped muszą zawierać:
- `id`
- `tenant_id`
- `organization_id`
- `created_at`
- `updated_at`
- opcjonalnie `deleted_at`

Cross-module links wyłącznie przez ID:
- `customer_id`
- `contact_id`
- `service_ticket_id`
- `user_id`
- `attachment_id`

### Encje

#### `phone_call_user_settings`

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `id` | uuid | tak | PK |
| `tenant_id` | uuid | tak | zakres tenant |
| `organization_id` | uuid | tak | zakres organizacji |
| `user_id` | uuid | tak | użytkownik Open Mercato |
| `provider_id` | text | tak | identyfikator źródła integracyjnego, np. `tillio_ringostat` |
| `phone_number` | text | nie | DID w E.164 |
| `extension` | text | nie | numer wewnętrzny |
| `agent_identifier` | text | nie | identyfikator agenta w centrali |
| `is_default` | boolean | tak | domyślne mapowanie |
| `is_active` | boolean | tak | aktywność wpisu |

#### `phone_call_tillio_configs`

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `id` | uuid | tak | PK |
| `tenant_id` | uuid | tak | zakres tenant |
| `organization_id` | uuid | tak | zakres organizacji |
| `plugin` | text | tak | operator/plugin Tillio |
| `system_key` | text | tak | wartość nagłówka `X-System` |
| `tenant_key` | text | tak | wartość nagłówka `X-Tenant` |
| `tenant_domain` | text | tak | wartość nagłówka `X-Tenant-Domain` |
| `api_key_encrypted` | text | tak | zaszyfrowany `X-Api-Key` |
| `client_token_encrypted` | text | tak | zaszyfrowany `X-Token` |
| `is_active` | boolean | tak | aktywna konfiguracja |
| `last_validated_at` | timestamptz | nie | ostatnia walidacja połączenia |

#### `phone_calls`

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `id` | uuid | tak | PK |
| `tenant_id` | uuid | tak | zakres tenant |
| `organization_id` | uuid | tak | zakres organizacji |
| `provider_id` | text | tak | identyfikator źródła integracyjnego |
| `external_call_id` | text | tak | unikalny identyfikator połączenia u providera |
| `external_conversation_id` | text | nie | identyfikator sesji lub wątku po stronie providera |
| `direction` | text enum | tak | `inbound`, `outbound`, `internal` |
| `status` | text enum | tak | `new_callback_received`, `ringing`, `answered`, `missed`, `failed`, `completed`, `recording_pending`, `transcript_pending`, `unresolved_identity` |
| `caller_phone_number` | text | tak | numer rozmówcy |
| `callee_phone_number` | text | nie | numer odbiorcy |
| `assigned_user_id` | uuid | nie | użytkownik OM skojarzony z połączeniem |
| `customer_id` | uuid | nie | link do klienta |
| `contact_id` | uuid | nie | link do kontaktu |
| `service_ticket_id` | uuid | nie | aktywnie przypięte zlecenie serwisowe |
| `recording_attachment_id` | uuid | nie | link do pliku nagrania |
| `active_transcript_version_id` | uuid | nie | aktualna transkrypcja |
| `active_summary_version_id` | uuid | nie | aktualne podsumowanie |
| `started_at` | timestamptz | tak | czas rozpoczęcia |
| `answered_at` | timestamptz | nie | czas odebrania |
| `ended_at` | timestamptz | nie | czas zakończenia |
| `duration_seconds` | integer | nie | długość rozmowy |
| `raw_snapshot` | jsonb | tak | znormalizowany snapshot zdarzenia |

#### `phone_call_transcript_versions`

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `id` | uuid | tak | PK |
| `tenant_id` | uuid | tak | zakres tenant |
| `organization_id` | uuid | tak | zakres organizacji |
| `phone_call_id` | uuid | tak | FK do `phone_calls` |
| `version_no` | integer | tak | numer wersji |
| `source` | text enum | tak | `provider`, `ai_regeneration`, `manual_import`, `tillio_pull` |
| `language_code` | text | nie | język rozmowy |
| `content` | text | tak | pełna transkrypcja |
| `speaker_segments` | jsonb | nie | segmenty mówców |
| `is_active` | boolean | tak | wersja aktywna |
| `quality_score` | numeric | nie | ocena jakości |

#### `phone_call_summary_versions`

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `id` | uuid | tak | PK |
| `tenant_id` | uuid | tak | zakres tenant |
| `organization_id` | uuid | tak | zakres organizacji |
| `phone_call_id` | uuid | tak | FK do `phone_calls` |
| `transcript_version_id` | uuid | nie | wersja transkrypcji użyta do generacji |
| `version_no` | integer | tak | numer wersji |
| `generation_type` | text enum | tak | `provider`, `automatic`, `manual_regeneration` |
| `summary_text` | text | tak | opisowe podsumowanie |
| `service_data` | jsonb | tak | struktura wyekstrahowanych danych serwisowych |
| `manual_overrides` | jsonb | nie | poprawki użytkownika |
| `prompt_version` | text | tak | wersja promptu |
| `model_name` | text | tak | model AI |
| `is_active` | boolean | tak | wersja aktywna |
| `quality_status` | text enum | tak | `draft`, `ready`, `requires_review`, `rejected` |

#### `phone_call_ingest_events`

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `id` | uuid | tak | PK |
| `tenant_id` | uuid | tak | zakres tenant |
| `organization_id` | uuid | tak | zakres organizacji |
| `provider_id` | text | tak | provider |
| `external_event_id` | text | tak | ID webhooka/eventu |
| `external_call_id` | text | nie | połączenie źródłowe |
| `event_type` | text | tak | typ eventu |
| `received_at` | timestamptz | tak | czas odbioru |
| `processed_at` | timestamptz | nie | czas przetworzenia |
| `status` | text enum | tak | `received`, `processed`, `ignored_duplicate`, `failed` |
| `payload` | jsonb | tak | surowy payload dla audytu technicznego |
| `error_message` | text | nie | ostatni błąd |

### Konfiguracja integracyjna Tillio

Tillio według dostarczonego PDF wymaga następujących nagłówków:
- `X-Api-Key`
- `X-System`
- `X-Tenant`
- `X-Tenant-Domain`
- `X-Token`

`X-Token` jest zwracany tylko przy utworzeniu konfiguracji klienta i musi być zachowany jako sekret. `X-System`, `X-Tenant` i `X-Tenant-Domain` nie mogą być zmieniane po uzyskaniu tokenu bez ponownej konfiguracji klienta.

### Relacje logiczne

- `phone_calls.assigned_user_id` -> `auth/users.id`
- `phone_calls.customer_id` -> `customers` przez FK ID
- `phone_calls.contact_id` -> `customers` przez FK ID
- `phone_calls.service_ticket_id` -> `service_tickets.service_tickets.id`
- `phone_calls.recording_attachment_id` -> `attachments`
- `phone_call_transcript_versions.phone_call_id` -> `phone_calls.id`
- `phone_call_summary_versions.phone_call_id` -> `phone_calls.id`

### Przykładowy obiekt JSON — połączenie

```json
{
  "id": "5ecf8b5e-2d2a-4b73-8e26-7bf5f8f0288c",
  "providerId": "tillio_ringostat",
  "externalCallId": "call_20260411_000123",
  "direction": "inbound",
  "status": "completed",
  "callerPhoneNumber": "+48600111222",
  "calleePhoneNumber": "+48221234567",
  "assignedUserId": "f98f2451-42ca-4863-b2fa-c66759a9fd87",
  "customerId": "3cd74cfd-f7e2-45fb-a9b9-7ee4ff42df6b",
  "contactId": "23ed7e6a-a342-4c2f-a14b-9f836c7fe0a2",
  "serviceTicketId": null,
  "recordingAttachmentId": "c3f9847b-9917-4f7e-8530-3957a28bd64a",
  "startedAt": "2026-04-11T09:10:00Z",
  "answeredAt": "2026-04-11T09:10:09Z",
  "endedAt": "2026-04-11T09:16:45Z",
  "durationSeconds": 396,
  "activeTranscriptVersionId": "ff4c2402-db66-4874-b93e-38c799ed8245",
  "activeSummaryVersionId": "03f89fe1-e407-4d97-b359-33f10465ac1f"
}
```

### Przykładowy obiekt JSON — `service_data`

```json
{
  "machine": {
    "label": "Koparka CAT 320D",
    "serialNumber": "CAT0320DABC12345",
    "confidence": 0.87,
    "requiresReview": false
  },
  "serviceAddress": {
    "label": "ul. Magazynowa 12, 05-500 Piaseczno",
    "confidence": 0.91,
    "requiresReview": false
  },
  "requestedDate": {
    "label": "2026-04-12",
    "confidence": 0.63,
    "requiresReview": true
  },
  "problemDescription": {
    "label": "Wyciek oleju z siłownika ramienia",
    "confidence": 0.93,
    "requiresReview": false
  }
}
```

## H) Integracja z API Tillio dla połączeń Ringostat

### Kontrakt integracyjny

Tillio MUST dostarczyć kontrakt integracyjny, który:
- pozwala OM skonfigurować klienta integracyjnego i przechowywać `X-Token`
- udostępnia endpoint listy połączeń z filtrami `from` / `to`
- udostępnia endpoint szczegółów połączenia
- udostępnia endpoint pobrania nagrania
- udostępnia endpoint zlecenia transkrypcji AI
- udostępnia endpoint zlecenia podsumowania AI
- w fazie po MVP dostarcza callback o nowym i zakończonym połączeniu

### Konfiguracja klienta Tillio

PDF Tillio dokumentuje model konfiguracji klienta:
- konfiguracja klienta jest tworzona przed użyciem endpointów `Call`
- request utworzenia konfiguracji nie wymaga `X-Token`
- odpowiedź zwraca `X-Token` tylko jednokrotnie
- dalsze endpointy `Call` wymagają `X-Token`
- konfiguracja zależy od pluginu/operatora

OM musi modelować tę konfigurację jako osobny zasób administracyjny tenant-scoped.

### Zdarzenia wejściowe

| Znormalizowany event | Obowiązkowość | Opis |
|---|---|---|
| `new_call` | Phase 2 | callback o nowym połączeniu przychodzącym |
| `call_finished` | Phase 2 | callback o zakończonym połączeniu |
| `sms_received` | N/A dla MVP | callback SMS poza zakresem tej specyfikacji |

Tillio PDF nie potwierdza callbacków `recording.ready` ani `transcript.ready`; te artefakty są pobierane przez osobne endpointy API po `call_finished`.

### Mapowanie pól Tillio -> model domenowy

Na podstawie PDF Tillio i kolekcji Bruno potwierdzone są różne payloady dla providerów. Implementacja MUST mieć normalizator per provider i nie może zakładać jednego kształtu `event/call`.

| Pole Tillio | Pole docelowe | Uwagi |
|---|---|---|
| Ringostat callback `uniqueid` | `phone_calls.external_call_id` / `phone_call_ingest_events.external_event_id` | dla prostego callbacku Ringostat |
| Ringostat callback `call_type` | `phone_calls.direction` | `in` -> `inbound`, `out` -> `outbound` |
| Ringostat callback `caller_number` | `phone_calls.caller_phone_number` | normalizacja do E.164 |
| Ringostat callback `dst` | `phone_calls.callee_phone_number` | normalizacja do E.164 |
| P4 callback `callSessionId` | `phone_calls.external_call_id` | stabilniejszy identyfikator rozmowy niż brakujące `event.id` |
| P4 callback `mainSessionId` / `globalSessionId` | `phone_calls.external_conversation_id` | identyfikator sesji/wątku |
| P4 callback `notificationType` | `phone_call_ingest_events.event_type` | `CALL_START`, `CALL_END` |
| P4 callback `recordingApiUrl` / `recordingWebUrl` | `phone_calls.raw_snapshot` oraz potencjalne źródło nagrania | nie logować pełnych URL w logach aplikacyjnych |
| Tillio `GET /api/call` item id | `phone_calls.external_call_id` | klucz idempotencji dla pull/backfill |
| Tillio `GET /api/call/:id/rec` | `attachments` + `phone_calls.recording_attachment_id` | pobranie nagrania w workerze |
| Tillio `POST /api/call/:id/trn` response | `phone_call_transcript_versions.content` | faza 2, endpoint wymaga `recordingUrl` wg kontraktu pluginu Ringostat |
| Tillio `POST /api/call/:id/sum` response | `phone_call_summary_versions.summary_text` / `service_data` | faza 2, endpoint wymaga `recordingUrl` |

### Retry, idempotencja, deduplikacja

- każdy webhook z Tillio musi być idempotentny po `external_event_id`, a gdy provider go nie dostarcza po deterministycznym hashu z `(provider, tenant, event_type, external_call_id, timestamp)`
- połączenie musi być idempotentne po `external_call_id`
- przetwarzanie eventu musi być transakcyjne: zapis `phone_call_ingest_events` oraz ewentualna mutacja `phone_calls` w jednym boundary
- eventy poza kolejnością muszą być obsłużone defensywnie; `call_finished` może nadejść bez użytecznego `new_call`
- callback `new_call` nie może tworzyć finalnego rekordu biznesowego bez późniejszego potwierdzenia po `call_finished` lub przez pull szczegółów
- wielokrotne pobranie tych samych szczegółów, nagrań lub transkrypcji nie może tworzyć duplikatów wersji przy identycznym checksum / payload hash
- system SHOULD wspierać ręczny backfill i ponowną synchronizację listy połączeń z Tillio po zakresie dat

### Obsługa błędów i braków danych

- błąd autoryzacji callbacku Tillio -> HTTP `401` lub `403`, dokładny kontrakt do potwierdzenia z Tillio
- błąd wywołania API Tillio z powodu nieprawidłowego `X-Token` -> oznaczenie konfiguracji klienta jako `invalid_credentials`
- błąd mapowania payloadu Tillio -> HTTP `202` lub `400` zgodnie z kontraktem retry Tillio, z logiem technicznym
- brak klienta po numerze -> połączenie zapisane z flagą `unresolved_identity`
- brak nagrania -> status `recording_pending`
- brak transkrypcji -> status `transcript_pending`
- timeout pobrania nagrania/transkrypcji -> retry przez worker z exponential backoff

### Przykładowy callback JSON — Ringostat `callNew` z Bruno

```json
{
  "uniqueid": "123456",
  "tenant": "voip.tests-s1.app.t.pc.pl",
  "provider": "Ringostat",
  "calldate": "2024-10-22 18:12:34",
  "call_type": "in",
  "caller_number": "+48123456789",
  "dst": "+48225987216"
}
```

### Endpointy Tillio wymagane przez OM

Na podstawie PDF Tillio OM musi przewidzieć integrację z kategoriami endpointów:
- konfiguracja klienta
- lista połączeń
- szczegóły połączenia
- pobranie nagrania
- wygenerowanie/pobranie transkrypcji AI przez `POST /api/call/:id/trn`
- wygenerowanie/pobranie podsumowania AI przez `POST /api/call/:id/sum`

Kolekcja Bruno potwierdza ścieżki dla Ringostat, natomiast dokładne response body dla listy/szczegółów zależy od danych operatora i musi być obsłużone defensywnie przez Zod schema z `passthrough`.

## I) Logika AI / podsumowania

### Kiedy i jak generowane jest podsumowanie

- automatycznie po zapisaniu kompletnej transkrypcji oznaczonej jako aktywna, jeśli brak gotowego summary z Tillio
- ręcznie na żądanie użytkownika z uprawnieniem `phone_calls.summary.regenerate`
- jeśli transkrypcja nie istnieje, a dostępne jest nagranie, system MAY uruchomić pipeline STT -> summary jako job asynchroniczny

### Wersjonowanie

- pierwsza generacja może pochodzić z Tillio jako wersja `provider` albo z OM jako wersja `automatic`
- każda regeneracja zwiększa `version_no`
- tylko jedna wersja podsumowania ma `is_active = true`
- poprzednie wersje pozostają nieusuwalne w celach audytowych
- ręczne korekty zapisują się w `manual_overrides`, nie w `summary_text` źródłowym

### Ekstrakcja danych serwisowych

AI musi próbować wyodrębnić co najmniej:
- `machine.label`
- `machine.serialNumber`
- `serviceAddress.label`
- `requestedDate.label`
- `problemDescription.label`
- `additionalNotes.label`

Dla każdego pola system przechowuje:
- wartość
- confidence
- `requiresReview`
- opcjonalnie źródłowy fragment transkrypcji

### Kontrola jakości

- próg `confidence < 0.75` dla `requestedDate` lub `serviceAddress` oznacza `requiresReview = true`
- brak któregokolwiek z pól krytycznych powoduje `quality_status = requires_review`
- użytkownik może ręcznie skorygować każde pole i zapisać korektę bez utraty wartości źródłowej
- UI musi rozróżniać pola:
  - dostarczone przez AI
  - poprawione ręcznie
  - puste / wymagające uzupełnienia

### Przykładowy request JSON — regeneracja podsumowania

```json
{
  "phoneCallId": "5ecf8b5e-2d2a-4b73-8e26-7bf5f8f0288c",
  "reason": "Zmiana promptu ekstrakcji danych serwisowych",
  "activateNewVersion": true
}
```

## J) UI/UX

### Ekran konfiguracji numeru

Ścieżka:
- `/backend/phone-calls/settings/users`

Wymagania UI:
- tabela mapowań użytkownik -> numer / extension / agent ID z Tillio
- akcje `Dodaj mapowanie`, `Edytuj`, `Dezaktywuj`
- walidacja konfliktów inline
- formularz oparty o `CrudForm` lub zgodny wzorzec guarded mutation

### Ekran konfiguracji Tillio

Ścieżka:
- `/backend/phone-calls/settings/tillio`

Wymagania UI:
- formularz konfiguracji klienta Tillio
- pola dla `plugin`, `X-System`, `X-Tenant`, `X-Tenant-Domain`
- bezpieczne zapisanie `X-Api-Key` i `X-Token`
- akcja `Zweryfikuj połączenie`
- informacja o tym, że zmiana nagłówków środowiska może unieważnić aktualny token klienta

### Ekran listy połączeń

Ścieżka:
- `/backend/phone-calls`

Wymagania UI:
- `DataTable` z keyset pagination
- page size domyślnie `25`, maksymalnie `100`
- filtry po dacie, numerze, kliencie, użytkowniku, statusie, statusie summary, statusie linku serwisowego
- szybkie akcje w wierszu:
  - `Szczegóły`
  - `Przypnij istniejące zgłoszenie`
  - `Utwórz nowe zgłoszenie`
  - `Regeneruj podsumowanie`

### Widok szczegółów połączenia

Ścieżka:
- `/backend/phone-calls/[id]`

Sekcje:
- nagłówek z metadanymi połączenia
- sekcja klient / kontakt
- odtwarzacz nagrania
- zakładka transkrypcji z historią wersji
- zakładka podsumowania z historią wersji i confidence
- sekcja linku serwisowego
- timeline zdarzeń technicznych i użytkownika

### Akcje serwisowe

#### `Przypnij istniejące zgłoszenie`

- modal z wyszukiwaniem `service_tickets`
- wyniki ograniczone do tej samej organizacji
- po sukcesie użytkownik wraca do szczegółu połączenia z potwierdzeniem

#### `Utwórz nowe zgłoszenie`

- otwiera formularz `service_tickets` z prefill
- użytkownik może przed zapisem skorygować dane AI
- po zapisie następuje redirect do nowej karty serwisowej lub szczegółu połączenia z linkiem

### i18n

Wszystkie stringi użytkownika muszą być dostarczone przez pliki `i18n/en.json` i `i18n/pl.json`.

## API Contracts

### `GET /api/phone-calls/calls`

- cel: lista połączeń
- auth: `requireAuth` + `requireFeatures(['phone_calls.view'])`
- pagination: MVP może używać standardowego `DataTable` page/pageSize zgodnego z lokalnym wzorcem; keyset jest optymalizacją fazy hardening
- query:

```json
{
  "page": 1,
  "pageSize": 25,
  "status": "completed",
  "callerPhoneNumber": "+48600111222",
  "assignedUserId": "f98f2451-42ca-4863-b2fa-c66759a9fd87",
  "hasServiceTicket": false
}
```

### `POST /api/phone-calls/sync/tillio`

- cel: ręczny backfill lub ponowna synchronizacja połączeń z Tillio
- auth: `phone_calls.tillio.manage`
- body:

```json
{
  "from": "2026-04-11 00:00",
  "to": "2026-04-11 23:59"
}
```

### `GET /api/phone-calls/calls/:id`

- cel: szczegóły połączenia z aktywnymi artefaktami i linkiem serwisowym
- auth: `phone_calls.view`

### `POST /api/phone-calls/calls/:id/regenerate-summary`

- cel: utworzenie nowej wersji podsumowania
- auth: `phone_calls.summary.regenerate`
- implementacja: command `phone_calls.summary.regenerate`

### `POST /api/phone-calls/calls/:id/link-service-ticket`

- cel: przypięcie istniejącej karty serwisowej
- auth: `phone_calls.service_ticket.link`
- body:

```json
{
  "serviceTicketId": "4f0cc710-f64c-4587-bf70-1196294ffdcc"
}
```

### `POST /api/phone-calls/calls/:id/create-service-ticket`

- cel: utworzenie nowej karty serwisowej z prefill
- auth: `phone_calls.service_ticket.create`
- body:

```json
{
  "confirmDataReview": true,
  "overrides": {
    "serviceAddress": "ul. Magazynowa 12, 05-500 Piaseczno",
    "requestedDate": "2026-04-12"
  }
}
```

### `PUT /api/phone-calls/user-settings/:id`

- cel: aktualizacja mapowania numeru użytkownika
- auth: `phone_calls.settings.manage`

### `PUT /api/phone-calls/settings/tillio`

- cel: zapis konfiguracji klienta Tillio
- auth: `phone_calls.tillio.manage`

### `POST /api/phone-calls/settings/tillio/verify`

- cel: walidacja konfiguracji klienta Tillio przez testowy odczyt API
- auth: `phone_calls.tillio.manage`

### Webhook Tillio — faza 2

- ścieżka: `/api/phone-calls/webhooks/tillio`
- Tillio odpowiada za dostarczenie callbacku zgodnego z uzgodnionym kontraktem
- mechanizm autoryzacji callbacku pozostaje do potwierdzenia z Tillio
- OM odpowiada za weryfikację autoryzacji callbacku Tillio, a następnie deleguje do `phone_calls.call.ingest`

Wszystkie route files MUST eksportować `openApi`.

## Tabela mapowania: połączenie/transkrypcja -> karta serwisowa

| Źródło | Pole źródłowe | Pole `service_ticket` | Reguła mapowania |
|---|---|---|---|
| Połączenie | `customer_id` | `customer_entity_id` | bezpośrednie kopiowanie do istniejącego pola |
| Połączenie | `contact_id` | `contact_person_id` | bezpośrednie kopiowanie do istniejącego pola |
| Połączenie | `caller_phone_number` | `description` lub przyszłe pole snapshotowe | MVP dopisuje kontekst do opisu, faza 2 może dodać dedykowane pole |
| Podsumowanie AI | `service_data.machine.label` | `machine_asset_id` tylko po dopasowaniu do zasobu | nie wpisywać tekstowego labela do UUID |
| Podsumowanie AI | `service_data.machine.serialNumber` | brak istniejącego pola | faza 2 wymaga pola snapshotowego albo lookupu assetu |
| Podsumowanie AI | `service_data.serviceAddress.label` | `address` | prefill adresu |
| Podsumowanie AI | `service_data.requestedDate.label` | `visit_date` | prefill terminu |
| Podsumowanie AI | `service_data.problemDescription.label` | `description` | główny opis zgłoszenia |
| Transkrypcja | `content` | brak istniejącego pola w MVP | trzymać w `phone_calls`, nie duplikować w `service_tickets` |
| Podsumowanie AI | `summary_text` | brak istniejącego pola w MVP | trzymać w `phone_calls`, prefill tylko wybranych pól |

## K) Wymagania niefunkcjonalne

### Bezpieczeństwo, RODO, retencja

- nagrania i transkrypcje są danymi wrażliwymi operacyjnie i muszą być traktowane jako dane ograniczonego dostępu
- nagrania muszą być przechowywane poza publicznym storage i udostępniane tylko przez autoryzowany URL
- retencja domyślna:
  - nagrania: `180 dni`
  - transkrypcje: `365 dni`
  - podsumowania i audit log: zgodnie z polityką biznesową, domyślnie `730 dni`
- retencja musi być konfigurowalna per tenant
- logi nie mogą zawierać sekretów providera ani pełnych signed URL do nagrań
- logi nie mogą zawierać `X-Api-Key` ani `X-Token`

### Audyt działań użytkownika

Audyt musi obejmować:
- odsłuch nagrania
- pobranie nagrania
- regenerację podsumowania
- ręczne korekty pól AI
- przypięcie i odpięcie zgłoszenia
- utworzenie nowego zgłoszenia z połączenia

### Wydajność i SLA

- lista połączeń dla 50k rekordów per tenant musi odpowiadać w p95 < 700 ms dla podstawowego filtrowania
- widok szczegółów połączenia w p95 < 1000 ms bez pobierania pliku nagrania
- webhook ingest endpoint powinien odpowiadać w p95 < 300 ms dla eventów bez pobierania artefaktów
- ciężkie operacje AI/STT muszą być przeniesione do workerów

### Monitoring i alerty

Alerty wymagane:
- nieudana walidacja konfiguracji Tillio
- wzrost błędów autoryzacji callbacków Tillio
- zalegające joby transkrypcji > 15 minut
- zalegające joby summary > 10 minut
- nieudane pobrania nagrań > 5 prób
- odsetek połączeń `unresolved_identity` powyżej ustalonego progu

## L) Kryteria akceptacji

### AC-01

Given administrator ma uprawnienie `phone_calls.settings.manage`
When zapisuje mapowanie użytkownika do numeru telefonu
Then system zapisuje konfigurację i blokuje duplikat aktywnego numeru w tej samej organizacji

### AC-02

Given administrator ma poprawne dane klienta Tillio
When zapisuje konfigurację i wykonuje walidację połączenia
Then system zapisuje konfigurację tenant-scoped i potwierdza poprawność dostępu do API Tillio

### AC-03

Given administrator uruchamia synchronizację Tillio dla zakresu dat
When API Tillio zwróci listę połączeń
Then system zapisuje lub aktualizuje rekordy połączeń idempotentnie

### AC-04

Given synchronizacja Tillio zwróci to samo połączenie drugi raz
When system rozpozna identyczne `external_call_id` w tej samej organizacji
Then nie powstaje drugi rekord ani zduplikowana mutacja

### AC-05

Faza 2:

Given połączenie ma nagranie i transkrypcję
When worker zakończy generację podsumowania albo Tillio zwróci gotowe summary
Then w szczegółach połączenia widoczne jest aktywne podsumowanie z polami serwisowymi i confidence

### AC-06

Faza 2:

Given użytkownik ma uprawnienie `phone_calls.summary.regenerate`
When wybierze akcję `Regeneruj podsumowanie`
Then system zapisze nową wersję podsumowania bez usunięcia poprzedniej

### AC-07

Given połączenie nie jest jeszcze powiązane z kartą serwisową
When użytkownik wybierze `Przypnij istniejące zgłoszenie`
Then system zapisze `service_ticket_id` i pokaże link do zgłoszenia

### AC-08

Given połączenie ma dane rozmówcy i opcjonalnie aktywne podsumowanie z danymi serwisowymi
When użytkownik wybierze `Utwórz nowe zgłoszenie`
Then formularz karty serwisowej otworzy się z uzupełnionymi polami z połączenia oraz, w fazie 2, z transkrypcji i podsumowania

### AC-09

Given użytkownik nie ma uprawnienia `phone_calls.recording.view`
When otworzy szczegóły połączenia
Then nie zobaczy ani nie pobierze nagrania

### AC-10

Given numer rozmówcy nie istnieje w CRM
When połączenie zostanie zapisane
Then system nie blokuje rejestracji połączenia i oznacza rekord jako wymagający identyfikacji

### AC-11

Faza 2:

Given callback `new_call` przyszedł z Tillio, ale połączenie nie zostało skutecznie zestawione
When nie pojawią się finalne szczegóły rozmowy z API Tillio
Then system nie traktuje takiego callbacku jako zakończonego połączenia biznesowego

### AC-12

Given połączenie jest już powiązane z kartą serwisową
When inny użytkownik próbuje utworzyć nowe zgłoszenie z tego połączenia
Then system blokuje akcję i wymaga najpierw odpięcia istniejącego linku

## M) Zakres testów

### Unit

- normalizacja rekordów Tillio `GET /api/call`
- normalizacja callbacków Tillio w fazie 2
- mapowanie numeru użytkownika
- walidacje konfiguracji Tillio i niezmienności nagłówków środowiska
- walidacje Zod dla API i callbacków fazy 2
- logika idempotencji
- wybór aktywnej wersji podsumowania
- mapowanie `service_data` -> payload karty serwisowej

### Integracyjne

- pełny pull/backfill `GET /api/call` -> upsert `phone_calls`
- pełny ingest `new_call` -> `call_finished` -> pull szczegółów w fazie 2
- tworzenie i odczyt `phone_calls`
- zapis i walidacja konfiguracji Tillio
- przypięcie istniejącej karty serwisowej
- utworzenie nowej karty serwisowej z połączenia
- ACL dla nagrań i podsumowań
- retencja i soft-delete

### E2E

- administrator konfiguruje klienta Tillio i numer użytkownika
- dyspozytor widzi listę połączeń i zakłada nowe zgłoszenie
- menedżer regeneruje summary i porównuje wersje
- użytkownik bez prawa do nagrania nie widzi playera

### UAT

- poprawność ekstrakcji maszyny, adresu i terminu na próbie rozmów referencyjnych
- ergonomia listy połączeń dla dispatcherów
- zgodność audit trail z oczekiwaniami operacyjnymi i RODO

### Wymagane testy integracyjne do wpisania do backlogu implementacyjnego

- `TC-PC-001` ingest kompletnego połączenia inbound
- `TC-PC-002` deduplikacja tego samego webhooka
- `TC-PC-003` utworzenie karty serwisowej z prefill
- `TC-PC-004` przypięcie istniejącej karty serwisowej
- `TC-PC-005` regeneracja podsumowania i zachowanie historii
- `TC-PC-006` blokada odtwarzania nagrania bez uprawnienia

## N) Ryzyka, założenia, kwestie otwarte

### Założenia

- Założenie: Tillio dostarcza stabilny `external_call_id` dla połączenia z Ringostat
- Założenie: Tillio potrafi dostarczyć nagranie przez `GET /api/call/:id/rec` albo przez URL w payloadzie providera
- Założenie: Tillio pozwala wygenerować transkrypcję i podsumowanie AI przez `POST /api/call/:id/trn` i `POST /api/call/:id/sum` z `recordingUrl`
- Założenie: moduł `service_tickets` nie musi być rozszerzany o pola snapshotowe w MVP; pełny kontekst pozostaje w `phone_calls`
- Założenie: klient akceptuje generyczny adapter providerowy przed wyborem konkretnej centrali

### Kwestie otwarte

1. Czy jedno połączenie ma w kolejnych fazach wspierać wiele linków do wielu kart serwisowych?
2. Czy Tillio ma dostarczać transkrypcję, czy OM ma wspierać niezależny pipeline STT?
3. Czy Tillio dostarcza gotowy mechanizm autoryzacji callbacków, czy potrzebna jest dodatkowa warstwa po IP allowlist / shared secret?
4. Czy numer użytkownika ma być mapowany 1:1, czy 1:N z regułami priorytetu zależnymi od kolejki?
5. Czy karta serwisowa ma przechowywać pełny snapshot transkrypcji, czy wyłącznie referencję do połączenia?
6. Czy OM ma wspierać import historycznych połączeń z Tillio przy pierwszym wdrożeniu?

## Risks & Impact Review

#### Duplikacja połączeń przez backfill lub retry webhooków
- **Scenario**: Pull/backfill lub provider ponawia wysyłkę eventów po timeoutach, a system tworzy wiele rekordów dla jednego połączenia.
- **Severity**: High
- **Affected area**: `phone_calls`, listy połączeń, linkowanie do kart serwisowych, raporty
- **Mitigation**: Idempotencja po `external_call_id`; w fazie webhooków dodatkowo po `external_event_id` albo deterministycznym hashu payloadu, tabela ingest eventów, transakcyjne przetwarzanie
- **Residual risk**: Pozostaje ryzyko błędnego mapowania, jeśli provider wyśle różne `external_call_id` dla jednej sesji biznesowej

#### Niepoprawna konfiguracja klienta Tillio
- **Scenario**: Administrator zapisuje błędne `X-Token` lub zmienia `X-System` / `X-Tenant` po wydaniu tokenu, przez co API `Call` przestaje działać.
- **Severity**: High
- **Affected area**: pobieranie list połączeń, szczegółów, nagrań, transkrypcji i podsumowań
- **Mitigation**: osobny zasób konfiguracji Tillio, walidacja po zapisie, blokada niespójnych zmian, alerting `invalid_credentials`
- **Residual risk**: Do czasu pełnego mechanizmu rotacji tokenów administrator może czasowo unieruchomić integrację

#### Callback `new_call` bez realnego połączenia
- **Scenario**: Tillio przekaże sygnał nowego połączenia, choć rozmowa nie została faktycznie zestawiona.
- **Severity**: Medium
- **Affected area**: jakość listy połączeń, UX dyspozytora, automatyzacje
- **Mitigation**: callback `new_call` traktowany jako event techniczny, finalizacja rekordu dopiero po `call_finished` i pull szczegółów
- **Residual risk**: W krótkim oknie czasowym użytkownik może widzieć rekord wstępny lub zdarzenie techniczne

#### Błędna ekstrakcja danych serwisowych przez AI
- **Scenario**: Model AI błędnie rozpoznaje adres lub termin i użytkownik zakłada kartę z nieprawidłowymi danymi.
- **Severity**: High
- **Affected area**: `service_tickets`, operacje terenowe, SLA serwisu
- **Mitigation**: Confidence, `requiresReview`, manual overrides, brak automatycznego zapisu karty bez akcji użytkownika
- **Residual risk**: Użytkownik może zaakceptować błędny prefill; ryzyko biznesowe pozostaje częściowo operacyjne

#### Wycieki danych nagrań lub transkrypcji
- **Scenario**: Nagrania są dostępne bez właściwej autoryzacji lub trafiają do logów.
- **Severity**: Critical
- **Affected area**: RODO, bezpieczeństwo danych, zaufanie klienta
- **Mitigation**: Osobne ACL do nagrań, signed URLs o krótkim TTL, maskowanie logów, brak przechowywania sekretów w payloadach API
- **Residual risk**: Nie eliminuje to ryzyka błędnej konfiguracji storage po stronie operatora

#### Niespójność między połączeniem a kartą serwisową
- **Scenario**: Utworzenie karty serwisowej powiedzie się częściowo lub link do połączenia nie zapisze się po awarii w połowie operacji.
- **Severity**: High
- **Affected area**: `phone_calls`, `service_tickets`, audyt
- **Mitigation**: Compound command `phone_calls.service_ticket.create_from_call` z jedną transakcją na część domenową i append-only historią
- **Residual risk**: Jeśli w przyszłości dojdą side-effecty zewnętrzne, rollback nie cofnie komunikacji poza OM

#### Kolejki AI/STT stają się wąskim gardłem
- **Scenario**: Duża liczba połączeń powoduje opóźnienia transkrypcji i summary.
- **Severity**: Medium
- **Affected area**: świeżość danych, UX dyspozytora
- **Mitigation**: Worker queue, retry z backoff, alerty backlogu, asynchroniczność ciężkich operacji
- **Residual risk**: W godzinach szczytu opóźnienia nadal mogą przekroczyć oczekiwania biznesowe bez odpowiedniej pojemności workerów

#### Cross-tenant data leak przez błędne lookupy klienta lub karty serwisowej
- **Scenario**: Lookup po numerze telefonu lub `service_ticket_id` nie filtruje `organization_id`.
- **Severity**: Critical
- **Affected area**: izolacja tenantów, zgodność prawna
- **Mitigation**: Każdy scoped query jawnie filtruje `organization_id`, compliance gate i testy integracyjne multi-tenant
- **Residual risk**: Ryzyko implementacyjne pozostaje do czasu pełnej walidacji testami

## O) Plan wdrożenia etapowego

### Faza 1 — MVP rejestru połączeń

- moduł `phone_calls`
- kontrakt `Tillio -> OM` dla pull/backfill `GET /api/call`
- konfiguracja klienta Tillio i bezpieczne przechowywanie tokenu
- konfiguracja numeru użytkownika
- lista i szczegóły połączeń
- zapis nagrania przez `attachments`
- podstawowe powiązanie z `customers`
- podstawowe powiązanie z `service_tickets`

### Faza 2 — Transkrypcje i summary AI

- tabela wersji transkrypcji
- tabela wersji summary
- zapis summary z Tillio oraz automatyczna generacja summary w OM jako fallback lub regeneracja
- confidence i flags `requiresReview`
- ręczna regeneracja summary

### Faza 3 — Integracja z `service_tickets`

- przypięcie istniejącego `service_ticket`
- tworzenie nowej karty z prefill
- snapshoty źródłowe w karcie serwisowej
- pełny audit trail od połączenia do zgłoszenia

### Faza 4 — Hardening operacyjny

- retencja i pruning
- alerting i dashboard operacyjny
- wsparcie dodatkowych providerów
- opcjonalny własny pipeline STT

## Implementation Plan

### Phase 1: Foundation / MVP

1. Utworzyć nowy moduł `phone_calls` w `src/modules/phone_calls/`.
2. Zdefiniować encje konfiguracji Tillio, połączeń, opcjonalnego ingest logu, ACL, setup, events i CRUD/API read routes.
3. Dodać klienta API Tillio do walidacji konfiguracji, utworzenia tokenu, pobrania listy połączeń i szczegółów.
4. Dodać ręczny endpoint synchronizacji `POST /api/phone-calls/sync/tillio`.
5. Dodać ekran konfiguracji Tillio, konfiguracji użytkownika i listę połączeń.
6. Dodać link/prefill do istniejącego modułu `service_tickets` bez addytywnych pól snapshotowych w MVP.

### Phase 2: Artifact Pipeline

1. Dodać ingest callbacków, tabelę idempotencji i logikę retry.
2. Rozszerzyć klienta API Tillio o pobieranie nagrań i artefaktów AI.
3. Zintegrować `attachments` dla nagrań.
4. Dodać wersjonowane transkrypcje i summary.
5. Uruchomić worker summary AI.

### Phase 3: Service Bridge

1. Rozszerzyć `service_tickets` o snapshotowe pola źródłowe tylko jeśli MVP pokaże, że prefill istniejących pól jest niewystarczający.
2. Dodać akcje `Przypnij istniejące zgłoszenie` i `Utwórz nowe zgłoszenie`.
3. Dodać audyt i pełne testy integracyjne.

### Phase 4: Hardening

1. Dodać retencję, pruning, alerty i health checks.
2. Zoptymalizować indeksy i keyset pagination.
3. Przygotować wsparcie dla kolejnych providerów.

## Migration & Compatibility

- Spec wprowadza nowy moduł i nowe API, więc zmiana jest addytywna.
- Nie zmienia istniejących endpointów `service_tickets`, `customers` ani `integrations`.
- Rozszerzenie `service_tickets` o snapshotowe pola, jeśli potrzebne w fazie 3, musi być addytywne.
- Import paths dla istniejących modułów pozostają bez zmian.
- Event IDs są nowe i nie naruszają istniejących kontraktów.

## Performance, Cache & Scale

- Lista połączeń używa keyset pagination zamiast OFFSET.
- Indeksy wymagane:
  - `(tenant_id, organization_id, ended_at desc, id desc)` dla listy
  - `(tenant_id, organization_id, external_call_id, provider_id)` dla idempotencji
  - `(tenant_id, organization_id, caller_phone_number)` dla lookupów
  - `(tenant_id, organization_id, service_ticket_id)` dla linków
- Brak cache dla detail call w MVP z uwagi na świeżość danych.
- Dopuszczalny krótki cache tenant-scoped dla lookupów numer -> customer/contact, TTL `30s`.
- Każdy write invaliduje tagi:
  - `phone_calls:list:{tenant}:{org}`
  - `phone_calls:detail:{tenant}:{org}:{callId}`
  - `service_tickets:detail:{tenant}:{org}:{serviceTicketId}` gdy zapisano link

## Final Compliance Report — 2026-04-11

### AGENTS.md Files Reviewed

- `AGENTS.md`
- `.ai/specs/AGENTS.md`
- `.ai/skills/spec-writing/SKILL.md`
- `src/modules/service_tickets/*` selected files for actual local module shape

### Compliance Matrix

| Rule Source | Rule | Status | Notes |
|-------------|------|--------|-------|
| `AGENTS.md` | Standalone app modules live under `src/modules/<id>` | Compliant | Spec wskazuje `src/modules/phone_calls`, nie `packages/core` |
| `AGENTS.md` | No direct ORM relationships between modules | Compliant | Spec używa wyłącznie FK ID do `customers`, `service_tickets`, `attachments` |
| `AGENTS.md` | Always filter by `organization_id` for tenant-scoped entities | Compliant | Jawnie opisane w modelu danych, API i ryzykach |
| `AGENTS.md` | API writes via command pattern | Compliant | Wszystkie mutacje opisane jako komendy |
| `AGENTS.md` | API route URLs are stable/additive-only | Compliant | Spec dodaje nowe endpointy, nie zmienia istniejących |
| `.ai/specs/AGENTS.md` | Every non-trivial spec includes TLDR, Overview, Problem Statement, Proposed Solution, Architecture, Data Models, API Contracts, Risks & Impact Review, Final Compliance Report, Changelog | Compliant | Wszystkie sekcje obecne |
| Local `service_tickets` module | Existing entity fields drive MVP prefill | Compliant | Spec mapuje do `customer_entity_id`, `contact_person_id`, `address`, `visit_date`, `description` |
| Tillio Bruno collection | Ringostat AI endpoints are `POST` and require `recordingUrl` | Compliant | Spec przesuwa AI artifact pipeline do fazy 2 |

### Internal Consistency Check

| Check | Status | Notes |
|-------|--------|-------|
| Data models match API contracts | Pass | Endpointy operują na encjach i wersjach opisanych w modelu |
| API contracts match UI/UX section | Pass | Wszystkie akcje UI mają odpowiadające endpointy |
| Risks cover all write operations | Pass | Sync, konfiguracja, linkowanie i tworzenie service ticket mają ryzyka |
| Commands defined for all mutations | Pass | Wszystkie mutacje mają jawne command IDs |
| Cache strategy covers all read APIs | Pass | Lista, detail i lookupi mają określoną strategię |

### Non-Compliant Items

- Pozostałe sekcje opisują webhooki i AI jako fazę 2; implementacja MVP nie może traktować ich jako scope fazy 1.
- Spec pozostaje w folderze `VOIP/` jako dostarczony materiał roboczy; przed długoterminowym utrzymaniem warto przenieść lub skopiować zaktualizowaną wersję do `.ai/specs/2026-04-11-voip-service-calls-integration.md` zgodnie z lokalną konwencją.

### Verdict

- **Conditionally approved for Phase 1 MVP**: ready for implementation of `phone_calls` + Tillio config/client + pull/backfill + `service_tickets` prefill/link. Webhooks, transcription and summary AI remain Phase 2.

## Changelog

### 2026-04-11
- Initial specification
- Updated after Tillio VoIP PDF review: callback model, Tillio client config, API pull flow, corrected assumptions
- Updated after local POC and repo review: target `src/modules/phone_calls`, bridge to `service_tickets`, pull/backfill MVP, AI/webhooks moved to Phase 2, Ringostat Bruno contract reflected.

### Review — 2026-04-11
- **Reviewer**: Agent
- **Security**: Passed
- **Performance**: Passed
- **Cache**: Passed
- **Commands**: Passed
- **Risks**: Passed
- **Verdict**: Conditionally approved for Phase 1 MVP
