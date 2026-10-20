# Validierung: SAP-Standard S/4HANA Service & KI-Agenten (Stand 20.10.2026)

Grundlage für den E2E-Prozess und den Agentenkatalog der Plattform. Jede Aussage trägt einen Marker:

| Marker | Bedeutung |
|---|---|
| `SAP_STANDARD` | Durch SAP-Quelle (Learning, Community-Blog von SAP, Produktseite, Help) belegt |
| `SAP_FOLIEN` | Aus den TG-Folien der SAP (Kick-off 07/2026, V128 10/2026) – **INTERNAL / Lab Preview, kein Produktversprechen** |
| `ZU_VERIFIZIEREN` | Quelle widersprüchlich, sekundär oder release-abhängig – Prüfauftrag in der Spalte „Prüfen“ |
| `ABGELEITET` | Logische Ableitung der Plattform, nicht von SAP bestätigt |
| `OFFEN` | Lücke, in keiner Quelle gefunden |

> **Hinweis zur Recherche:** help.sap.com und learning.sap.com waren aus der Build-Umgebung nicht direkt abrufbar
> (Netzwerkrichtlinie). Die Validierung lief über Websuche mit Auswertung der Trefferseiten. Release-spezifische Details
> (Fiori-App-IDs, Customizing-Pfade) sind deshalb als `ZU_VERIFIZIEREN` gekennzeichnet und vor Workshops im
> Fiori Apps Reference Library bzw. im SAP Help Portal der jeweiligen Release zu prüfen.

## 1. In-House Service (vormals In-House Repair)

