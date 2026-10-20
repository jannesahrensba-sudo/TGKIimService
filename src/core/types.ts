/**
 * Domänenmodell der TG-Plattform „KI im Service“.
 *
 * Single Source of Truth ist das Modell (JSON unter model/ plus gemeinsamer Speicher):
 *  - E2E-Serviceprozess im SAP-Standard (BPMN-fähig: Lanes, Schritte, Flüsse)
 *  - Katalog der SAP-Agenten und Joule-Assistenten (Autonomous Service) mit Verortung im Prozess
 *  - Agentenlücken (wo im Prozess noch Agenten fehlen)
 *  - Anforderungen der Unternehmen (User Story oder Prozessthema & Anmerkung) mit Bewertung der TG
 */

// ---------------------------------------------------------------------------
// Marker & Tonalität
// ---------------------------------------------------------------------------

export type Marker = 'SAP_STANDARD' | 'SAP_FOLIEN' | 'ZU_VERIFIZIEREN' | 'ABGELEITET' | 'OFFEN' | 'TG';

export type Tone = 'positive' | 'warning' | 'critical' | 'info' | 'neutral' | 'agent';

export const MARKERS: Record<Marker, { label: string; description: string; tone: Tone }> = {
  SAP_STANDARD: { label: 'SAP-Standard', description: 'Durch SAP-Quelle belegt (Help, Learning, SAP-Blog, Produktseite)', tone: 'positive' },
  SAP_FOLIEN: { label: 'SAP-Folien (TG)', description: 'Aus den SAP-Folien der Themengruppe – INTERNAL / Lab Preview, kein Produktversprechen', tone: 'agent' },
  ZU_VERIFIZIEREN: { label: 'Zu verifizieren', description: 'Quelle widersprüchlich, sekundär oder release-abhängig – Prüfauftrag', tone: 'warning' },
  ABGELEITET: { label: 'Abgeleitet', description: 'Ableitung der Plattform bzw. Vorschlag – nicht von SAP oder der TG bestätigt', tone: 'info' },
  OFFEN: { label: 'Offen', description: 'Lücke oder Widerspruch – in keiner Quelle gefunden, Klärung nötig', tone: 'critical' },
  TG: { label: 'TG', description: 'Von der Themengruppe eingebracht oder entschieden', tone: 'neutral' },
};

// ---------------------------------------------------------------------------
// Rahmen: Themengruppe, Autonomous-Service-Bereiche, Systeme
// ---------------------------------------------------------------------------

/** Phasen der Themengruppe (Kick-off 03.07.2026) */
export type TgPhaseId = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface TgPhase {
  id: TgPhaseId;
  name: string;
  items: string[];
}

/** Stufen von Autonomous Service: Engage | Manage | Schedule & Execute | Confirm & Improve */
export type StageId = 'ENGAGE' | 'MANAGE' | 'SCHEDULE_EXECUTE' | 'CONFIRM_IMPROVE';

/** Bereiche laut SAP (V128, Folie 6/10) – plus Querschnitt für bereichsübergreifende Funktionen */
export type AreaId = 'CASE' | 'OPTIMIZATION' | 'PLANNING' | 'DISPATCH' | 'EXECUTION' | 'CLOSE' | 'ADMIN' | 'QUERSCHNITT';

export interface ServiceArea {
  id: AreaId;
  no: string;
  name: string;
  nameDe: string;
  stage: StageId;
  claim: string;
  product: string;
}

export interface Stage {
  id: StageId;
  name: string;
  description: string;
}

export interface SystemRef {
  id: string;
  short: string;
  name: string;
  description: string;
}

export interface Contact {
  role: string;
  name: string;
  organisation: string;
}

export interface Meta {
  title: string;
  subtitle: string;
  version: string;
  updatedAt: string;
  tg: {
    name: string;
    context: string;
    workingMode: string;
    contacts: Contact[];
    relatedGroups: string[];
  };
  phases: TgPhase[];
  currentPhase: TgPhaseId;
  stages: Stage[];
  areas: ServiceArea[];
  systems: SystemRef[];
  /** Themenblöcke für Anforderungen (erweiterbar durch die Moderation) */
  categories: string[];
  confidentiality: string;
}

