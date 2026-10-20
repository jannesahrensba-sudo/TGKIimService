import { useMemo, useState } from 'react';
import type { AgentStatus, AreaId } from '@core/types';
import { AGENT_STATUS, MARKERS } from '@core/types';
import { requirementAgentIds } from '@core/coverage';
import { findNode } from '@core/queries';
import { useStore } from '../../data/store';
import { AgentStatusBadge, Badge, Empty, Id, Kv, MarkerBadge, Panel, StatusBadge } from '../../components/ui';

const STATUS_ORDER: AgentStatus[] = ['VERFUEGBAR', 'GEPLANT', 'LAB_PREVIEW', 'WIP', 'NICHT_MEHR_GENANNT'];

/** Katalog der SAP-Agenten und KI-Funktionen (Autonomous Service) – mit Verortung und Anforderungen der Unternehmen. */
export function AgentsView() {
  const { model, route, go, principal } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AgentStatus[]>([]);
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);
  const selected = model.sapAgents.find((a) => a.id === route.params.agent);
  const isMod = principal?.role === 'moderation';

  const demand = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of model.requirements) if (!r.withdrawn) for (const id of requirementAgentIds(model, r)) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [model]);

  const list = model.sapAgents.filter((a) => {
    if (status.length && !status.includes(a.status)) return false;
    if (onlyUnmapped && a.nodeIds.length) return false;
    const t = q.trim().toLowerCase();
    return !t || `${a.id} ${a.name} ${a.description} ${a.keywords.join(' ')} ${a.earlierNames.map((e) => e.name).join(' ')}`.toLowerCase().includes(t);
  });
  const byArea = model.meta.areas.map((area) => ({ area, agents: list.filter((a) => a.areaId === area.id) })).filter((g) => g.agents.length);

  return (
    <div className="page">
      <div className="note">
        <span>
          <b>Stand:</b> Kick-off 07/2026 (WIP) und SAP-Vortrag V128 10/2026 (Lab Preview) sowie öffentlich belegte Agenten. {model.meta.confidentiality}
        </span>
      </div>
      <div className="row between">
        <div className="row" style={{ gap: 6 }}>
          <input className="input" style={{ width: 260 }} placeholder="Agent suchen (Name, Begriff, früherer Name)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Agent suchen" />
          {STATUS_ORDER.map((s) => (
            <button key={s} type="button" className={`chip-filter${status.includes(s) ? ' on' : ''} st-${s}`} aria-pressed={status.includes(s)} onClick={() => setStatus(status.includes(s) ? status.filter((x) => x !== s) : [...status, s])}>
              {AGENT_STATUS[s].label} <span className="num">{model.sapAgents.filter((a) => a.status === s).length}</span>
            </button>
          ))}
          <label className="toggle">
            <input type="checkbox" checked={onlyUnmapped} onChange={(e) => setOnlyUnmapped(e.target.checked)} /> ohne Prozessbezug
          </label>
        </div>
        {isMod && <NewAgentButton />}
      </div>

      <div className="split wide-side">
        <div className="stack" style={{ gap: 14 }}>
          {byArea.length === 0 && <Empty title="Keine Agenten für diesen Filter" />}
          {byArea.map(({ area, agents }) => (
            <section key={area.id} className="area-block">
              <header>
                <span className="area-no">{area.no}</span>
                <div>
                  <h3>{area.nameDe}</h3>
                  <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                    {area.name} · {area.product} · „{area.claim}“
                  </span>
                </div>
              </header>
              <div className="agent-grid">
                {agents.map((a) => (
                  <button key={a.id} type="button" className={`agent-card st-${a.status}${selected?.id === a.id ? ' selected' : ''}`} onClick={() => go('board', 'agents', { agent: a.id })}>
                    <span className="row between" style={{ gap: 4 }}>
                      <b>✦ {a.name}</b>
                    </span>
                    <span className="row" style={{ gap: 4 }}>
                      <AgentStatusBadge status={a.status} availability={a.availability} />
                      {a.kind === 'KI_FUNKTION' && <Badge square>KI-Funktion</Badge>}
                      {(demand.get(a.id) ?? 0) > 0 && <Badge tone="amber">▲ {demand.get(a.id)}</Badge>}
                    </span>
                    <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                      {a.nodeIds.length ? `Schritte ${a.nodeIds.join(', ')}` : 'ohne Prozessbezug'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <Panel title="Joule-Assistenten" eyebrow="Koordinieren mehrere Agenten">
            <ul className="list-plain">
              {model.assistants.map((as) => (
                <li key={as.id} className="stack" style={{ gap: 2 }}>
                  <span className="row" style={{ gap: 6 }}>
                    <b>{as.name}</b> <AgentStatusBadge status={as.status} /> <MarkerBadge marker={as.marker} />
                  </span>
                  <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                    {as.description}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="sticky-side">{selected ? <AgentDetail agentId={selected.id} /> : <Panel title="Agent auswählen"><p className="muted">Links einen Agenten wählen: Beschreibung, Status, frühere Namen, Verortung im Prozess und Anforderungen der Unternehmen an diesen Agenten.</p></Panel>}</aside>
      </div>
    </div>
  );
}

function AgentDetail({ agentId }: { agentId: string }) {
  const { model, go, principal, apply } = useStore();
  const a = model.sapAgents.find((x) => x.id === agentId)!;
  const isMod = principal?.role === 'moderation';
  const area = model.meta.areas.find((x) => x.id === a.areaId);
  const reqs = model.requirements.filter((r) => !r.withdrawn && requirementAgentIds(model, r).includes(a.id));
  const [edit, setEdit] = useState<{ status: AgentStatus; availability: string; note: string } | null>(null);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <Panel
        eyebrow={`${area?.nameDe ?? a.areaId} · ${a.product}`}
        title={`✦ ${a.name}`}
        actions={
          <span className="row" style={{ gap: 4 }}>
            <AgentStatusBadge status={a.status} availability={a.availability} />
            <MarkerBadge marker={a.marker} />
          </span>
        }
      >
        <p>{a.description}</p>
        {a.capabilities.length > 0 && (
          <ul className="cap-list">
            {a.capabilities.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <Kv
          items={[
            ['ID', <Id key="id">{a.id}</Id>],
            ['Verfügbarkeit', a.availability ?? AGENT_STATUS[a.status].description],
            ['Assistent', model.assistants.find((x) => x.id === a.assistantId)?.name ?? null],
            ['Rollen', a.roles.join(', ') || null],
            [
              'Frühere Namen',
              a.earlierNames.length ? (
                <ul className="list-plain">
                  {a.earlierNames.map((e) => (
                    <li key={e.name}>
                      {e.name} <span className="faint">({e.source}, {MARKERS[e.marker].label})</span>
                    </li>
                  ))}
                </ul>
              ) : null,
            ],
            ['Quellen', a.sourceIds.map((id) => model.sources.find((s) => s.id === id)?.title ?? id).join(' · ') || null],
          ]}
        />
        {a.note && <div className="note warn">{a.note}</div>}
        {isMod &&
          (edit ? (
            <div className="stack">
              <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as AgentStatus })} aria-label="Status">
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {AGENT_STATUS[s].label}
                  </option>
                ))}
              </select>
              <input className="input" value={edit.availability} placeholder="Verfügbarkeit, z. B. Planned Q1/2027" onChange={(e) => setEdit({ ...edit, availability: e.target.value })} />
              <textarea className="input" rows={2} value={edit.note} placeholder="Hinweis / offene Frage an SAP" onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
              <div className="row">
                <button
                  type="button"
                  className="btn primary small"
                  onClick={async () => {
                    const res = await apply([{ op: 'agent.update', agentId: a.id, patch: { status: edit.status, availability: edit.availability, note: edit.note } }]);
                    if (res?.applied) setEdit(null);
                  }}
                >
                  Speichern
                </button>
                <button type="button" className="btn ghost small" onClick={() => setEdit(null)}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button type="button" className="btn ghost small" onClick={() => setEdit({ status: a.status, availability: a.availability ?? '', note: a.note ?? '' })}>
                Status / Hinweis pflegen
              </button>
            </div>
          ))}
      </Panel>

      <Panel title={`Verortung im Prozess (${a.nodeIds.length})`}>
        {a.nodeIds.length === 0 && <p className="faint">Noch keinem Schritt zugeordnet (Querschnitt bzw. außerhalb des modellierten Prozesses).</p>}
        <div className="row" style={{ gap: 4 }}>
          {a.nodeIds.map((id) => (
            <Id key={id} onClick={() => go('board', 'process', { node: id, agent: a.id })}>
              {id} {findNode(model, id)?.node.name}
            </Id>
          ))}
        </div>
        {a.nodeIds.length > 0 && (
          <button type="button" className="btn small" onClick={() => go('board', 'process', { agent: a.id })}>
            Im Prozess hervorheben
          </button>
        )}
      </Panel>

      <Panel title={`Anforderungen an diesen Agenten (${reqs.length})`} eyebrow="aus dem Anforderungsportal und dem Abgleich">
        {reqs.length === 0 && <p className="faint">Noch keine.</p>}
        <ul className="list-plain">
          {reqs.map((r) => (
            <li key={r.id} className="req-line">
              <button type="button" className="link-btn" onClick={() => go('board', 'requirements', { req: r.id })}>
                <span className="mono">{r.id}</span> {r.title}
              </button>
              <span className="row" style={{ gap: 4 }}>
                <Badge>{r.company}</Badge>
                <StatusBadge model={model} req={r} />
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn small" onClick={() => go('portal', 'new', { agent: a.id })}>
          + Anforderung an diesen Agenten stellen
        </button>
      </Panel>
    </div>
  );
}

function NewAgentButton() {
  const { model, apply } = useStore();
  const [d, setD] = useState<{ name: string; areaId: AreaId; product: string; status: AgentStatus; description: string } | null>(null);
  if (!d)
    return (
      <button type="button" className="btn small" onClick={() => setD({ name: '', areaId: 'PLANNING', product: 'SAP Cloud ERP', status: 'LAB_PREVIEW', description: '' })}>
        + Agent aufnehmen
      </button>
    );
  return (
    <div className="panel" style={{ padding: 10, display: 'grid', gap: 6, width: 'min(100%, 520px)' }}>
      <input className="input" placeholder="Name (wie von SAP genannt)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      <div className="form-grid">
        <select className="input" value={d.areaId} onChange={(e) => setD({ ...d, areaId: e.target.value as AreaId })} aria-label="Bereich">
          {model.meta.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nameDe}
            </option>
          ))}
        </select>
        <select className="input" value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as AgentStatus })} aria-label="Status">
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {AGENT_STATUS[s].label}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Produkt" value={d.product} onChange={(e) => setD({ ...d, product: e.target.value })} />
      </div>
      <textarea className="input" rows={2} placeholder="Beschreibung (mit Quelle)" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      <div className="row">
        <button
          type="button"
          className="btn primary small"
          disabled={!d.name.trim() || !d.description.trim()}
          onClick={async () => {
            const res = await apply([{ op: 'agent.add', agent: { ...d, marker: 'ZU_VERIFIZIEREN' } }]);
            if (res?.applied) setD(null);
          }}
        >
          Aufnehmen
        </button>
        <button type="button" className="btn ghost small" onClick={() => setD(null)}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