| # | Aussage | Marker | Quelle |
|---|---|---|---|
| 1.1 | Mit **S/4HANA 2023 FPS02** kam „In-House Repair 2.0“; die alten Vorgangsarten REPA, REPC, REPO, REPQ, REPT sind seitdem *deprecated*. Reparaturauftrag/-rückmeldung laufen über Serviceauftrag/Servicerückmeldung (z. B. SRVO/SRVC). | `SAP_STANDARD` | [SAP Learning – Processing an In-House Repair](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/processing-an-in-house-repair) |
| 1.2 | Ab **Release 2025** heißt In-House Repair **In-House Service**, das Reparaturobjekt **Serviceobjekt** (API `API_INHOUSEREPAIR` und Archivierungsobjekt `CRMS4_REPA` wurden umbenannt). | `SAP_STANDARD` | [SAP Learning – New Features of In-House Service](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/identifying-new-features-of-in-house-service_ed288fe7-0ad3-4788-abec-adf6ec312612) |
| 1.3 | Eingang: **Retourenauftrag** (Folgeaktivität „In-House Service fortführen“) → **Wareneingang** (Shipping Specialist) → **Eingangsprüfung** (Receiving Specialist). Mit „Material Received“ + Prüfergebnis wird der In-House Service automatisch angelegt. | `SAP_STANDARD` | [SAP Learning – Integration In-House Repair & Logistics](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-an-in-house-repair-and-logistics_c99315c6-6beb-487c-9859-7001d606dcef) |
| 1.4 | **Vorprüfung (Precheck)** je Serviceobjekt: Reparieren oder **unrepariert an den Kunden zurück** (dann kein Serviceauftrag, Objekt wird abgeschlossen). App „Perform Prechecks“. | `SAP_STANDARD` | [SAP Help – Perform Prechecks](https://help.sap.com/docs/SAP_S4HANA_CLOUD/adbae5bcd5994f159bf2847a11397b61/f76b69ede70d47ce8edea731a17c41c6.html) |
| 1.5 | Ab 2023 FPS02: Ist ein Serviceobjekt im **Serviceangebot** enthalten, wird der In-House-Service-Beleg beim Sichern automatisch angelegt. Massenaktionen (Retourenauftrag, Serviceaufträge, Angebote, Festpreisvarianten für mehrere Objekte). | `SAP_STANDARD` | [SAP Community – In-House Repair with Advanced Execution](https://community.sap.com/t5/supply-chain-management-blog-posts-by-sap/in-house-repair-with-advanced-execution-sap-s-4hana-cloud-private-edition/ba-p/13788144) |
| 1.6 | Je Serviceobjekt ein **Serviceauftrag (Reparatur)**: planen, freigeben; bei Freigabe automatisch **Bestellanforderung** für Ersatzteilpositionen; **Servicerückmeldung** je Position (Zeit, Teile, Spesen → CO). | `SAP_STANDARD` | [SAP Learning – Process Steps for In-House Repairs (3XK)](https://learning.sap.com/courses/implementing-in-house-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-process-steps-for-in-house-repairs_a5ddc919-9c1b-435b-b031-d413d9182f6c) |
| 1.7 | Ablauf laut SAP Learning: Retourenauftrag → In-House Service + Serviceobjekte → Vorprüfung → Angebot → Durchführung → (ohne Nachangebot) **Freigabe zur Fakturierung** → **Serviceobjekt abschließen**. Rückversand über **Auslieferung + Warenausgang** (App „Prepare for Billing“ erzeugt die Auslieferung zum Retourenauftrag); Erstattung „No Refund“. | `SAP_STANDARD` | [SAP Learning – Processing an In-House Repair](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/processing-an-in-house-repair) |
| 1.8 | 2025: Transfer von Serviceobjekten zwischen Service Centern (Auslieferung aus „Manage In-House Service Objects/Services“), werks-/lagerortübergreifend im Buchungskreis; **2025 FPS1: Intercompany In-House Service** (verknüpfter Beleg im Ziel-Buchungskreis); 2025 FPS2: Ausführungsstatus im Intercompany-Prozess. Kundenretouren können auf **Kundensonderbestand** gebucht werden. | `SAP_STANDARD` | [SAP Learning – In-House Service 2025 FPS1](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/identifying-new-features-of-in-house-service-in-2025-fps1_bf947215-90c3-4891-92f1-622362db476d), [SAP Community – Intercompany Dual Order](https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/through-the-looking-glass-major-enhancements-for-the-intercompany-dual/ba-p/14452144) |
| 1.9 | Fiori-Apps: „Manage In-House Services“, „Manage In-House Service Objects“ (vormals Manage Repair Objects), „Perform Prechecks“, „Plan Repairs“, „Prepare for Billing“. **App-IDs** in den Quellen widersprüchlich (F7695 / F4025). | `ZU_VERIFIZIEREN` | Prüfen: Fiori Apps Reference Library, Release 2025 FPS01/02 |
| 1.10 | Public Cloud: Scope Item **3XK „In-House Repair“** (schlank, Aufwand/Material). Private Edition / On-Premise: In-House Service 2.0 inkl. Advanced Execution. | `SAP_STANDARD` | [SAP Learning – 3XK](https://learning.sap.com/learning-journeys/implement-sap-s-4hana-cloud-public-edition-for-service/introducing-the-in-house-repair-solution-process_f612bed2-c43e-4765-9ed3-9b7665f65d5c) |
| 1.11 | Eine **Verschrottungs-/Austauschentscheidung** als eigene Vorprüfungsoption wurde in keiner Quelle gefunden. | `OFFEN` | – |

## 2. Serviceauftrag, Field Service, Garantie, Fakturierung

| # | Aussage | Marker | Quelle |
|---|---|---|---|
| 2.1 | Standardkette: **Serviceanfrage → (Serviceangebot) → Serviceauftrag → Servicerückmeldung → Fakturaanforderung (Billing Document Request) → Faktura**; Reservierung/BANF aus dem Auftrag; Rückmeldung auch ohne Auftrag möglich. Scope Item **3D2** Service Order Management and Monitoring. | `SAP_STANDARD` | [SAP Learning – FSM-Integration (49X)](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/introducing-service-order-processing-with-sap-field-service-management_fa46a4a7-9cc2-437c-8156-34bdae29c118) |
| 2.2 | **FSM-Integration (49X)**: freigegebener Serviceauftrag → SAP FSM (Planung/Disposition) → Techniker/Termin zurück → FSM-Rückmeldung (Zeit, Spesen, Material) → **Servicerückmeldung in S/4** → Folgebelege (CO, Warenbewegung, Fakturaanforderung). Zusatzlizenz FSM nötig. | `SAP_STANDARD` | [SAP Learning – Integration S/4HANA Service & FSM](https://learning.sap.com/courses/implementing-additional-topics-for-service-processes-in-sap-s-4hana-cloud-public-edition-service/explaining-the-integration-between-sap-s-4hana-cloud-public-edition-service-and-sap-field-service-management_dc38c915-6c25-4a8d-9b86-a5cbe0e2a100) |
| 2.3 | Serviceverträge: Scope Item **426** (Private Edition) bzw. **3MO**; Vertragsfindung im Auftrag/Anfrage (gleicher Auftraggeber, VkOrg/VtWeg, freigegebene Vertragsposition, Gültigkeit). | `SAP_STANDARD` | [SAP Learning – Service Contract Management](https://learning.sap.com/courses/implementing-sap-s-4hana-cloud-public-edition-service-management-br/creating-service-contracts_c526e5c2-f2bd-4653-a4eb-d4df5e9f180f) |
| 2.4 | **Garantieprüfung**: Garantie-Prüfprofil an der Vorgangsart, Mastergarantie am Equipment/TP; **2025 FPS0**: abgelaufene und datumsbasierte Garantien, manuelles Übersteuern, Garantie-Zuordnungsblock in Kopf/Position. | `SAP_STANDARD` | [SAP Blog – Warranty Determination](https://blogs.sap.com/2020/03/05/warranty-determination-in-sap-s-4hana-service-orders/), [SAP Learning – Improved Warranty Determination](https://learning.sap.com/courses/sap-s-4hana-cloud-private-edition-service-delta/working-with-improved-warranty-determination-in-service-management_c9ac3cac-4516-4420-b3a1-2a087a89b745) |
| 2.5 | **Service with Advanced Execution** (GA 2023): Ausführungsauftragsposition im Serviceauftrag → abrechenbarer Instandhaltungsauftrag (Planung/Ausführung in EAM); aufwandsbezogene Faktura über DIP, Festpreis aus dem Serviceauftrag; setzt positionsbezogene Kontierung voraus. | `SAP_STANDARD` | [SAP Learning – Advanced Execution](https://learning.sap.com/courses/performing-basic-customizing-for-service-in-sap-s-4hana-and-sap-s-4hana-cloud-private-edition/configuring-the-service-with-advanced-execution-scenario) |
| 2.6 | SAP CS (Customer Service) ist nach 2025 nicht mehr verfügbar; S/4HANA Service ist der Nachfolger im Kern. | `ZU_VERIFIZIEREN` | Community-Beitrag; prüfen: SAP-Hinweis/Simplification List zur Zielrelease |

## 3. KI im Standard – heute verfügbar (öffentlich belegt)

| # | Funktion | Produkt | Verfügbarkeit / Lizenz | Marker | Quelle |
|---|---|---|---|---|---|
| 3.1 | **Case Classification Agent** – klassifiziert und routet neue Cases | SAP Service Cloud V2 | verfügbar (seit 2025) | `SAP_STANDARD` | [SAP – Joule Agents: Case Classification](https://www.sap.com/assetdetail/2026/01/e4e28630-397f-0010-bca6-c68f7e60039b.html) |
| 3.2 | **Knowledge Creation Agent** – Wissensartikel aus gelösten Cases (Review durch Knowledge Manager) | SAP Service Cloud V2 | verfügbar (seit 2025) | `SAP_STANDARD` | [CX Today – Preconfigured AI Agents](https://cxtoday.com/sap-adds-preconfigured-ai-agents-to-its-cx-ai-toolkit) |
| 3.3 | **Case Summary** (Zusammenfassung der Interaktionen) | SAP Service Cloud V2 | Joule Premium for CX (AI Units) | `SAP_STANDARD` | [SAP – Service Cloud V2 Case Summary](https://www.sap.com/products/crm/service-cloud-version-2-case-summary.html) |
| 3.4 | **Field Service Dispatcher Agent** – Ressourcen-/Auftragszuordnung auf Echtzeitdaten | SAP Field Service Management | AI Units | `SAP_STANDARD` | [SAP – Field Service Dispatcher Agent](https://www.sap.com/india/products/scm/field-service-dispatcher-agent.html) |
| 3.5 | **Joule in FSM** (Disponent: Planung per Dialog, Antworten aus Help) | SAP FSM | laut SAP in Joule Base | `ZU_VERIFIZIEREN` | [SAP – Joule with FSM](https://www.sap.com/products/scm/joule-with-sap-field-service-management.html) – Lizenzaussage widerspricht 3.4 |
| 3.6 | **In-house service initiation** – Serviceobjekte aus gescannten Papierbelegen (z. B. Bestellung) | S/4HANA Cloud Private Edition | Joule Premium for SCM (AI Units) | `SAP_STANDARD` | [SAP Discovery Center – AI Feature](https://discovery-center.cloud.sap/ai-feature/df0164e9-75f2-4547-80d3-586619709246/) |
| 3.7 | **Joule für Serviceaufträge** (Statusänderung mit Bestätigung, Meldungen) ab Private Edition 2025 FPS0; Joule-Suche nach Serviceobjekten ab 2023 FPS03 | S/4HANA Cloud Private Edition | release-/hinweisabhängig | `ZU_VERIFIZIEREN` | [SAP Community – Joule Service Order Enhancements](https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/through-the-looking-glass-joule-ai-assistant-gets-major-service-order/ba-p/14361352) |
| 3.8 | Geplante KI-Funktionen für **Service-Angebots- und Serviceauftragsmanagement: Q1/2027** | S/4HANA | Roadmap | `ZU_VERIFIZIEREN` | SAP Discovery Center (s. 3.6) |

## 4. Autonomous Service – Agenten laut TG-Folien (`SAP_FOLIEN`)

- **Kick-off 03.07.2026** (Folie 11, „WIP, subject to change“): Assistenten Self Service, Service Representative, Case Management,
  Service Orchestration, Commercial Service Planning, Execution Planning, Post Execution; Agenten u. a. Request Screening, Equipment Insight,
  Entitlement, Service Recommendation, Service Quotation, Service Order (Parts Logistics Monitor, Advance Shipment Monitor, Parts Return),
  Inhouse Service (Logistics Transfer, Split & Merge, Serial#/Material# Change), Service Template, Equipment Enrichment,
  Task List Management, Maintenance Opportunity/Operational Maintenance Order/Maintenance Event Planning, Service Dispatching (FSA),
  Technical Briefing (FSA), Maintenance Job Debrief, Service Confirmation, Warranty Claim; „AI assisted Service Monitor“.
- **V128, Oktober 2026** (Folien 10/12, „Lab Preview – no actual product“): Bereiche Case Management, Service Optimization,
  Service Planning and Operations, Scheduling and Dispatching, Work Execution, Confirm & Close, Administration – 36 Agenten auf Folie 10,
  dazu Service Notification Initiation, Service Sales und Service Debriefing Agent (Folie 12) sowie Digital Service Agent und Q&A Agent (Folie 9).
  **In-House Service Processing Agent** und **Service Quotation Optimization Agent: „Planned Q1/2027“** (Folien 13/15).
- Namensstände Juli → Oktober weichen ab; Zuordnungen alter zu neuen Namen sind in der Plattform als `ABGELEITET` markiert.

**Öffentliche Einordnung** (Sapphire 05/2026, SAP Connect 10/2026): Autonomous Enterprise mit Joule Work, Joule Assistants, Joule Agents,
Joule Studio; Autonomous CX mit Case-Management-Assistent (GA-Ziel laut Sekundärquelle Nov. 2026 – `ZU_VERIFIZIEREN`).
Quellen: [SAP News – Sapphire 2026](https://news.sap.com/2026/05/sap-sapphire-sap-unveils-autonomous-enterprise/),
[SAP News – SAP Connect 10/2026](https://news.sap.com/2026/10/sap-connect-sap-puts-autonomous-enterprise-to-work/),
[SiliconANGLE 06.10.2026](https://siliconangle.com/2026/10/06/sap-expands-joule-into-an-agentic-work-layer-as-autonomous-enterprise-goes-live/).

## 5. Offene Prüfaufträge für die TG

1. Fiori-App-IDs In-House Service (F7695/F4025) und „Plan Repairs“/„Prepare for Billing“ in Release 2025 FPS02 bestätigen.
2. Lizenzmodell Joule in FSM vs. Field Service Dispatcher Agent (Joule Base vs. AI Units) bei SAP klären.
3. Zuordnung Kick-off-Agenten → V128-Agenten (z. B. Entitlement → Warranty Coverage Check, Request Screening → Case Preparation?) mit SAP (Dr. Oliver Frick) abstimmen.
4. Verbleib von Warranty Claim Agent, Service Template Agent, Parts Logistics/Advance Shipment Monitor im V128-Stand.
5. Verschrottungs-/Austauschentscheidung in der Vorprüfung – Standard oder Anforderung?
