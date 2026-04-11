## ADDED Requirements

### Requirement: Service protocol creation copies linked machines from the ticket
The system SHALL copy all active linked machines from a service ticket into protocol-owned records when a service protocol is created from that ticket. The copied protocol-machine records SHALL preserve the ticket-machine order, primary designation, and machine snapshot context present at protocol creation time.

#### Scenario: Protocol created from ticket with multiple machines
- **WHEN** a user creates a service protocol from a service ticket that has multiple linked machines
- **THEN** the protocol contains a corresponding machine record for each active linked machine on the ticket

#### Scenario: Protocol preserves primary machine designation
- **WHEN** one linked machine on the ticket is marked as primary
- **THEN** the created protocol marks the corresponding copied machine as primary

### Requirement: Service protocol creation copies planned machine parts
The system SHALL copy planned `ServiceTicketMachinePart` rows into protocol-owned machine-part records when a service protocol is created from a ticket. Each copied protocol part SHALL remain associated with the corresponding copied protocol-machine record.

#### Scenario: Planned parts copied per machine
- **WHEN** a ticket machine has planned spare parts at the time a protocol is created
- **THEN** the protocol contains copied part rows under the corresponding copied machine

#### Scenario: Machine without planned parts creates no copied parts
- **WHEN** a linked ticket machine has no planned spare parts
- **THEN** the created protocol includes the machine record without any copied part rows for that machine

### Requirement: Protocol data remains independent after creation
The system SHALL treat copied protocol machine records and copied protocol machine-part records as protocol-owned data. Changes made to the source ticket after protocol creation SHALL NOT mutate already-created protocol machine or protocol part records.

#### Scenario: Editing ticket after protocol creation does not rewrite protocol machine data
- **WHEN** a user updates linked machines or planned machine parts on a ticket after a protocol was already created
- **THEN** the existing protocol keeps its previously copied machine and part state unchanged

#### Scenario: New protocol reflects latest ticket state
- **WHEN** a user creates a new protocol from the same ticket after ticket-machine data changed
- **THEN** the newly created protocol copies the latest linked machine and planned part state from the ticket
