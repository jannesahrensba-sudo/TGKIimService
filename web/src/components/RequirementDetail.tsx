import { useState } from 'react';
import type { ReqStatus } from '@core/types';
import { AGENT_STATUS, FIT_RESULTS, PRIORITIES, REQ_STATUS, REQUIREMENT_TARGETS, REQUIREMENT_TYPES } from '@core/types';
import { reviewOf, type RequirementDraft } from '@core/ops';
import { quickMatch } from '@core/match';
import { requirementAgentIds, requirementNodeIds } from '@core/coverage';
import { findNode } from '@core/queries';
import { checkOp } from '@core/access';
import { useStore } from '../data/store';
import { AgentChat } from './AgentChat';
import { cleanDraft, draftProblems, RequirementForm } from './RequirementForm';
import { Badge, ConfirmButton, FitBadge, Id, Kv, MarkerBadge, StatusBadge } from './ui';

const fmt = (iso: string) => (iso ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');

/**
 * Anforderung im Detail – gleiche Sicht im Board (mit Moderation) und im Portal (ohne Board-Navigation):
 * Inhalt, Bezug zu Prozess und SAP-Agenten, Abgleich, Status und Historie, Gespräch.
 */
export function RequirementDetail({ requirementId, area }: { requirementId: string; area: 'board' | 'portal' }) {
  const { model, principal, identity, apply, go, toast } = useStore();
  const req = model.requirements.find((r) => r.id === requirementId);
  const [editing, setEditing] = useState<RequirementDraft | null>(null);
  const [comment, setComment] = useState('');
  const [statusDraft, setStatusDraft] = useState<{ status: ReqStatus; note: string } | null>(null);
  const [showAgent, setShowAgent] = useState(false);
  if (!req) return <div className="empty">Anforderung {requirementId} nicht gefunden.</div>;

  const review = reviewOf(model, req.id);
  const a = review.assessment;
  const isMod = principal?.role === 'moderation';
  const can = (op: Parameters<typeof checkOp>[1]) => Boolean(principal) && checkOp(model, op, principal!) === null;
  const canEdit = can({ op: 'requirement.update', requirementId: req.id, patch: {} });
  const canComment = can({ op: 'comment.add', requirementId: req.id, text: 'x' });
  const supporters = model.supports.filter((s) => s.requirementId === req.id);
  const mySupport = supporters.some((s) => s.authorId === principal?.authorId);
  const canSupport = principal && principal.company !== req.company && can({ op: 'support.set', requirementId: req.id, on: true });
  const comments = model.comments.filter((c) => c.requirementId === req.id);
  const nodes = requirementNodeIds(model, req);
  const agents = requirementAgentIds(model, req);
  const gap = review.gapId ? model.gaps.find((g) => g.id === review.gapId) : undefined;
  const board = area === 'board' && identity.boardAccess;

  const quick = () => {
    const q = quickMatch(model, req);
    if (isMod) void apply([{ op: 'review.assess', requirementId: req.id, assessment: q.proposal }], 'Schnellabgleich');
    else toast(`Schnellabgleich: ${FIT_RESULTS[q.proposal.fit].label} – ${q.proposal.rationale}`);
  };

  if (editing) {
    const problems = draftProblems(editing);
    return (
      <div className="stack" style={{ gap: 12 }}>
        <div className="row between">
          <h3>
            {req.id} bearbeiten
          </h3>
          <button type="button" className="btn ghost small" onClick={() => setEditing(null)}>
            Abbrechen
          </button>
        </div>
        <RequirementForm model={model} value={editing} onChange={setEditing} />
        {problems.length > 0 && <div className="note warn">{problems.join(' · ')}</div>}
        <div className="row">
          <button
            type="button"
            className="btn primary"
            disabled={problems.length > 0}
            onClick={async () => {
              const d = cleanDraft(editing);
              const res = await apply([{ op: 'requirement.update', requirementId: req.id, patch: { ...d, story: d.story ?? (null as never), priority: d.priority ?? (null as never) } }], `${req.id} geändert`);
              if (res?.applied) {
                setEditing(null);
                toast(`${req.id} gespeichert`, 'ok');
              }
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack req-detail" style={{ gap: 14 }}>
      <header className="stack" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <Id>{req.id}</Id>
          <StatusBadge model={model} req={req} />
          <Badge tone="neutral" square>
            {REQUIREMENT_TYPES[req.type].label}
          </Badge>
          <Badge tone={req.target === 'NEUER_AGENT' ? 'amber' : req.target === 'SAP_AGENT' ? 'agent' : 'info'} square>
            {REQUIREMENT_TARGETS[req.target].label}
          </Badge>
          {req.priority && <Badge tone={PRIORITIES[req.priority].tone}>{PRIORITIES[req.priority].label}</Badge>}
          {review.tgPriority && <Badge tone="accent">TG-Prio {review.tgPriority}</Badge>}
        </div>
        <h2 style={{ fontSize: 'var(--fs-xl)' }}>{req.title}</h2>
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
          <b>{req.company}</b> · {req.author} · {fmt(req.createdAt)} · {req.category}
          {req.source && <> · Quelle: {req.source}</>}
        </span>
      </header>

      {req.story && (
        <div className="story-card">
          <p>
            <span className="faint">Als</span> <b>{req.story.role}</b> <span className="faint">möchte ich</span> {req.story.goal}, <span className="faint">damit</span> {req.story.benefit}.
          </p>
          {req.story.acceptanceCriteria.length > 0 && (
            <ol className="ac-list">
              {req.story.acceptanceCriteria.map((c, i) => (
                <li key={i}>
                  <span className="faint">Gegeben</span> {c.given} <span className="faint">– wenn</span> {c.when} <span className="faint">– dann</span> {c.then}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {req.note && <p style={{ whiteSpace: 'pre-wrap' }}>{req.note}</p>}
      {req.businessValue && (
        <p className="muted">
          <b>Nutzen:</b> {req.businessValue}
        </p>
      )}

      <Kv
        items={[
          [
            'Prozessschritte',
            nodes.length ? (
              <span className="row" style={{ gap: 4 }}>
                {nodes.map((id) => (
                  <Id key={id} title={findNode(model, id)?.node.name} onClick={board ? () => go('board', 'process', { node: id }) : undefined}>
                    {id} {findNode(model, id)?.node.name}
                  </Id>
                ))}
              </span>
            ) : null,
          ],
          [
            'SAP-Agenten',
            agents.length ? (
              <span className="row" style={{ gap: 4 }}>
                {agents.map((id) => {
                  const ag = model.sapAgents.find((x) => x.id === id);
                  return (
                    <button key={id} type="button" className="chip-agent" onClick={board ? () => go('board', 'agents', { agent: id }) : undefined} title={ag ? AGENT_STATUS[ag.status].label : id}>
                      ✦ {ag?.name ?? id}
                    </button>
                  );
                })}
              </span>
            ) : null,
          ],
          ['Agentenlücke', gap ? <Id onClick={board ? () => go('board', 'gaps', { gap: gap.id }) : undefined}>{`${gap.id} ${gap.title}`}</Id> : null],
          ['Unterstützt von', supporters.length ? supporters.map((s) => s.company).join(', ') : null],
        ]}
      />

      <div className="row">
        {canEdit && !req.withdrawn && (
          <button type="button" className="btn small" onClick={() => setEditing({ type: req.type, target: req.target, category: req.category, title: req.title, note: req.note, story: req.story ?? { role: '', goal: '', benefit: '', acceptanceCriteria: [] }, nodeIds: req.nodeIds, sapAgentIds: req.sapAgentIds, priority: req.priority, businessValue: req.businessValue })}>
            Bearbeiten
          </button>
        )}
        {canEdit && !req.withdrawn && <ConfirmButton label="Zurückziehen" confirmLabel="Wirklich zurückziehen?" onConfirm={() => void apply([{ op: 'requirement.withdraw', requirementId: req.id, withdrawn: true }])} />}
        {canEdit && req.withdrawn && (
          <button type="button" className="btn small" onClick={() => void apply([{ op: 'requirement.withdraw', requirementId: req.id, withdrawn: false }])}>
            Wiederherstellen
          </button>
        )}
        {canSupport && (
          <button type="button" className={`btn small${mySupport ? ' primary' : ''}`} onClick={() => void apply([{ op: 'support.set', requirementId: req.id, on: !mySupport }])} title="Ihr Unternehmen hat denselben Bedarf">
            {mySupport ? '✓ Betrifft uns auch' : '+ Betrifft uns auch'}
          </button>
        )}
      </div>

      <section className="sub">
        <div className="row between">
          <h4>Abgleich mit Prozess, Standard und SAP-Agenten</h4>
          {board && (
            <div className="row" style={{ gap: 4 }}>
              <button type="button" className="btn small" onClick={quick} title="Stichwortabgleich ohne KI">
                Schnellabgleich
              </button>
              <button type="button" className="btn small agent-btn" onClick={() => setShowAgent((v) => !v)}>
                ✦ Abgleich-Agent
              </button>
            </div>
          )}
        </div>
        {a ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row">
              <FitBadge fit={a.fit} confirmed={a.confirmed} />
              <MarkerBadge marker={a.marker} />
              <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                {a.assessedBy} · {fmt(a.assessedAt)} · {a.confirmed ? 'von der Moderation bestätigt' : 'Vorschlag – noch nicht bestätigt'}
              </span>
            </div>
            <p>
              <b>{a.summary}</b>
            </p>
            <p className="muted">{a.rationale}</p>
            <Kv
              items={[
                ['Standardbezug', a.standardReference || null],
                ['Empfehlung', a.recommendation || null],
                ['Prüfaufträge', a.verify.length ? <ul className="list-plain">{a.verify.map((v) => <li key={v}>• {v}</li>)}</ul> : null],
              ]}
            />
            {isMod && board && (
              <div className="row">
                <button type="button" className={`btn small${a.confirmed ? '' : ' primary'}`} onClick={() => void apply([{ op: 'review.confirm', requirementId: req.id, confirmed: !a.confirmed }])}>
                  {a.confirmed ? 'Bestätigung zurücknehmen' : 'Abgleich bestätigen'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="faint">Noch kein Abgleich. {board ? 'Schnellabgleich oder Abgleich-Agent starten.' : 'Die Themengruppe gleicht die Anforderung mit Prozess und SAP-Agenten ab.'}</p>
        )}
        {showAgent && board && (
          <div className="agent-inline">
            <AgentChat scope={`abgleich-${req.id}`} agents={['abgleich-agent']} defaultAgentId="abgleich-agent" focus={{ requirementId: req.id }} starters={[`Gleiche ${req.id} mit Prozess, Standard und SAP-Agenten ab.`, `Gibt es zu ${req.id} ähnliche Anforderungen anderer Unternehmen?`]} height="440px" />
          </div>
        )}
      </section>

      {isMod && board && (
        <section className="sub">
          <h4>Status & Bewertung der Themengruppe</h4>
          <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px' }}>
            <select className="input" value={statusDraft?.status ?? review.status} onChange={(e) => setStatusDraft({ status: e.target.value as ReqStatus, note: statusDraft?.note ?? '' })} aria-label="Status">
              {(Object.keys(REQ_STATUS) as ReqStatus[]).map((s) => (
                <option key={s} value={s}>
                  {REQ_STATUS[s].label} ({REQ_STATUS[s].phase})
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="TG-Prio"
              aria-label="TG-Priorität"
              defaultValue={review.tgPriority ?? ''}
              onBlur={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                if (v !== (review.tgPriority ?? null)) void apply([{ op: 'review.update', requirementId: req.id, patch: { tgPriority: v } }]);
              }}
            />
          </div>
          {statusDraft && statusDraft.status !== review.status && (
            <div className="stack" style={{ gap: 6 }}>
              <textarea className="input" rows={2} value={statusDraft.note} placeholder={statusDraft.status === 'RUECKFRAGE' ? 'Frage an das Unternehmen (Pflicht)' : 'Notiz (optional, bei Ablehnung/Zurückstellung als Begründung sichtbar)'} onChange={(e) => setStatusDraft({ ...statusDraft, note: e.target.value })} />
              <div className="row">
                <button
                  type="button"
                  className="btn primary small"
                  onClick={async () => {
                    const res = await apply([{ op: 'review.setStatus', requirementId: req.id, status: statusDraft.status, note: statusDraft.note || undefined }]);
                    if (res?.applied) setStatusDraft(null);
                  }}
                >
                  Status setzen
                </button>
                <button type="button" className="btn ghost small" onClick={() => setStatusDraft(null)}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
          <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <select className="input" value={review.gapId ?? ''} aria-label="Agentenlücke" onChange={(e) => void apply([{ op: 'review.update', requirementId: req.id, patch: { gapId: e.target.value || null } }])}>
              <option value="">keine Agentenlücke zugeordnet</option>
              {model.gaps.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id} {g.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn small"
              disabled={Boolean(review.gapId) || !nodes.length}
              title={nodes.length ? 'Lücke mit den Schritten dieser Anforderung anlegen' : 'Erst Prozessschritte zuordnen (Abgleich)'}
              onClick={() =>
                void apply([{ op: 'gap.add', gap: { title: req.title, nodeIds: nodes, description: a?.rationale || req.note || req.title, proposedAgent: req.story ? `Agent: ${req.story.goal}` : req.title, benefit: req.story?.benefit ?? req.businessValue ?? '', requirementIds: [req.id], origin: 'ANFORDERUNG' } }])
              }
            >
              Als Agentenlücke anlegen
            </button>
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="Rückmeldung der SAP (nach Übergabe)"
            defaultValue={review.sapFeedback ?? ''}
            onBlur={(e) => e.target.value !== (review.sapFeedback ?? '') && void apply([{ op: 'review.update', requirementId: req.id, patch: { sapFeedback: e.target.value } }])}
          />
        </section>
      )}
      {!isMod && review.sapFeedback && (
        <section className="sub">
          <h4>Rückmeldung der SAP</h4>
          <p>{review.sapFeedback}</p>
        </section>
      )}

      <section className="sub">
        <h4>Gespräch {comments.length > 0 && <span className="faint">({comments.length})</span>}</h4>
        {comments.length === 0 && <p className="faint">Noch keine Kommentare.</p>}
        <ul className="list-plain comments">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                {fmt(c.at)} · <b>{c.author}</b> ({c.company})
              </span>
              <p style={{ whiteSpace: 'pre-wrap' }}>{c.text}</p>
              {(c.authorId === principal?.authorId || principal?.owner) && (
                <button type="button" className="btn ghost small" onClick={() => void apply([{ op: 'comment.remove', commentId: c.id }])}>
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
        {canComment ? (
          <form
            className="stack"
            style={{ gap: 6 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await apply([{ op: 'comment.add', requirementId: req.id, text: comment }]);
              if (res?.applied) setComment('');
            }}
          >
            <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={review.status === 'RUECKFRAGE' && principal?.company === req.company ? 'Antwort auf die Rückfrage …' : 'Kommentar, Ergänzung, Erfahrung aus Ihrem Unternehmen …'} />
            <div>
              <button type="submit" className="btn small" disabled={!comment.trim()}>
                Kommentieren
              </button>
            </div>
          </form>
        ) : (
          !principal && <p className="faint">Zum Kommentieren bitte zuerst Namen und Unternehmen angeben.</p>
        )}
      </section>

      {review.history.length > 0 && (
        <details className="sub">
          <summary>
            <h4 style={{ display: 'inline' }}>Verlauf</h4>
          </summary>
          <ul className="list-plain timeline">
            {[...review.history].reverse().map((h, i) => (
              <li key={i}>
                <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>
                  {fmt(h.at)}
                </span>{' '}
                <b>{h.action}</b> <span className="faint">– {h.by}</span>
                {h.note && <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{h.note}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
