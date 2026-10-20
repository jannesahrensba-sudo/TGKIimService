import { useMemo, useState } from 'react';
import type { Requirement } from '@core/types';
import { FIT_RESULTS, REQUIREMENT_TARGETS, REQUIREMENT_TYPES } from '@core/types';
import { reviewOf, type RequirementDraft } from '@core/ops';
import { ROLES } from '@core/access';
import { useStore, href } from '../../data/store';
import { IdentityForm } from '../../components/IdentityForm';
import { RequirementForm, cleanDraft, draftProblems, emptyDraft } from '../../components/RequirementForm';
import { RequirementDetail } from '../../components/RequirementDetail';
import { AgentChat } from '../../components/AgentChat';
import { Badge, Empty, FitBadge, StatusBadge } from '../../components/ui';

/** Anforderungsportal der Unternehmen: eigener Bereich mit Einreichung, Assistent und Statusverfolgung. */
export function PortalShell() {
  const { route, principal, identity, model } = useStore();
  const mine = principal ? model.requirements.filter((r) => r.authorId === principal.authorId || r.company === principal.company).length : 0;
  return (
    <div className="portal">
      <header className="portal-head">
        <a className="portal-brand" href={href('start')}>
          <strong>Anforderungsportal</strong>
          <span>TG KI im Service</span>
        </a>
        <nav className="portal-nav" aria-label="Portal">
          <a href={href('portal', 'home')} aria-current={route.view === 'home' ? 'page' : undefined}>
            Anforderungen nach Unternehmen
          </a>
          <a href={href('portal', 'mine')} aria-current={route.view === 'mine' ? 'page' : undefined}>
            Mein Unternehmen {mine > 0 && <span className="count">{mine}</span>}
          </a>
          <a className="btn primary small" href={href('portal', 'new')}>
            + Neue Anforderung
          </a>
        </nav>
        <div className="portal-who">
          {principal ? (
            <span>
              {principal.name} · {principal.company} <span className="faint">({ROLES[principal.role].label})</span>
            </span>
          ) : (
            <span className="faint">nicht angemeldet</span>
          )}
          {identity.boardAccess && (
            <a className="btn ghost small" href={href('board', 'overview')}>
              TG-Board →
            </a>
          )}
        </div>
      </header>
      <main className="portal-main">
        {!principal && identity.canWrite !== false ? (
          <section className="panel portal-welcome">
            <div className="panel-body">
              <h1>Willkommen im Anforderungsportal der Themengruppe „KI im Service“</h1>
              <p className="muted">Hier bringen Unternehmen ihre Anforderungen ein – als User Story oder als Prozessthema mit Anmerkung, an den Serviceprozess, an einen SAP-Agenten oder als KI-Hook für einen fehlenden Agenten. Die Themengruppe gleicht sie mit dem SAP-Standard ab, priorisiert sie und übergibt sie an SAP.</p>
              <h2 style={{ fontSize: 'var(--fs-lg)' }}>Bitte nennen Sie zu Beginn Ihren Namen und Ihr Unternehmen</h2>
              <IdentityForm />
            </div>
          </section>
        ) : route.view === 'new' ? (
          <NewRequirement />
        ) : route.view === 'req' && route.params.id ? (
          <div className="portal-detail">
            <a href={href('portal', route.params.from === 'mine' ? 'mine' : 'home')}>← zurück zur Übersicht</a>
            <section className="panel">
              <div className="panel-body">
                <RequirementDetail requirementId={route.params.id} area="portal" />
              </div>
            </section>
          </div>
        ) : (
          <RequirementsByCompany onlyMine={route.view === 'mine'} />
        )}
      </main>
    </div>
  );
}

