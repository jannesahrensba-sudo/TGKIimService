import { useEffect, useMemo, useState } from 'react';
import type { AcceptanceCriterion, Priority, RequirementTarget, RequirementType, TgModel } from '@core/types';
import { AGENT_STATUS, PRIORITIES, REQUIREMENT_TARGETS, REQUIREMENT_TYPES, isActivity } from '@core/types';
import type { RequirementDraft } from '@core/ops';
import { quickMatch } from '@core/match';
import { Field, TokenPicker } from './ui';

export const emptyDraft = (): RequirementDraft => ({ type: 'USER_STORY', target: 'NEUER_AGENT', category: '', title: '', note: '', story: { role: '', goal: '', benefit: '', acceptanceCriteria: [{ given: '', when: '', then: '' }] }, nodeIds: [], sapAgentIds: [] });

export function nodeOptions(m: TgModel) {
  return m.processes.flatMap((p) => p.nodes.filter((n) => isActivity(n.type)).map((n) => ({ id: n.id, label: `${n.name} · ${p.lanes.find((l) => l.id === n.laneId)?.name ?? ''}` })));
}

export function agentOptions(m: TgModel) {
  return m.sapAgents.map((a) => ({ id: a.id, label: `${a.name} (${AGENT_STATUS[a.status].label})` }));
}

/** Entwurf vollständig genug zum Einreichen? (gleiche Prüfung wie im Kern, als Hinweis vor dem Absenden) */
export function draftProblems(d: RequirementDraft): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push('Titel fehlt');
  if (!d.category.trim()) out.push('Kategorie fehlt');
  if (d.type === 'USER_STORY') {
    if (!d.story?.role.trim() || !d.story?.goal.trim() || !d.story?.benefit.trim()) out.push('User Story: Rolle, Ziel und Nutzen ausfüllen');
  } else if (!d.note.trim()) out.push('Anmerkung fehlt');
  return out;
}

/** Leere Akzeptanzkriterien entfernen; Prozessthema ohne Story */
export function cleanDraft(d: RequirementDraft): RequirementDraft {
  const out: RequirementDraft = { ...d, title: d.title.trim(), category: d.category.trim(), note: d.note.trim() };
  if (d.type === 'USER_STORY' && d.story) out.story = { ...d.story, acceptanceCriteria: d.story.acceptanceCriteria.filter((c) => c.given.trim() || c.when.trim() || c.then.trim()) };
  else delete out.story;
  return out;
}

/**
 * Formular für eine Anforderung: Art (User Story / Prozessthema & Anmerkung), Bezug (Prozess, SAP-Agent,
 * KI-Hook), Prozessschritte und SAP-Agenten – mit Live-Schnellabgleich als Vorschlag.
 */
