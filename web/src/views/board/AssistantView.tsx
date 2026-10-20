import { useStore } from '../../data/store';
import { AgentChat } from '../../components/AgentChat';
import { PLATFORM_AGENTS } from '@agents/definitions';
import { Panel } from '../../components/ui';

/** Prozess-Agent (und die anderen Plattform-Agenten) im Vollbild. */
export function AssistantView() {
  const { route } = useStore();
  return (
    <div className="page">
      <div className="split">
        <div className="panel" style={{ height: 'calc(100vh - 150px)', minHeight: 480 }}>
          <AgentChat scope="assistant-page" agents={['prozess-agent', 'abgleich-agent', 'story-assistent']} defaultAgentId="prozess-agent" focus={{ nodeId: route.params.node, agentId: route.params.agent, requirementId: route.params.req }} />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {PLATFORM_AGENTS.map((a) => (
            <Panel key={a.id} title={`✦ ${a.name}`} eyebrow={a.short}>
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {a.description}
              </p>
            </Panel>
          ))}
          <div className="note">
            Agenten lesen das Modell der Plattform (Prozess, Agentenkatalog, Lücken, Anforderungen) und schlagen nur vor. Änderungen übernimmt die Person selbst – Board-Änderungen nur die Moderation. SAP-Fakten ohne Quelle werden als „zu verifizieren“ benannt.
          </div>
        </div>
      </div>
    </div>
  );
}
