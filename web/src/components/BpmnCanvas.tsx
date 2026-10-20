import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import type { AgentStatus, ProcessModel, TgModel } from '@core/types';
import { AGENT_STATUS, isActivity } from '@core/types';
import { bpmnId, toBpmnXml } from '@core/bpmn';
import { processCoverage } from '@core/coverage';
import { esc } from './ui';

type Viewer = InstanceType<typeof NavigatedViewer>;
interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Canvas {
  zoom(level?: number | 'fit-viewport', center?: 'auto' | { x: number; y: number }): number;
  viewbox(box?: ViewBox): ViewBox & { inner: ViewBox; outer: { width: number; height: number } };
  addMarker(id: string, cls: string): void;
  removeMarker(id: string, cls: string): void;
  resized(): void;
  scrollToElement?(el: unknown, padding?: number): void;
}

export interface OverlayFlags {
  /** SAP-Agenten an den Schritten */
  agents: boolean;
  /** Einfärbung nach Agentenabdeckung */
  coverage: boolean;
  /** Bedarf der Unternehmen (Anzahl Anforderungen) */
  demand: boolean;
  /** Dokumentierte Agentenlücken */
  gaps: boolean;
  /** Kunden-Pool mit Nachrichten vom/an den Kunden */
  customer: boolean;
}

