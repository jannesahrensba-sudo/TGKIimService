import { useState } from 'react';
import type { GapStatus } from '@core/types';
import { GAP_STATUS, isActivity } from '@core/types';
import { COVERAGE, coverageSummary, nodeCoverage, requirementNodeIds } from '@core/coverage';
import { reviewOf } from '@core/ops';
import { findNode } from '@core/queries';
import { useStore } from '../../data/store';
import { Badge, ConfirmButton, Empty, FitBadge, GapBadge, Id, MarkerBadge, Meter, Panel, StatusBadge } from '../../components/ui';

/** Wo im Prozess fehlen Agenten? Abdeckungskarte je Bereich, dokumentierte Lücken, KI-Hooks ohne Lücke. */
export function GapsView() {
  const { model, route, go, principal, apply } = useStore();
  const process = model.processes[0];
  const isMod = principal?.role === 'moderation';
  const [statusFilter, setStatusFilter] = useState<GapStatus | ''>('');
  if (!process) return <div className="page">Kein Prozess.</div>;
  const sum = coverageSummary(model, process.id);
  const steps = process.nodes.filter((n) => isActivity(n.type)).map((n) => nodeCoverage(model, process.id, n));
  const gaps = model.gaps.filter((g) => !statusFilter || g.status === statusFilter);
  const linked = new Set(model.reviews.filter((r) => r.gapId).map((r) => r.requirementId));
  const hooks = model.requirements.filter((r) => {
    if (r.withdrawn || linked.has(r.id)) return false;
    const rv = reviewOf(model, r.id);
    if (rv.status === 'ABGELEHNT' || rv.status === 'ZURUECKGESTELLT') return false;
    return rv.assessment?.fit === 'GAP' || (!rv.assessment && r.target === 'NEUER_AGENT');
  });

  return (
    <div className="page">
      <div className="grid cols-4">
        <div className="panel stat">
          <span className="eyebrow">Schritte (Aktivitäten)</span>
          <span className="value">{sum.activities}</span>
        </div>
        <div className="panel stat">
          <span className="eyebrow">mit verfügbarem SAP-Agenten</span>
          <span className="value" style={{ color: 'var(--ok)' }}>
            {sum.byClass.VERFUEGBAR}
          </span>
        </div>
        <div className="panel stat">
          <span className="eyebrow">nur geplant / Lab / WIP</span>
          <span className="value" style={{ color: 'var(--agent)' }}>
            {sum.byClass.GEPLANT}
          </span>
        </div>
        <div className="panel stat">
          <span className="eyebrow">mit dokumentierter Agentenlücke</span>
          <span className="value" style={{ color: 'var(--crit)' }}>
            {sum.withGap}
          </span>
        </div>
      </div>

      <Panel title="Abdeckungskarte" eyebrow="Je Bereich von Autonomous Service – Schritt anklicken öffnet den Prozess" actions={<Meter segments={(Object.keys(COVERAGE) as (keyof typeof COVERAGE)[]).map((k) => ({ label: COVERAGE[k].label, value: sum.byClass[k], color: `var(--cov-${k})` }))} total={sum.activities} />}>
        <div className="heat">
          {model.meta.areas
            .map((area) => ({ area, list: steps.filter((s) => s.node.areaId === area.id) }))
            .filter((x) => x.list.length)
            .map(({ area, list }) => (
              <div key={area.id} className="heat-row">
                <div className="heat-label">
                  <span className="area-no">{area.no}</span>
                  <span>
                    <b>{area.nameDe}</b>
                    <span className="faint">{model.meta.stages.find((s) => s.id === area.stage)?.name}</span>
                  </span>
                </div>
                <div className="heat-cells">
                  {list.map((c) => (
                    <button key={c.nodeId} type="button" className={`heat-cell cov-${c.coverage}${c.gaps.length ? ' has-gap' : ''}`} onClick={() => go('board', 'process', { node: c.nodeId })} title={`${c.node.name}\n${COVERAGE[c.coverage].label}: ${c.agents.map((a) => a.name).join(', ') || '–'}${c.gaps.length ? `\nLücken: ${c.gaps.map((g) => g.id).join(', ')}` : ''}`}>
                      <span className="mono">{c.nodeId}</span>
                      <span className="heat-name">{c.node.name}</span>
                      <span className="heat-meta">
                        {c.agents.length > 0 && <span>✦ {c.agents.length}</span>}
                        {c.requirements.length > 0 && <span>▲ {c.requirements.length}</span>}
                        {c.gaps.length > 0 && <span className="g">Lücke</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </Panel>

      <div className="split">
        <Panel
          title={`Dokumentierte Agentenlücken (${gaps.length})`}
          eyebrow="Kandidaten für neue Use Cases an SAP (Phase 2/3)"
          actions={
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as GapStatus | '')} aria-label="Status filtern">
              <option value="">alle Status</option>
              {(Object.keys(GAP_STATUS) as GapStatus[]).map((s) => (
                <option key={s} value={s}>
                  {GAP_STATUS[s].label}
                </option>
              ))}
            </select>
          }
        >
          {gaps.length === 0 && <Empty title="Keine Lücken für diesen Filter" />}
          {gaps.map((g) => {
            const reqs = model.requirements.filter((r) => g.requirementIds.includes(r.id) || reviewOf(model, r.id).gapId === g.id);
            return (
              <article key={g.id} id={g.id} className={`gap-article${route.params.gap === g.id ? ' selected' : ''}`}>
                <header className="row between">
                  <span className="row" style={{ gap: 6 }}>
                    <Id>{g.id}</Id>
                    <b>{g.title}</b>
                  </span>
                  <span className="row" style={{ gap: 4 }}>
                    <GapBadge status={g.status} />
                    <MarkerBadge marker={g.marker} />
                    <Badge square>{g.origin === 'RECHERCHE' ? 'aus Recherche' : g.origin === 'ANFORDERUNG' ? 'aus Anforderung' : 'TG'}</Badge>
                  </span>
                </header>
                <p>{g.description}</p>
                <p>
                  <span className="faint">Vorgeschlagener Agent:</span> {g.proposedAgent || '–'}
                </p>
                {g.benefit && (
                  <p>
                    <span className="faint">Nutzen:</span> {g.benefit}
                  </p>
                )}
                <div className="row" style={{ gap: 4 }}>
                  {g.nodeIds.map((id) => (
                    <Id key={id} onClick={() => go('board', 'process', { node: id })}>
                      {id} {findNode(model, id)?.node.name}
                    </Id>
                  ))}
                  {reqs.map((r) => (
                    <button key={r.id} type="button" className="chip-req" onClick={() => go('board', 'requirements', { req: r.id })}>
                      ▲ {r.id} · {r.company}
                    </button>
                  ))}
                </div>
                {isMod && (
                  <div className="row">
                    <select className="input" style={{ width: 200 }} value={g.status} onChange={(e) => void apply([{ op: 'gap.update', gapId: g.id, patch: { status: e.target.value as GapStatus } }])} aria-label="Status der Lücke">
                      {(Object.keys(GAP_STATUS) as GapStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {GAP_STATUS[s].label}
                        </option>
                      ))}
                    </select>
                    {g.marker !== 'TG' && (
                      <button type="button" className="btn small" onClick={() => void apply([{ op: 'gap.update', gapId: g.id, patch: { marker: 'TG' } }])} title="Lücke ist von der TG bestätigt">
                        Von der TG bestätigt
                      </button>
                    )}
                    <ConfirmButton label="Entfernen" onConfirm={() => void apply([{ op: 'gap.remove', gapId: g.id }])} />
                  </div>
                )}
              </article>
            );
          })}
        </Panel>

        <div className="stack" style={{ gap: 16 }}>
          <Panel title={`KI-Hooks ohne Lücke (${hooks.length})`} eyebrow="Anforderungen: Abgleich „Lücke“ oder noch offen">
            {hooks.length === 0 && <p className="faint">Alle KI-Hooks sind einer Lücke zugeordnet oder bewertet.</p>}
            <ul className="list-plain">
              {hooks.map((r) => {
                const rv = reviewOf(model, r.id);
                const nodes = requirementNodeIds(model, r);
                return (
                  <li key={r.id} className="req-line">
                    <button type="button" className="link-btn" onClick={() => go('board', 'requirements', { req: r.id })}>
                      <span className="mono">{r.id}</span> {r.title}
                    </button>
                    <span className="row" style={{ gap: 4 }}>
                      <Badge>{r.company}</Badge>
                      <StatusBadge model={model} req={r} />
                      {rv.assessment && <FitBadge fit={rv.assessment.fit} confirmed={rv.assessment.confirmed} />}
                      {isMod && nodes.length > 0 && (
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => void apply([{ op: 'gap.add', gap: { title: r.title, nodeIds: nodes, description: rv.assessment?.rationale || r.note || r.title, proposedAgent: r.story?.goal ?? r.title, benefit: r.story?.benefit ?? r.businessValue ?? '', requirementIds: [r.id], origin: 'ANFORDERUNG' } }])}
                        >
                          → Lücke
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title={`Agenten ohne Prozessbezug (${sum.agentsUnmapped.length})`} eyebrow="Querschnitt, Administration oder außerhalb des modellierten Prozesses">
            <div className="row" style={{ gap: 4 }}>
              {sum.agentsUnmapped.map((a) => (
                <button key={a.id} type="button" className="chip-agent" onClick={() => go('board', 'agents', { agent: a.id })}>
                  ✦ {a.name}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
