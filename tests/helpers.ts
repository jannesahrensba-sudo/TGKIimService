/** Testhilfen: ausgeliefertes Modell laden, Personen der Plattform. */
import type { Principal } from '../src/core/access';
import { assembleModel } from '../src/core/model-io';
import { readBundledFiles } from '../src/node/model-store';

export const bundled = async () => assembleModel(await readBundledFiles());

export const moderation: Principal = { role: 'moderation', authorId: 'u-mod', name: 'Mara Moderation', company: 'Brunata Metrona', owner: false };
export const owner: Principal = { ...moderation, authorId: 'u-owner', name: 'Eigentümer', owner: true };
export const memberA: Principal = { role: 'member', authorId: 'u-a', name: 'Anna Anwender', company: 'Testo Industrial Services', owner: false };
export const memberB: Principal = { role: 'member', authorId: 'u-b', name: 'Bernd Beispiel', company: 'Bosch Thermotechnik', owner: false };
export const portalA: Principal = { role: 'portal', authorId: 'u-pa', name: 'Paula Portal', company: 'Testo Industrial Services', owner: false };
export const guest: Principal = { role: 'guest', authorId: null };

export const ctx = (principal: Principal) => ({ actor: `${principal.name ?? 'Gast'}`, principal, now: '2026-10-20T10:00:00.000Z' });
