/**
 * Erzeugt BPMN 2.0 XML (inkl. Diagram Interchange) aus dem Prozessmodell.
 * Das XML ist in SAP Signavio Process Manager, Camunda Modeler und bpmn.io importierbar.
 *
 * Layout: Spalten = längster Pfad ab Start (Rückkanten ausgenommen), Zeilen = Lanes;
 * mehrere Knoten derselben Lane/Spalte werden innerhalb der Lane gestapelt.
 * Kunde als zugeklappter Pool mit Message Flows (Nachrichten vom/an den Kunden).
 */
import type { NodeType, ProcessModel, ProcessNode, TgModel } from './types';
import { MARKERS, isActivity, isGateway } from './types';

export interface BpmnOptions {
  /** Kunden-Pool mit Message Flows (Nachrichten vom/an den Kunden) */
  includeCustomer?: boolean;
  /** Systemkürzel in den Aufgabennamen ergänzen (z. B. "[S/4]") */
  systemTags?: boolean;
}

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessLayout {
  nodes: Map<string, LayoutBox>;
  lanes: Map<string, LayoutBox>;
  pool: LayoutBox;
  customerPool: LayoutBox;
  columns: Map<string, number>;
  width: number;
  height: number;
}

const COL_W = 175;
const ROW_H = 130;
const LANE_MIN_H = 150;
const POOL_LABEL = 30;
const LANE_LABEL = 30;
const FIRST_COL_CENTER = POOL_LABEL + LANE_LABEL + 85;
const CUSTOMER_H = 70;
const POOL_GAP = 70;

function sizeOf(type: NodeType): { w: number; h: number } {
  if (isActivity(type)) return { w: 124, h: 84 };
  if (isGateway(type)) return { w: 50, h: 50 };
  return { w: 36, h: 36 };
}

export function computeLayout(p: ProcessModel, options: BpmnOptions = {}): ProcessLayout {
  const includeCustomer = options.includeCustomer ?? true;
  const ids = p.nodes.map((n) => n.id);
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const f of p.flows) if (out.has(f.from) && out.has(f.to)) out.get(f.from)!.push(f.to);

  // Rückkanten per DFS erkennen
  const back = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();
  const starts = p.nodes.filter((n) => n.type === 'startEvent' || n.type === 'messageStartEvent').map((n) => n.id);
  const dfs = (id: string) => {
    state.set(id, 1);
    for (const nxt of out.get(id) ?? []) {
      const s = state.get(nxt) ?? 0;
      if (s === 1) back.add(`${id}>${nxt}`);
      else if (s === 0) dfs(nxt);
    }
    state.set(id, 2);
  };
  [...starts, ...ids].forEach((id) => (state.get(id) ?? 0) === 0 && dfs(id));

  // Längster Pfad (Kahn) auf dem DAG
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const [from, tos] of out) for (const to of tos) if (!back.has(`${from}>${to}`)) indeg.set(to, (indeg.get(to) ?? 0) + 1);
  const col = new Map<string, number>(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nxt of out.get(cur) ?? []) {
      if (back.has(`${cur}>${nxt}`)) continue;
      col.set(nxt, Math.max(col.get(nxt) ?? 0, (col.get(cur) ?? 0) + 1));
      indeg.set(nxt, (indeg.get(nxt) ?? 0) - 1);
      if (indeg.get(nxt) === 0) queue.push(nxt);
    }
  }

  // Zeilen innerhalb der Lanes
  const rowOf = new Map<string, number>();
  const laneRows = new Map<string, number>(p.lanes.map((l) => [l.id, 1]));
  const bucket = new Map<string, string[]>();
  for (const n of p.nodes) {
    const key = `${n.laneId}|${col.get(n.id)}`;
    bucket.set(key, [...(bucket.get(key) ?? []), n.id]);
  }
  for (const [key, members] of bucket) {
    const laneId = key.split('|')[0];
    members.forEach((id, i) => rowOf.set(id, i));
    laneRows.set(laneId, Math.max(laneRows.get(laneId) ?? 1, members.length));
  }

  const maxCol = Math.max(0, ...[...col.values()]);
  const width = FIRST_COL_CENTER + maxCol * COL_W + 110;
  const customerPool: LayoutBox = { x: 0, y: 0, width, height: includeCustomer ? CUSTOMER_H : 0 };
  const poolY = includeCustomer ? CUSTOMER_H + POOL_GAP : 0;

  const lanes = new Map<string, LayoutBox>();
  let y = poolY;
  for (const lane of p.lanes) {
    const rows = laneRows.get(lane.id) ?? 1;
    const h = Math.max(LANE_MIN_H, rows * ROW_H + 20);
    lanes.set(lane.id, { x: POOL_LABEL, y, width: width - POOL_LABEL, height: h });
    y += h;
  }
  const pool: LayoutBox = { x: 0, y: poolY, width, height: Math.max(y - poolY, LANE_MIN_H) };

  const nodes = new Map<string, LayoutBox>();
  for (const n of p.nodes) {
    const lane = lanes.get(n.laneId);
    if (!lane) continue;
    const rows = laneRows.get(n.laneId) ?? 1;
    const { w, h } = sizeOf(n.type);
    const cx = FIRST_COL_CENTER + (col.get(n.id) ?? 0) * COL_W;
    const rowSpace = lane.height / rows;
    const cy = lane.y + rowSpace * ((rowOf.get(n.id) ?? 0) + 0.5);
    nodes.set(n.id, { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h });
  }

  return { nodes, lanes, pool, customerPool, columns: col, width, height: pool.y + pool.height };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const ncname = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^([^A-Za-z_])/, '_$1');