export function RequirementForm({ model, value, onChange }: { model: TgModel; value: RequirementDraft; onChange: (d: RequirementDraft) => void }) {
  const set = <K extends keyof RequirementDraft>(k: K, v: RequirementDraft[K]) => onChange({ ...value, [k]: v });
  const story = value.story ?? { role: '', goal: '', benefit: '', acceptanceCriteria: [] };
  const setStory = (patch: Partial<typeof story>) => set('story', { ...story, ...patch });
  const setAc = (i: number, patch: Partial<AcceptanceCriterion>) => setStory({ acceptanceCriteria: story.acceptanceCriteria.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const nodes = useMemo(() => nodeOptions(model), [model]);
  const agents = useMemo(() => agentOptions(model), [model]);

  // Schnellabgleich verzögert, damit Tippen flüssig bleibt
  const [match, setMatch] = useState<ReturnType<typeof quickMatch> | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (`${value.title} ${value.note} ${story.goal}`.trim().length < 8) return setMatch(null);
      setMatch(quickMatch(model, { ...value, nodeIds: value.nodeIds ?? [], sapAgentIds: value.sapAgentIds ?? [], story: value.type === 'USER_STORY' ? story : undefined }));
    }, 400);
    return () => clearTimeout(t);
  }, [model, value, story]);

  const suggestedNodes = (match?.nodes ?? []).filter((h) => h.score >= 1.2 && !(value.nodeIds ?? []).includes(h.id)).slice(0, 4);
  const suggestedAgents = (match?.agents ?? []).filter((h) => h.score >= 2 && !(value.sapAgentIds ?? []).includes(h.id)).slice(0, 4);

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="segmented" role="radiogroup" aria-label="Art der Anforderung">
        {(Object.keys(REQUIREMENT_TYPES) as RequirementType[]).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={value.type === t} onClick={() => set('type', t)}>
            <b>{REQUIREMENT_TYPES[t].label}</b>
            <span>{REQUIREMENT_TYPES[t].description}</span>
          </button>
        ))}
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <Field label="Titel / Thema *">
          <input className="input" value={value.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="z. B. Zuteilungsvorschlag für den Auftragsbestand" />
        </Field>
        <Field label="Kategorie *">
          <input className="input" list="tg-categories" value={value.category} onChange={(e) => set('category', e.target.value)} placeholder="auswählen oder eingeben" />
          <datalist id="tg-categories">
            {model.meta.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>

      {value.type === 'USER_STORY' && (
        <fieldset className="fieldset">
          <legend>User Story</legend>
          <div className="story-sentence">
            <label>
              <span>Als</span>
              <input className="input" value={story.role} onChange={(e) => setStory({ role: e.target.value })} placeholder="Rolle, z. B. Disponent:in" />
            </label>
            <label>
              <span>möchte ich</span>
              <textarea className="input" rows={2} value={story.goal} onChange={(e) => setStory({ goal: e.target.value })} placeholder="Ziel – was soll der Agent / das System tun?" />
            </label>
            <label>
              <span>damit</span>
              <textarea className="input" rows={2} value={story.benefit} onChange={(e) => setStory({ benefit: e.target.value })} placeholder="Nutzen für Kunde, Mitarbeitende oder Unternehmen" />
            </label>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Akzeptanzkriterien (Gegeben / Wenn / Dann)</span>
            {story.acceptanceCriteria.map((c, i) => (
              <div key={i} className="criterion-row">
                <span className="mono faint">AK{i + 1}</span>
                <input className="input" value={c.given} onChange={(e) => setAc(i, { given: e.target.value })} placeholder="Gegeben …" aria-label={`AK${i + 1} Gegeben`} />
                <input className="input" value={c.when} onChange={(e) => setAc(i, { when: e.target.value })} placeholder="Wenn …" aria-label={`AK${i + 1} Wenn`} />
                <input className="input" value={c.then} onChange={(e) => setAc(i, { then: e.target.value })} placeholder="Dann …" aria-label={`AK${i + 1} Dann`} />
                <button type="button" className="btn ghost small" aria-label={`AK${i + 1} entfernen`} onClick={() => setStory({ acceptanceCriteria: story.acceptanceCriteria.filter((_, k) => k !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <div>
              <button type="button" className="btn small" onClick={() => setStory({ acceptanceCriteria: [...story.acceptanceCriteria, { given: '', when: '', then: '' }] })}>
                + Akzeptanzkriterium
              </button>
            </div>
          </div>
        </fieldset>
      )}

      <Field label={value.type === 'USER_STORY' ? 'Ergänzende Beschreibung' : 'Anmerkung *'}>
        <textarea className="input" rows={value.type === 'USER_STORY' ? 3 : 5} value={value.note} onChange={(e) => set('note', e.target.value)} placeholder="Was soll der Agent anhand welcher Daten, Regeln und Kriterien tun? Wo bleibt der Mensch in der Verantwortung?" />
      </Field>

      <fieldset className="fieldset">
        <legend>Bezug</legend>
        <div className="segmented small" role="radiogroup" aria-label="Bezug">
          {(Object.keys(REQUIREMENT_TARGETS) as RequirementTarget[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={value.target === t} onClick={() => set('target', t)}>
              <b>{REQUIREMENT_TARGETS[t].label}</b>
              <span>{REQUIREMENT_TARGETS[t].description}</span>
            </button>
          ))}
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <Field label="Prozessschritt(e)">
            <TokenPicker options={nodes} value={value.nodeIds ?? []} onChange={(v) => set('nodeIds', v)} placeholder="Schritt suchen, z. B. Disposition" />
          </Field>
          <Field label="SAP-Agent(en)">
            <TokenPicker options={agents} value={value.sapAgentIds ?? []} onChange={(v) => set('sapAgentIds', v)} placeholder="Agent suchen, z. B. Dispatching" />
          </Field>
        </div>
        {(suggestedNodes.length > 0 || suggestedAgents.length > 0) && (
          <div className="suggest">
            <span className="eyebrow">Vorschläge aus dem Schnellabgleich</span>
            <div className="row" style={{ gap: 6 }}>
              {suggestedNodes.map((h) => (
                <button key={h.id} type="button" className="btn small" title={`Begriffe: ${h.concepts.join(', ')}`} onClick={() => set('nodeIds', [...(value.nodeIds ?? []), h.id])}>
                  + <span className="mono">{h.id}</span> {h.name}
                </button>
              ))}
              {suggestedAgents.map((h) => (
                <button key={h.id} type="button" className="btn small agent-btn" title={`Begriffe: ${h.concepts.join(', ')}`} onClick={() => set('sapAgentIds', [...(value.sapAgentIds ?? []), h.id])}>
                  + ✦ {h.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <div className="form-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)' }}>
        <Field label="Priorität (optional)">
          <select className="input" value={value.priority ?? ''} onChange={(e) => set('priority', (e.target.value || undefined) as Priority | undefined)}>
            <option value="">nicht angegeben</option>
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITIES[p].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nutzen / Business Value (optional)">
          <input className="input" value={value.businessValue ?? ''} onChange={(e) => set('businessValue', e.target.value || undefined)} placeholder="z. B. 30 % weniger Fehleinsätze" />
        </Field>
      </div>
    </div>
  );
}