// ---------------------------------------------------------------------------
// Prozess (BPMN 2.0-kompatibel)
// ---------------------------------------------------------------------------

export type NodeType =
  | 'startEvent'
  | 'messageStartEvent'
  | 'endEvent'
  | 'messageEndEvent'
  | 'task'
  | 'userTask'
  | 'serviceTask'
  | 'sendTask'
  | 'receiveTask'
  | 'manualTask'
  | 'businessRuleTask'
  | 'callActivity'
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'eventBasedGateway'
  | 'messageCatchEvent'
  | 'timerCatchEvent'
  | 'messageThrowEvent';

export const NODE_TYPES: Record<NodeType, { label: string; group: 'event' | 'activity' | 'gateway' }> = {
  startEvent: { label: 'Startereignis', group: 'event' },
  messageStartEvent: { label: 'Nachrichten-Start', group: 'event' },
  endEvent: { label: 'Endereignis', group: 'event' },
  messageEndEvent: { label: 'Nachrichten-Ende', group: 'event' },
  task: { label: 'Aufgabe', group: 'activity' },
  userTask: { label: 'Benutzeraufgabe', group: 'activity' },
  serviceTask: { label: 'Systemaufgabe', group: 'activity' },
  sendTask: { label: 'Sendeaufgabe', group: 'activity' },
  receiveTask: { label: 'Empfangsaufgabe', group: 'activity' },
  manualTask: { label: 'Manuelle Aufgabe', group: 'activity' },
  businessRuleTask: { label: 'Geschäftsregel', group: 'activity' },
  callActivity: { label: 'Teilprozess', group: 'activity' },
  exclusiveGateway: { label: 'XOR-Gateway', group: 'gateway' },
  parallelGateway: { label: 'AND-Gateway', group: 'gateway' },
  eventBasedGateway: { label: 'Ereignis-Gateway', group: 'gateway' },
  messageCatchEvent: { label: 'Nachricht empfangen', group: 'event' },
  timerCatchEvent: { label: 'Zeitereignis', group: 'event' },
  messageThrowEvent: { label: 'Nachricht senden', group: 'event' },
};

export const isActivity = (t: NodeType) => NODE_TYPES[t]?.group === 'activity';
export const isGateway = (t: NodeType) => NODE_TYPES[t]?.group === 'gateway';
export const isStart = (t: NodeType) => t === 'startEvent' || t === 'messageStartEvent';
export const isEnd = (t: NodeType) => t === 'endEvent' || t === 'messageEndEvent';

export interface ProcessNode {
  id: string;
  type: NodeType;
  name: string;
  laneId: string;
  areaId: AreaId;
  /** Was der SAP-Standard in diesem Schritt heute leistet */
  description: string;
  systemIds: string[];
  /** Geschäftsobjekte (SAP-Begriffe), z. B. „Serviceauftrag“ */
  objects: string[];
  /** Fiori-Apps / UIs – IDs nur, wenn bestätigt */
  apps: string[];
  scopeItems: string[];
  sourceIds: string[];
  /** Nachricht vom Kunden (Message Flow aus dem Kunden-Pool) */
  customerInbound?: string;
  /** Nachricht an den Kunden (Message Flow in den Kunden-Pool) */
  customerOutbound?: string;
  /** Zusätzliche Suchbegriffe für den Abgleich (Fachsprache der Unternehmen) */
  keywords?: string[];
  note?: string;
  marker: Marker;
}

export interface SequenceFlow {
  id: string;
  from: string;
  to: string;
  label?: string;
  isDefault?: boolean;
}

export interface Lane {
  id: string;
  name: string;
  /** SAP-Rolle (V128, Folie 12) */
  role: string;
  systemIds: string[];
}

export interface ChangeEntry {
  at: string;
  by: string;
  summary: string;
}

export interface ProcessModel {
  id: string;
  code: string;
  name: string;
  description: string;
  scope: string;
  version: string;
  customerPool: string;
  lanes: Lane[];
  nodes: ProcessNode[];
  flows: SequenceFlow[];
  sourceIds: string[];
  changelog: ChangeEntry[];
}

