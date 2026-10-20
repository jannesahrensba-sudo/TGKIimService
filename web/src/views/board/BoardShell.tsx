import type { ReactNode } from 'react';
import { ROLES } from '@core/access';
import { reviewOf } from '@core/ops';
import { useStore, href } from '../../data/store';

const NAV: { group: string; items: { view: string; label: string; count?: 'reqs' | 'gaps' | 'agents' | 'open' }[]; moderation?: boolean }[] = [
  { group: 'Themengruppe', items: [{ view: 'overview', label: 'Überblick' }] },
  {
    group: 'Prozess & Agenten',
    items: [
      { view: 'process', label: 'Serviceprozess (BPMN)' },
      { view: 'agents', label: 'SAP-Agenten', count: 'agents' },
      { view: 'gaps', label: 'Agentenlücken', count: 'gaps' },
    ],
  },
  { group: 'Anforderungen', items: [{ view: 'requirements', label: 'Anforderungen & User Stories', count: 'reqs' }] },
  {
    group: 'Assistenz & Wissen',
    items: [
      { view: 'assistant', label: 'Prozess-Agent' },
      { view: 'sources', label: 'Quellen & Validierung' },
    ],
  },
  { group: 'Moderation', items: [{ view: 'admin', label: 'Verwaltung' }], moderation: true },
];

const TITLES: Record<string, string> = {
  overview: 'Überblick',
  process: 'Serviceprozess End-to-End',
  agents: 'SAP-Agenten (Autonomous Service)',
  gaps: 'Agentenlücken – wo fehlen Agenten?',
  requirements: 'Anforderungen & User Stories',
  assistant: 'Prozess-Agent',
  sources: 'Quellen & Validierung des SAP-Standards',
  admin: 'Verwaltung',
};

/** Board der Themengruppe: Navigationsleiste links, Arbeitsfläche rechts. */
export function BoardShell({ children }: { children: ReactNode }) {
  const { model, route, principal, identity, backend } = useStore();
  const counts = {
    reqs: model.requirements.filter((r) => !r.withdrawn).length,
    open: model.requirements.filter((r) => !r.withdrawn && reviewOf(model, r.id).status === 'EINGEREICHT').length,
    gaps: model.gaps.filter((g) => g.status !== 'GESCHLOSSEN' && g.status !== 'VERWORFEN').length,
    agents: model.sapAgents.length,
  };
  const isMod = principal?.role === 'moderation';
  return (
    <div className="app">
      <nav className="rail" aria-label="TG-Board">
        <a className="rail-brand" href={href('start')} style={{ textDecoration: 'none' }}>
          <strong>TG KI im Service</strong>
          <span>Board der Themengruppe</span>
        </a>
        {NAV.filter((g) => !g.moderation || isMod).map((g) => (
          <div key={g.group} className="stack" style={{ gap: 2 }}>
            <span className="rail-group">{g.group}</span>
            {g.items.map((it) => (
              <a key={it.view} href={href('board', it.view)} aria-current={route.view === it.view ? 'page' : undefined}>
                <span>{it.label}</span>
                {it.count && <span className="count">{counts[it.count]}</span>}
                {it.view === 'requirements' && counts.open > 0 && isMod && <span className="count new" title="neu eingereicht">+{counts.open}</span>}
              </a>
            ))}
          </div>
        ))}
        <div className="rail-foot">
          <a href={href('portal')} className="rail-switch">
            → Anforderungsportal
          </a>
          <span>{principal ? `${principal.name} · ${principal.company}` : 'Nicht angemeldet'}</span>
          <span>
            {ROLES[principal?.role ?? identity.role].label} · {backend.kind === 'artifact' ? 'geteilt in Claude' : backend.kind === 'server' ? 'Server' : 'lokale Demo'}
          </span>
        </div>
      </nav>
      <header className="topbar">
        <div className="crumbs">
          <span className="eyebrow">TG-Board</span>
          <h1>{TITLES[route.view] ?? 'Board'}</h1>
        </div>
        {!principal && (
          <a className="btn small" href={href('start')}>
            Namen und Unternehmen angeben
          </a>
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
