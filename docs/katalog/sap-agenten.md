# SAP-Agenten und KI-Funktionen (Autonomous Service)

> Automatisch erzeugt aus `model/` mit `npm run docs` – nicht von Hand bearbeiten.

Inhalte aus den SAP-Folien der Themengruppe (Kick-off 07/2026, V128 10/2026) sind als INTERNAL bzw. „Lab Preview – no actual product“ gekennzeichnet. Nur im Kreis der Themengruppe teilen; keine Produktzusage der SAP.

## 01 Case Management (Case Management)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Case Classification Agent | Verfügbar – verfügbar (seit 2025) | SAP Service Cloud V2 | E04 | – | Liest eingehende Serviceanfragen per Sprachverständnis, erkennt Anliegen und Dringlichkeit und leitet den Case an das passende Team weiter (Routing). |
| Case Summary (Joule) | Verfügbar – Joule Premium for Customer Experience (AI Units) | SAP Service Cloud V2 | E05 | – | Fasst alle ein- und ausgehenden Interaktionen eines Cases zusammen, damit nicht jede Nachricht gelesen werden muss. |
| Knowledge Creation Agent | Verfügbar – verfügbar (seit 2025); in V128 im Bereich Case Management | SAP Service Cloud V2 | E07, C02 | – | Erzeugt aus gelösten Cases strukturierte Wissensartikel (Lösungsschritte je Kundenanliegen, Tags, Kategorien) als Entwurf für den Knowledge Manager. |
| Q&A Agent | Verfügbar – 2025 als vorkonfigurierter Agent genannt | SAP Service Cloud V2 | E05 | – | Beantwortet Fragen des Service-Mitarbeiters aus Handbüchern, Richtlinien und vergangenen Cases („I search multiple systems before I can answer customers“). |
| Case Preparation Agent | Lab Preview | SAP Service Cloud V2 | E03, E04 | Request Screening Agent | Bereitet Cases automatisch vor: Priorität, Kategorie, Asset-Historie; empfiehlt bei Bedarf einen Serviceauftrag (Szenario V128, Folie 7). |
| Case Processing Agent | Lab Preview | SAP Service Cloud V2 | E04, E05 | – | Bearbeitet Cases weitgehend autonom entlang definierter Schritte (Funktionsumfang laut Folie nicht detailliert). |
| Case Action Recommendation Agent | Lab Preview | SAP Service Cloud V2 | E05, E06 | – | Empfiehlt die nächste beste Aktion zum Case (z. B. Antwort, Eskalation, Serviceeinsatz). |
| Knowledge Content Retrieval Agent | Lab Preview | SAP Service Cloud V2 | E05 | – | Findet passende Wissensinhalte zum Case. |
| Service Order Preparation Agent | Lab Preview | SAP Service Cloud V2 | E09 | – | Bereitet aus dem Case den Serviceauftrag vor (Übergang Service Cloud → S/4HANA Service). |
| Digital Service Agent | Lab Preview | SAP Service Cloud V2 / Portal | E01, E07 | – | Beantwortet Kundenfragen im Self-Service, z. B. zu Rechnung oder Ticketstatus („I don’t know where to find the answer“). |

## 02 Service-Optimierung (Service Optimization)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Escalation Agent | Lab Preview | SAP Service Cloud V2 | E04 | – | Erkennt eskalationsgefährdete Cases. |
| Sentiment / Topic Agent | Lab Preview | SAP Service Cloud V2 | E03, E04 | – | Analysiert Stimmung und Themen der Kundeninteraktionen. |
| Compliance Agent | Lab Preview | SAP Service Cloud V2 | E07 | – | Prüft Kommunikation und Bearbeitung auf Richtlinienkonformität. |
| Journey Agent | Lab Preview | SAP Service Cloud V2 | F04, C01 | – | Begleitet die Kundenreise über Touchpoints (Funktionsumfang laut Folie nicht detailliert). |
| Coaching Agent | Lab Preview | SAP Service Cloud V2 | E05 | – | Coacht Service-Mitarbeiter auf Basis ihrer Interaktionen. |
| Knowledge Content Administration Agent | Lab Preview | SAP Service Cloud V2 | C02 | – | Pflegt und bereinigt Wissensinhalte. |