function RequirementsByCompany({ onlyMine }: { onlyMine: boolean }) {
  const { model, principal, route } = useStore();
  const [q, setQ] = useState('');
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const own = principal?.company;
  const list = model.requirements.filter((r) => {
    if (onlyMine && r.company !== own && r.authorId !== principal?.authorId) return false;
    if (!showWithdrawn && r.withdrawn) return false;
    if (route.params.company && r.company !== route.params.company) return false;
    const t = q.trim().toLowerCase();
    return !t || `${r.id} ${r.title} ${r.note} ${r.company} ${r.category} ${r.story?.goal ?? ''}`.toLowerCase().includes(t);
  });
  // Nach Unternehmen sortiert; das eigene Unternehmen zuerst
  const companies = [...new Set(list.map((r) => r.company))].sort((a, b) => (a === own ? -1 : b === own ? 1 : a.localeCompare(b, 'de')));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row between">
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>{onlyMine ? `Anforderungen von ${own ?? 'Ihrem Unternehmen'}` : 'Anforderungen nach Unternehmen'}</h1>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {onlyMine ? 'Status, Rückfragen und Abgleich Ihrer Anforderungen.' : 'Alle eingereichten Anforderungen, sortiert nach Unternehmen. Gleicher Bedarf? „Betrifft uns auch“ in der Anforderung markieren.'}
            {route.params.company && (
              <>
                {' '}
                Gefiltert: <b>{route.params.company}</b> · <a href={href('portal', 'home')}>alle anzeigen</a>
              </>
            )}
          </p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <input className="input" style={{ width: 240 }} placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchen" />
          <label className="toggle">
            <input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} /> zurückgezogene
          </label>
        </div>
      </div>
      {companies.length === 0 && (
        <Empty title={onlyMine ? 'Noch keine Anforderungen Ihres Unternehmens' : 'Keine Anforderungen gefunden'}>
          <a className="btn primary small" href={href('portal', 'new')}>
            Erste Anforderung einreichen
          </a>
        </Empty>
      )}
      {companies.map((c) => (
        <section key={c} className="company-block">
          <header>
            <h2>
              {c} {c === own && <Badge tone="accent">Ihr Unternehmen</Badge>}
            </h2>
            <span className="faint">{list.filter((r) => r.company === c).length} Anforderungen</span>
          </header>
          <ul className="list-plain portal-list">
            {list
              .filter((r) => r.company === c)
              .map((r) => (
                <PortalItem key={r.id} r={r} from={onlyMine ? 'mine' : 'home'} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PortalItem({ r, from }: { r: Requirement; from: string }) {
  const { model } = useStore();
  const rv = reviewOf(model, r.id);
  const sup = model.supports.filter((s) => s.requirementId === r.id).length;
  const asks = rv.status === 'RUECKFRAGE';
  return (
    <li>
      <a className={`portal-item${asks ? ' asks' : ''}`} href={href('portal', 'req', { id: r.id, from })}>
        <span className="row between" style={{ gap: 6 }}>
          <span className="row" style={{ gap: 6 }}>
            <span className="mono faint">{r.id}</span>
            <b>{r.title}</b>
          </span>
          <span className="row" style={{ gap: 4 }}>
            <StatusBadge model={model} req={r} />
            {rv.assessment?.confirmed && <FitBadge fit={rv.assessment.fit} />}
          </span>
        </span>
        <span className="faint" style={{ fontSize: 'var(--fs-sm)' }}>
          {REQUIREMENT_TYPES[r.type].label} · {REQUIREMENT_TARGETS[r.target].label} · {r.category} · {r.author}
          {sup > 0 && ` · ▲ ${sup} weitere Unternehmen`}
          {asks && ' · Rückfrage der TG – bitte antworten'}
          {rv.assessment && !rv.assessment.confirmed && ` · Abgleich (Vorschlag): ${FIT_RESULTS[rv.assessment.fit].label}`}
        </span>
      </a>
    </li>
  );
}

function NewRequirement() {
  const { model, route, apply, go, toast } = useStore();
  const initial = useMemo(() => {
    const d = emptyDraft();
    if (route.params.node) d.nodeIds = [route.params.node];
    if (route.params.agent) {
      d.sapAgentIds = [route.params.agent];
      d.target = 'SAP_AGENT';
    }
    return d;
  }, [route.params.node, route.params.agent]);
  const [draft, setDraft] = useState<RequirementDraft>(initial);
  const [busy, setBusy] = useState(false);
  const problems = draftProblems(draft);

  const submit = async () => {
    setBusy(true);
    const res = await apply([{ op: 'requirement.submit', requirement: cleanDraft(draft) }], 'Anforderung eingereicht');
    setBusy(false);
    const id = res?.results[0]?.createdId;
    if (id) {
      toast(`${id} eingereicht – danke! Die Themengruppe gleicht sie mit Standard und SAP-Agenten ab.`, 'ok');
      go('portal', 'req', { id, from: 'mine' });
    }
  };

  return (
    <div className="portal-new">
      <section className="panel">
        <div className="panel-head">
          <div className="stack" style={{ gap: 2 }}>
            <span className="eyebrow">Neue Anforderung</span>
            <h2>Was soll KI im Serviceprozess für Sie leisten?</h2>
          </div>
        </div>
        <div className="panel-body">
          <RequirementForm model={model} value={draft} onChange={setDraft} />
          {problems.length > 0 && <div className="note warn">{problems.join(' · ')}</div>}
          <div className="row">
            <button type="button" className="btn primary" disabled={busy || problems.length > 0} onClick={() => void submit()}>
              Einreichen
            </button>
            <button type="button" className="btn ghost" onClick={() => setDraft(emptyDraft())}>
              Formular leeren
            </button>
            <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
              Nach dem Einreichen sehen alle Teilnehmenden die Anforderung mit Ihrem Unternehmen. Sie können sie bearbeiten oder zurückziehen.
            </span>
          </div>
        </div>
      </section>
      <aside className="panel portal-assistant">
        <AgentChat
          scope="portal-story"
          agents={['story-assistent', 'prozess-agent']}
          defaultAgentId="story-assistent"
          focus={{ nodeId: draft.nodeIds?.[0], agentId: draft.sapAgentIds?.[0] }}
          placeholder="Beschreiben Sie Ihr Anliegen in eigenen Worten …"
          starters={['Formuliere mein Anliegen als User Story: …', 'Welcher Prozessschritt und welcher SAP-Agent passen zu meinem Anliegen?', 'Prüfe meinen Entwurf im Formular und schlage Akzeptanzkriterien vor.']}
          onDraft={(d) => setDraft({ ...emptyDraft(), ...d, story: d.story ?? emptyDraft().story })}
          extraContext={draft.title || draft.note || draft.story?.goal ? `Aktueller Entwurf im Formular: ${JSON.stringify(cleanDraft(draft))}` : undefined}
        />
      </aside>
    </div>
  );
}
