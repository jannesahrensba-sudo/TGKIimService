import { useEffect, useRef, useState } from 'react';
import { PLATFORM_AGENTS, type PlatformAgentId } from '@agents/definitions';
import type { AgentTurnResult } from '@agents/runner';
import type { AgentFocus } from '@agents/context';
import { describeOp, type RequirementDraft } from '@core/ops';
import { useStore } from '../data/store';
import type { AgentAvailability } from '../data/backend';
import { Badge, Markdown } from './ui';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  agentId: PlatformAgentId;
  content: string;
  result?: AgentTurnResult;
  state?: 'offen' | 'übernommen' | 'verworfen';
  error?: boolean;
}

// Gesprächsverläufe überleben einen Ansichtswechsel (nicht aber ein Neuladen der Seite)
const transcripts = new Map<string, { agentId: PlatformAgentId; messages: ChatMessage[] }>();
let availabilityCache: Promise<AgentAvailability> | null = null;

/**
 * Chat mit einem Plattform-Agenten. Vorschläge (Entwurf einer Anforderung, Abgleich, Board-Änderungen)
 * erscheinen am Ende der Antwort und werden erst mit „Übernehmen“ angewendet – mit den Rechten der Person.
 */
export function AgentChat({
  scope,
  agents,
  defaultAgentId,
  focus,
  starters,
  placeholder,
  onDraft,
  extraContext,
  height,
}: {
  scope: string;
  agents: PlatformAgentId[];
  defaultAgentId: PlatformAgentId;
  focus?: AgentFocus;
  starters?: string[];
  placeholder?: string;
  /** Story-Assistent: Entwurf ins Formular übernehmen */
  onDraft?: (d: RequirementDraft) => void;
  /** Zusätzlicher Kontext für den Agenten (z. B. aktueller Formularentwurf), nicht im Verlauf sichtbar */
  extraContext?: string;
  height?: string;
}) {
  const { backend, model, principal, identity, apply, toast } = useStore();
  const saved = transcripts.get(scope);
  const [agentId, setAgentId] = useState<PlatformAgentId>(saved?.agentId ?? defaultAgentId);
  const [messages, setMessages] = useState<ChatMessage[]>(saved?.messages ?? []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ text: string; tools: string[] }>({ text: '', tools: [] });
  const [availability, setAvailability] = useState<AgentAvailability | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const agent = PLATFORM_AGENTS.find((a) => a.id === agentId) ?? PLATFORM_AGENTS[0];

  useEffect(() => {
    transcripts.set(scope, { agentId, messages });
  }, [scope, agentId, messages]);

  useEffect(() => {
    let alive = true;
    availabilityCache ??= backend.agentAvailability().catch((e: Error): AgentAvailability => ({ ok: false, via: 'none', label: 'Agentenstatus unbekannt', hint: e.message }));
    void availabilityCache.then((a) => alive && setAvailability(a));
    return () => {
      alive = false;
    };
  }, [backend]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, live]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages
      .filter((m) => m.agentId === agentId && !m.error)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { id: Date.now(), role: 'user', agentId, content: message }]);
    setInput('');
    setBusy(true);
    setLive({ text: '', tools: [] });
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const forAgent = extraContext ? `${message}\n\n[${extraContext}]` : message;
      const result = await backend.runAgent({ agentId, message: forAgent, history, focus, principal: principal ?? { role: identity.role, authorId: identity.authorId } }, model, {
        signal: ctl.signal,
        onText: (t) => setLive((l) => ({ ...l, text: t })),
        onTool: (name) => setLive((l) => ({ ...l, tools: [...l.tools, name] })),
      });
      const hasProposal = result.ops.length > 0 || Boolean(result.draft);
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'assistant', agentId, content: result.reply, result, state: hasProposal ? 'offen' : undefined }]);
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError';
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'assistant', agentId, content: aborted ? 'Abgebrochen.' : (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const mark = (id: number, state: ChatMessage['state']) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, state } : m)));

  const accept = async (msg: ChatMessage) => {
    const r = msg.result;
    if (!r) return;
    if (r.draft && onDraft) onDraft(r.draft);
    if (r.ops.length) {
      const res = await apply(r.ops, `Vorschlag ${agent.name}`);
      if (!res) return;
      toast(`${res.applied} Änderung(en) übernommen${res.failed ? `, ${res.failed} abgelehnt` : ''}`, res.failed ? 'crit' : 'ok');
    } else if (r.draft) toast('Entwurf ins Formular übernommen', 'ok');
    mark(msg.id, 'übernommen');
  };

  const canApply = (r: AgentTurnResult) => !r.ops.length || principal?.role === 'moderation';

  return (
    <div className="chat" style={height ? { height } : undefined}>
      <div className="stack" style={{ gap: 0, minHeight: 0 }}>
        <div className="chat-head">
          {agents.length > 1 ? (
            <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value as PlatformAgentId)} aria-label="Agent wählen" style={{ maxWidth: 260 }}>
              {agents.map((id) => (
                <option key={id} value={id}>
                  {PLATFORM_AGENTS.find((a) => a.id === id)?.name}
                </option>
              ))}
            </select>
          ) : (
            <strong>{agent.name}</strong>
          )}
          {availability && (
            <Badge tone={availability.ok ? 'positive' : 'warning'} dot title={availability.hint}>
              {availability.label}
            </Badge>
          )}
          {messages.length > 0 && (
            <button type="button" className="btn ghost small" onClick={() => setMessages([])}>
              Neues Gespräch
            </button>
          )}
        </div>
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && (
            <div className="stack" style={{ gap: 8 }}>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {agent.description}
              </p>
              {availability && !availability.ok && <div className="note warn">{availability.hint}</div>}
              <div className="row" style={{ gap: 6 }}>
                {(starters ?? agent.starters).map((s) => (
                  <button key={s} type="button" className="btn small" onClick={() => (s.endsWith('…') || s.endsWith(': …') ? setInput(s.replace(/…$/, '')) : void send(s))} disabled={busy || availability?.ok === false}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role === 'user' ? 'user' : 'agent'}${m.error ? ' error' : ''}`}>
              {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
              {m.result && m.state && (
                <div className="changeset">
                  <strong style={{ fontSize: 'var(--fs-sm)' }}>Vorschlag</strong>
                  {m.result.draft && (
                    <div className="stack" style={{ gap: 2, fontSize: 'var(--fs-sm)' }}>
                      <span>
                        Entwurf: <b>{m.result.draft.title}</b> ({m.result.draft.type === 'USER_STORY' ? 'User Story' : 'Prozessthema'})
                      </span>
                      {m.result.draft.story && (
                        <span className="muted">
                          Als {m.result.draft.story.role} möchte ich {m.result.draft.story.goal}, damit {m.result.draft.story.benefit}. ({m.result.draft.story.acceptanceCriteria.length} Akzeptanzkriterien)
                        </span>
                      )}
                    </div>
                  )}
                  {m.result.ops.length > 0 && (
                    <ul className="list-plain" style={{ fontSize: 'var(--fs-sm)' }}>
                      {m.result.ops.map((o, i) => (
                        <li key={i}>• {describeOp(o)}</li>
                      ))}
                    </ul>
                  )}
                  {m.state === 'offen' ? (
                    <div className="row">
                      <button type="button" className="btn primary small" disabled={!canApply(m.result) || (Boolean(m.result.draft) && !onDraft && !m.result.ops.length)} onClick={() => void accept(m)} title={canApply(m.result) ? '' : 'Übernehmen darf nur die Moderation'}>
                        {m.result.draft && !m.result.ops.length ? 'In Formular übernehmen' : 'Übernehmen'}
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => mark(m.id, 'verworfen')}>
                        Verwerfen
                      </button>
                      {!canApply(m.result) && <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>Übernahme durch die Moderation</span>}
                    </div>
                  ) : (
                    <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{m.state}</span>
                  )}
                </div>
              )}
              {m.result && m.result.toolCalls.length > 0 && (
                <div className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                  Werkzeuge: {[...new Set(m.result.toolCalls.map((t) => t.name))].join(', ')}
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="bubble agent">
              {live.text ? <Markdown text={live.text} /> : <span className="faint">{agent.name} denkt nach …</span>}
              {live.tools.length > 0 && <div className="faint" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>{live.tools.join(' → ')}</div>}
            </div>
          )}
        </div>
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          className="input"
          rows={2}
          value={input}
          placeholder={placeholder ?? `Frage an den ${agent.name} …`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <div className="row between">
          <span className="faint" style={{ fontSize: 'var(--fs-xs)' }}>
            Enter senden · Umschalt+Enter neue Zeile
          </span>
          {busy ? (
            <button type="button" className="btn small" onClick={() => abortRef.current?.abort()}>
              Abbrechen
            </button>
          ) : (
            <button type="submit" className="btn primary small" disabled={!input.trim() || availability?.ok === false}>
              Senden
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
