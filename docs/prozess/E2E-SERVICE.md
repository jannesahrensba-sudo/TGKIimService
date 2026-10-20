# Serviceprozess End-to-End (SAP-Standard heute, mit In-House Service)

> Automatisch erzeugt aus `model/` mit `npm run docs` – nicht von Hand bearbeiten.

Ganzheitlicher Serviceprozess vom ersten Kundenkontakt bis zum finanziellen Abschluss, wie ihn SAP heute im Standard abbildet: SAP Service Cloud V2 (Case Management), SAP S/4HANA Service (Garantie/Vertrag, Angebot, Serviceauftrag, In-House Service, Rückmeldung, Faktura), S/4HANA-Logistik (Retoure, Wareneingang, Auslieferung) und SAP Field Service Management (Disposition, mobile Durchführung). Die In-House-Strecke folgt In-House Service 2.0 (ab 2023 FPS02, Begriffe ab Release 2025).

**Abgrenzung:** Reaktiver Service (Störung/Anfrage) mit zwei Abwicklungsarten: In-House Service (Gerät wird eingesendet) und Field Service (Einsatz vor Ort). Nicht im Detail: Serviceverträge/Wartungsplanung, Service with Advanced Execution (EAM), Intercompany – als Hinweise an den Schritten.

| ID | Schritt | Lane (Rolle) | Bereich | SAP-Agenten | Abdeckung | Lücken | Marker |
|---|---|---|---|---|---|---|---|
| E03 | Interaktion erfassen, Kunde & Equipment identifizieren | Kundenservice (Service Agent) | Case Management | Case Preparation Agent (Lab Preview); Equipment Enrichment Agent (Lab Preview); Equipment Insights Agent (Lab Preview); Sentiment / Topic Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| E04 | Case anlegen, klassifizieren & priorisieren | Kundenservice (Service Agent) | Case Management | Case Classification Agent (Verfügbar); Case Preparation Agent (Lab Preview); Case Processing Agent (Lab Preview); Escalation Agent (Lab Preview); Sentiment / Topic Agent (Lab Preview) | Agent verfügbar | – | SAP-Standard |
| E05 | Lösung recherchieren (Wissen, Historie, Garantie) | Kundenservice (Service Agent) | Case Management | Case Summary (Joule) (Verfügbar); Q&A Agent (Verfügbar); Case Action Recommendation Agent (Lab Preview); Case Processing Agent (Lab Preview); Coaching Agent (Lab Preview); Knowledge Content Retrieval Agent (Lab Preview) | Agent verfügbar | – | SAP-Standard |
| E07 | Lösung mitteilen & Case lösen | Kundenservice (Service Agent) | Case Management | Knowledge Creation Agent (Verfügbar); Compliance Agent (Lab Preview); Digital Service Agent (Lab Preview) | Agent verfügbar | – | SAP-Standard |
| E09 | Serviceeinsatz anstoßen (Folgebeleg in S/4HANA Service) | Kundenservice (Service Agent) | Case Management | Service Notification Initiation Agent (Lab Preview); Service Order Preparation Agent (Lab Preview) | Agent geplant | – | Zu verifizieren |
| E10 | Garantie & Vertrag prüfen (Entitlement) | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | Service Contract Performance Agent (Lab Preview); Warranty Coverage Check Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| E12 | Retourenauftrag & In-House Service anlegen | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | In-house service initiation (KI-Funktion) (Verfügbar); In-House Service Processing Agent (Geplant) | Agent verfügbar | – | SAP-Standard |
| E13 | Gerät empfangen & Wareneingang buchen | Logistik & Wareneingang (Shipping / Receiving Specialist) | Serviceplanung & -abwicklung | In-house service initiation (KI-Funktion) (Verfügbar); In-House Service Processing Agent (Geplant) | Agent verfügbar | GAP-02 | SAP-Standard |
| E14 | Eingangsprüfung (Inspection) | Logistik & Wareneingang (Shipping / Receiving Specialist) | Serviceplanung & -abwicklung | In-House Service Processing Agent (Geplant); Equipment Enrichment Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| E15 | Vorprüfung (Precheck) je Serviceobjekt | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | Equipment Insights Agent (Lab Preview) | Agent geplant | GAP-01, GAP-02 | SAP-Standard |
| E18 | Serviceangebot erstellen & versenden | Service-Vertrieb (Service Sales) | Serviceplanung & -abwicklung | Service Quotation Optimization Agent (Geplant); Service Sales Agent (Lab Preview); Service Scope Recommendation Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| E20 | Serviceauftrag (Reparatur) anlegen, planen & freigeben | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | Joule für Serviceaufträge (Verfügbar); AI assisted Service Monitor (Operation Monitoring & Resolution / Service Control Tower) (Lab Preview); Service Order Planning and Operations Agent (Lab Preview); Service Scope Recommendation Agent (Lab Preview); Service Template Agent (WIP (Kick-off)) | Agent verfügbar | GAP-05 | SAP-Standard |
| E21 | Ersatzteile reservieren / beschaffen | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | Service Order Planning and Operations Agent (Lab Preview); Parts Logistics Monitor / Advance Shipment Monitor (WIP (Kick-off)) | Agent geplant | GAP-07 | SAP-Standard |
| E22 | Reparatur in der Werkstatt durchführen | Techniker (Werkstatt & vor Ort) (Service Technician) | Durchführung | Technician Briefing Agent (Lab Preview); Work Execution Agent (Lab Preview) | Agent geplant | GAP-02, GAP-03 | SAP-Standard |
| E23 | Zeiten & Material rückmelden | Techniker (Werkstatt & vor Ort) (Service Technician) | Rückmeldung & Abschluss | Service Debriefing Agent (Lab Preview); Service Confirmation Agent (WIP (Kick-off)) | Agent geplant | – | SAP-Standard |
| E24 | Abschließen & zur Fakturierung freigeben | Serviceplanung (Service Planner) | Rückmeldung & Abschluss | Billing Orchestration Agent (Lab Preview); Warranty Claim Agent (WIP (Kick-off)) | Agent geplant | – | SAP-Standard |
| E26 | Serviceobjekt zurücksenden (Auslieferung & Warenausgang) | Logistik & Wareneingang (Shipping / Receiving Specialist) | Rückmeldung & Abschluss | In-House Service Processing Agent (Geplant) | Agent geplant | GAP-02 | SAP-Standard |
| E27 | Serviceobjekt & In-House Service abschließen | Serviceplanung (Service Planner) | Rückmeldung & Abschluss | In-House Service Processing Agent (Geplant) | Agent geplant | – | SAP-Standard |
| F01 | Serviceauftrag anlegen & freigeben | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | Joule für Serviceaufträge (Verfügbar); Service Order Planning and Operations Agent (Lab Preview); Service Template Agent (WIP (Kick-off)) | Agent verfügbar | GAP-05, GAP-06 | SAP-Standard |
| F02 | Serviceauftrag an SAP FSM übertragen | Serviceplanung (Service Planner) | Serviceplanung & -abwicklung | – | Ohne Agent | – | SAP-Standard |
| F03 | Einsatz planen & disponieren (Skills, Gebiet, Route) | Disposition (Service Dispatcher) | Einsatzplanung & Disposition | Field Service Dispatcher Agent (Verfügbar); Joule in SAP FSM (Disponent) (Verfügbar); AI assisted Service Monitor (Operation Monitoring & Resolution / Service Control Tower) (Lab Preview); Autonomous Crew Planner/Manager Agent (Lab Preview); Resource Reservations Management Agent (Lab Preview); Scheduling Policy Management Agent (Lab Preview); Service and Maintenance Dispatching Agent (Lab Preview); Service and Maintenance Workload and Capacity Optimization Agent (Lab Preview) | Agent verfügbar | – | SAP-Standard |
| F04 | Termin bestätigen & Kunden informieren | Disposition (Service Dispatcher) | Einsatzplanung & Disposition | Journey Agent (Lab Preview); Service and Maintenance Dispatching Agent (Lab Preview) | Agent geplant | – | Zu verifizieren |
| F05 | Einsatz vorbereiten (Briefing, Teile an Bord) | Techniker (Werkstatt & vor Ort) (Service Technician) | Durchführung | Technician Briefing Agent (Lab Preview) | Agent geplant | – | Abgeleitet |
| F06 | Arbeit vor Ort durchführen & dokumentieren | Techniker (Werkstatt & vor Ort) (Service Technician) | Durchführung | Work Execution Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| F07 | Rückmeldung an S/4HANA (Servicerückmeldung) | Techniker (Werkstatt & vor Ort) (Service Technician) | Rückmeldung & Abschluss | Service Debriefing Agent (Lab Preview); Service Confirmation Agent (WIP (Kick-off)) | Agent geplant | – | SAP-Standard |
| F08 | Ersatz- und Altteile zurückführen | Logistik & Wareneingang (Shipping / Receiving Specialist) | Rückmeldung & Abschluss | Service Parts Return Agent (Lab Preview) | Agent geplant | – | Abgeleitet |
| B01 | Fakturaanforderung prüfen & Faktura erstellen | Fakturierung & Finanzen (Finance Expert) | Rückmeldung & Abschluss | Billing Orchestration Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| B02 | Kosten & Erlöse abrechnen | Fakturierung & Finanzen (Finance Expert) | Rückmeldung & Abschluss | Settlement Agent (Lab Preview) | Agent geplant | – | SAP-Standard |
| C01 | Case abschließen & Kunden informieren | Kundenservice (Service Agent) | Case Management | Journey Agent (Lab Preview) | Agent geplant | – | Abgeleitet |
| C02 | Service auswerten: Qualität, Profitabilität, Folgegeschäft | Serviceplanung (Service Planner) | Rückmeldung & Abschluss | Knowledge Creation Agent (Verfügbar); AI assisted Service Monitor (Operation Monitoring & Resolution / Service Control Tower) (Lab Preview); Knowledge Content Administration Agent (Lab Preview); Maintenance Plan Creation Agent (Lab Preview); Service Contract Lifecycle Renewal Agent (Lab Preview); Service Contract Performance Agent (Lab Preview); Service Sales Agent (Lab Preview) | Agent verfügbar | GAP-04 | Abgeleitet |

