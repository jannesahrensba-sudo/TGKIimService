import { useMemo, useState, type ReactNode } from 'react';
import type { AgentStatus, FitResult, GapStatus, Marker, Requirement, TgModel, Tone } from '@core/types';
import { AGENT_STATUS, FIT_RESULTS, GAP_STATUS, MARKERS, REQ_STATUS } from '@core/types';
import { COVERAGE, type CoverageClass } from '@core/coverage';
import { reviewOf } from '@core/ops';

/** HTML-Escaping für Overlays und Tooltips, die als HTML-String gebaut werden */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const toneVar = (tone: Tone) =>
  ({ positive: 'var(--ok)', warning: 'var(--warn)', critical: 'var(--crit)', info: 'var(--info)', neutral: 'var(--ink-3)', agent: 'var(--agent)' })[tone];

export function Badge({ tone = 'neutral', children, dot, outline, square, title }: { tone?: Tone | 'accent' | 'amber'; children: ReactNode; dot?: boolean; outline?: boolean; square?: boolean; title?: string }) {
  return (
    <span className={`badge tone-${tone}${outline ? ' outline' : ''}${square ? ' square' : ''}`} title={title}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function MarkerBadge({ marker }: { marker: Marker }) {
  const m = MARKERS[marker];
  if (!m) return null;
  return (
    <Badge tone={m.tone} square title={m.description}>
      {m.label}
    </Badge>
  );
}

export function AgentStatusBadge({ status, availability }: { status: AgentStatus; availability?: string }) {
  const s = AGENT_STATUS[status];
  return (
    <Badge tone={s.tone} dot title={`${s.description}${availability ? ` – ${availability}` : ''}`}>
      {s.label}
    </Badge>
  );
}

export function FitBadge({ fit, confirmed }: { fit: FitResult; confirmed?: boolean }) {
  const f = FIT_RESULTS[fit];
  return (
    <Badge tone={f.tone} dot title={`${f.description}${confirmed === false ? ' – Vorschlag, noch nicht bestätigt' : ''}`}>
      {f.label}
      {confirmed === false ? ' ?' : ''}
    </Badge>
  );
}

export function StatusBadge({ model, req }: { model: TgModel; req: Requirement }) {
  if (req.withdrawn) return <Badge tone="neutral" square>Zurückgezogen</Badge>;
  const s = REQ_STATUS[reviewOf(model, req.id).status];
  return (
    <Badge tone={s.tone} square title={s.description}>
      {s.label}
    </Badge>
  );
}

export function CoverageBadge({ coverage }: { coverage: CoverageClass }) {
  const c = COVERAGE[coverage];
  return (
    <Badge tone={c.tone} dot title={c.description}>
      {c.label}
    </Badge>
  );
}

export function GapBadge({ status }: { status: GapStatus }) {
  const g = GAP_STATUS[status];
  return (
    <Badge tone={g.tone} square>
      {g.label}
    </Badge>
  );
}

export function Id({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  return onClick ? (
    <button type="button" className="id" onClick={onClick} title={title}>
      {children}
    </button>
  ) : (
    <span className="id" title={title}>
      {children}
    </span>
  );
}

export function Panel({ title, eyebrow, actions, children, tight, id }: { title?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children: ReactNode; tight?: boolean; id?: string }) {
  return (
    <section className="panel" id={id}>
      {(title || actions) && (
        <header className="panel-head">
          <div className="stack" style={{ gap: 2 }}>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h3>{title}</h3>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={`panel-body${tight ? ' tight' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, unit, sub, tone }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="panel stat">
      <span className="eyebrow">{label}</span>
      <span className="value" style={tone ? { color: toneVar(tone) } : undefined}>
        {value}
        {unit && <small> {unit}</small>}
      </span>
      {sub && <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{sub}</span>}
    </div>
  );
}

export interface MeterSegment {
  label: string;
  value: number;
  color: string;
}

export function Meter({ segments, total }: { segments: MeterSegment[]; total?: number }) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="meter" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {segments.map((s) => (s.value > 0 ? <span key={s.label} style={{ width: `${(s.value / Math.max(sum, 1)) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} /> : null))}
      </div>
      <div className="legend">
        {segments.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label} <b className="num">{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Kv({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v ?? <span className="faint">–</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Mehrfachauswahl mit Suche (Prozessschritte, SAP-Agenten, Anforderungen). */
export function TokenPicker({ options, value, onChange, placeholder, id }: { options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return options.filter((o) => !value.includes(o.id) && `${o.id} ${o.label}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, options, value]);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 4 }}>
        {value.length === 0 && <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>keine</span>}
        {value.map((v) => (
          <span key={v} className="badge tone-accent" title={byId.get(v) ?? v} style={{ whiteSpace: 'normal' }}>
            <span className="mono">{v}</span>
            {byId.get(v) && <span>{(byId.get(v) ?? '').slice(0, 48)}</span>}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${v} entfernen`} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit' }}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input id={id} className="input" placeholder={placeholder ?? 'Suchen und hinzufügen …'} value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <div className="stack" style={{ gap: 2, border: '1px solid var(--line)', borderRadius: 5, padding: 4, background: 'var(--surface)' }}>
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="btn ghost small"
              style={{ justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left' }}
              onClick={() => {
                onChange([...value, h.id]);
                setQ('');
              }}
            >
              <span className="mono">{h.id}</span> {h.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Datei speichern: im Artifact über die Fähigkeit „downloads“, sonst per Blob-Link. */
export async function saveFile(filename: string, data: string, mime = 'text/plain'): Promise<'saved' | 'copied' | 'failed'> {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (claude?.use) {
    try {
      const downloads = (await claude.use('downloads')) as { save(r: { filename: string; data: string }): Promise<unknown> } | null;
      if (downloads) {
        await downloads.save({ filename, data });
        return 'saved';
      }
    } catch {
      /* abgelehnt oder nicht verfügbar → Fallback */
    }
    try {
      await navigator.clipboard.writeText(data);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignorieren */
    }
  };
  return [v, set];
}

/** Minimales Markdown für Agentenantworten: Überschriften, Listen, Fett, Code, Tabellen (als Mono-Block). */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  let table: string[] | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
      blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    }
    list = null;
  };
  const flushTable = () => {
    if (table) blocks.push(<pre key={blocks.length} className="md-table">{table.join('\n')}</pre>);
    table = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (line.trim().startsWith('|')) {
      flushPara();
      flushList();
      (table ??= []).push(line.trim());
      continue;
    }
    flushTable();
    if (heading) {
      flushPara();
      flushList();
      blocks.push(<h4 key={blocks.length}>{inline(heading[2])}</h4>);
    } else if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  flushTable();
  return <div className="md">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={out.length}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={out.length}>{t.slice(1, -1)}</code>);
    else out.push(<em key={out.length}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Bestätigung direkt in der Seite (window.confirm ist im Artifact nicht verfügbar). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className, disabled }: { label: ReactNode; confirmLabel?: ReactNode; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" className={className ?? 'btn danger small'} disabled={disabled} onClick={() => setArmed(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="row" style={{ gap: 4 }}>
      <button
        type="button"
        className="btn danger small"
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel ?? 'Wirklich?'}
      </button>
      <button type="button" className="btn ghost small" onClick={() => setArmed(false)}>
        Abbrechen
      </button>
    </span>
  );
}
