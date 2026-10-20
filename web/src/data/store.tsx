/**
 * Zustand der Oberfläche: Modell, Identität, Änderungen (Operationen), Navigation (Hash), Hinweise.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TgModel } from '@core/types';
import type { ApplyResult, Op } from '@core/ops';
import type { Principal } from '@core/access';
import type { Backend, Identity, ProfileInput } from './backend';

export interface Route {
  area: 'start' | 'board' | 'portal';
  view: string;
  params: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [area, view = ''] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query));
  if (area === 'board') return { area, view: view || 'overview', params };
  if (area === 'portal') return { area, view: view || 'home', params };
  return { area: 'start', view: '', params };
}

export const href = (area: Route['area'], view = '', params: Record<string, string | undefined> = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return `#/${area}${view ? `/${view}` : ''}${q ? `?${q}` : ''}`;
};

interface Toast {
  id: number;
  text: string;
  tone?: 'crit' | 'ok';
}

interface StoreValue {
  backend: Backend;
  model: TgModel;
  identity: Identity;
  principal: Principal | null;
  route: Route;
  go(area: Route['area'], view?: string, params?: Record<string, string | undefined>): void;
  apply(ops: Op[], summary?: string): Promise<ApplyResult | null>;
  signIn(input: ProfileInput): Promise<boolean>;
  signOut(): Promise<void>;
  refreshIdentity(): Promise<void>;
  setModel(m: TgModel): void;
  toast(text: string, tone?: Toast['tone']): void;
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider fehlt');
  return v;
}

export function StoreProvider({ backend, initialModel, initialIdentity, children }: { backend: Backend; initialModel: TgModel; initialIdentity: Identity; children: ReactNode }) {
  const [model, setModel] = useState(initialModel);
  const [identity, setIdentity] = useState(initialIdentity);
  const [route, setRoute] = useState(() => parseHash(location.hash));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const modelRef = useRef(model);
  modelRef.current = model;

  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Änderungen anderer laufen live ein; Identität (z. B. Rolle durch Moderation) mitführen
  useEffect(() => {
    if (!backend.subscribe) return;
    return backend.subscribe((m) => {
      setModel(m);
      void backend.identity(m).then(setIdentity);
    });
  }, [backend]);

  useEffect(() => {
    if (!backend.access) return;
    return backend.access.subscribe(() => void backend.identity(modelRef.current).then(setIdentity));
  }, [backend]);

  const toast = useCallback((text: string, tone?: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'crit' ? 8000 : 4000);
  }, []);

  const go = useCallback((area: Route['area'], view = '', params: Record<string, string | undefined> = {}) => {
    location.hash = href(area, view, params);
  }, []);

  const apply = useCallback(
    async (ops: Op[], summary?: string) => {
      const p = identity.principal;
      if (!p) {
        toast('Bitte zuerst Namen und Unternehmen angeben.', 'crit');
        return null;
      }
      try {
        const res = await backend.apply(modelRef.current, ops, { actor: `${p.name} (${p.company})`, principal: p, summary });
        if (res.applied) setModel(res.model);
        const failed = res.results.filter((r) => !r.ok);
        if (failed.length) toast(failed.map((f) => f.message).join(' · '), 'crit');
        return res;
      } catch (e) {
        toast((e as Error).message, 'crit');
        return null;
      }
    },
    [backend, identity.principal, toast],
  );

  const refreshIdentity = useCallback(async () => setIdentity(await backend.identity(modelRef.current)), [backend]);

  const signIn = useCallback(
    async (input: ProfileInput) => {
      try {
        const id = await backend.signIn(input, modelRef.current);
        if (backend.kind !== 'demo') setModel(await backend.load());
        setIdentity(id);
        return true;
      } catch (e) {
        toast((e as Error).message, 'crit');
        return false;
      }
    },
    [backend, toast],
  );

  const signOut = useCallback(async () => {
    await backend.signOut?.();
    setIdentity(await backend.identity(modelRef.current));
  }, [backend]);

  const value = useMemo<StoreValue>(
    () => ({ backend, model, identity, principal: identity.principal, route, go, apply, signIn, signOut, refreshIdentity, setModel, toast }),
    [backend, model, identity, route, go, apply, signIn, signOut, refreshIdentity, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone ? ` ${t.tone}` : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
