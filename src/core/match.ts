/**
 * Schnellabgleich ohne KI: vergleicht eine Anforderung über Fachbegriffe (Deutsch/Englisch, Komposita)
 * mit Prozessschritten und SAP-Agenten und schlägt einen Abgleich vor. Ergebnis ist immer ein
 * unbestätigter Vorschlag (Marker ABGELEITET) – Grundlage für Moderation und Abgleich-Agent.
 */
import type { FitResult, ProcessNode, Requirement, SapAgent, TgModel } from './types';
import { AGENT_STATUS, FIT_RESULTS, isActivity } from './types';
import type { AssessmentInput } from './ops';

/** Fachbegriffe → Konzept. Wörter normalisiert (Kleinbuchstaben, ä→ae, ß→ss). */
const CONCEPTS: Record<string, string[]> = {
  dispatch: ['disposition', 'disponieren', 'disponent', 'zuteilung', 'zuteilen', 'zuordnung', 'einsatzplanung', 'dispatch', 'dispatching', 'scheduling', 'plantafel', 'einplanung'],
  route: ['route', 'routen', 'tour', 'touren', 'tagesroute', 'routenoptimierung', 'fahrweg'],
  capacity: ['auslastung', 'kapazitaet', 'workload', 'capacity', 'ressource', 'ressourcen'],
  technician: ['techniker', 'monteur', 'servicetechniker', 'technician', 'crew', 'aussendienst'],
  case: ['ticket', 'case', 'reklamation', 'beschwerde', 'anliegen', 'stoerung', 'stoerungsmeldung'],
  classify: ['klassifizierung', 'klassifizieren', 'kategorie', 'kategorisierung', 'routing', 'classification', 'triage'],
  priority: ['prioritaet', 'priorisierung', 'kritikalitaet', 'kritisch', 'dringlichkeit', 'eskalation', 'escalation', 'ueberfaellig', 'ueberfaelligkeit'],
  knowledge: ['wissen', 'wissensdatenbank', 'wissensartikel', 'knowledge', 'handbuch', 'loesungsdatenbank'],
  summary: ['zusammenfassung', 'zusammenfassen', 'ueberblick', 'summary', 'briefing', 'einen blick'],
  email: ['email', 'e-mail', 'mail', 'antwort', 'antworten', 'formuliert', 'formulieren', 'korrespondenz', 'anschreiben'],
  research: ['recherche', 'recherchieren', 'hintergrundinformation', 'historie', 'verlauf', 'bearbeitungsverlauf', 'history', 'anreichern'],
  order: ['auftrag', 'auftraege', 'serviceauftrag', 'order', 'auftragsbestand', 'einsatz'],
  create: ['auftragserstellung', 'anlegen', 'erstellen', 'erstellung', 'initiieren'],
  duplicate: ['dublette', 'doppelt', 'doppelte', 'duplikat', 'buendelung', 'buendeln'],
  release: ['freigabe', 'freigeben', 'auftragsfreigabe', 'release'],
  quality: ['qualitaet', 'qualitaetskontrolle', 'qualitaetssicherung', 'plausibilitaet', 'pruefung', 'kontrolle', 'sinnvoll'],
  confirm: ['rueckmeldung', 'auftragsrueckmeldung', 'confirmation', 'debrief', 'debriefing', 'nachbereitung'],
  material: ['material', 'materialverfuegbarkeit', 'ersatzteil', 'teile', 'parts', 'lager', 'bestand', 'umverteilung', 'verfuegbarkeit', 'verfuegbarkeitspruefung'],
  quotation: ['angebot', 'kostenvoranschlag', 'quotation', 'quote', 'preis'],
  warranty: ['garantie', 'gewaehrleistung', 'warranty', 'entitlement', 'kostenpflicht', 'kostenpflichtig'],
  contract: ['vertrag', 'wartungsvertrag', 'dauerdienst', 'contract', 'servicevertrag'],
  inhouse: ['inhouse', 'in-house', 'werkstatt', 'einsendung', 'einsenden', 'servicecenter', 'serviceobjekt', 'reparaturobjekt'],
  repair: ['reparatur', 'reparieren', 'repair', 'instandsetzung'],
  returns: ['retoure', 'ruecksendung', 'rueckversand', 'ruecklieferung', 'rueckfuehrung'],
  billing: ['faktura', 'rechnung', 'abrechnung', 'fakturierung', 'billing', 'invoice'],
  meter: ['zaehler', 'zaehlerwert', 'ablesung', 'ablesen', 'ableseergebnis', 'ableseauftrag', 'messwert', 'messdaten', 'verbrauch'],
  sensor: ['funk', 'funkdaten', 'iot', 'sensor', 'telemetrie', 'zustandsmeldung', 'm-bus', 'mbus'],
  pattern: ['muster', 'auffaelligkeit', 'anomalie', 'analyse', 'analysiert', 'analysieren', 'auswertung', 'auswerten', 'erkennt'],
  action: ['massnahme', 'empfehlung', 'vorschlag', 'vorschlagen', 'schlaegt', 'handlungsempfehlung', 'recommendation'],
  portal: ['portal', 'kundenportal', 'selfservice', 'self-service', 'chatbot'],
  appointment: ['termin', 'terminplanung', 'terminvorschlag', 'eta', 'anmeldung', 'terminbestaetigung'],
  rules: ['regel', 'parameter', 'kriterien', 'kriterium', 'policy', 'policies'],
  equipment: ['geraet', 'equipment', 'anlage', 'seriennummer', 'asset'],
  customer: ['kunde', 'kunden', 'customer', 'nutzer'],
  monitor: ['monitoring', 'ueberwachung', 'control tower', 'steuerung', 'auftragsbestand'],
  // neutrale Begriffe, die sonst falsche Teilwörter liefern („Berechnung“ ≠ „Rechnung“)
  calc: ['berechnung', 'berechnen', 'kalkulation'],
};

