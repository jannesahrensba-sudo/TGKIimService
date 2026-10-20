import { useEffect, useState } from 'react';
import type { TgPhaseId } from '@core/types';
import { splitModel } from '@core/model-io';
import { summarizeFindings, validateModel } from '@core/validate';
import { useStore } from '../../data/store';
import type { AccessConfig } from '../../data/backend';
import { Badge, ConfirmButton, Empty, Panel, saveFile } from '../../components/ui';

/** Verwaltung für die Moderation: Zugänge, Phase, Kategorien, Export, Prüfregeln. */
export function AdminView() {
  const { model, principal, identity, backend, apply, toast, setModel } = useStore();
  const [cats, setCats] = useState(model.meta.categories.join('\n'));
  const [access, setAccess] = useState<AccessConfig | null>(null);
  const findings = validateModel(model);
  const sum = summarizeFindings(findings);

  useEffect(() => {
    if (!backend.access) return;
    void backend.access.read().then(setAccess);
    return backend.access.subscribe(setAccess);
  }, [backend]);

  if (principal?.role !== 'moderation') return <div className="page"><Empty title="Nur für die Moderation" /></div>;

  const saveAccess = async (next: AccessConfig) => {
    try {
      await backend.access!.write(next);
      setAccess(next);
      toast('Zugänge gespeichert', 'ok');
    } catch (e) {
      toast((e as Error).message, 'crit');
    }
  };
  const toggle = (list: 'moderators' | 'boardMembers', id: string) => {
    if (!access) return;
    const has = access[list].includes(id);
    void saveAccess({ ...access, [list]: has ? access[list].filter((x) => x !== id) : [...access[list], id] });
  };

  return (
    <div className="page">
      <div className="grid cols-2">
        <Panel title="Zugänge" eyebrow={backend.kind === 'artifact' ? 'Geteilt in Claude' : backend.kind === 'server' ? 'Plattform-Server' : 'Lokale Demo'}>
          {backend.kind === 'artifact' && access && (
            <div className="stack">
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                Wer das Artifact öffnen darf, steuern Sie über „Teilen“ in Claude. Zum Einreichen brauchen Teilnehmende Schreibrechte (für Personen außerhalb Ihrer Organisation: Einladung als Bearbeiter/in). Hier legen Sie fest, wer die <b>Moderation</b> übernimmt und wer das <b>TG-Board</b> sieht – alle anderen nutzen nur das Anforderungsportal.
              </p>
              <label className="toggle">
                <input type="checkbox" checked={access.boardOpen} disabled={!identity.isOwner} onChange={(e) => void saveAccess({ ...access, boardOpen: e.target.checked })} /> TG-Board für alle Teilnehmenden öffnen
              </label>
              {model.profiles.length === 0 ? (
                <p className="faint">Noch keine Teilnehmenden mit Profil.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Unternehmen</th>
                        <th>Moderation</th>
                        <th>Board</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.profiles.map((p) => (
                        <tr key={p.authorId}>
                          <td>
                            {p.name} {p.authorId === principal.authorId && <Badge>Sie</Badge>}
                          </td>
                          <td>{p.company}</td>
                          <td>
                            <input type="checkbox" aria-label={`Moderation ${p.name}`} checked={access.moderators.includes(p.authorId)} disabled={!identity.isOwner || p.authorId === principal.authorId} onChange={() => toggle('moderators', p.authorId)} />
                          </td>
                          <td>
                            <input type="checkbox" aria-label={`Board ${p.name}`} checked={access.boardOpen || access.boardMembers.includes(p.authorId) || access.moderators.includes(p.authorId)} disabled={!identity.isOwner || access.boardOpen} onChange={() => toggle('boardMembers', p.authorId)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!identity.isOwner && <p className="faint">Zugänge ändert nur der Eigentümer des Artifacts.</p>}
              <p className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
                Hinweis: Board-Sichtbarkeit und Moderationsrechte prüft die Seite; der Speicher schützt zusätzlich eigene Beiträge (nur die Person selbst) sowie Board-Daten (nur Bearbeiter/innen). Für strikt getrennte Zugänge den Plattform-Server mit Zugangscodes nutzen.
              </p>
            </div>
          )}
          {backend.kind === 'server' && (
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Zugänge über Zugangscodes des Servers: <code>TG_PORTAL_CODE</code> (nur Anforderungsportal), <code>TG_MEMBER_CODE</code> (TG-Mitglied: Board + Portal), <code>TG_MODERATION_CODE</code> (Moderation). Ohne Umgebungsvariablen erzeugt der Server die Codes beim ersten Start in <code>.tg-data/codes.json</code>.
            </p>
          )}
          {backend.kind === 'demo' && (
            <div className="stack">
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Lokale Demo: Rolle beim Start frei wählbar, Änderungen nur in diesem Browser.</p>
              {backend.reset && (
                <ConfirmButton
                  label="Lokale Änderungen verwerfen"
                  onConfirm={async () => {
                    setModel(await backend.reset!());
                    toast('Ausgelieferter Stand wiederhergestellt', 'ok');
                  }}
                />
              )}
            </div>
          )}
        </Panel>

        <Panel title="Themengruppe">
          <label className="field">
            <span>Aktuelle Phase</span>
            <select className="input" value={model.meta.currentPhase} onChange={(e) => void apply([{ op: 'meta.update', patch: { currentPhase: e.target.value as TgPhaseId } }])}>
              {model.meta.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Kategorien für Anforderungen (eine je Zeile)</span>
            <textarea className="input" rows={8} value={cats} onChange={(e) => setCats(e.target.value)} />
          </label>
          <div>
            <button type="button" className="btn small" onClick={() => void apply([{ op: 'meta.update', patch: { categories: cats.split('\n').map((c) => c.trim()).filter(Boolean) } }])}>
              Kategorien speichern
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid cols-2">
        <Panel title="Export" eyebrow="Stand sichern bzw. ins Repository übernehmen">
          <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Der Modellstand als JSON-Dateien (gleiche Struktur wie <code>model/</code> und die Dokumente des gemeinsamen Speichers). Damit lässt sich der Stand im Repository versionieren.
          </p>
          <div className="row">
            <button type="button" className="btn small" onClick={() => void saveFile('tg-ki-im-service-modell.json', JSON.stringify(splitModel(model), null, 2), 'application/json')}>
              Modell (JSON)
            </button>
          </div>
        </Panel>
        <Panel title="Prüfregeln" eyebrow={`${sum.errors} Fehler · ${sum.warnings} Warnungen · ${sum.infos} Hinweise`}>
          {findings.length === 0 && <p className="faint">Keine Befunde.</p>}
          <ul className="list-plain">
            {findings.slice(0, 40).map((f, i) => (
              <li key={i} className={`severity ${f.severity === 'warn' ? 'warning' : f.severity}`}>
                <span className="mono faint">{f.rule}</span> {f.message}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
