import { useState } from 'react';
import { ROLES } from '@core/access';
import { coverageSummary } from '@core/coverage';
import { useStore, href } from '../../data/store';
import { IdentityForm } from '../../components/IdentityForm';

const MODE: Record<string, { label: string; text: string }> = {
  artifact: { label: 'Geteilt in Claude', text: 'Alle mit Zugriff auf dieses Artifact arbeiten auf demselben Stand. Eigene Beiträge kann nur die jeweilige Person ändern.' },
  server: { label: 'Plattform-Server', text: 'Zugang über Zugangscodes der Moderation; Agenten über die Claude API des Servers.' },
  demo: { label: 'Lokale Demo', text: 'Änderungen bleiben in diesem Browser. Zum gemeinsamen Arbeiten als Artifact teilen oder den Plattform-Server betreiben.' },
};

/** Einstieg: wer bin ich, wohin will ich – TG-Board (Zusammenarbeit) oder Anforderungsportal (Unternehmen). */
export function StartPage({ notice }: { notice?: string }) {
  const { model, identity, principal, backend, signOut } = useStore();
  const [editing, setEditing] = useState(false);
  const p = model.processes[0];
  const cov = p ? coverageSummary(model, p.id) : null;
  const companies = new Set(model.requirements.map((r) => r.company));
  const current = model.meta.phases.findIndex((x) => x.id === model.meta.currentPhase);
  const mode = MODE[backend.kind];

  return (
    <div className="entry">
      <header className="entry-head">
        <div className="entry-head-inner">
          <span className="entry-eyebrow">Themengruppe · Autonomous Service Management</span>
          <h1>{model.meta.title}</h1>
          <p>{model.meta.subtitle}</p>
          <ol className="phase-strip" aria-label="Phasen der Themengruppe">
            {model.meta.phases.map((ph, i) => (
              <li key={ph.id} className={i < current ? 'done' : i === current ? 'now' : ''} title={ph.items.join(' · ')}>
                <b>{ph.name.split(' – ')[0]}</b>
                <span>{ph.name.split(' – ')[1] ?? ''}</span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <main className="entry-body">
        {notice && <div className="note warn">{notice}</div>}

        <section className="panel entry-who">
          <div className="panel-body">
            {principal && !editing ? (
              <div className="row between">
                <span>
                  Angemeldet als <b>{principal.name}</b> ({principal.company}) · <span className="muted">{ROLES[principal.role].label}</span>
                  {identity.isOwner && <span className="muted"> · Eigentümer:in</span>}
                </span>
                <span className="row" style={{ gap: 4 }}>
                  <button type="button" className="btn small" onClick={() => setEditing(true)}>
                    Angaben ändern
                  </button>
                  {backend.signOut && backend.kind !== 'artifact' && (
                    <button type="button" className="btn ghost small" onClick={() => void signOut()}>
                      Abmelden
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <div className="stack">
                <h2 style={{ fontSize: 'var(--fs-lg)' }}>Bitte nennen Sie zu Beginn Ihren Namen und Ihr Unternehmen</h2>
                <IdentityForm onDone={() => setEditing(false)} />
              </div>
            )}
          </div>
        </section>

        <div className="entry-areas">
          <a className={`entry-area board${identity.boardAccess ? '' : ' locked'}`} href={identity.boardAccess ? href('board', 'overview') : undefined} aria-disabled={!identity.boardAccess}>
            <span className="eyebrow">Zusammenarbeit der Themengruppe</span>
            <h2>TG-Board</h2>
            <p>Der Serviceprozess End-to-End im SAP-Standard (BPMN, mit In-House Service), die SAP-Agenten von Autonomous Service einblendbar, Agentenlücken, die gespiegelten Anforderungen und User Stories mit Status und Abgleich – unterstützt vom Prozess-Agenten.</p>
            <div className="entry-stats">
              <span>
                <b>{p?.nodes.length ?? 0}</b> Prozesselemente
              </span>
              <span>
                <b>{model.sapAgents.length}</b> SAP-Agenten & KI-Funktionen
              </span>
              <span>
                <b>{model.gaps.length}</b> Agentenlücken
              </span>
              {cov && (
                <span>
                  <b>{cov.byClass.VERFUEGBAR}</b>/{cov.activities} Schritte mit verfügbarem Agenten
                </span>
              )}
            </div>
            <span className="btn primary">{identity.boardAccess ? 'Board öffnen →' : 'Board nicht freigeschaltet'}</span>
          </a>

          <a className="entry-area portal" href={href('portal')}>
            <span className="eyebrow">Für die Unternehmen</span>
            <h2>Anforderungsportal</h2>
            <p>Anforderungen als User Story oder als Prozessthema mit Anmerkung einreichen – an den Prozess, an einen SAP-Agenten oder als KI-Hook für einen fehlenden Agenten. Der User-Story-Assistent hilft beim Formulieren; der Status ist jederzeit sichtbar.</p>
            <div className="entry-stats">
              <span>
                <b>{model.requirements.filter((r) => !r.withdrawn).length}</b> Anforderungen
              </span>
              <span>
                <b>{companies.size}</b> Unternehmen
              </span>
            </div>
            <span className="btn primary">Zum Portal →</span>
          </a>
        </div>

        <section className="entry-foot">
          <div>
            <b>{mode.label}.</b> {mode.text}
          </div>
          <div>{model.meta.confidentiality}</div>
          <div className="faint">Arbeitsplattform von Mitgliedern der Themengruppe – kein offizielles Angebot der DSAG oder der SAP. Ansprechpartner: {model.meta.tg.contacts.map((c) => `${c.name} (${c.role})`).join(' · ')}.</div>
        </section>
      </main>
    </div>
  );
}
