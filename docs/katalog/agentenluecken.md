# Agentenlücken – wo im Prozess fehlen Agenten?

> Automatisch erzeugt aus `model/` mit `npm run docs` – nicht von Hand bearbeiten.

## GAP-01 Vorprüfung: Reparieren, unrepariert zurück – oder austauschen/verschrotten?

- **Status:** Identifiziert · **Herkunft:** RECHERCHE · **Marker:** Abgeleitet
- **Schritte:** E15, E16
- **Anforderungen:** –

Die Vorprüfung ist der zentrale Entscheidungspunkt im In-House Service. Weder im Kick-off- noch im V128-Stand ist ein Agent genannt, der die Entscheidung vorbereitet (Schadensbild, Gerätealter, Reparatur- vs. Austauschkosten, Garantie). Equipment Insights liefert nur Teilinformationen; eine Austausch-/Verschrottungsoption ist im Standard nicht belegt.

**Vorgeschlagener Agent:** Vorprüfungs-Agent (Repair-or-Replace): schlägt je Serviceobjekt Reparieren / Austausch / unrepariert zurück mit Begründung vor; Entscheidung bleibt beim Service Planner.

**Nutzen:** Schnellere, konsistente Vorprüfung; weniger unwirtschaftliche Reparaturen.

## GAP-02 Proaktiver Kundenstatus in der In-House-Strecke

- **Status:** Identifiziert · **Herkunft:** RECHERCHE · **Marker:** Abgeleitet
- **Schritte:** E13, E15, E22, E26
- **Anforderungen:** –

SAP nennt „Instant transparency, proactive communication“ als Ziel. Der Journey Agent ist nur an Terminbestätigung und Abschluss verortet; für Eingang, Vorprüfung, Reparatur und Rückversand des eingesendeten Geräts ist kein Agent genannt, der den Kunden informiert.

**Vorgeschlagener Agent:** Status-Agent In-House: informiert den Kunden ereignisgesteuert (Eingang bestätigt, Befund, Reparatur fertig, Versand mit Sendungsnummer).

**Nutzen:** Weniger Statusanfragen im Kundenservice; Transparenz für den Kunden.

## GAP-03 Diagnose-Unterstützung für Werkstatt-Techniker (In-House)

- **Status:** Identifiziert · **Herkunft:** RECHERCHE · **Marker:** Abgeleitet
- **Schritte:** E22
- **Anforderungen:** –

Technician Briefing und Work Execution Agent sind im Field Service (FSA) verortet. Ob sie auch die Werkstattreparatur im Service Center (Serviceauftrag in S/4HANA) unterstützen, ist nicht belegt.

**Vorgeschlagener Agent:** Briefing/Diagnose auch für die Werkstatt: Fehlerursache aus Historie und Wissensbasis, benötigte Teile, Prüfschritte.

**Nutzen:** Höhere Erstlösungsquote in der Werkstatt.

## GAP-04 Auswertung von Mess-/Funkdaten mit Maßnahmenvorschlag

- **Status:** Identifiziert · **Herkunft:** ANFORDERUNG · **Marker:** Abgeleitet
- **Schritte:** E02, C02
- **Anforderungen:** ANF-009

Zustandsmeldungen (IoT) sind als Einstieg genannt, aber kein Service-Agent analysiert Zählerwerte bzw. Funkdaten, erkennt Muster und schlägt Servicemaßnahmen vor.

**Vorgeschlagener Agent:** Messdaten-Agent: erkennt Auffälligkeiten (Ausfälle, Plausibilität, Muster) und legt Serviceanfragen bzw. Maßnahmenvorschläge an.

**Nutzen:** Vorausschauender Service statt Reaktion auf Kundenmeldung.

## GAP-05 Fachliche Prüfungen bei der Auftragsfreigabe

- **Status:** Identifiziert · **Herkunft:** ANFORDERUNG · **Marker:** Abgeleitet
- **Schritte:** F01, E20
- **Anforderungen:** ANF-008

Die Freigabe ist ein Standardschritt. Ein Agent, der Freigabeprüfungen nach unternehmensspezifischen Regeln eigenständig durchführt, ist nicht genannt; der Business Rule Management Agent (Administration) pflegt Regeln, prüft aber keine Aufträge.

**Vorgeschlagener Agent:** Freigabe-Agent: prüft Aufträge gegen Regeln (z. B. Anlagentyp, Auftragsart, Folgeaktivitäten) und gibt frei oder begründet die Rückweisung.

**Nutzen:** Weniger manuelle Freigaben, weniger Fehleinsätze.

## GAP-06 Bedarfsprüfung bei periodischen Aufträgen (z. B. Ablesung)

- **Status:** Identifiziert · **Herkunft:** ANFORDERUNG · **Marker:** Abgeleitet
- **Schritte:** F01
- **Anforderungen:** ANF-007

Branchenspezifische periodische Aufträge (Ablesung im Submetering) sind nicht Teil der SAP-Service-Agenten. Die Frage „ist der Auftrag noch nötig?“ ist auf andere periodische Leistungen übertragbar (Wartung, Prüffristen).

**Vorgeschlagener Agent:** Bedarfsprüfungs-Agent für periodische Aufträge (Kriterien, Datenlage, Empfehlung).

**Nutzen:** Vermeidet unnötige Einsätze.

## GAP-07 Materialverfügbarkeit mit Umverteilungsvorschlag

- **Status:** Identifiziert · **Herkunft:** ANFORDERUNG · **Marker:** Abgeleitet
- **Schritte:** E21
- **Anforderungen:** ANF-005

Im Kick-off waren Parts Logistics Monitor und Advance Shipment Monitor genannt, im V128-Stand nicht mehr separat. Umverteilung zwischen Lagern bzw. Fahrzeugbeständen ist für keinen Agenten beschrieben.

**Vorgeschlagener Agent:** Teileverfügbarkeits-Agent: prüft Verfügbarkeit über Lager und Fahrzeugbestände und schlägt Umverteilung oder Beschaffung vor.

**Nutzen:** Höhere Erstlösungsquote, weniger Folgeeinsätze.