function elementTag(type: NodeType): { tag: string; def?: 'message' | 'timer' } {
  switch (type) {
    case 'startEvent':
      return { tag: 'startEvent' };
    case 'messageStartEvent':
      return { tag: 'startEvent', def: 'message' };
    case 'endEvent':
      return { tag: 'endEvent' };
    case 'messageEndEvent':
      return { tag: 'endEvent', def: 'message' };
    case 'messageCatchEvent':
      return { tag: 'intermediateCatchEvent', def: 'message' };
    case 'timerCatchEvent':
      return { tag: 'intermediateCatchEvent', def: 'timer' };
    case 'messageThrowEvent':
      return { tag: 'intermediateThrowEvent', def: 'message' };
    default:
      return { tag: type };
  }
}

type Pt = { x: number; y: number };

/** Knoten, die ein horizontales Segment schneiden (ohne Quelle/Ziel). */
function crossing(y: number, x1: number, x2: number, obstacles: LayoutBox[]): LayoutBox[] {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  return obstacles.filter((b) => b.y - 4 < y && y < b.y + b.height + 4 && b.x < hi && b.x + b.width > lo);
}

function routeSequence(s: LayoutBox, t: LayoutBox, sType: NodeType, tType: NodeType, obstacles: LayoutBox[] = []): Pt[] {
  const sc = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  const tc = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  const forward = t.x > s.x + s.width - 1;
  if (forward) {
    if (Math.abs(sc.y - tc.y) < 2) {
      const others = obstacles.filter((b) => b !== s && b !== t);
      const blockers = crossing(sc.y, s.x + s.width, t.x, others);
      if (!blockers.length) return [{ x: s.x + s.width, y: sc.y }, { x: t.x, y: tc.y }];
      // Umweg über oder unter den blockierenden Knoten führen
      const above = Math.min(...blockers.map((b) => b.y), s.y, t.y) - 16;
      const below = Math.max(...blockers.map((b) => b.y + b.height), s.y + s.height, t.y + t.height) + 16;
      const detourY = crossing(above, sc.x, tc.x, others).length === 0 || crossing(below, sc.x, tc.x, others).length > 0 ? above : below;
      const exitY = detourY < sc.y ? s.y : s.y + s.height;
      const entryY = detourY < tc.y ? t.y : t.y + t.height;
      return [{ x: sc.x, y: exitY }, { x: sc.x, y: detourY }, { x: tc.x, y: detourY }, { x: tc.x, y: entryY }];
    }
    if (isGateway(sType)) {
      const exitY = tc.y < sc.y ? s.y : s.y + s.height;
      return [{ x: sc.x, y: exitY }, { x: sc.x, y: tc.y }, { x: t.x, y: tc.y }];
    }
    if (isGateway(tType)) {
      const entryY = sc.y < tc.y ? t.y : t.y + t.height;
      return [{ x: s.x + s.width, y: sc.y }, { x: tc.x, y: sc.y }, { x: tc.x, y: entryY }];
    }
    const midX = Math.round((s.x + s.width + t.x) / 2);
    return [{ x: s.x + s.width, y: sc.y }, { x: midX, y: sc.y }, { x: midX, y: tc.y }, { x: t.x, y: tc.y }];
  }
  // gleiche Spalte (gestapelt) oder Rückkante: unten herum führen
  if (Math.abs(sc.x - tc.x) < 2) {
    return tc.y > sc.y
      ? [{ x: sc.x, y: s.y + s.height }, { x: tc.x, y: t.y }]
      : [{ x: sc.x, y: s.y }, { x: tc.x, y: t.y + t.height }];
  }
  const detourY = Math.max(s.y + s.height, t.y + t.height) + 22;
  return [
    { x: sc.x, y: s.y + s.height },
    { x: sc.x, y: detourY },
    { x: tc.x, y: detourY },
    { x: tc.x, y: t.y + t.height },
  ];
}

