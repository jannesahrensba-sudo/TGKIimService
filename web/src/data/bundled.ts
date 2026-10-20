/** Das mit der Seite ausgelieferte Modell (Stand des Repositories, model/**). */
import type { TgModel } from '@core/types';
import { assembleModel, type ModelFiles } from '@core/model-io';

const raw = import.meta.glob('../../../model/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export function bundledFiles(): ModelFiles {
  const files: ModelFiles = {};
  for (const [k, v] of Object.entries(raw)) files[k.replace(/^.*\/model\//, '')] = v;
  return structuredClone(files);
}

export const bundledModel = (): TgModel => assembleModel(bundledFiles());
