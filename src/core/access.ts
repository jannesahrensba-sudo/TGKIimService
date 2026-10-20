/**
 * Rechte der Plattform – zentral für Server, Browser (Artifact/Demo) und Agenten.
 *
 *  - moderation  Sprecherteam/Moderation der TG: Prozess, Agentenkatalog, Lücken, Status und Bewertung
 *  - member      TG-Mitglied: Board ansehen, Anforderungen einreichen, kommentieren, „betrifft uns auch“
 *  - portal      Unternehmen mit Zugang nur zum Anforderungsportal: eigene Anforderungen, Antworten auf Rückfragen
 *  - guest       nur lesen
 *
 * Eigene Beiträge (Profil, Anforderungen, Kommentare) liegen im persönlichen Dokument und gehören der Person;
 * die Moderation ändert fremde Inhalte nicht (Ausnahme: ausgelieferte Seed-Anforderungen, Eigentümer:in des Artifacts).
 */
import type { Op } from './ops';
import type { TgModel } from './types';
import { SEED_AUTHOR } from './types';
import { ownerOf } from './model-io';

export type Role = 'moderation' | 'member' | 'portal' | 'guest';

export interface Principal {
  role: Role;
  /** Kennung der Person (Artifact: Nutzer-ID, Server: aus Name und Firma) – null: anonym */
  authorId: string | null;
  name?: string;
  company?: string;
  /** Eigentümer:in des Artifacts bzw. Server-Moderation mit Vollzugriff */
  owner?: boolean;
}

export const ROLES: Record<Role, { label: string; description: string }> = {
  moderation: { label: 'Moderation', description: 'Sprecherteam: pflegt Prozess, Agentenkatalog, Lücken, Status und Bewertung' },
  member: { label: 'TG-Mitglied', description: 'Board und Anforderungsportal: einreichen, kommentieren, unterstützen' },
  portal: { label: 'Unternehmen (Portal)', description: 'Nur Anforderungsportal: eigene Anforderungen einreichen und verfolgen' },
  guest: { label: 'Gast', description: 'Nur lesen' },
};

export const MODERATION: Principal = { role: 'moderation', authorId: 'moderation', name: 'Moderation', company: 'Themengruppe', owner: true };

const MODERATION_OPS = /^(review|gap|agent|process|meta|source)\./;

export function canSeeBoard(p: Principal | null): boolean {
  return Boolean(p && p.role !== 'portal');
}

/** Darf die Person diese Operation ausführen? null = ja, sonst Begründung. */
export function checkOp(model: TgModel, op: Op, p: Principal): string | null {
  if (p.role === 'guest') return 'Nur Lesezugriff';
  if (MODERATION_OPS.test(op.op)) return p.role === 'moderation' ? null : 'Nur die Moderation der Themengruppe darf das ändern';
  if (!p.authorId) return 'Bitte zuerst Namen und Unternehmen angeben';

  const req = 'requirementId' in op ? model.requirements.find((r) => r.id === op.requirementId) : undefined;
  switch (op.op) {
    case 'profile.set':
      return null;
    case 'requirement.submit':
      return p.name && p.company ? null : 'Bitte zuerst Namen und Unternehmen angeben';
    case 'requirement.update':
    case 'requirement.withdraw':
      if (!req) return null; // Fehler meldet die Operation selbst
      if (req.authorId === p.authorId || p.owner) return null;
      if (req.authorId === SEED_AUTHOR && p.role === 'moderation') return null;
      return 'Nur das einreichende Unternehmen (Person) darf die Anforderung ändern';
    case 'comment.add':
      if (!req || p.role !== 'portal') return null;
      return req.company === p.company ? null : 'Im Portal sind Kommentare nur zu Anforderungen des eigenen Unternehmens möglich';
    case 'comment.remove': {
      const c = model.comments.find((x) => x.id === op.commentId);
      if (!c || c.authorId === p.authorId || p.owner) return null;
      return 'Nur eigene Kommentare können gelöscht werden';
    }
    case 'support.set':
      if (req && req.company === p.company) return 'Eigene Anforderungen des Unternehmens müssen nicht unterstützt werden';
      return null;
    default:
      return 'Unbekannte Operation';
  }
}

/** Darf die Person dieses Dokument schreiben? (zweite Prüfung beim Speichern) */
export function canWriteDoc(key: string, p: Principal): boolean {
  const o = ownerOf(key);
  if (o.kind === 'portal') return p.owner === true || (p.authorId !== null && o.authorId === p.authorId);
  return p.role === 'moderation';
}
