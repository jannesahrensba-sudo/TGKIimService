/** Prüfregeln auf dem Modell (ausgeliefert + Laufzeitdokumente) – Exit 1 bei Fehlern. */
import { loadModel } from '../src/node/model-store';
import { summarizeFindings, validateModel } from '../src/core/validate';

const model = await loadModel();
const findings = validateModel(model);
for (const f of findings) console.log(`${f.severity.toUpperCase().padEnd(5)} ${f.rule} ${f.message}`);
const s = summarizeFindings(findings);
console.log(`\n${model.processes.length} Prozess(e), ${model.sapAgents.length} SAP-Agenten, ${model.gaps.length} Lücken, ${model.requirements.length} Anforderungen – ${s.errors} Fehler, ${s.warnings} Warnungen, ${s.infos} Hinweise`);
process.exit(s.errors ? 1 : 0);