## Schritte im Detail

### E03 Interaktion erfassen, Kunde & Equipment identifizieren

Service Agent erfasst die Interaktion im Customer Hub, identifiziert Kunde, Ansprechpartner und betroffenes Equipment (registriertes Produkt) und sieht die Historie.
- Objekte: Interaktion, Geschäftspartner, Equipment / Registriertes Produkt
- Apps/UI: Customer Hub (Service Cloud V2)
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li) · [CX Today – SAP Adds Preconfigured AI Agents to Its CX AI Toolkit](https://cxtoday.com/sap-adds-preconfigured-ai-agents-to-its-cx-ai-toolkit)

### E04 Case anlegen, klassifizieren & priorisieren

Case mit Kategorie, Priorität und SLA anlegen; Routing an das zuständige Team. Case-Kategorisierung kann aus historischen Cases gelernt werden.
- Objekte: Case, SLA
- Quellen: [SAP – Joule Agents: Case Classification Agent](https://www.sap.com/assetdetail/2026/01/e4e28630-397f-0010-bca6-c68f7e60039b.html) · [CX Today – SAP Adds Preconfigured AI Agents to Its CX AI Toolkit](https://cxtoday.com/sap-adds-preconfigured-ai-agents-to-its-cx-ai-toolkit)

### E05 Lösung recherchieren (Wissen, Historie, Garantie)

Wissensdatenbank, Case- und Gerätehistorie sowie Garantie-/Vertragsstatus prüfen; Antwort an den Kunden vorbereiten.
- Objekte: Wissensartikel, Case-Historie
- Quellen: [CX Today – SAP Adds Preconfigured AI Agents to Its CX AI Toolkit](https://cxtoday.com/sap-adds-preconfigured-ai-agents-to-its-cx-ai-toolkit) · [SAP – Service Cloud V2 Case Summary (Joule Premium for CX)](https://www.sap.com/products/crm/service-cloud-version-2-case-summary.html)

### E07 Lösung mitteilen & Case lösen

Antwort bzw. Lösung an den Kunden senden, Case auf gelöst setzen.
- Objekte: Case, E-Mail
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### E09 Serviceeinsatz anstoßen (Folgebeleg in S/4HANA Service)

Aus dem Case wird der Folgebeleg in S/4HANA Service vorbereitet (Serviceanfrage oder Serviceauftrag) – inkl. Kunde, Equipment, Schadensbild.
- Objekte: Case, Serviceanfrage, Serviceauftrag
- **Hinweis:** Integrationsszenario Service Cloud V2 → S/4HANA Service (Folgebeleg aus Case) für die Zielrelease prüfen.
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### E10 Garantie & Vertrag prüfen (Entitlement)

Garantiefindung (Garantie-Prüfprofil, Mastergarantie am Equipment; ab 2025 FPS0 auch abgelaufene/datumsbasierte Garantien und Übersteuern) und Servicevertragsfindung (Auftraggeber, VkOrg/VtWeg, Gültigkeit) – bestimmt Kostenpflicht und Konditionen.
- Objekte: Garantie, Servicevertrag, Equipment
- Scope Items: 426 / 3MO (Serviceverträge)
- Quellen: [SAP Blog – Warranty Determination in SAP S/4HANA Service Orders](https://blogs.sap.com/2020/03/05/warranty-determination-in-sap-s-4hana-service-orders/) · [SAP Learning – Improved Warranty Determination (Private Edition 2025 FPS0)](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/working-with-improved-warranty-determination-in-service-management_c9ac3cac-4516-4420-b3a1-2a087a89b745) · [SAP Learning – Service Contracts (Vertragsfindung im Serviceauftrag)](https://learning.sap.com/courses/implementing-sap-s-4hana-cloud-public-edition-service-management-br/creating-service-contracts_c526e5c2-f2bd-4653-a4eb-d4df5e9f180f)

### E12 Retourenauftrag & In-House Service anlegen

Retourenauftrag mit Folgeaktivität „In-House Service fortführen“ und In-House Service mit Serviceobjekten anlegen (Massenaktionen möglich). Alternative: In-House Service entsteht automatisch beim Wareneingang/Prüfung oder beim Sichern eines Angebots mit Serviceobjekt.
- Objekte: Retourenauftrag, In-House Service, Serviceobjekt
- Apps/UI: Manage In-House Services, Manage In-House Service Objects
- Scope Items: 3XK (Public Cloud)
- **Hinweis:** Fiori-App-IDs (F7695 / F4025) in den Quellen widersprüchlich – im Fiori Apps Reference Library prüfen.
- Quellen: [SAP Learning – Integration zwischen In-House Repair und Logistik](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-an-in-house-repair-and-logistics_c99315c6-6beb-487c-9859-7001d606dcef) · [SAP Learning – Identifying New Features of In-House Service (2025)](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/identifying-new-features-of-in-house-service_ed288fe7-0ad3-4788-abec-adf6ec312612) · [SAP Community – In-House Repair with Advanced Execution (Private Edition 2023)](https://community.sap.com/t5/supply-chain-management-blog-posts-by-sap/in-house-repair-with-advanced-execution-sap-s-4hana-cloud-private-edition/ba-p/13788144)

### E13 Gerät empfangen & Wareneingang buchen

Shipping Specialist bucht den Wareneingang zum Retourenauftrag; Kundenretouren können auf Kundensonderbestand gebucht werden (2025). Serviceobjekt: „Received by Service Center“.
- Objekte: Retourenlieferung, Wareneingang, Kundensonderbestand
- Quellen: [SAP Learning – Integration zwischen In-House Repair und Logistik](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-an-in-house-repair-and-logistics_c99315c6-6beb-487c-9859-7001d606dcef) · [SAP Learning – New Features of In-House Service in 2025 FPS1 (Intercompany, Transfer)](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/identifying-new-features-of-in-house-service-in-2025-fps1_bf947215-90c3-4891-92f1-622362db476d)

### E14 Eingangsprüfung (Inspection)

Receiving Specialist prüft das Gerät; mit „Material Received“ und Prüfergebnis legt das System den In-House Service automatisch an. Transfer an ein anderes Service Center (auch Intercompany ab 2025 FPS1) möglich.
- Objekte: Prüfergebnis, Serviceobjekt
- Quellen: [SAP Learning – Integration zwischen In-House Repair und Logistik](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-an-in-house-repair-and-logistics_c99315c6-6beb-487c-9859-7001d606dcef) · [SAP Learning – New Features of In-House Service in 2025 FPS1 (Intercompany, Transfer)](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/identifying-new-features-of-in-house-service-in-2025-fps1_bf947215-90c3-4891-92f1-622362db476d)

### E15 Vorprüfung (Precheck) je Serviceobjekt

Je Serviceobjekt entscheiden: reparieren oder unrepariert an den Kunden zurück (dann kein Serviceauftrag). Kostenpflichtige Diagnose möglich.
- Objekte: Serviceobjekt
- Apps/UI: Perform Prechecks
- **Hinweis:** Verschrottungs-/Austauschentscheidung als eigene Option in keiner Quelle gefunden (OFFEN).
- Quellen: [SAP Help – Perform Prechecks](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/f76b69ede70d47ce8edea731a17c41c6.html) · [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c)

### E18 Serviceangebot erstellen & versenden

Serviceangebot (Festpreis oder Aufwand, mit Versionen) für die Serviceobjekte erstellen; ist ein Serviceobjekt enthalten, wird der In-House-Service-Beleg beim Sichern verknüpft bzw. angelegt.
- Objekte: Serviceangebot, Festpreisvariante
- Quellen: [SAP Community – In-House Repair with Advanced Execution (Private Edition 2023)](https://community.sap.com/t5/supply-chain-management-blog-posts-by-sap/in-house-repair-with-advanced-execution-sap-s-4hana-cloud-private-edition/ba-p/13788144) · [SAP Learning – Processing an In-House Repair (S/4HANA, Private Edition)](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/processing-an-in-house-repair)

### E20 Serviceauftrag (Reparatur) anlegen, planen & freigeben

Je Serviceobjekt ein Serviceauftrag; Servicemitarbeiter, Termine und Ersatzteilpositionen planen, Auftrag freigeben. Alternative: Service with Advanced Execution (Ausführungsauftragsposition → abrechenbarer Instandhaltungsauftrag).
- Objekte: Serviceauftrag, Serviceauftragsvorlage
- Apps/UI: Manage Service Orders, Plan Repairs
- Scope Items: 3XK, 3D2
- **Hinweis:** App-Namen „Plan Repairs“/„Manage Service Orders“ je Release prüfen.
- Quellen: [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c) · [SAP Learning – Processing an In-House Repair (S/4HANA, Private Edition)](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/processing-an-in-house-repair) · [SAP Learning – Configuring the Service with Advanced Execution Scenario](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/configuring-the-service-with-advanced-execution-scenario)

### E21 Ersatzteile reservieren / beschaffen

Bei Freigabe entsteht für Ersatzteilpositionen automatisch eine Bestellanforderung bzw. Reservierung.
- Objekte: Reservierung, Bestellanforderung
- Quellen: [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c)

### E22 Reparatur in der Werkstatt durchführen

Techniker im Service Center führt die Reparatur am Serviceobjekt aus (Serviceauftrag in S/4HANA; Ausführung in EAM bei Advanced Execution).
- Objekte: Serviceauftrag, Serviceobjekt
- Quellen: [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c)

### E23 Zeiten & Material rückmelden

Servicerückmeldung je Auftragsposition (Zeit, Ersatzteile, Spesen); Buchungen nach Controlling.
- Objekte: Servicerückmeldung
- Quellen: [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c)

### E24 Abschließen & zur Fakturierung freigeben

Rückmeldungen prüfen, Serviceauftrag abschließen (nur abgeschlossene Aufträge sind fakturierbar), Freigabe zur Fakturierung – erzeugt die Fakturaanforderung.
- Objekte: Serviceauftrag, Fakturaanforderung
- Apps/UI: Prepare for Billing
- Quellen: [SAP Learning – Processing an In-House Repair (S/4HANA, Private Edition)](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/processing-an-in-house-repair) · [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c)

### E26 Serviceobjekt zurücksenden (Auslieferung & Warenausgang)

Auslieferung zum Retourenauftrag anlegen (z. B. über „Prepare for Billing“) und Warenausgang buchen; Retourenauftrag ohne Erstattung (No Refund) abschließen.
- Objekte: Auslieferung, Warenausgang, Retourenauftrag
- Apps/UI: Prepare for Billing
- Quellen: [SAP Learning – Integration zwischen In-House Repair und Logistik](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-an-in-house-repair-and-logistics_c99315c6-6beb-487c-9859-7001d606dcef)

### E27 Serviceobjekt & In-House Service abschließen

Serviceobjekt auf „Abgeschlossen“ setzen; In-House Service beenden.
- Objekte: Serviceobjekt, In-House Service
- Apps/UI: Manage In-House Service Objects
- Quellen: [SAP Learning – Processing an In-House Repair (S/4HANA, Private Edition)](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/processing-an-in-house-repair)

### F01 Serviceauftrag anlegen & freigeben

Serviceauftrag (ggf. aus Serviceanfrage, Angebot, Vorlage oder Vertrag) mit Positionen anlegen und freigeben.
- Objekte: Serviceauftrag, Serviceanfrage, Serviceauftragsvorlage
- Apps/UI: Manage Service Orders
- Scope Items: 3D2
- Quellen: [SAP Learning – Service Order Processing with SAP Field Service Management (49X)](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/introducing-service-order-processing-with-sap-field-service-management_fa46a4a7-9cc2-437c-8156-34bdae29c118)

### F02 Serviceauftrag an SAP FSM übertragen

Freigegebener Serviceauftrag wird an SAP Field Service Management repliziert (Scope Item 49X, Zusatzlizenz FSM).
- Objekte: Serviceauftrag, Service Call / Aktivität (FSM)
- Scope Items: 49X
- Quellen: [SAP Learning – Integration S/4HANA Service und SAP FSM](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-sap-s-4hana-cloud-public-edition-service-and-sap-field-service-management_dc38c915-6c25-4a8d-9b86-a5cbe0e2a100)

### F03 Einsatz planen & disponieren (Skills, Gebiet, Route)

Disponent plant Einsätze auf der Plantafel nach Qualifikation, Gebiet, Auslastung und Route; Techniker und Termin gehen an S/4HANA zurück.
- Objekte: Aktivität, Einsatz, Ressource
- Apps/UI: Planning & Dispatching Board (FSM)
- Scope Items: 49X
- Quellen: [SAP Learning – Service Order Processing with SAP Field Service Management (49X)](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/introducing-service-order-processing-with-sap-field-service-management_fa46a4a7-9cc2-437c-8156-34bdae29c118) · [SAP – Streamline dispatching processes with Joule (FSM)](https://www.sap.com/products/scm/joule-with-sap-field-service-management.html)

### F04 Termin bestätigen & Kunden informieren

Kunde erhält Termin bzw. ETA des Technikers.
- Objekte: Termin
- **Hinweis:** Standard-Kundenbenachrichtigung aus FSM bzw. Portal je Produkt prüfen.
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### F05 Einsatz vorbereiten (Briefing, Teile an Bord)

Techniker sichtet Auftrag, Historie, Besonderheiten beim Kunden und benötigte Teile.
- Objekte: Aktivität, Equipment-Historie
- Apps/UI: Field Service App (FSA)
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### F06 Arbeit vor Ort durchführen & dokumentieren

Durchführung mit der mobilen App: Checklisten (Smartforms), Zeiten, Material, Unterschrift des Kunden.
- Objekte: Aktivität, Checkliste, Zeitrückmeldung, Materialrückmeldung
- Apps/UI: Field Service App (FSA)
- Scope Items: 49X
- Quellen: [SAP Learning – Service Order Processing with SAP Field Service Management (49X)](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/introducing-service-order-processing-with-sap-field-service-management_fa46a4a7-9cc2-437c-8156-34bdae29c118) · SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### F07 Rückmeldung an S/4HANA (Servicerückmeldung)

FSM-Rückmeldung (Zeit, Spesen, Material) erzeugt die Servicerückmeldung in S/4HANA; Folgebelege für CO, Warenbewegung und Fakturaanforderung.
- Objekte: Servicerückmeldung
- Scope Items: 49X
- Quellen: [SAP Learning – Integration S/4HANA Service und SAP FSM](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-sap-s-4hana-cloud-public-edition-service-and-sap-field-service-management_dc38c915-6c25-4a8d-9b86-a5cbe0e2a100)

### F08 Ersatz- und Altteile zurückführen

Nicht verbaute Ersatzteile bzw. Altteile werden ins Lager zurückgeführt (optional).
- Objekte: Rücklieferung, Umbuchung
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### B01 Fakturaanforderung prüfen & Faktura erstellen

Fakturaanforderung (Billing Document Request) prüfen und Faktura erzeugen; Festpreis aus dem Serviceauftrag oder aufwandsbezogen (bei Advanced Execution über DIP).
- Objekte: Fakturaanforderung, Faktura
- Quellen: [SAP Learning – Configuring Service Confirmations and Service Billing](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition-de/configuring-service-confirmations-and-service-billing) · [SAP Learning – Service Order Processing with SAP Field Service Management (49X)](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/introducing-service-order-processing-with-sap-field-service-management_fa46a4a7-9cc2-437c-8156-34bdae29c118) · [SAP Learning – Configuring the Service with Advanced Execution Scenario](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/configuring-the-service-with-advanced-execution-scenario)

### B02 Kosten & Erlöse abrechnen

Kosten und Erlöse in Controlling bzw. Ergebnisrechnung; bei positionsbezogener Kontierung Erlösrealisierung je Auftragsposition.
- Objekte: Kosten, Erlöse, Ergebnisrechnung
- Quellen: [SAP Learning – In-House Repair (3XK): Process Steps](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c) · [SAP Learning – Configuring the Service with Advanced Execution Scenario](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/configuring-the-service-with-advanced-execution-scenario)

### C01 Case abschließen & Kunden informieren

Case schließen, Kunde über Ergebnis informieren und Feedback einholen.
- Objekte: Case, Umfrage
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li)

### C02 Service auswerten: Qualität, Profitabilität, Folgegeschäft

Auswertung von Qualität, Profitabilität und Wiederholfehlern; Wissen sichern; Folgegeschäft (Austausch, Wartungsvertrag) anstoßen.
- Objekte: Auswertung, Opportunity, Wartungsplan
- Scope Items: 43B (Service Monitoring and Analytics)
- Quellen: SAP V128 – Autonomous Service Management: KI im Service-Kernprozess (Frick, Lenz, Li) · TG KI im Service – Kick-off (03.07.2026): Arbeitsweise, Autonomous Service Management (Folien 10–11, WIP)
