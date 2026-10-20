import { useEffect, useMemo, useState } from 'react';
import type { AgentStatus, Marker } from '@core/types';
import { AGENT_STATUS, MARKERS, isActivity } from '@core/types';
import { COVERAGE, coverageSummary, nodeCoverage } from '@core/coverage';
import { toBpmnXml } from '@core/bpmn';
import { useStore } from '../../data/store';
import { BpmnCanvas, type OverlayFlags } from '../../components/BpmnCanvas';
import { AgentChat } from '../../components/AgentChat';
import { AgentStatusBadge, Badge, CoverageBadge, FitBadge, GapBadge, Id, Kv, MarkerBadge, Meter, Panel, StatusBadge, Tabs, saveFile, useLocalState } from '../../components/ui';
import { reviewOf } from '@core/ops';

export function useDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(query);
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

const ALL_STATUS: AgentStatus[] = ['VERFUEGBAR', 'GEPLANT', 'LAB_PREVIEW', 'WIP'];

export default function ProcessView() {
  const { model, route, go, principal, apply } = useStore();
  const dark = useDark();
  const process = model.processes.find((p) => p.id === route.params.process) ?? model.processes[0];
  const selectedId = route.params.node;
  const [overlays, setOverlays] = useLocalState<OverlayFlags>('tg.overlays.v2', { agents: true, coverage: true, demand: true, gaps: true, customer: false });
  const [statuses, setStatuses] = useLocalState<AgentStatus[]>('tg.statuses.v1', ALL_STATUS);
  const [tab, setTab] = useState<'step' | 'chat'>('step');
  const highlight = route.params.agent ? model.sapAgents.find((a) => a.id === route.params.agent)?.nodeIds : undefined;
  const sum = useMemo(() => coverageSummary(model, process.id), [model, process.id]);
  const select = (nodeId: string | undefined) => go('board', 'process', { process: route.params.process, node: nodeId, agent: route.params.agent });
  const toggle = (k: keyof OverlayFlags) => setOverlays({ ...overlays, [k]: !overlays[k] });

  if (!process) return <div className="page">Kein Prozess im Modell.</div>;
  const node = process.nodes.find((n) => n.id === selectedId);

  return (
    <div className="page process-page">
      <div className="split wide-side">
        <section className="panel canvas-panel">
          <div className="canvas-toolbar">
            <div className="row" style={{ gap: 6 }}>
              {model.processes.length > 1 && (
                <select className="input" style={{ maxWidth: 280 }} value={process.id} onChange={(e) => go('board', 'process', { process: e.target.value })} aria-label="Prozess">
                  {model.processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <label className="toggle">
                <input type="checkbox" checked={overlays.agents} onChange={() => toggle('agents')} /> <span className="ag-dot" /> SAP-Agenten
              </label>
              <label className="toggle">
                <input type="checkbox" checked={overlays.coverage} onChange={() => toggle('coverage')} /> Abdeckung
              </label>
              <label className="toggle">
                <input type="checkbox" checked={overlays.gaps} onChange={() => toggle('gaps')} /> <span className="gap-dot" /> Lücken
              </label>
              <label className="toggle">
                <input type="checkbox" checked={overlays.demand} onChange={() => toggle('demand')} /> ▲ Anforderungen
              </label>
              <label className="toggle">
                <input type="checkbox" checked={overlays.customer} onChange={() => toggle('customer')} /> ◆ Kunde (Pool)
              </label>
            </div>
            <div className="row" style={{ gap: 4 }}>
              {overlays.agents &&
                ALL_STATUS.map((s) => (
                  <button key={s} type="button" className={`chip-filter${statuses.includes(s) ? ' on' : ''} st-${s}`} aria-pressed={statuses.includes(s)} onClick={() => setStatuses(statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s])} title={AGENT_STATUS[s].description}>
                    {AGENT_STATUS[s].label}
                  </button>
                ))}
              <button type="button" className="btn ghost small" onClick={() => void saveFile(`${process.code}-serviceprozess.bpmn`, toBpmnXml(process, model), 'application/xml')} title="BPMN 2.0 XML für Signavio, Camunda, bpmn.io">
                BPMN exportieren
              </button>
            </div>
          </div>
          <BpmnCanvas process={process} model={model} dark={dark} overlays={overlays} statuses={statuses} selectedId={selectedId} highlightIds={highlight} onSelect={select} />
        </section>

        <aside className="sticky-side stack" style={{ gap: 12 }}>
          {route.params.agent && (
            <div className="note info">
              Hervorgehoben: Schritte von <b>{model.sapAgents.find((a) => a.id === route.params.agent)?.name}</b>{' '}
              <button type="button" className="btn ghost small" onClick={() => go('board', 'process', { node: selectedId })}>
                Hervorhebung aufheben
              </button>
            </div>
          )}
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'step', label: node ? `Schritt ${node.id}` : 'Prozess' },
              { id: 'chat', label: '✦ Prozess-Agent fragen' },
            ]}
          />
          {tab === 'chat' ? (
            <div className="panel" style={{ height: 'calc(100vh - 240px)', minHeight: 420 }}>
              <AgentChat
                scope={`process-${process.id}`}
                agents={['prozess-agent']}
                defaultAgentId="prozess-agent"
                focus={{ processId: process.id, nodeId: node?.id }}
                starters={node ? [`Was leistet der SAP-Standard im Schritt „${node.name}“?`, `Welche SAP-Agenten setzen bei ${node.id} an – und was fehlt noch?`, `Welche Anforderungen der Unternehmen betreffen ${node.id}?`] : undefined}
              />
            </div>
          ) : node ? (
            <StepInspector nodeId={node.id} />
          ) : (
            <Panel title={process.name} eyebrow={`Prozess ${process.code} · Version ${process.version}`}>
              <p className="muted">{process.description}</p>
              <p style={{ fontSize: 'var(--fs-sm)' }}>
                <b>Abgrenzung:</b> {process.scope}
              </p>
              <Meter
                segments={(Object.keys(COVERAGE) as (keyof typeof COVERAGE)[]).map((k) => ({ label: COVERAGE[k].label, value: sum.byClass[k], color: `var(--cov-${k})` }))}
                total={sum.activities}
              />
              <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
                {sum.activities} Aktivitäten · {sum.withGap} mit dokumentierter Agentenlücke · {sum.withDemand} mit Anforderungen der Unternehmen. Schritt anklicken für Details, SAP-Agenten und Anforderungen.
              </p>
              <div className="legend-block">
                <span>
                  <span className="ov-sample ag ag-VERFUEGBAR">✦ 2</span> SAP-Agenten am Schritt (Farbe = bester Status)
                </span>
                <span>
                  <span className="ov-sample gap">Lücke</span> dokumentierte Agentenlücke
                </span>
                <span>
                  <span className="ov-sample dem open">▲ 3</span> Anforderungen (gefüllt: Abgleich offen/Teil-Fit/Lücke)
                </span>
                <span>
                  <span className="ov-sample cust">◆</span> Nachricht vom/an den Kunden
                </span>
                <span>
                  <span className="ov-sample mk">?</span> zu verifizieren / offen
                </span>
              </div>
              {principal?.role === 'moderation' && (
                <button type="button" className="btn small" onClick={() => void apply([{ op: 'process.add', process: { code: 'NEU', name: 'Neuer Teilprozess', description: '' } }])}>
                  + Weiteren Prozess anlegen
                </button>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function StepInspector({ nodeId }: { nodeId: string }) {
  const { model, go, principal, apply } = useStore();
  const process = model.processes.find((p) => p.nodes.some((n) => n.id === nodeId))!;
  const node = process.nodes.find((n) => n.id === nodeId)!;
  const cov = nodeCoverage(model, process.id, node);
  const area = model.meta.areas.find((a) => a.id === node.areaId);
  const lane = process.lanes.find((l) => l.id === node.laneId);
  const isMod = principal?.role === 'moderation';
  const [linkAgent, setLinkAgent] = useState('');
  const [editNote, setEditNote] = useState<{ description: string; note: string; marker: Marker } | null>(null);
  const [gapDraft, setGapDraft] = useState<{ title: string; description: string; proposedAgent: string } | null>(null);
  const sys = (id: string) => model.meta.systems.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <Panel
        eyebrow={`${area ? `${area.no} ${area.nameDe}` : node.areaId} · ${lane?.name ?? ''} (${lane?.role ?? ''})`}
        title={
          <span>
            <Id>{node.id}</Id> {node.name || 'Gateway'}
          </span>
        }
        actions={
          <span className="row" style={{ gap: 4 }}>
            <MarkerBadge marker={node.marker} />
            {isActivity(node.type) && <CoverageBadge coverage={cov.coverage} />}
          </span>
        }
      >
        {editNote ? (
          <div className="stack">
            <textarea className="input" rows={4} value={editNote.description} onChange={(e) => setEditNote({ ...editNote, description: e.target.value })} aria-label="Beschreibung" />
            <textarea className="input" rows={2} value={editNote.note} placeholder="Hinweis / Prüfauftrag" onChange={(e) => setEditNote({ ...editNote, note: e.target.value })} aria-label="Hinweis" />
            <select className="input" value={editNote.marker} onChange={(e) => setEditNote({ ...editNote, marker: e.target.value as Marker })} aria-label="Marker">
              {(Object.keys(MARKERS) as Marker[]).map((m) => (
                <option key={m} value={m}>
                  {MARKERS[m].label}
                </option>
              ))}
            </select>
            <div className="row">
              <button
                type="button"
                className="btn primary small"
                onClick={async () => {
                  const res = await apply([{ op: 'process.updateNode', processId: process.id, nodeId: node.id, patch: { description: editNote.description, note: editNote.note, marker: editNote.marker } }]);
                  if (res?.applied) setEditNote(null);
                }}
              >
                Speichern
              </button>
              <button type="button" className="btn ghost small" onClick={() => setEditNote(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <>
            {node.description && <p>{node.description}</p>}
            <Kv
              items={[
                ['Systeme', node.systemIds.length ? node.systemIds.map(sys).join(', ') : null],
                ['Objekte', node.objects.length ? node.objects.join(', ') : null],
                ['Apps / UI', node.apps.length ? node.apps.join(', ') : null],
                ['Scope Items', node.scopeItems.length ? node.scopeItems.join(', ') : null],
                ['Vom Kunden', node.customerInbound ?? null],
                ['An den Kunden', node.customerOutbound ?? null],
              ]}
            />
            {node.note && <div className="note warn">{node.note}</div>}
            {node.sourceIds.length > 0 && (
              <ul className="list-plain sources">
                {node.sourceIds.map((sid) => {
                  const s = model.sources.find((x) => x.id === sid);
                  return <li key={sid}>{s?.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : (s?.title ?? sid)}</li>;
                })}
              </ul>
            )}
            {isMod && (
              <div>
                <button type="button" className="btn ghost small" onClick={() => setEditNote({ description: node.description, note: node.note ?? '', marker: node.marker })}>
                  Beschreibung bearbeiten
                </button>
              </div>
            )}
          </>
        )}
      </Panel>

      {isActivity(node.type) && (
        <Panel title={`SAP-Agenten an diesem Schritt (${cov.agents.length})`} eyebrow="Autonomous Service">
          {cov.agents.length === 0 && <p className="faint">Kein SAP-Agent verortet.</p>}
          <ul className="list-plain agent-list">
            {cov.agents.map((a) => (
              <li key={a.id}>
                <div className="row between">
                  <button type="button" className="link-btn" onClick={() => go('board', 'agents', { agent: a.id })}>
                    ✦ {a.name}
                  </button>
                  <span className="row" style={{ gap: 4 }}>
                    <AgentStatusBadge status={a.status} availability={a.availability} />
                    {isMod && (
                      <button type="button" className="btn ghost small" title="Verortung lösen" onClick={() => void apply([{ op: 'agent.unlink', agentId: a.id, nodeId: node.id }])}>
                        ×
                      </button>
                    )}
                  </span>
                </div>
                <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                  {a.product}
                  {a.availability ? ` · ${a.availability}` : ''} – {a.description}
                </span>
              </li>
            ))}
          </ul>
          {isMod && (
            <div className="row">
              <select className="input" style={{ flex: 1 }} value={linkAgent} onChange={(e) => setLinkAgent(e.target.value)} aria-label="Agent verorten">
                <option value="">SAP-Agent an diesem Schritt verorten …</option>
                {model.sapAgents
                  .filter((a) => !a.nodeIds.includes(node.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({AGENT_STATUS[a.status].label})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn small"
                disabled={!linkAgent}
                onClick={async () => {
                  const res = await apply([{ op: 'agent.link', agentId: linkAgent, nodeId: node.id }]);
                  if (res?.applied) setLinkAgent('');
                }}
              >
                Verorten
              </button>
            </div>
          )}
        </Panel>
      )}

      {isActivity(node.type) && (
        <Panel title={`Agentenlücken (${cov.gaps.length})`} eyebrow="Wo fehlen Agenten?">
          {cov.gaps.length === 0 && <p className="faint">Keine dokumentierte Lücke.</p>}
          {cov.gaps.map((g) => (
            <div key={g.id} className="gap-card" onClick={() => go('board', 'gaps', { gap: g.id })} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go('board', 'gaps', { gap: g.id })}>
              <div className="row between">
                <b>
                  {g.id} {g.title}
                </b>
                <GapBadge status={g.status} />
              </div>
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Vorschlag: {g.proposedAgent}
              </span>
            </div>
          ))}
          {isMod &&
            (gapDraft ? (
              <div className="stack">
                <input className="input" placeholder="Titel der Lücke" value={gapDraft.title} onChange={(e) => setGapDraft({ ...gapDraft, title: e.target.value })} />
                <textarea className="input" rows={3} placeholder="Was fehlt hier?" value={gapDraft.description} onChange={(e) => setGapDraft({ ...gapDraft, description: e.target.value })} />
                <input className="input" placeholder="Vorgeschlagener Agent" value={gapDraft.proposedAgent} onChange={(e) => setGapDraft({ ...gapDraft, proposedAgent: e.target.value })} />
                <div className="row">
                  <button
                    type="button"
                    className="btn primary small"
                    disabled={!gapDraft.title.trim() || !gapDraft.description.trim()}
                    onClick={async () => {
                      const res = await apply([{ op: 'gap.add', gap: { ...gapDraft, benefit: '', nodeIds: [node.id], origin: 'TG' } }]);
                      if (res?.applied) setGapDraft(null);
                    }}
                  >
                    Lücke anlegen
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setGapDraft(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn small" onClick={() => setGapDraft({ title: '', description: '', proposedAgent: '' })}>
                + Agentenlücke an diesem Schritt
              </button>
            ))}
        </Panel>
      )}

      {isActivity(node.type) && (
        <Panel title={`Anforderungen der Unternehmen (${cov.requirements.length})`} eyebrow="Gespiegelt aus dem Anforderungsportal">
          {cov.requirements.length === 0 && <p className="faint">Noch keine Anforderung an diesem Schritt.</p>}
          <ul className="list-plain">
            {cov.requirements.map((r) => {
              const a = reviewOf(model, r.id).assessment;
              return (
                <li key={r.id} className="req-line">
                  <button type="button" className="link-btn" onClick={() => go('board', 'requirements', { req: r.id })}>
                    <span className="mono">{r.id}</span> {r.title}
                  </button>
                  <span className="row" style={{ gap: 4 }}>
                    <Badge tone="neutral">{r.company}</Badge>
                    <StatusBadge model={model} req={r} />
                    {a && <FitBadge fit={a.fit} confirmed={a.confirmed} />}
                  </span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn small" onClick={() => go('portal', 'new', { node: node.id })}>
            + Anforderung an diesen Schritt stellen
          </button>
        </Panel>
      )}
    </div>
  );
}
