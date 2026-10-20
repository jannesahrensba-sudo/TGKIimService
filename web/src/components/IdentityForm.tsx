import { useState } from 'react';
import type { Role } from '@core/access';
import { ROLES } from '@core/access';
import { useStore } from '../data/store';
import { Field } from './ui';

/**
 * „Wer sind Sie?“ – Name und Unternehmen zu Beginn. Im Servermodus zusätzlich der Zugangscode,
 * in der lokalen Demo die Rolle zum Ausprobieren.
 */
export function IdentityForm({ compact, onDone }: { compact?: boolean; onDone?: () => void }) {
  const { backend, identity, principal, model, signIn } = useStore();
  const known = [...new Set(model.requirements.map((r) => r.company).concat(model.profiles.map((p) => p.company)))].sort();
  const [name, setName] = useState(principal?.name ?? '');
  const [company, setCompany] = useState(principal?.company ?? '');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<Role>(principal?.role ?? 'member');
  const [busy, setBusy] = useState(false);
  const needsCode = backend.kind === 'server';
  const readOnly = backend.kind === 'artifact' && identity.canWrite === false;

  if (readOnly) {
    return <div className="note warn">Sie haben Lesezugriff auf diese Plattform. Zum Einreichen bitte die Moderation bitten, Sie im Artifact als Bearbeiter/in freizugeben.</div>;
  }

  return (
    <form
      className="stack"
      style={{ gap: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await signIn({ name: name.trim(), company: company.trim(), code: code.trim() || undefined, role });
        setBusy(false);
        if (ok) onDone?.();
      }}
    >
      <div className="form-grid" style={{ gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
        <Field label="Ihr Name *">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={120} />
        </Field>
        <Field label="Unternehmen *">
          <input className="input" list="tg-companies" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" required maxLength={160} />
          <datalist id="tg-companies">
            {known.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        {needsCode && (
          <Field label="Zugangscode *">
            <input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} required placeholder="von der Moderation" />
          </Field>
        )}
        {backend.kind === 'demo' && (
          <Field label="Rolle (lokale Demo)">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(['member', 'portal', 'moderation'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLES[r].label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="row">
        <button type="submit" className="btn primary" disabled={busy || !name.trim() || !company.trim() || (needsCode && !code.trim())}>
          {principal ? 'Übernehmen' : 'Weiter'}
        </button>
        <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
          {backend.kind === 'artifact' ? 'Name und Unternehmen sind für alle Teilnehmenden sichtbar und stehen an Ihren Anforderungen.' : backend.kind === 'demo' ? 'Lokale Demo: Angaben bleiben in diesem Browser.' : 'Der Code bestimmt Ihren Zugang (Portal, TG-Mitglied, Moderation).'}
        </span>
      </div>
    </form>
  );
}
