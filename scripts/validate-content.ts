/**
 * Build-time gate: validates every module's content against the domain schema and cross-checks references.
 * Run with `npm run validate`; the build fails on any error.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ModuleContentSchema, TechniqueContentSchema } from '../src/domain/technique/TechniqueContent';

const modulesDir = 'src/modules';
const errors: string[] = [];
let techniqueCount = 0;

for (const slug of readdirSync(modulesDir)) {
  const contentDir = join(modulesDir, slug, 'content');
  if (!existsSync(contentDir)) continue;
  const moduleResult = ModuleContentSchema.safeParse(JSON.parse(readFileSync(join(contentDir, 'module.json'), 'utf8')));
  if (!moduleResult.success) { errors.push(`${slug}/module.json: ${moduleResult.error.message}`); continue; }
  const moduleContent = moduleResult.data;
  for (const id of moduleContent.techniqueOrder) {
    const file = join(contentDir, `${id}.json`);
    if (!existsSync(file)) { errors.push(`${slug}: missing ${id}.json`); continue; }
    const parsed = TechniqueContentSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (!parsed.success) { errors.push(`${slug}/${id}.json: ${parsed.error.message}`); continue; }
    const technique = parsed.data;
    techniqueCount += 1;
    if (technique.id !== id) errors.push(`${slug}/${id}.json: id field is "${technique.id}"`);
    if (!existsSync(join(contentDir, technique.diagram.file))) errors.push(`${slug}/${id}: diagram ${technique.diagram.file} not found`);
    const quizIds = new Set<string>();
    for (const question of technique.quiz) {
      if (quizIds.has(question.id)) errors.push(`${slug}/${id}: duplicate quiz id ${question.id}`);
      quizIds.add(question.id);
    }
  }
  for (const route of moduleContent.symptomRouter) {
    if (!moduleContent.techniqueOrder.includes(route.techniqueId)) errors.push(`${slug}: symptom router points to unknown technique "${route.techniqueId}"`);
  }
}

if (errors.length) {
  console.error(`Content validation failed with ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Content valid: ${techniqueCount} techniques.`);
