---
name: anforderungen-abgleichen
description: Gleicht Anforderungen der Unternehmen (ANF-…) mit dem E2E-Serviceprozess, dem SAP-Standard und dem SAP-Agentenkatalog ab und speichert den Abgleich als unbestätigten Vorschlag. Auslöser – „Abgleich“, „Fit-to-Standard“, „passt das in den Standard“, „welcher SAP-Agent deckt das ab“, Anforderungs-IDs wie ANF-005.
---

# Anforderungen abgleichen

1. Über den MCP-Server `tg-ki-im-service`: `list_requirements` (ggf. Filter Status/Unternehmen), dann je Anforderung `get_requirement`.
2. Kandidaten mit `quick_match` holen, Schritte mit `get_step`, Agenten mit `get_sap_agent` prüfen. Ähnliche Anforderungen anderer
   Unternehmen über `list_requirements` mit Text suchen.
3. Ergebnis wählen: STANDARD · SAP_AGENT_VERFUEGBAR · SAP_AGENT_GEPLANT · TEIL_FIT · GAP · OFFEN.
   Status der Agenten genau wiedergeben (Lab Preview/WIP sind keine Produkte). Nichts erfinden – Unsicheres als Prüfauftrag (`verify`).
4. `assess_requirement` aufrufen (wird als Vorschlag gespeichert, Moderation bestätigt). Bei GAP vorschlagen, eine Agentenlücke
   (`apply_operations` mit `gap.add`) anzulegen – nur auf ausdrücklichen Wunsch.
5. Danach `validate_model` und kurz zusammenfassen: je Anforderung Ergebnis, Schritte, Agenten, Empfehlung.
