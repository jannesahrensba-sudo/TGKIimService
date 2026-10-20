import type { ReqStatus } from '@core/types';
import { AGENT_STATUS, FIT_RESULTS, REQ_STATUS } from '@core/types';
import { reviewOf } from '@core/ops';
import { COVERAGE, coverageSummary } from '@core/coverage';
import { useStore, href } from '../../data/store';
import { Badge, Meter, Panel, Stat, StatusBadge } from '../../components/ui';

const fmt = (iso: string) => (iso ? new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('de-DE') : '');

/** Überblick der Themengruppe: Phase, Abdeckung, Anforderungen nach Status und Unternehmen, Aktivität. */
export function Overview() {
  const { model, go, principal } = useStore();
  const p = model.processes[0];
  const cov = p ? coverageSummary(model, p.id) : null;
  const active = model.requirements.filter((r) => !r.withdrawn);
  const byStatus = (Object.keys(REQ_STATUS) as ReqStatus[]).map((s) => ({ s, n: active.filter((r) => reviewOf(model, r.id).status === s).length }));
  const companies = [...new Set(active.map((r) => r.company))].map((c) => ({ c, n: active.filter((r) => r.company === c).length, sup: model.supports.filter((s) => active.some((r) => r.id === s.requirementId && r.company === c)).length })).sort((a, b) => b.n - a.n);
  const fits = Object.keys(FIT_RESULTS).map((f) => ({ f, n: active.filter((r) => reviewOf(model, r.id).assessment?.fit === f).length }));
  const top = [...active].filter((r) => model.supports.some((s) => s.requirementId === r.id)).sort((a, b) => model.supports.filter((s) => s.requirementId === b.id).length - model.supports.filter((s) => s.requirementId === a.id).length).slice(0, 5);
  const activity = [
    ...model.requirements.map((r) => ({ at: r.createdAt, text: `${r.company}: ${r.id} „${r.title}“ eingereicht`, id: r.id })),
    ...model.reviews.flatMap((rv) => rv.history.filter((h) => !/^Eingereicht/.test(h.action)).map((h) => ({ at: h.at, text: `${rv.requirementId}: ${h.action} (${h.by})`, id: rv.requirementId }))),
    ...model.comments.map((c) => ({ at: c.at, text: `${c.author} (${c.company}) kommentiert ${c.requirementId}`, id: c.requirementId })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);
  const phaseIdx = model.meta.phases.findIndex((x) => x.id === model.meta.currentPhase);
  const waiting = principal?.role === 'moderation' ? active.filter((r) => reviewOf(model, r.id).status === 'EINGEREICHT') : [];

  return (
    <div className="page">
      <section className="panel phase-panel">
        <div className="panel-body">
          <ol className="phase-strip light">
            {model.meta.phases.map((ph, i) => (
              <li key={ph.id} className={i < phaseIdx ? 'done' : i === phaseIdx ? 'now' : ''}>
                <b>{ph.name}</b>
                <ul>
                  {ph.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid cols-4">
        <Stat label="Anforderungen" value={active.length} sub={`${companies.length} Unternehmen`} />
        <Stat label="SAP-Agenten & KI-Funktionen" value={model.sapAgents.length} sub={`${model.sapAgents.filter((a) => a.status === 'VERFUEGBAR').length} verfügbar · ${model.sapAgents.filter((a) => a.status === 'GEPLANT').length} geplant`} />
        <Stat label="Agentenlücken" value={model.gaps.filter((g) => g.status !== 'GESCHLOSSEN' && g.status !== 'VERWORFEN').length} tone="critical" sub="dokumentiert" />
        {cov && <Stat label="Schritte mit verfügbarem Agenten" value={`${cov.byClass.VERFUEGBAR}/${cov.activities}`} tone="positive" sub={`${cov.byClass.GEPLANT} nur geplant/Lab`} />}
      </div>

      {waiting.length > 0 && (
        <div className="note info">
          <b>{waiting.length} neu eingereichte Anforderung(en) warten auf Sichtung.</b>
          <span>
            <a href={href('board', 'requirements', { req: waiting[0].id })}>Zur ersten ({waiting[0].id})</a>
          </span>
        </div>
      )}

      <div className="grid cols-2">
        <Panel title="Anforderungen nach Status" eyebrow="Workflow der TG (Phasen 1–4)">
          <Meter segments={byStatus.filter((x) => x.n).map((x) => ({ label: REQ_STATUS[x.s].label, value: x.n, color: `var(--st-${x.s})` }))} />
          <Meter segments={fits.filter((x) => x.n).map((x) => ({ label: `Abgleich: ${FIT_RESULTS[x.f as keyof typeof FIT_RESULTS].label}`, value: x.n, color: `var(--fit-${x.f})` }))} total={active.length} />
          <a href={href('board', 'requirements')}>Alle Anforderungen & User Stories →</a>
        </Panel>
        {cov && (
          <Panel title="Agentenabdeckung im Serviceprozess" eyebrow={p?.name}>
            <Meter segments={(Object.keys(COVERAGE) as (keyof typeof COVERAGE)[]).map((k) => ({ label: COVERAGE[k].label, value: cov.byClass[k], color: `var(--cov-${k})` }))} total={cov.activities} />
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Fast jeder Schritt hat im V128-Stand einen SAP-Agenten – die meisten jedoch als Lab Preview. Die eigentliche Frage der TG: Decken diese Agenten den Bedarf der Unternehmen? Dafür stehen {cov.withGap} Schritte mit dokumentierter Lücke und {cov.withDemand} mit Anforderungen.
            </p>
            <div className="row">
              <a className="btn small" href={href('board', 'process')}>
                Prozess mit Agenten
              </a>
              <a className="btn small" href={href('board', 'gaps')}>
                Agentenlücken
              </a>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid cols-3">
        <Panel title="Unternehmen" eyebrow="Anforderungen je Unternehmen">
          <ul className="list-plain">
            {companies.map((c) => (
              <li key={c.c} className="row between">
                <button type="button" className="link-btn" onClick={() => go('portal', 'home', { company: c.c })}>
                  {c.c}
                </button>
                <span className="num">{c.n}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Am häufigsten unterstützt" eyebrow="„Betrifft uns auch“ – Kandidaten für die Priorisierung">
          {top.length === 0 && <p className="faint">Noch keine Unterstützung durch weitere Unternehmen. Im Portal markieren Unternehmen gleichen Bedarf mit „Betrifft uns auch“.</p>}
          <ul className="list-plain">
            {top.map((r) => (
              <li key={r.id} className="req-line">
                <a href={href('board', 'requirements', { req: r.id })}>
                  <span className="mono">{r.id}</span> {r.title}
                </a>
                <span className="row" style={{ gap: 4 }}>
                  <Badge>{r.company}</Badge>
                  <Badge tone="amber" title="Unternehmen insgesamt">▲ {model.supports.filter((s) => s.requirementId === r.id).length + 1} Unternehmen</Badge>
                  <StatusBadge model={model} req={r} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Letzte Aktivität">
          <ul className="list-plain activity">
            {activity.map((a, i) => (
              <li key={i}>
                <span className="faint mono" style={{ fontSize: 'var(--fs-xs)' }}>
                  {fmt(a.at)}
                </span>{' '}
                <a href={href('board', 'requirements', { req: a.id })}>{a.text}</a>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Status der SAP-Agenten" eyebrow="Kick-off 07/2026 · V128 10/2026 · öffentlich belegt">
        <Meter segments={(Object.keys(AGENT_STATUS) as (keyof typeof AGENT_STATUS)[]).map((s) => ({ label: AGENT_STATUS[s].label, value: model.sapAgents.filter((a) => a.status === s).length, color: `var(--ast-${s})` }))} />
        <p className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
          {model.meta.confidentiality}
        </p>
      </Panel>
    </div>
  );
}
