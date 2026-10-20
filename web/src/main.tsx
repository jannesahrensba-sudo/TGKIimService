import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { connectBackend, type Backend, type Identity } from './data/backend';
import { StoreProvider } from './data/store';
import type { TgModel } from '@core/types';
import { App } from './App';

function Boot() {
  const [state, setState] = useState<{ backend: Backend; model: TgModel; identity: Identity } | { error: string } | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const backend = await connectBackend();
        const model = await backend.load();
        const identity = await backend.identity(model);
        setState({ backend, model, identity });
      } catch (e) {
        setState({ error: (e as Error).message });
      }
    })();
  }, []);
  if (!state) {
    return (
      <div className="boot">
        <strong>TG KI im Service</strong>
        <span>Plattform wird geladen …</span>
      </div>
    );
  }
  if ('error' in state) {
    return (
      <div className="boot">
        <strong>Die Plattform konnte nicht geladen werden</strong>
        <span>{state.error}</span>
      </div>
    );
  }
  return (
    <StoreProvider backend={state.backend} initialModel={state.model} initialIdentity={state.identity}>
      <App />
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
