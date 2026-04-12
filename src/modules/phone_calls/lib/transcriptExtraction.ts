import { generateObject } from 'ai'
import { z } from 'zod'
import {
  resolveOpenCodeModel,
  resolveOpenCodeProviderApiKey,
  resolveOpenCodeProviderId,
  resolveFirstConfiguredOpenCodeProvider,
  type OpenCodeProviderId,
} from '@open-mercato/shared/lib/ai/opencode-provider'

// ---------------------------------------------------------------------------
// Output schema — structured ticket fields extracted from transcript/summary
// ---------------------------------------------------------------------------

export const ticketExtractionSchema = z.object({
  service_type: z
    .enum(['commissioning', 'regular', 'warranty_claim', 'maintenance'])
    .describe('Service type: commissioning (uruchomienie), regular (serwis regularny), warranty_claim (reklamacja gwarancyjna), maintenance (konserwacja)'),
  priority: z
    .enum(['normal', 'urgent', 'critical'])
    .describe('Priority: normal (standardowe), urgent (pilne), critical (krytyczne — awaria zatrzymuje produkcję)'),
  description: z
    .string()
    .describe('Detailed problem description extracted from the call — what is broken, symptoms, context'),
  address: z
    .string()
    .nullable()
    .describe('Service location / address mentioned in the call. Null if not mentioned.'),
  visit_date: z
    .string()
    .nullable()
    .describe('Requested visit date/time in ISO 8601 format (YYYY-MM-DDTHH:mm). Null if not mentioned.'),
  customer_name: z
    .string()
    .nullable()
    .describe('Customer company name or caller full name. Null if not mentioned.'),
  contact_name: z
    .string()
    .nullable()
    .describe('Contact person name at the service site. Null if not mentioned.'),
  contact_phone: z
    .string()
    .nullable()
    .describe('Contact phone number. Null if not mentioned.'),
  machine_info: z
    .string()
    .nullable()
    .describe('Machine type, model or serial number mentioned. Null if not mentioned.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score 0-1 representing extraction quality and completeness'),
})

export type TicketExtractionResult = z.infer<typeof ticketExtractionSchema>

// ---------------------------------------------------------------------------
// Provider resolution (same pattern as inbox_ops/lib/llmProvider.ts)
// ---------------------------------------------------------------------------

type AiModel = Parameters<typeof generateObject>[0]['model']
function asAiModel(model: unknown): AiModel {
  return model as AiModel
}

function resolveProviderId(): OpenCodeProviderId {
  const configured = process.env.OPENCODE_PROVIDER?.trim()
  if (configured) return resolveOpenCodeProviderId(configured)
  const first = resolveFirstConfiguredOpenCodeProvider()
  if (first) return first
  return resolveOpenCodeProviderId(undefined)
}

async function buildModel(providerId: OpenCodeProviderId, apiKey: string, modelId: string): Promise<AiModel> {
  switch (providerId) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      return asAiModel(createAnthropic({ apiKey })(modelId))
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai')
      return asAiModel(createOpenAI({ apiKey })(modelId))
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
      return asAiModel(createGoogleGenerativeAI({ apiKey })(modelId))
    }
    default:
      throw new Error(`Unsupported provider: ${providerId}`)
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `Jesteś asystentem serwisowym. Analizujesz transkrypcję lub streszczenie rozmowy telefonicznej i wyodrębniasz z niej ustrukturyzowane dane do stworzenia zlecenia serwisowego.

Zlecenie serwisowe zawiera:
- Typ serwisu: commissioning (uruchomienie/instalacja), regular (serwis regularny/przegląd), warranty_claim (reklamacja gwarancyjna/usterka w gwarancji), maintenance (konserwacja planowa)
- Priorytet: normal (standardowe), urgent (pilne — klient czeka), critical (krytyczne — maszyna stoi, produkcja zatrzymana)
- Opis problemu: szczegółowy opis usterki/zgłoszenia
- Adres serwisu: lokalizacja gdzie ma być wykonany serwis
- Termin wizyty: kiedy klient chce/potrzebuje serwisu
- Dane klienta i kontaktowe

Zasady:
- Analizuj dokładnie co zostało powiedziane. Nie wymyślaj informacji których nie ma.
- Jeśli jakiegoś pola nie ma w rozmowie — zwróć null.
- Opis problemu powinien być szczegółowy i zawierać wszystkie kluczowe informacje z rozmowy.
- Daty konwertuj do formatu ISO 8601 (YYYY-MM-DDTHH:mm). Jeśli brak godziny — użyj 09:00.
- Confidence: 0.9+ gdy wszystkie kluczowe dane są jasne, 0.5-0.9 gdy część danych brakuje, <0.5 gdy rozmowa jest niewyraźna lub brak kluczowych informacji.`
}

function buildUserPrompt(text: string, source: 'transcript' | 'summary'): string {
  const sourceLabel = source === 'transcript' ? 'TRANSKRYPCJA ROZMOWY' : 'STRESZCZENIE ROZMOWY'
  return `${sourceLabel}:\n\n${text}\n\nWyodrębnij dane do zlecenia serwisowego.`
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function extractTicketFieldsFromText(
  text: string,
  source: 'transcript' | 'summary',
  options?: { timeoutMs?: number; modelOverride?: string | null },
): Promise<TicketExtractionResult> {
  const providerId = resolveProviderId()
  const apiKey = resolveOpenCodeProviderApiKey(providerId)
  if (!apiKey) {
    throw new Error(`Missing API key for provider "${providerId}"`)
  }

  const modelConfig = resolveOpenCodeModel(providerId, {
    overrideModel: options?.modelOverride ?? process.env.INBOX_OPS_LLM_MODEL ?? null,
  })

  const model = await buildModel(providerId, apiKey, modelConfig.modelId)
  const timeoutMs = options?.timeoutMs ?? 60_000

  const operation = generateObject({
    model,
    schema: ticketExtractionSchema,
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(text, source),
    temperature: 0,
  })

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`LLM extraction timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })

  try {
    const result = await Promise.race([operation, timeoutPromise])
    return result.object
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

export function isLlmConfigured(): boolean {
  const providerId = resolveProviderId()
  return Boolean(resolveOpenCodeProviderApiKey(providerId))
}
