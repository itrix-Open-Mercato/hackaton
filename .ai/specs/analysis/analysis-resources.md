CUSTOMER MACHINES
Module Description
A register of specific machine and equipment instances installed at customer sites. The module is built on a two-level structure: Product (catalogue – definition of the machine type with its specification) and Asset (a specific machine with a serial number assigned to a customer, which inherits its specification from the Product). Each asset has a service history and associated documentation.
Metadata
Priority: High
Related modules: Customer OM, Service Request Card, Reports, Products (machine catalogue), Assets
View type: Asset list + asset card

ℹ Components are not a static list – they derive from the link to the Product (catalogue). The Product defines a default list of components, which the asset inherits and may extend with data specific to that individual unit.

Data Structure – 2 Levels
Product (catalogue) – Definition of the machine type: commercial name, technical specification, documentation / instruction list, default component list. Example: Machine type A.
Asset (unit) – A specific machine at a customer site: serial number, commissioning date, location, link to the Product. Upon selecting a Product, the asset automatically pulls in the full specification (manuals, components, parameters). Example: Machine type A, SN 001234, customer XYZ.
Features

List of all assets (specific machines) with filtering by: customer, type / product, status, location
Creating a new asset: select Product from catalogue → specification pulled in automatically
Asset card: identification data, serial number, dates, location, customer
Associated documentation and manuals – pulled from the Product, with the option to add documents specific to the individual unit
Service and inspection history for the given asset
Periodic inspection scheduling with alerts for upcoming due dates
Warranty status: active / expired / warranty claim
Machine photos and condition records at each service visit
Asset list import (CSV / Excel)

Key Asset (Unit) Fields
FieldDescriptionSerial numberUnique identifier of the specific unitProduct (type)Link to the Products catalogue – source of specificationName / modelInherited from the Product, editableCustomerLink to Customer OMLocationAddress where the machine is installed (may differ from the customer's registered address)Production dateFrom the machine's documentsCommissioning dateDate of the first commissioning serviceWarranty statusActive / Expired / Warranty claimNext inspectionAutomatically calculated based on the maintenance scheduleDocumentationManuals pulled from the Product + documents added to the specific unit