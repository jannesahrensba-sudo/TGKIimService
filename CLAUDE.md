# CLAUDE.md – TG KI im Service (Arbeitsplattform der Themengruppe)

Plattform der DSAG-Themengruppe „KI im Service“ (Autonomous Service Management): E2E-Serviceprozess im SAP-Standard als BPMN,
Katalog der SAP-Agenten, Agentenlücken, Anforderungsportal der Unternehmen, Prozess-, User-Story- und Abgleich-Agent.
Betreiber/Eigentümer ist ein Mitglied der TG (Unternehmen Brunata Metrona). Kein offizielles DSAG-/SAP-Angebot.

## Rollen
- **Moderation** (Sprecherteam): pflegt Prozess, Agentenkatalog, Lücken, Status, Abgleich (bestätigen), TG-Priorität.
- **TG-Mitglied**: Board lesen, einreichen, kommentieren, „Betrifft uns auch“.
- **Unternehmen (Portal)**: nur Anforderungsportal – eigene Anforderungen einreichen, bearbeiten, Rückfragen beantworten.
- Rechte zentral in `src/core/access.ts` (`checkOp` je Operation, `canWriteDoc` je Dokument). Eigene Beiträge gehören der Person;
  die Moderation ändert fremde Inhalte nicht (Ausnahme: Seed-Anforderungen, Eigentümer:in des Artifacts).

## Regeln
1. **Single Source of Truth ist `model/`** plus Laufzeitdokumente (Artifact-db bzw. `.tg-data/docs`). Änderungen über Operationen
   (`applyOps` in `src/core/ops.ts`) – Oberfläche, Server, MCP (`tg-ki-im-service`) und Agenten nutzen denselben Weg.
   Direkte JSON-Edits nur für Massenpflege, danach `npm run validate` und `npm run docs`.
2. **SAP-Fakten ehrlich:** Keine erfundenen Fiori-App-IDs, API-Namen, Releases oder Agenten. Belegtes als `SAP_STANDARD` mit Quelle
   (`model/sources.json`), Folieninhalte als `SAP_FOLIEN`, Unsicheres als `ZU_VERIFIZIEREN` mit Hinweis (Prüfauftrag), Vorschläge als `ABGELEITET`.
   Grundlage: `docs/recherche/standard-validierung.md`.
3. **Agentenstatus genau:** VERFUEGBAR (öffentlich belegt) · GEPLANT (mit Termin) · LAB_PREVIEW (V128, kein Produkt) · WIP (Kick-off) ·
   NICHT_MEHR_GENANNT. Zuordnungen Kick-off → V128 sind `ABGELEITET`.
4. **Anforderungen der Unternehmen nicht umschreiben:** Seed-Anforderungen (Brunata-Agenten-Hooks) sind wörtlich übernommen.
   Abgleiche sind Vorschläge (`confirmed: false`), bestätigt wird von der Moderation.
5. **Vertraulichkeit:** SAP-Folien sind INTERNAL / Lab Preview – nur im Kreis der TG; keine Produktzusage der SAP.
6. Kommentare und UI-Texte auf Deutsch; Code-Bezeichner englisch.

## Befehle
```bash
npm run dev | npm test | npm run typecheck | npm run validate | npm run docs
npm run build:artifact   # dist-artifact/index.html – eine Datei für das Claude-Artifact
npm run mcp              # MCP-Server (stdio)
```
Agenten im Servermodus brauchen `ANTHROPIC_API_KEY` (oder `ant auth login`); Modell änderbar über `CLAUDE_MODEL`.

## Code-Struktur
- `src/core/` – `types.ts`, `ops.ts`, `access.ts`, `model-io.ts` (Aufteilung in Dokumente je Eigentümer), `coverage.ts`, `match.ts`
  (Schnellabgleich), `validate.ts`, `bpmn.ts`, `queries.ts`, `export.ts`
- `src/agents/` – `definitions.ts`, `tools.ts` (Zod, für Browser und Server), `context.ts`, `runner.ts` (Claude API, Tool Runner)
- `web/src/` – `views/start`, `views/board`, `views/portal`, `components/` (BPMN, AgentChat, RequirementForm/Detail), `data/`
  (backend: server/artifact/demo, `artifact-store.ts`)

## Neue Inhalte
- **Weiterer Prozess/Teilprozess:** `model/processes/<ID>.json` (Struktur wie `E2E-SERVICE.json`) oder in der Oberfläche
  (Moderation → „Weiteren Prozess anlegen“). Knoten-IDs sind prozessübergreifend eindeutig.
- **Neuer SAP-Agent:** `model/sap-agents.json` bzw. „Agent aufnehmen“ (Marker `ZU_VERIFIZIEREN` bis zur Quelle).
- Danach `npm run validate && npm run docs && npm test`.
