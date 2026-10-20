import { useMemo, useState } from 'react';
import type { ReqStatus, Requirement } from '@core/types';
import { REQ_STATUS, REQUIREMENT_TARGETS, REQUIREMENT_TYPES } from '@core/types';
import { reviewOf, type Op } from '@core/ops';
import { quickMatch } from '@core/match';
import { requirementNodeIds } from '@core/coverage';
import { requirementsCsv, sapHandoverMarkdown } from '@core/export';
import { useStore } from '../../data/store';
import { RequirementDetail } from '../../components/RequirementDetail';
import { AgentChat } from '../../components/AgentChat';
import { Badge, Empty, FitBadge, Panel, StatusBadge, Tabs, saveFile, useLocalState } from '../../components/ui';

type Mode = 'list' | 'company' | 'board';

const BOARD_COLUMNS: { title: string; statuses: (ReqStatus | 'ZURUECKGEZOGEN')[] }[] = [
  { title: 'Phase 1 · Gesammelt', statuses: ['EINGEREICHT', 'RUECKFRAGE'] },
  { title: 'Phase 2 · In Bewertung', statuses: ['IN_BEWERTUNG'] },
  { title: 'Phase 3 · Priorisiert / an SAP', statuses: ['PRIORISIERT', 'AN_SAP_UEBERGEBEN'] },
  { title: 'Phase 4 · Umsetzung', statuses: ['IN_UMSETZUNG', 'UMGESETZT'] },
  { title: 'Nicht weiterverfolgt', statuses: ['ZURUECKGESTELLT', 'ABGELEHNT', 'ZURUECKGEZOGEN'] },
];

export const statusKey = (m: Parameters<typeof reviewOf>[0], r: Requirement): ReqStatus | 'ZURUECKGEZOGEN' => (r.withdrawn ? 'ZURUECKGEZOGEN' : reviewOf(m, r.id).status);

