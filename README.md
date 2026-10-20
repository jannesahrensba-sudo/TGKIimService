# TG KI im Service – Arbeitsplattform der Themengruppe

Plattform für die Themengruppe **„KI im Service“ (Autonomous Service Management)**: Anwenderunternehmen und SAP arbeiten
gemeinsam daran, den SAP-Standard um KI-Agenten zu erweitern. Die Plattform bildet den **Serviceprozess End-to-End im
SAP-Standard** ab, blendet die **SAP-Agenten** von Autonomous Service ein, zeigt, **wo Agenten fehlen**, und sammelt
die **Anforderungen der Unternehmen** – mit Status, Abgleich gegen den Standard und Übergabe an SAP.

> Arbeitsplattform von Mitgliedern der Themengruppe – kein offizielles Angebot der DSAG oder der SAP. Inhalte aus den
> SAP-Folien der TG (Kick-off 07/2026, V128 10/2026) sind INTERNAL bzw. „Lab Preview – no actual product“: nur im
> Kreis der Themengruppe teilen.

## Zwei Bereiche

| Bereich | Für wen | Inhalt |
|---|---|---|
| **TG-Board** (Zusammenarbeit) | TG-Mitglieder, Moderation | Serviceprozess als BPMN (Case Management → In-House Service bzw. Field Service → Rückmeldung → Faktura → Abschluss), einblendbare SAP-Agenten je Schritt (Status-Filter: verfügbar, geplant, Lab Preview, WIP), Abdeckung, Bedarf der Unternehmen, Agentenlücken; Agentenkatalog; Abdeckungskarte; gespiegelte Anforderungen & User Stories mit Status (TG-Phasen 1–4), Schnellabgleich und **Abgleich-Agent**; **Prozess-Agent** für Fragen zu Teilprozessen und Agenten; Quellen & Validierung; Verwaltung |
| **Anforderungsportal** (Unternehmen) | alle Unternehmen mit Zugang | Name und Unternehmen zu Beginn; Anforderung als **User Story** (Als/möchte ich/damit + Akzeptanzkriterien) oder als **Prozessthema & Anmerkung** – an den Prozess, an einen SAP-Agenten oder als KI-Hook; **User-Story-Assistent**; Übersicht **nach Unternehmen sortiert** (eigenes zuerst), Status, Rückfragen, „Betrifft uns auch“ |

Erstbestand: der E2E-Prozess (30 Aktivitäten, 7 Lanes nach SAP-Rollen), 56 SAP-Agenten/KI-Funktionen, 10 Joule-Assistenten,
7 Agentenlücken und die **13 Agenten-Hooks von Brunata Metrona** (wörtlich übernommen, mit unbestätigtem Erstabgleich).
Das Standardwissen ist recherchiert und mit Quellen belegt: [`docs/recherche/standard-validierung.md`](docs/recherche/standard-validierung.md).

## Betriebsarten

| Betriebsart | Zugang | Agenten | Speicher |
|---|---|---|---|
| **Artifact in Claude** (empfohlen zum Start) | Teilen über Claude; Moderation und Board-Zugang vergibt der Eigentümer unter *Verwaltung* | Claude-Konto der Person (`sample`) | gemeinsamer Speicher des Artifacts: eigene Beiträge je Person geschützt (`portal/{self}`), Board und Bewertungen für Bearbeiter/innen, Zugänge nur Eigentümer |
| **Plattform-Server** (`npm start`) | Zugangscodes: `TG_PORTAL_CODE` (nur Portal), `TG_MEMBER_CODE` (Board + Portal), `TG_MODERATION_CODE` | Claude API (`ANTHROPIC_API_KEY`, Modell über `CLAUDE_MODEL`) | `.tg-data/docs` (gleiche Dokumentaufteilung) |
| **Lokale Demo** | Rolle beim Start wählbar | – | nur im Browser |

```bash
npm install
npm run dev            # Server (5175) + Oberfläche (5173); Codes stehen in der Konsole bzw. .tg-data/codes.json
npm run build:static   # → dist-static/ (statisch, relative Pfade)
npm run build:artifact # → dist-artifact/index.html (eine Datei, zum Veröffentlichen als Artifact)
npm run validate       # Prüfregeln (Exit 1 bei Fehlern)
npm test               # Vitest
npm run docs           # docs/prozess, docs/katalog aus dem Modell
npm run mcp            # MCP-Server für Claude Code (stdio; -- --http 8788 für HTTP)
```

## Arbeitsweise in der Themengruppe

1. **Phase 1 – Sammlung:** Unternehmen reichen im Portal ein. Die Moderation sichtet, stellt bei Bedarf eine **Rückfrage** (das Unternehmen antwortet im Gespräch).
2. **Phase 2 – Bewertung:** **Schnellabgleich** (Stichworte, ohne KI) und **Abgleich-Agent** schlagen vor, ob die Anforderung im Standard liegt, von einem verfügbaren oder geplanten SAP-Agenten abgedeckt ist, eine Anforderung an einen SAP-Agenten ist oder eine **Lücke** (neuer Use Case). Die Moderation **bestätigt** den Abgleich.
3. **Phase 3 – Priorisierung & Übergabe:** TG-Priorität, Unterstützung durch weitere Unternehmen („Betrifft uns auch“), **Übergabepaket an SAP** (Markdown) und CSV.
4. **Phase 4 – Realisierung:** Status „In Umsetzung (SAP)“/„Umgesetzt“, Rückmeldung der SAP an der Anforderung.

## Aufbau

```
model/                 ausgeliefertes Modell (JSON): meta, processes/E2E-SERVICE, sap-agents, gaps, sources,
                       requirements (Brunata Metrona), reviews (Erstabgleich)
src/core/              Typen, Operationen (applyOps), Rechte (access), Abdeckung, Schnellabgleich, Prüfregeln, BPMN, Exporte
src/agents/            Prozess-Agent, User-Story-Assistent, Abgleich-Agent: Definitionen, Werkzeuge, Kontext, Claude-API-Runner
src/server/ src/mcp/   Plattform-Server (Express), MCP-Server „tg-ki-im-service“
web/src/               React-Oberfläche: Einstieg, Board (views/board), Portal (views/portal), BPMN (bpmn-js), Datenschicht
docs/                  Recherche/Validierung, Plattform-Konzept, generierte Prozess- und Katalogdoku
tests/                 Vitest: Modell, Operationen & Rechte, Abdeckung & Abgleich, BPMN, Artifact-Speicher, Server, MCP, Agenten
```

Weiterlesen: [Plattform-Konzept](docs/architektur/plattform.md) · [Validierung SAP-Standard](docs/recherche/standard-validierung.md) · [Prozess](docs/prozess/E2E-SERVICE.md) · [SAP-Agenten](docs/katalog/sap-agenten.md) · [Agentenlücken](docs/katalog/agentenluecken.md) · [Anforderungen](docs/katalog/anforderungen.md)