function labelBoundsFor(n: ProcessNode, b: LayoutBox): LayoutBox | null {
  if (isActivity(n.type)) return null;
  if (isGateway(n.type)) return { x: b.x - 35, y: b.y - 40, width: 120, height: 34 };
  return { x: b.x - 42, y: b.y + b.height + 4, width: 120, height: 40 };
}

function documentation(model: TgModel | undefined, n: ProcessNode): string {
  const parts: string[] = [];
  if (n.description) parts.push(n.description);
  if (model) {
    const sys = n.systemIds.map((id) => model.meta.systems.find((s) => s.id === id)?.name ?? id);
    if (sys.length) parts.push(`Systeme: ${sys.join(', ')}`);
    const agents = model.sapAgents.filter((a) => a.nodeIds.includes(n.id)).map((a) => `${a.name} (${a.status})`);
    if (agents.length) parts.push(`SAP-Agenten: ${agents.join(', ')}`);
  }
  if (n.objects.length) parts.push(`Objekte: ${n.objects.join(', ')}`);
  if (n.apps.length) parts.push(`Apps: ${n.apps.join(', ')}`);
  if (n.scopeItems.length) parts.push(`Scope Items: ${n.scopeItems.join(', ')}`);
  if (n.note) parts.push(`Hinweis: ${n.note}`);
  parts.push(`Marker: ${MARKERS[n.marker]?.label ?? n.marker}`);
  return parts.join('\n');
}