/** Allgemeine Konzepte zählen weniger (kommen in fast jeder Anforderung vor) */
const GENERIC: Record<string, number> = { order: 0.35, create: 0.4, rules: 0.4, action: 0.4, pattern: 0.6, customer: 0.4, quality: 0.7, calc: 0 };

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[„“"'’]/g, ' ');

const WORD_INDEX: { word: string; concept: string }[] = Object.entries(CONCEPTS)
  .flatMap(([concept, words]) => words.map((w) => ({ word: normalize(w), concept })))
  .sort((a, b) => b.word.length - a.word.length);

/** Konzepte eines Textes; lange Begriffe auch in Komposita (z. B. „Materialverfügbarkeitsprüfung“). */
export function conceptsOf(text: string): Set<string> {
  const t = normalize(text);
  const out = new Set<string>();
  for (const { word, concept } of WORD_INDEX) if (word.includes(' ') && t.includes(word)) out.add(concept);
  // Längster Begriff zuerst; getroffene Teile eines Kompositums sind „verbraucht“ (Auftragsbestand ≠ Bestand)
  for (const token of t.split(/[^a-z0-9-]+/).filter((x) => x.length >= 2)) {
    let rest = token;
    for (const { word, concept } of WORD_INDEX) {
      if (word.includes(' ')) continue;
      if (word.length >= 5) {
        const i = rest.indexOf(word);
        if (i < 0) continue;
        out.add(concept);
        rest = `${rest.slice(0, i)}|${rest.slice(i + word.length)}`;
      } else if (rest === token && [word, `${word}s`, `${word}e`, `${word}n`].includes(token)) out.add(concept);
    }
  }
  out.delete('calc');
  return out;
}

const nodeText = (n: ProcessNode) => [n.name, n.description, ...(n.keywords ?? []), ...n.objects].join(' ');
const agentText = (a: SapAgent) => [a.name, a.description, ...a.capabilities, ...a.keywords, ...a.earlierNames.map((e) => e.name)].join(' ');
// Kategorie bewusst nicht: sie gruppiert nur (z. B. „Materialprüfung“ unter „Auftragsdisposition“)
const requirementText = (r: Pick<Requirement, 'title' | 'note' | 'story' | 'businessValue'>) =>
  [r.title, r.note, r.story?.role, r.story?.goal, r.story?.benefit, ...(r.story?.acceptanceCriteria ?? []).flatMap((c) => [c.given, c.when, c.then]), r.businessValue].filter(Boolean).join(' ');

export interface MatchHit {
  id: string;
  name: string;
  score: number;
  concepts: string[];
}

export interface QuickMatch {
  concepts: string[];
  nodes: MatchHit[];
  agents: MatchHit[];
  proposal: AssessmentInput;
}

function rank<T extends { id: string; name: string }>(items: T[], textOf: (x: T) => string, req: Set<string>): MatchHit[] {
  const sets = items.map((x) => ({ x, c: conceptsOf(textOf(x)), inName: conceptsOf(x.name) }));
  const df = new Map<string, number>();
  for (const s of sets) for (const c of s.c) df.set(c, (df.get(c) ?? 0) + 1);
  const n = Math.max(1, items.length);
  const norm = Math.sqrt(Math.max(1, [...req].reduce((s, k) => s + (GENERIC[k] ?? 1), 0)));
  return sets
    .map(({ x, c, inName }) => {
      const shared = [...c].filter((k) => req.has(k));
      const weight = (k: string) => (GENERIC[k] ?? 1) * (1 + Math.log(n / (1 + (df.get(k) ?? 0)))) * (inName.has(k) ? 1.4 : 1);
      const score = shared.reduce((s, k) => s + weight(k), 0) / norm;
      return { id: x.id, name: x.name, score: Math.round(score * 100) / 100, concepts: shared };
    })
    .filter((h) => h.concepts.length > 0)
    .sort((a, b) => b.score - a.score);
}

const NODE_MIN = 1.2;
const AGENT_MIN = 2.0;

export function quickMatch(m: TgModel, r: Pick<Requirement, 'title' | 'note' | 'category' | 'story' | 'businessValue' | 'target' | 'nodeIds' | 'sapAgentIds'>): QuickMatch {
  const req = conceptsOf(requirementText(r));
  const nodes = m.processes.flatMap((p) => p.nodes.filter((n) => isActivity(n.type)));
  const agents = m.sapAgents.filter((a) => a.status !== 'NICHT_MEHR_GENANNT');
  const nodeHits = rank(nodes, nodeText, req);
  const agentHits = rank(agents, agentText, req);

  const topAgents = [...new Set([...r.sapAgentIds, ...agentHits.filter((h, i) => h.score >= AGENT_MIN && (i < 2 || h.score >= agentHits[0].score * 0.75)).slice(0, 4).map((h) => h.id)])];
  const agentNodes = new Set(topAgents.flatMap((id) => m.sapAgents.find((a) => a.id === id)?.nodeIds ?? []));
  // Schritte: Angabe des Unternehmens, dann Treffer – bevorzugt dort, wo auch die Agenten verortet sind
  const nodeCands = nodeHits.filter((h) => h.score >= NODE_MIN).map((h) => ({ ...h, score: h.score + (agentNodes.has(h.id) ? 0.8 : 0) })).sort((a, b) => b.score - a.score);
  const topNodes = [...new Set([...r.nodeIds, ...nodeCands.slice(0, 3).map((h) => h.id)])].slice(0, 4);

  // Maßgeblich ist der am besten passende Agent (Angabe des Unternehmens zuerst)
  const best = topAgents.map((id) => m.sapAgents.find((a) => a.id === id)).find(Boolean);
  let fit: FitResult;
  if (r.target === 'PROZESS' && topNodes.length && !best) fit = 'STANDARD';
  else if (best?.status === 'VERFUEGBAR') fit = 'SAP_AGENT_VERFUEGBAR';
  else if (best && (best.status === 'GEPLANT' || best.status === 'LAB_PREVIEW')) fit = 'SAP_AGENT_GEPLANT';
  else if (best) fit = 'TEIL_FIT';
  else if (topNodes.length) fit = 'GAP';
  else fit = 'OFFEN';

  const agentNames = topAgents.map((id) => {
    const a = m.sapAgents.find((x) => x.id === id);
    return a ? `${a.name} (${AGENT_STATUS[a.status].label})` : id;
  });
  const nodeNames = topNodes.map((id) => `${id} ${nodes.find((n) => n.id === id)?.name ?? ''}`.trim());
  const rationale = [
    req.size ? `Erkannte Fachbegriffe: ${[...req].join(', ')}.` : 'Keine bekannten Fachbegriffe erkannt.',
    nodeNames.length ? `Passende Prozessschritte: ${nodeNames.join('; ')}.` : 'Kein eindeutiger Prozessschritt erkannt.',
    agentNames.length ? `Passende SAP-Agenten: ${agentNames.join('; ')}.` : 'Kein passender SAP-Agent im Katalog.',
  ].join(' ');

  return {
    concepts: [...req],
    nodes: nodeHits.slice(0, 6),
    agents: agentHits.slice(0, 6),
    proposal: {
      fit,
      summary: `${FIT_RESULTS[fit].label} (Stichwortabgleich)${agentNames[0] ? ` – ${agentNames[0]}` : ''}`,
      rationale,
      nodeIds: topNodes,
      sapAgentIds: topAgents,
      standardReference: topNodes.length ? nodeNames[0] : '',
      recommendation: fit === 'GAP' ? 'Als neuen Use Case ausarbeiten und gegen SAP-Roadmap prüfen.' : fit === 'OFFEN' ? 'Anforderung präzisieren (Prozessschritt, Rolle, Daten).' : 'Mit dem Abgleich-Agenten bzw. in der TG fachlich bewerten.',
      verify: ['Vorschlag aus Stichwortabgleich – fachlich prüfen'],
      assessedBy: 'Schnellabgleich (Stichworte)',
      marker: 'ABGELEITET',
    },
  };
}