/** Gespiegelte Anforderungen und User Stories aller Unternehmen – mit Status, Abgleich und Bewertung der TG. */
export function RequirementsView() {
  const { model, route, go, principal, apply, toast } = useStore();
  const [mode, setMode] = useLocalState<Mode>('tg.reqmode.v1', 'list');
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState('');
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState('');
  const [bulkAgent, setBulkAgent] = useState(false);
  const selected = route.params.req;
  const isMod = principal?.role === 'moderation';
  const companies = useMemo(() => [...new Set(model.requirements.map((r) => r.company))].sort(), [model]);
  const categories = useMemo(() => [...new Set(model.requirements.map((r) => r.category))].sort(), [model]);

  const list = model.requirements.filter((r) => {
    if (company && r.company !== company) return false;
    if (status && statusKey(model, r) !== status) return false;
    if (target && r.target !== target) return false;
    if (category && r.category !== category) return false;
    const t = q.trim().toLowerCase();
    return !t || `${r.id} ${r.title} ${r.note} ${r.company} ${r.author} ${r.story?.goal ?? ''}`.toLowerCase().includes(t);
  });
  const unassessed = model.requirements.filter((r) => !r.withdrawn && !reviewOf(model, r.id).assessment);
  const open = (id: string) => go('board', 'requirements', { req: id });

  const quickAll = async () => {
    const ops: Op[] = unassessed.map((r) => ({ op: 'review.assess', requirementId: r.id, assessment: quickMatch(model, r).proposal }));
    const res = await apply(ops, 'Schnellabgleich (alle unbewerteten)');
    if (res) toast(`${res.applied} Anforderungen per Schnellabgleich vorbewertet (unbestätigt)`, 'ok');
  };

  return (
    <div className="page">
      <div className="row between">
        <Tabs
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'list', label: 'Liste' },
            { id: 'company', label: 'Nach Unternehmen' },
            { id: 'board', label: 'Status (TG-Phasen)' },
          ]}
        />
        <div className="row" style={{ gap: 4 }}>
          {isMod && unassessed.length > 0 && (
            <button type="button" className="btn small" onClick={() => void quickAll()} title="Stichwortabgleich ohne KI für alle unbewerteten Anforderungen">
              Schnellabgleich für {unassessed.length} unbewertete
            </button>
          )}
          <button type="button" className="btn small agent-btn" onClick={() => setBulkAgent((v) => !v)}>
            ✦ Abgleich-Agent
          </button>
          <button type="button" className="btn ghost small" onClick={() => void saveFile('tg-ki-im-service-anforderungen.csv', requirementsCsv(model, list), 'text/csv')}>
            CSV
          </button>
          <button type="button" className="btn ghost small" onClick={() => void saveFile('tg-ki-im-service-uebergabe-sap.md', sapHandoverMarkdown(model), 'text/markdown')} title="Priorisierte und an SAP übergebene Anforderungen">
            Übergabepaket SAP
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 6 }}>
        <input className="input" style={{ width: 240 }} placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchen" />
        <select className="input" style={{ width: 200 }} value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Unternehmen">
          <option value="">alle Unternehmen</option>
          {companies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="input" style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">alle Status</option>
          {(Object.keys(REQ_STATUS) as ReqStatus[]).map((s) => (
            <option key={s} value={s}>
              {REQ_STATUS[s].label}
            </option>
          ))}
          <option value="ZURUECKGEZOGEN">Zurückgezogen</option>
        </select>
        <select className="input" style={{ width: 200 }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Bezug">
          <option value="">jeder Bezug</option>
          {Object.entries(REQUIREMENT_TARGETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select className="input" style={{ width: 200 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategorie">
          <option value="">alle Kategorien</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
          {list.length} von {model.requirements.length}
        </span>
      </div>

      {bulkAgent && (
        <div className="panel" style={{ height: 460 }}>
          <AgentChat scope="abgleich-alle" agents={['abgleich-agent', 'prozess-agent']} defaultAgentId="abgleich-agent" starters={['Gleiche alle unbewerteten bzw. nur vorgeschlagenen Anforderungen ab.', 'Welche Anforderungen sind echte Lücken (neue Use Cases)?', 'Welche Anforderungen betreffen dieselben SAP-Agenten?']} />
        </div>
      )}

      <div className={selected ? 'split wide-side req-split' : ''}>
        <div className="stack" style={{ gap: 12, minWidth: 0 }}>
          {list.length === 0 && <Empty title="Keine Anforderungen für diesen Filter" />}
          {mode === 'list' && list.length > 0 && <RequirementTable list={list} selected={selected} onOpen={open} />}
          {mode === 'company' &&
            companies
              .filter((c) => list.some((r) => r.company === c))
              .map((c) => (
                <Panel key={c} title={c} eyebrow={`${list.filter((r) => r.company === c).length} Anforderungen`} tight>
                  <RequirementTable list={list.filter((r) => r.company === c)} selected={selected} onOpen={open} hideCompany />
                </Panel>
              ))}
          {mode === 'board' && (
            <div className="kanban">
              {BOARD_COLUMNS.map((col) => {
                const items = list.filter((r) => col.statuses.includes(statusKey(model, r)));
                return (
                  <section key={col.title} className="kanban-col">
                    <header>
                      <b>{col.title}</b> <span className="num faint">{items.length}</span>
                    </header>
                    {items.map((r) => (
                      <button key={r.id} type="button" className={`kanban-card${selected === r.id ? ' selected' : ''}`} onClick={() => open(r.id)}>
                        <span className="row between" style={{ gap: 4 }}>
                          <span className="mono faint">{r.id}</span>
                          <StatusBadge model={model} req={r} />
                        </span>
                        <b>{r.title}</b>
                        <span className="faint">{r.company}</span>
                        {reviewOf(model, r.id).assessment && <FitBadge fit={reviewOf(model, r.id).assessment!.fit} confirmed={reviewOf(model, r.id).assessment!.confirmed} />}
                      </button>
                    ))}
                  </section>
                );
              })}
            </div>
          )}
        </div>
        {selected && (
          <aside className="sticky-side">
            <div className="panel">
              <div className="panel-head">
                <span className="eyebrow">Anforderung</span>
                <button type="button" className="btn ghost small" onClick={() => go('board', 'requirements')}>
                  Schließen
                </button>
              </div>
              <div className="panel-body">
                <RequirementDetail requirementId={selected} area="board" />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function RequirementTable({ list, selected, onOpen, hideCompany }: { list: Requirement[]; selected?: string; onOpen: (id: string) => void; hideCompany?: boolean }) {
  const { model } = useStore();
  return (
    <div className="table-wrap panel">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Anforderung</th>
            {!hideCompany && <th>Unternehmen</th>}
            <th>Art / Bezug</th>
            <th>Status</th>
            <th>Abgleich</th>
            <th title="Unterstützt von weiteren Unternehmen">▲</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const rv = reviewOf(model, r.id);
            const sup = model.supports.filter((s) => s.requirementId === r.id).length;
            return (
              <tr key={r.id} className={`clickable${selected === r.id ? ' selected' : ''}`} onClick={() => onOpen(r.id)}>
                <td className="mono">{r.id}</td>
                <td>
                  <b>{r.title}</b>
                  <div className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                    {r.category} · {requirementNodeIds(model, r).join(', ') || 'ohne Schritt'}
                  </div>
                </td>
                {!hideCompany && <td>{r.company}</td>}
                <td>
                  <span className="stack" style={{ gap: 2 }}>
                    <Badge square>{REQUIREMENT_TYPES[r.type].label}</Badge>
                    <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                      {REQUIREMENT_TARGETS[r.target].label}
                    </span>
                  </span>
                </td>
                <td>
                  <StatusBadge model={model} req={r} />
                </td>
                <td>{rv.assessment ? <FitBadge fit={rv.assessment.fit} confirmed={rv.assessment.confirmed} /> : <span className="faint">–</span>}</td>
                <td className="num">{sup || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