// ---------------------------------------------------------------------------
// SAP-Agenten & Joule-Assistenten
// ---------------------------------------------------------------------------

export type AgentStatus = 'VERFUEGBAR' | 'GEPLANT' | 'LAB_PREVIEW' | 'WIP' | 'NICHT_MEHR_GENANNT';

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: Tone; rank: number; description: string }> = {
  VERFUEGBAR: { label: 'Verfügbar', tone: 'positive', rank: 4, description: 'Öffentlich als verfügbar belegt (ggf. mit AI Units)' },
  GEPLANT: { label: 'Geplant', tone: 'info', rank: 3, description: 'Von SAP mit Termin angekündigt (z. B. „Planned Q1/2027“)' },
  LAB_PREVIEW: { label: 'Lab Preview', tone: 'agent', rank: 2, description: 'SAP-Folien V128 (10/2026): Lab Preview – kein Produkt' },
  WIP: { label: 'WIP (Kick-off)', tone: 'neutral', rank: 1, description: 'Kick-off-Folie 07/2026 „WIP, subject to change“' },
  NICHT_MEHR_GENANNT: { label: 'Nicht mehr genannt', tone: 'critical', rank: 0, description: 'Im Kick-off genannt, im V128-Stand nicht mehr – Verbleib offen' },
};

export interface EarlierName {
  name: string;
  source: string;
  marker: Marker;
}

export interface SapAgent {
  id: string;
  name: string;
  kind: 'AGENT' | 'KI_FUNKTION';
  areaId: AreaId;
  assistantId?: string;
  product: string;
  status: AgentStatus;
  availability?: string;
  description: string;
  capabilities: string[];
  /** SAP-Rollen, die der Agent unterstützt */
  roles: string[];
  /** Verortung im Prozess (Knoten-IDs, prozessübergreifend eindeutig) */
  nodeIds: string[];
  earlierNames: EarlierName[];
  keywords: string[];
  sourceIds: string[];
  marker: Marker;
  note?: string;
}

export interface JouleAssistant {
  id: string;
  name: string;
  description: string;
  areaIds: AreaId[];
  status: AgentStatus;
  sourceIds: string[];
  marker: Marker;
}

// ---------------------------------------------------------------------------
// Agentenlücken (wo im Prozess noch Agenten fehlen)
// ---------------------------------------------------------------------------

export type GapStatus = 'IDENTIFIZIERT' | 'IN_BEWERTUNG' | 'AN_SAP_ADRESSIERT' | 'GESCHLOSSEN' | 'VERWORFEN';

export const GAP_STATUS: Record<GapStatus, { label: string; tone: Tone }> = {
  IDENTIFIZIERT: { label: 'Identifiziert', tone: 'critical' },
  IN_BEWERTUNG: { label: 'In Bewertung', tone: 'warning' },
  AN_SAP_ADRESSIERT: { label: 'An SAP adressiert', tone: 'info' },
  GESCHLOSSEN: { label: 'Geschlossen', tone: 'positive' },
  VERWORFEN: { label: 'Verworfen', tone: 'neutral' },
};