/** BPMN 2.0 XML mit Kollaboration (Kunde ↔ Serviceorganisation) und Lanes. */
export function toBpmnXml(p: ProcessModel, model?: TgModel, options: BpmnOptions = {}): string {
  const includeCustomer = options.includeCustomer ?? true;
  const layout = computeLayout(p, { includeCustomer });
  const pid = `Process_${ncname(p.code)}`;
  const nodeById = new Map(p.nodes.map((n) => [n.id, n]));
  const sysShort = (id: string) => model?.meta.systems.find((s) => s.id === id)?.short ?? id;

  const flowsIn = new Map<string, string[]>();
  const flowsOut = new Map<string, string[]>();
  for (const f of p.flows) {
    flowsOut.set(f.from, [...(flowsOut.get(f.from) ?? []), `Flow_${f.id}`]);
    flowsIn.set(f.to, [...(flowsIn.get(f.to) ?? []), `Flow_${f.id}`]);
  }

  const nodeXml = p.nodes
    .map((n) => {
      const { tag, def } = elementTag(n.type);
      const name = options.systemTags && n.systemIds.length && isActivity(n.type) ? `${n.name} [${n.systemIds.map(sysShort).join('/')}]` : n.name;
      const defaultFlow = isGateway(n.type) ? p.flows.find((f) => f.from === n.id && f.isDefault) : undefined;
      const attrs = [`id="${ncname(n.id)}"`, `name="${esc(name)}"`];
      if (defaultFlow) attrs.push(`default="Flow_${ncname(defaultFlow.id)}"`);
      if (n.type === 'callActivity') attrs.push(`calledElement="${esc(n.name)}"`);
      const inner = [
        `      <bpmn:documentation>${esc(documentation(model, n))}</bpmn:documentation>`,
        ...(flowsIn.get(n.id) ?? []).map((f) => `      <bpmn:incoming>${ncname(f)}</bpmn:incoming>`),
        ...(flowsOut.get(n.id) ?? []).map((f) => `      <bpmn:outgoing>${ncname(f)}</bpmn:outgoing>`),
      ];
      if (def === 'message') inner.push(`      <bpmn:messageEventDefinition id="${ncname(n.id)}_def" />`);
      if (def === 'timer') inner.push(`      <bpmn:timerEventDefinition id="${ncname(n.id)}_def" />`);
      return `    <bpmn:${tag} ${attrs.join(' ')}>\n${inner.join('\n')}\n    </bpmn:${tag}>`;
    })
    .join('\n');

  const flowXml = p.flows
    .map((f) => {
      const attrs = [`id="Flow_${ncname(f.id)}"`, `sourceRef="${ncname(f.from)}"`, `targetRef="${ncname(f.to)}"`];
      if (f.label) attrs.push(`name="${esc(f.label)}"`);
      return `    <bpmn:sequenceFlow ${attrs.join(' ')} />`;
    })
    .join('\n');

  const laneXml = p.lanes
    .map((l) => {
      const refs = p.nodes.filter((n) => n.laneId === l.id).map((n) => `        <bpmn:flowNodeRef>${ncname(n.id)}</bpmn:flowNodeRef>`);
      return `      <bpmn:lane id="Lane_${ncname(l.id)}" name="${esc(l.name)}">\n${refs.join('\n')}\n      </bpmn:lane>`;
    })
    .join('\n');

  // Message Flows: Kunde → eingehende Nachrichten, Prozessschritte → Kunde
  type Msg = { id: string; name: string; source: string; target: string; points: Pt[]; label: LayoutBox };
  const msgs: Msg[] = [];
  if (includeCustomer) {
    const poolBottom = layout.customerPool.y + layout.customerPool.height;
    for (const n of p.nodes) {
      if (!n.customerInbound) continue;
      const b = layout.nodes.get(n.id);
      if (!b) continue;
      const x = b.x + b.width / 2 - 8;
      msgs.push({
        id: `Msg_in_${ncname(n.id)}`,
        name: n.customerInbound,
        source: 'Participant_Kunde',
        target: ncname(n.id),
        points: [{ x, y: poolBottom }, { x, y: b.y }],
        label: { x: x - 92, y: poolBottom + 6, width: 86, height: 40 },
      });
    }
    for (const n of p.nodes) {
      if (!n.customerOutbound) continue;
      const b = layout.nodes.get(n.id);
      if (!b) continue;
      const x = b.x + b.width / 2 + 8;
      msgs.push({
        id: `Msg_out_${ncname(n.id)}`,
        name: n.customerOutbound,
        source: ncname(n.id),
        target: 'Participant_Kunde',
        points: [{ x, y: b.y }, { x, y: poolBottom }],
        label: { x: x + 4, y: poolBottom + 6, width: 86, height: 40 },
      });
    }
  }

  const participantName = `${p.code} ${p.name}`;
  const collaboration = [
    `  <bpmn:collaboration id="Collaboration_${ncname(p.code)}">`,
    includeCustomer ? `    <bpmn:participant id="Participant_Kunde" name="${esc(p.customerPool)}" />` : '',
    `    <bpmn:participant id="Participant_Main" name="${esc(participantName)}" processRef="${pid}" />`,
    ...msgs.map((m) => `    <bpmn:messageFlow id="${m.id}" name="${esc(m.name)}" sourceRef="${m.source}" targetRef="${m.target}" />`),
    `  </bpmn:collaboration>`,
  ]
    .filter(Boolean)
    .join('\n');

  const shape = (id: string, b: LayoutBox, extra = '', label?: LayoutBox | null) =>
    `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"${extra}>\n        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" />${
      label ? `\n        <bpmndi:BPMNLabel>\n          <dc:Bounds x="${label.x}" y="${label.y}" width="${label.width}" height="${label.height}" />\n        </bpmndi:BPMNLabel>` : ''
    }\n      </bpmndi:BPMNShape>`;
  const edge = (id: string, pts: Pt[], label?: LayoutBox) =>
    `      <bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">\n${pts.map((pt) => `        <di:waypoint x="${Math.round(pt.x)}" y="${Math.round(pt.y)}" />`).join('\n')}${
      label ? `\n        <bpmndi:BPMNLabel>\n          <dc:Bounds x="${label.x}" y="${label.y}" width="${label.width}" height="${label.height}" />\n        </bpmndi:BPMNLabel>` : ''
    }\n      </bpmndi:BPMNEdge>`;

  const di: string[] = [];
  if (includeCustomer) di.push(shape('Participant_Kunde', layout.customerPool, ' isHorizontal="true"'));
  di.push(shape('Participant_Main', layout.pool, ' isHorizontal="true"'));
  for (const l of p.lanes) {
    const b = layout.lanes.get(l.id);
    if (b) di.push(shape(`Lane_${ncname(l.id)}`, b, ' isHorizontal="true"'));
  }
  for (const n of p.nodes) {
    const b = layout.nodes.get(n.id);
    if (!b) continue;
    const extra = n.type === 'exclusiveGateway' ? ' isMarkerVisible="true"' : '';
    di.push(shape(ncname(n.id), b, extra, labelBoundsFor(n, b)));
  }
  for (const f of p.flows) {
    const s = layout.nodes.get(f.from);
    const t = layout.nodes.get(f.to);
    const sn = nodeById.get(f.from);
    const tn = nodeById.get(f.to);
    if (!s || !t || !sn || !tn) continue;
    const pts = routeSequence(s, t, sn.type, tn.type, [...layout.nodes.values()]);
    const label = f.label ? { x: Math.round(pts[0].x + 6), y: Math.round(pts[0].y - (pts[1] && pts[1].y > pts[0].y ? -4 : 30)), width: 90, height: 27 } : undefined;
    di.push(edge(`Flow_${ncname(f.id)}`, pts, label));
  }
  for (const m of msgs) di.push(edge(m.id, m.points, m.label));

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_${ncname(p.code)}" targetNamespace="urn:tg-ki-im-service:bpmn:${ncname(p.code)}" exporter="TG KI im Service – Arbeitsplattform" exporterVersion="${esc(p.version)}">
${collaboration}
  <bpmn:process id="${pid}" name="${esc(participantName)}" isExecutable="false">
    <bpmn:documentation>${esc(`${p.description}\nAbgrenzung: ${p.scope}`)}</bpmn:documentation>
    <bpmn:laneSet id="LaneSet_${ncname(p.code)}">
${laneXml}
    </bpmn:laneSet>
${nodeXml}
${flowXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${ncname(p.code)}">
    <bpmndi:BPMNPlane id="Plane_${ncname(p.code)}" bpmnElement="Collaboration_${ncname(p.code)}">
${di.join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

export { ncname as bpmnId };