## 03 Serviceplanung & -abwicklung (Service Planning and Operations)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Service Notification Initiation Agent | Lab Preview | SAP Cloud ERP | E02, E09 | – | Startet laut Folie 12 die Serviceplanung (Einstieg Service Planner → Service Planning and Operations Agent); Funktionsumfang nicht beschrieben. |
| Warranty Coverage Check Agent | Lab Preview | SAP Cloud ERP | E10, E17 | Entitlement Agent | Prüft Garantie- und Vertragsdeckung („Order created, warranty confirmed, SLA calculated“, Folie 7). |
| Equipment Insights Agent | Lab Preview | SAP Cloud ERP | E03, E15 | Equipment Insight Agent | Liefert Einsichten zum Equipment: Historie, Kritikalität, Wiederholfehler. |
| Equipment Enrichment Agent | Lab Preview | SAP Cloud ERP | E03, E14 | Equipment Enrichment Agent | Reichert Equipment-Stammdaten an bzw. vervollständigt sie. |
| Service Order Planning and Operations Agent | Lab Preview | SAP Cloud ERP | E20, F01, E21 | Service Order Agent (Parts Logistics Monitor, Advance Shipment Monitor, Parts Return); Service Planning and Operations Agent | Plant und steuert Serviceaufträge („Service order created … parts identified“, Folie 7); auf Folie 12 als „Service Planning and Operations Agent“. |
| Service Quotation Optimization Agent | Geplant – Planned Q1/2027 (V128, Folie 15) | SAP Cloud ERP | E18, E19 | Service Quotation Agent (Quote Versioning, Quote Simulation); Quotation Optimization Agent | Intelligente Serviceangebote mit automatisierter Kundenfreigabe: KI-gestützter Leistungsumfang aus Servicehistorie und Kontext, Vergleich von Angebotsversionen, Orchestrierung von Annahme und Kundenkommunikation. |
| In-House Service Processing Agent | Geplant – Planned Q1/2027 (V128, Folie 13) | SAP Cloud ERP | E12, E13, E14, E26, E27 | Inhouse Service Agent (Logistics Transfer, Split & Merge, Serial#/Material# Change) | Durchgängige Orchestrierung des In-House Service: In-House-Belege per natürlicher Sprache aus Versand-, Einkaufs- und Stammdaten anlegen (Kunden und Serviceobjekte erkennen), Logistik der Serviceobjekte (Empfang, Transfer zwischen Service Centern und Gesellschaften, Rücksendung anstoßen), Angebote und Aufträge verknüpfen – Serviceobjekt als zentraler Steuerungspunkt. |
| Service Scope Recommendation Agent | Lab Preview | SAP Cloud ERP | E18, E20 | Service recommendation Agent | Empfiehlt den Leistungsumfang (Leistungen, Teile) für Angebot bzw. Auftrag. |
| Service Sales Agent | Lab Preview | SAP Cloud ERP | C02, E18 | – | Unterstützt den Service-Vertrieb (Folie 12; Szenario Folie 7: Opportunity aus Technikerempfehlung). |
| Service Contract Lifecycle Renewal Agent | Lab Preview | SAP Cloud ERP | C02 | – | Steuert Verlängerung und Lebenszyklus von Serviceverträgen. |
| Service Contract Performance Agent | Lab Preview | SAP Cloud ERP | C02, E10 | – | Bewertet die Wirtschaftlichkeit und Leistung von Serviceverträgen. |
| Maintenance Plan Creation Agent | Lab Preview | SAP Cloud ERP | C02 | – | Erstellt Wartungspläne (z. B. als Folge aus Serviceeinsätzen oder Verträgen). |
| In-house service initiation (KI-Funktion) | Verfügbar – Joule Premium for Supply Chain Management (AI Units) | SAP S/4HANA Cloud Private Edition | E12, E13 | – | Erzeugt aus gescannten oder fotografierten Papierbelegen (z. B. Bestellungen) die Liste der Serviceobjekte zum In-House Service; Prüfung durch den Mitarbeiter. |
| Joule für Serviceaufträge | Verfügbar – ab Private Edition 2025 FPS0 (Hinweise, APIs, Berechtigungen nötig) | SAP S/4HANA Cloud Private Edition | E20, F01 | – | Serviceaufträge per Dialog bearbeiten (z. B. Statusänderung mit Bestätigung, vollständige Systemmeldungen); Joule-Suche nach Serviceobjekten ab 2023 FPS03. |
| Service Template Agent | WIP (Kick-off) | SAP Cloud ERP | E20, F01 | – | Im Kick-off genannt (Serviceauftragsvorlagen); im V128-Stand nicht mehr separat genannt – Verbleib klären. |
| Parts Logistics Monitor / Advance Shipment Monitor | WIP (Kick-off) | SAP Cloud ERP | E21 | – | Teilfunktionen des „Service Order Agent“ im Kick-off: Überwachung der Teilelogistik und von Vorabversand; im V128-Stand nicht separat genannt. |
| Task List Management Agent | WIP (Kick-off) | SAP Cloud ERP (EAM) | – | – | Im Kick-off genannt (Arbeitspläne, Execution Planning); im V128-Service-Stand nicht genannt. |
| Maintenance Opportunity Planning Agent | WIP (Kick-off) | SAP Cloud ERP (EAM) | – | – | Im Kick-off genannt (Execution Planning). |
| Operational Maintenance Order Planning Agent | WIP (Kick-off) | SAP Cloud ERP (EAM) | – | – | Im Kick-off genannt (Execution Planning). |
| Maintenance Event Planning Agent | WIP (Kick-off) | SAP Cloud ERP (EAM) | – | – | Im Kick-off genannt (Execution Planning). |

## 04 Einsatzplanung & Disposition (Scheduling and Dispatching)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Service and Maintenance Workload and Capacity Optimization Agent | Lab Preview | SAP Field Service Management | F03 | – | Optimiert Arbeitslast und Kapazitäten über Service- und Instandhaltungsaufträge. |
| Service and Maintenance Dispatching Agent | Lab Preview | SAP Field Service Management | F03, F04 | Service Dispatching Agent (FSA) | Ordnet den passenden Techniker zu und optimiert die Disposition in Echtzeit neu („Certified tech assigned, parts confirmed in van, customer notified with ETA“). |
| Field Service Dispatcher Agent | Verfügbar – verfügbar, AI Units erforderlich | SAP Field Service Management | F03 | – | Ordnet Ressourcen auf Basis von Echtzeitdaten Aufträgen zu (SAP: bis zu 50 % produktivere Disposition). |
| Joule in SAP FSM (Disponent) | Verfügbar – laut SAP in Joule Base enthalten | SAP Field Service Management | F03 | – | Disponenten planen Serviceaufträge per Dialog und erhalten Antworten aus der Dokumentation. |
| Scheduling Policy Management Agent | Lab Preview | SAP Field Service Management | F03 | – | Verwaltet die Regeln (Policies) der automatischen Einsatzplanung. |
| Resource Reservations Management Agent | Lab Preview | SAP Field Service Management | F03 | – | Verwaltet Ressourcenreservierungen (Abwesenheiten, Blockzeiten). |
| Autonomous Crew Planner/Manager Agent | Lab Preview | SAP Field Service Management | F03 | – | Plant und steuert Teams (Crews) autonom. |

## 05 Durchführung (Work Execution)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Technician Briefing Agent | Lab Preview | SAP Field Service Management | F05, E22 | Technical Briefing Agent (FSA) | Brieft den Techniker vor dem Einsatz: vollständiger Kontext und KI-gestützte Fehlerursache („Half the time I arrive without the right parts or context“). |
| Work Execution Agent | Lab Preview | SAP Field Service Management | F06, E22 | – | Begleitet die Durchführung; Teile und Zeiten werden automatisch erfasst (Folie 7). |

## 06 Rückmeldung & Abschluss (Confirm & Close)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Service Debriefing Agent | Lab Preview | SAP Cloud ERP | F07, E23 | Maintenance Job Debrief Agent | Nachbereitung des Einsatzes (Folie 12: Techniker → Debriefing → Teilerückführung). |
| Service Parts Return Agent | Lab Preview | SAP Cloud ERP | F08 | Parts Return (Teilfunktion Service Order Agent) | Steuert die Rückführung von Ersatz- und Altteilen. |
| Billing Orchestration Agent | Lab Preview | SAP Cloud ERP | E24, B01 | – | Orchestriert die Fakturierung aus Rückmeldung und Auftrag. |
| Settlement Agent | Lab Preview | SAP Cloud ERP | B02 | – | Abrechnung von Kosten und Erlösen. |
| Service Confirmation Agent | WIP (Kick-off) | SAP Cloud ERP | E23, F07 | – | Im Kick-off genannt (Post Execution); im V128-Stand nicht mehr separat genannt – ggf. in Service Debriefing / Work Execution aufgegangen (OFFEN). |
| Warranty Claim Agent | WIP (Kick-off) | SAP Cloud ERP | E24 | – | Im Kick-off genannt (Garantieansprüche nach der Durchführung); im V128-Stand nicht mehr genannt – Verbleib klären. |

## – Administration (Administration)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| Business Rule Management Agent | Lab Preview | übergreifend | – | – | Unterstützt bei Definition und Pflege von Geschäftsregeln. |
| Custom Extension Quality Check Agent | Lab Preview | übergreifend | – | – | Prüft Qualität kundeneigener Erweiterungen. |
| Custom Field Management Agent | Lab Preview | übergreifend | – | – | Verwaltet kundeneigene Felder. |
| AI Translations Management Agent | Lab Preview | übergreifend | – | – | KI-gestützte Übersetzungsverwaltung. |

## – Querschnitt / Service Control Tower (Operation Monitoring & Resolution)

| Agent | Status | Produkt | Schritte | Frühere Namen | Beschreibung |
|---|---|---|---|---|---|
| AI assisted Service Monitor (Operation Monitoring & Resolution / Service Control Tower) | Lab Preview | übergreifend | C02, F03, E20 | AI assisted Service Monitor | Prozessübergreifende Überwachung und Auflösung von Störungen im Serviceablauf (Kick-off: AI assisted Service Monitor; V128 Folie 12: Operation Monitoring and Resolution / Service Control Tower). |

## Joule-Assistenten

- **Interaction Management Assistant** (Lab Preview): Begleitet das Live-Gespräch: Stimmung, Antwortvorschlag, Empfehlung zur Case-Anlage (V128, Folien 7–8).
- **Case Management Assistant** (Lab Preview): Bereitet Cases vor (Priorität, Kategorie, Asset-Historie) und empfiehlt den Serviceauftrag (V128, Folie 7). Öffentlich: Case-Management-Assistent im Rahmen Autonomous CX angekündigt.
- **Service Planning and Operations Assistant** (Lab Preview): Koordiniert die Agenten der Serviceplanung: Equipment Insight/Enrichment, Warranty Coverage Check, Service Quotation Optimization, Service Order Planning and Operations, In-House Service Processing, Service Contract Lifecycle Renewal/Performance, Service Scope Recommendation, Maintenance Plan Creation (V128, Folien 13/15).
- **Self Service Assistant** (WIP (Kick-off)): Self-Service für Kunden (Kick-off, Folie 11).
- **Service Representative Assistant** (WIP (Kick-off)): Unterstützt den Service-Mitarbeiter im Kundenkontakt (Kick-off, Folie 11).
- **Service Orchestration Assistant** (WIP (Kick-off)): Orchestriert Serviceabläufe (Kick-off, Folie 11).
- **Commercial Service Planning Assistant** (WIP (Kick-off)): Kommerzielle Serviceplanung: Anfrage, Garantie, Angebot, Auftrag, In-House (Kick-off, Folie 11).
- **Execution Planning Assistant** (WIP (Kick-off)): Ausführungsplanung inkl. Instandhaltungsplanung (Kick-off, Folie 11).
- **Post Execution Assistant** (WIP (Kick-off)): Nach der Durchführung: Disposition (FSA), Briefing, Debrief, Rückmeldung, Garantieanspruch (Kick-off, Folie 11).
- **Service Management Assistant (Autonomous CX)** (Geplant): Laut Sekundärquelle Joule Assistant für Field Service (Serviceaufträge, Terminierung, Teileprüfung, Disposition über Service Cloud V2 und S/4HANA), GA-Ziel November 2026.