export interface AgentGap {
  id: string;
  title: string;
  nodeIds: string[];
  description: string;
  /** Vorschlag für einen Agenten, der die Lücke schließt */
  proposedAgent: string;
  benefit: string;
  requirementIds: string[];
  status: GapStatus;
  origin: 'RECHERCHE' | 'TG' | 'ANFORDERUNG';
  marker: Marker;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Quellen
// ---------------------------------------------------------------------------

export type SourceKind = 'SAP_HELP' | 'SAP_LEARNING' | 'SAP_COMMUNITY' | 'SAP_PRODUKT' | 'SAP_NEWS' | 'TG_FOLIEN' | 'TG_UNTERLAGE' | 'PRESSE';

export interface Source {
  id: string;
  title: string;
  url?: string;
  kind: SourceKind;
  date?: string;
  reliability: 'hoch' | 'mittel' | 'niedrig';
  note?: string;
}

// ---------------------------------------------------------------------------
// Anforderungen der Unternehmen
// ---------------------------------------------------------------------------

export type RequirementType = 'USER_STORY' | 'PROZESSTHEMA';
export type RequirementTarget = 'PROZESS' | 'SAP_AGENT' | 'NEUER_AGENT';
export type Priority = 'MUSS' | 'SOLL' | 'KANN';

export const REQUIREMENT_TYPES: Record<RequirementType, { label: string; description: string }> = {
  USER_STORY: { label: 'User Story', description: 'Als <Rolle> möchte ich <Ziel>, damit <Nutzen> – mit Akzeptanzkriterien' },
  PROZESSTHEMA: { label: 'Prozessthema & Anmerkung', description: 'Thema mit freier Anmerkung (z. B. KI-Hook aus einer Liste)' },
};

export const REQUIREMENT_TARGETS: Record<RequirementTarget, { label: string; description: string }> = {
  PROZESS: { label: 'Anforderung an den Prozess', description: 'Standardprozess / Funktion in S/4HANA Service, FSM, Service Cloud' },
  SAP_AGENT: { label: 'Anforderung an einen SAP-Agenten', description: 'Erweiterung oder Feedback zu einem genannten SAP-Agenten' },
  NEUER_AGENT: { label: 'KI-Hook / neuer Agent', description: 'Hier soll ein Agent unterstützen – ob SAP ihn hat, klärt der Abgleich' },
};

export const PRIORITIES: Record<Priority, { label: string; tone: Tone }> = {
  MUSS: { label: 'Muss', tone: 'critical' },
  SOLL: { label: 'Soll', tone: 'warning' },
  KANN: { label: 'Kann', tone: 'neutral' },
};

export interface AcceptanceCriterion {
  given: string;
  when: string;
  then: string;
}

export interface UserStoryContent {
  role: string;
  goal: string;
  benefit: string;
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface Requirement {
  id: string;
  /** Wer die Anforderung besitzt: Nutzer-ID (Artifact), Sitzungskennung (Server) oder „seed“ (ausgeliefert) */
  authorId: string;
  author: string;
  company: string;
  createdAt: string;
  updatedAt: string;
  type: RequirementType;
  target: RequirementTarget;
  category: string;
  title: string;
  note: string;
  story?: UserStoryContent;
  nodeIds: string[];
  sapAgentIds: string[];
  /** Priorität aus Sicht des Unternehmens (optional) */
  priority?: Priority;
  businessValue?: string;
  /** Herkunft, z. B. „Agenten-Hooks-Liste Brunata Metrona“ */
  source?: string;
  withdrawn?: boolean;
}

/** Status in der Themengruppe – entlang der TG-Phasen 1–4 */
export type ReqStatus =
  | 'EINGEREICHT'
  | 'RUECKFRAGE'
  | 'IN_BEWERTUNG'
  | 'PRIORISIERT'
  | 'AN_SAP_UEBERGEBEN'
  | 'IN_UMSETZUNG'
  | 'UMGESETZT'
  | 'ZURUECKGESTELLT'
  | 'ABGELEHNT';

export const REQ_STATUS: Record<ReqStatus, { label: string; tone: Tone; phase: TgPhaseId; description: string; order: number }> = {
  EINGEREICHT: { label: 'Eingereicht', tone: 'info', phase: 'P1', order: 1, description: 'Gesammelt – wartet auf Sichtung durch die Moderation' },
  RUECKFRAGE: { label: 'Rückfrage', tone: 'warning', phase: 'P1', order: 2, description: 'Die TG hat eine Frage an das einreichende Unternehmen' },
  IN_BEWERTUNG: { label: 'In Bewertung', tone: 'agent', phase: 'P2', order: 3, description: 'Abgleich mit SAP-Standard und SAP-Agenten' },
  PRIORISIERT: { label: 'Priorisiert', tone: 'positive', phase: 'P3', order: 4, description: 'Von der TG priorisiert – Kandidat für die Übergabe an SAP' },
  AN_SAP_UEBERGEBEN: { label: 'An SAP übergeben', tone: 'positive', phase: 'P3', order: 5, description: 'Als Use Case / Optimierungsvorschlag an SAP übergeben' },
  IN_UMSETZUNG: { label: 'In Umsetzung (SAP)', tone: 'positive', phase: 'P4', order: 6, description: 'SAP realisiert in Iterationen, gemeinsame Tests' },
  UMGESETZT: { label: 'Umgesetzt', tone: 'positive', phase: 'P4', order: 7, description: 'Im Standard bzw. als SAP-Agent verfügbar' },
  ZURUECKGESTELLT: { label: 'Zurückgestellt', tone: 'neutral', phase: 'P2', order: 8, description: 'Derzeit nicht weiterverfolgt (z. B. außerhalb des Service)' },
  ABGELEHNT: { label: 'Abgelehnt', tone: 'critical', phase: 'P2', order: 9, description: 'Nicht in der TG weiterverfolgt' },
};

/** Ergebnis des Abgleichs mit Prozess, Standard und SAP-Agenten */
export type FitResult = 'STANDARD' | 'SAP_AGENT_VERFUEGBAR' | 'SAP_AGENT_GEPLANT' | 'TEIL_FIT' | 'GAP' | 'OFFEN';

export const FIT_RESULTS: Record<FitResult, { label: string; tone: Tone; description: string }> = {
  STANDARD: { label: 'Im Standard', tone: 'positive', description: 'Prozess/Funktion im SAP-Standard vorhanden – kein Agent nötig' },
  SAP_AGENT_VERFUEGBAR: { label: 'SAP-Agent verfügbar', tone: 'positive', description: 'Durch einen verfügbaren SAP-Agenten bzw. eine KI-Funktion abgedeckt' },
  SAP_AGENT_GEPLANT: { label: 'SAP-Agent geplant', tone: 'agent', description: 'Durch einen geplanten / Lab-Preview-Agenten adressiert – Feedback an SAP' },
  TEIL_FIT: { label: 'Teil-Fit', tone: 'warning', description: 'Teilweise abgedeckt – Anforderung an SAP-Agent oder Standard' },
  GAP: { label: 'Lücke', tone: 'critical', description: 'Kein Standard und kein SAP-Agent – neuer Use Case für SAP' },
  OFFEN: { label: 'Offen', tone: 'neutral', description: 'Noch nicht bewertbar – Rückfrage oder Recherche nötig' },
};

export interface Assessment {
  fit: FitResult;
  summary: string;
  rationale: string;
  nodeIds: string[];
  sapAgentIds: string[];
  standardReference: string;
  recommendation: string;
  verify: string[];
  assessedBy: string;
  assessedAt: string;
  /** Von der Moderation bestätigt (Vorschläge von Agenten/Schnellabgleich sind unbestätigt) */
  confirmed: boolean;
  marker: Marker;
}

export interface ReviewEntry {
  at: string;
  by: string;
  action: string;
  note?: string;
  status?: ReqStatus;
}

export interface RequirementReview {
  requirementId: string;
  status: ReqStatus;
  assessment?: Assessment;
  /** Priorität der TG (1 = höchste) */
  tgPriority?: number;
  sapFeedback?: string;
  gapId?: string;
  history: ReviewEntry[];
  updatedAt: string;
  updatedBy: string;
}

export interface Comment {
  id: string;
  requirementId: string;
  authorId: string;
  author: string;
  company: string;
  text: string;
  at: string;
}

/** „Betrifft uns auch“ – Unterstützung einer Anforderung durch weitere Unternehmen */
export interface Support {
  requirementId: string;
  authorId: string;
  author: string;
  company: string;
  at: string;
}

export interface Profile {
  authorId: string;
  name: string;
  company: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Gesamtmodell
// ---------------------------------------------------------------------------

export interface TgModel {
  meta: Meta;
  processes: ProcessModel[];
  assistants: JouleAssistant[];
  sapAgents: SapAgent[];
  gaps: AgentGap[];
  sources: Source[];
  requirements: Requirement[];
  reviews: RequirementReview[];
  comments: Comment[];
  supports: Support[];
  profiles: Profile[];
}

export const SEED_AUTHOR = 'seed';
