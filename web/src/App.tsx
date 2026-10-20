import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useStore } from './data/store';
import { StartPage } from './views/start/StartPage';
import { BoardShell } from './views/board/BoardShell';
import { Overview } from './views/board/Overview';
import { AgentsView } from './views/board/AgentsView';
import { GapsView } from './views/board/GapsView';
import { RequirementsView } from './views/board/RequirementsView';
import { AssistantView } from './views/board/AssistantView';
import { SourcesView } from './views/board/SourcesView';
import { AdminView } from './views/board/AdminView';
import { PortalShell } from './views/portal/PortalShell';

// bpmn-js ist groß – eigener Chunk, geladen erst beim Öffnen der Prozessansicht
const ProcessView = lazy(() => import('./views/board/ProcessView'));

export function App() {
  const { route, identity } = useStore();

  useEffect(() => {
    document.title = route.area === 'portal' ? 'Anforderungsportal · TG KI im Service' : route.area === 'board' ? 'TG-Board · KI im Service' : 'TG KI im Service';
  }, [route.area]);

  if (route.area === 'portal') return <PortalShell />;
  if (route.area === 'board') {
    if (!identity.boardAccess) return <StartPage notice="Das TG-Board ist für Ihren Zugang nicht freigeschaltet. Anforderungen reichen Sie im Anforderungsportal ein; den Board-Zugang vergibt die Moderation." />;
    const views: Record<string, ReactNode> = {
      overview: <Overview />,
      process: <ProcessView />,
      agents: <AgentsView />,
      gaps: <GapsView />,
      requirements: <RequirementsView />,
      assistant: <AssistantView />,
      sources: <SourcesView />,
      admin: <AdminView />,
    };
    return (
      <BoardShell>
        <Suspense fallback={<div className="page faint">Prozessansicht wird geladen …</div>}>{views[route.view] ?? <Overview />}</Suspense>
      </BoardShell>
    );
  }
  return <StartPage />;
}