interface Props {
  process: ProcessModel;
  model: TgModel;
  dark: boolean;
  overlays: OverlayFlags;
  /** Welche Agentenstatus eingeblendet werden */
  statuses: AgentStatus[];
  selectedId?: string;
  /** z. B. Schritte eines gewählten Agenten oder einer Anforderung */
  highlightIds?: string[];
  onSelect?: (nodeId: string | undefined) => void;
  className?: string;
  style?: CSSProperties;
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const FONT = "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif";

function createViewer(container: HTMLElement): Viewer {
  return new NavigatedViewer({
    container,
    bpmnRenderer: {
      defaultFillColor: cssVar('--surface', '#ffffff'),
      defaultStrokeColor: cssVar('--ink-2', '#4b5a68'),
      defaultLabelColor: cssVar('--ink', '#13212c'),
    },
    textRenderer: {
      defaultStyle: { fontFamily: FONT, fontSize: 11, lineHeight: 1.2 },
      externalStyle: { fontFamily: FONT, fontSize: 10.5, lineHeight: 1.2 },
    },
  });
}

/** Lesbarer Einstieg: Prozessanfang links oben, Maßstab nach Höhe statt „alles einpassen“. */
function initialView(canvas: Canvas) {
  const { inner, outer } = canvas.viewbox();
  if (!outer.width || !outer.height) return canvas.zoom('fit-viewport', 'auto');
  const scale = Math.min(1, Math.max(0.55, (outer.height - 10) / (inner.height + 40)));
  canvas.viewbox({ x: inner.x - 16, y: inner.y - 16, width: outer.width / scale, height: outer.height / scale });
}

/**
 * BPMN-Leinwand (bpmn-js, nur Ansicht): rendert das aus dem Modell erzeugte BPMN 2.0 XML und legt die
 * TG-Sicht darüber – SAP-Agenten je Schritt, Abdeckung, Bedarf der Unternehmen, Agentenlücken.
 */
export function BpmnCanvas({ process, model, dark, overlays, statuses, selectedId, highlightIds, onSelect, className, style }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<{ viewer: Viewer; dark: boolean; imported: boolean; processId: string } | null>(null);
  const keptBox = useRef<{ processId: string; box: ViewBox } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const lastClick = useRef<string | undefined>(undefined);
  const [generation, setGeneration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const xml = useMemo(() => toBpmnXml(process, model, { includeCustomer: overlays.customer }), [process, model, overlays.customer]);
  const idMap = useMemo(() => new Map(process.nodes.map((n) => [bpmnId(n.id), n.id])), [process]);
  const idMapRef = useRef(idMap);
  idMapRef.current = idMap;
  const coverage = useMemo(() => processCoverage(model, process.id), [model, process.id]);

  useEffect(
    () => () => {
      instRef.current?.viewer.destroy();
      instRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => instRef.current?.imported && instRef.current.viewer.get<Canvas>('canvas').resized());
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inst = instRef.current;
    if (inst?.imported) {
      const b = inst.viewer.get<Canvas>('canvas').viewbox();
      keptBox.current = { processId: inst.processId, box: { x: b.x, y: b.y, width: b.width, height: b.height } };
    }
    if (inst && inst.dark !== dark) {
      inst.viewer.destroy();
      inst = null;
    }
    if (!inst) {
      const viewer = createViewer(hostRef.current!);
      const bus = viewer.get<{ on(e: string, fn: (ev: { element: { id: string; businessObject?: { id?: string } } }) => void): void }>('eventBus');
      bus.on('element.click', (ev) => {
        const nodeId = idMapRef.current.get(ev.element.businessObject?.id ?? ev.element.id);
        lastClick.current = nodeId;
        onSelectRef.current?.(nodeId);
      });
      inst = { viewer, dark, imported: false, processId: process.id };
      instRef.current = inst;
    }
    const current = inst;
    current.viewer
      .importXML(xml)
      .then(() => {
        if (cancelled) return;
        const canvas = current.viewer.get<Canvas>('canvas');
        const kept = keptBox.current;
        if (kept && kept.processId === process.id) canvas.viewbox(kept.box);
        else initialView(canvas);
        current.imported = true;
        current.processId = process.id;
        setError(null);
        setGeneration((g) => g + 1);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [xml, dark, process.id]);

  // Overlays: Agenten, Bedarf, Lücken, Kundenkontakt
  useEffect(() => {
    const inst = instRef.current;
    if (!inst?.imported) return;
    const ov = inst.viewer.get<{ clear(): void; add(id: string, o: { position: Record<string, number>; html: string }): void }>('overlays');
    const registry = inst.viewer.get<{ get(id: string): unknown }>('elementRegistry');
    ov.clear();
    const show = new Set(statuses);
    for (const n of process.nodes) {
      const id = bpmnId(n.id);
      if (!registry.get(id) || !isActivity(n.type)) continue;
      const c = coverage.get(n.id);
      if (!c) continue;
      const top: string[] = [];
      if (overlays.agents) {
        const agents = c.agents.filter((a) => show.has(a.status));
        if (agents.length) {
          const best = agents[0].status;
          const title = agents.map((a) => `${a.name} – ${AGENT_STATUS[a.status].label}`).join('\n');
          top.push(`<span class="ag ag-${best}" title="${esc(title)}">✦ ${agents.length}</span>`);
        }
      }
      if (overlays.gaps && c.gaps.length) top.push(`<span class="gap" title="${esc(c.gaps.map((g) => `${g.id} ${g.title}`).join('\n'))}">Lücke</span>`);
      if (top.length) ov.add(id, { position: { top: -11, left: 0 }, html: `<div class="ov">${top.join('')}</div>` });
      const bottom: string[] = [];
      if (overlays.demand && c.requirements.length) {
        const open = c.openDemand.length;
        bottom.push(`<span class="dem${open ? ' open' : ''}" title="${esc(c.requirements.map((r) => `${r.id} ${r.title} (${r.company})`).join('\n'))}">▲ ${c.requirements.length}</span>`);
      }
      if (overlays.customer && (n.customerInbound || n.customerOutbound)) bottom.push(`<span class="cust" title="${esc([n.customerInbound && `vom Kunden: ${n.customerInbound}`, n.customerOutbound && `an den Kunden: ${n.customerOutbound}`].filter(Boolean).join('\n'))}">◆</span>`);
      if (n.marker === 'ZU_VERIFIZIEREN' || n.marker === 'OFFEN') bottom.push(`<span class="mk" title="${esc(n.note ?? n.marker)}">?</span>`);
      if (bottom.length) ov.add(id, { position: { bottom: 5, right: 4 }, html: `<div class="ov">${bottom.join('')}</div>` });
    }
  }, [generation, overlays.agents, overlays.demand, overlays.gaps, overlays.customer, statuses, process, coverage]);

  // Marker: Auswahl, Hervorhebung, Abdeckung
  useEffect(() => {
    const inst = instRef.current;
    if (!inst?.imported) return;
    const canvas = inst.viewer.get<Canvas>('canvas');
    const registry = inst.viewer.get<{ get(id: string): unknown }>('elementRegistry');
    const hi = new Set(highlightIds ?? []);
    for (const n of process.nodes) {
      const id = bpmnId(n.id);
      if (!registry.get(id)) continue;
      const set = (cls: string, on: boolean) => (on ? canvas.addMarker(id, cls) : canvas.removeMarker(id, cls));
      const c = coverage.get(n.id);
      set('is-selected', n.id === selectedId);
      set('is-hi', hi.has(n.id));
      set('is-dim', hi.size > 0 && !hi.has(n.id) && isActivity(n.type));
      for (const k of ['VERFUEGBAR', 'GEPLANT', 'LUECKE', 'OHNE']) set(`cov-${k}`, overlays.coverage && isActivity(n.type) && c?.coverage === k);
      set('has-gap', overlays.gaps && Boolean(c?.gaps.length));
    }
    if (selectedId && selectedId !== lastClick.current) {
      const el = registry.get(bpmnId(selectedId));
      if (el && canvas.scrollToElement) canvas.scrollToElement(el, 160);
    }
    lastClick.current = undefined;
  }, [generation, selectedId, highlightIds, process, coverage, overlays.coverage, overlays.gaps]);

  const zoom = (factor: number | 'fit' | 'start') => {
    const canvas = instRef.current?.viewer.get<Canvas>('canvas');
    if (!canvas) return;
    if (factor === 'start') initialView(canvas);
    else if (factor === 'fit') canvas.zoom('fit-viewport', 'auto');
    else canvas.zoom(canvas.zoom() * factor, 'auto');
  };

  return (
    <div className={`bpmn-host ${className ?? ''}`} style={style}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      {error && (
        <div className="note crit" style={{ position: 'absolute', inset: '12px 12px auto 12px', zIndex: 6 }}>
          <strong>BPMN konnte nicht dargestellt werden</strong>
          <span>{error}</span>
        </div>
      )}
      <div className="zoom-tools">
        <button type="button" className="btn small" onClick={() => zoom(1.2)} aria-label="Vergrößern">
          +
        </button>
        <button type="button" className="btn small" onClick={() => zoom(1 / 1.2)} aria-label="Verkleinern">
          −
        </button>
        <button type="button" className="btn small" onClick={() => zoom('fit')} title="Ganzen Prozess einpassen">
          Alles
        </button>
        <button type="button" className="btn small" onClick={() => zoom('start')} title="Prozessanfang lesbar anzeigen">
          Start
        </button>
      </div>
    </div>
  );
}
