import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PlaygroundSession } from '@/application/PlaygroundSession';
import { TechniqueContentSchema } from '@/domain/technique/TechniqueContent';
import type { PlaygroundMap } from '@/application/FeatureModuleFactory';
import { COST_OPTIMISATION_PLAYGROUNDS } from '@/modules/cost-optimisation';
import { EMBEDDINGS_PLAYGROUNDS } from '@/modules/embeddings';
import { ARCHITECTURES_PLAYGROUNDS } from '@/modules/architectures';
import { TOOL_USE_PLAYGROUNDS } from '@/modules/tool-use';
import { MEMORY_PLAYGROUNDS } from '@/modules/memory';
import { MULTI_AGENT_PLAYGROUNDS } from '@/modules/multi-agent';
import { OPERATIONS_PLAYGROUNDS } from '@/modules/operations';
import { SECURITY_PLAYGROUNDS } from '@/modules/security';
import { PROMPTING_PLAYGROUNDS } from '@/modules/prompting';
import { FINE_TUNING_PLAYGROUNDS } from '@/modules/fine-tuning';
import { GOVERNANCE_PLAYGROUNDS } from '@/modules/governance';
import { FRAMEWORKS_PLAYGROUNDS } from '@/modules/frameworks';
import { COMPUTER_USE_PLAYGROUNDS } from '@/modules/computer-use';
import { RAG_PLAYGROUNDS } from '@/modules/rag';
import { EVALUATION_PLAYGROUNDS } from '@/modules/evaluation';
import { GUARDRAILS_PLAYGROUNDS } from '@/modules/guardrails';
import { PERFORMANCE_PLAYGROUNDS } from '@/modules/performance';
import { VECTOR_DATABASES_PLAYGROUNDS } from '@/modules/vector-databases';

/** Every feature module's playgrounds, keyed by module slug. Add new modules here. */
const MODULES: Readonly<Record<string, PlaygroundMap>> = { evaluation: EVALUATION_PLAYGROUNDS, guardrails: GUARDRAILS_PLAYGROUNDS, 'cost-optimisation': COST_OPTIMISATION_PLAYGROUNDS, embeddings: EMBEDDINGS_PLAYGROUNDS, 'vector-databases': VECTOR_DATABASES_PLAYGROUNDS, performance: PERFORMANCE_PLAYGROUNDS, 'architectures': ARCHITECTURES_PLAYGROUNDS, 'tool-use': TOOL_USE_PLAYGROUNDS, 'memory': MEMORY_PLAYGROUNDS, 'multi-agent': MULTI_AGENT_PLAYGROUNDS, 'operations': OPERATIONS_PLAYGROUNDS, 'security': SECURITY_PLAYGROUNDS, 'prompting': PROMPTING_PLAYGROUNDS, 'fine-tuning': FINE_TUNING_PLAYGROUNDS, 'governance': GOVERNANCE_PLAYGROUNDS, 'frameworks': FRAMEWORKS_PLAYGROUNDS, 'computer-use': COMPUTER_USE_PLAYGROUNDS, 'rag': RAG_PLAYGROUNDS };

const contentFor = (slug: string, id: string) =>
  TechniqueContentSchema.parse(JSON.parse(readFileSync(join(process.cwd(), 'src/modules', slug, 'content', `${id}.json`), 'utf8')));

const CASES = Object.entries(MODULES).flatMap(([slug, map]) => Object.entries(map).map(([id, definition]) => [`${slug}/${id}`, slug, id, definition] as const));

/**
 * Contract tests every playground must satisfy. They replace the manual checks used before the refactor:
 * presets produce the numbers the copy promises, the first preset completes no mission,
 * and the definition and the learner-facing guide list the same presets and missions.
 */
describe.each(CASES)('%s playground', (_name, slug, id, definition) => {
  const guide = contentFor(slug, id).playgroundGuide;

  it('declares the technique id it is registered under', () => {
    expect(definition.techniqueId).toBe(id);
  });

  it.each(Object.entries(definition.presets))('preset "%s" produces its expected values', (_key, preset) => {
    const result = definition.simulate(preset.state);
    for (const [field, expected] of Object.entries(preset.expected ?? {})) {
      const actual = (result as Record<string, unknown>)[field];
      if (typeof expected === 'number') expect(actual as number, field).toBeCloseTo(expected, 3);
      else expect(actual, field).toEqual(expected);
    }
  });

  it('starts on a preset that completes no mission', () => {
    const snapshot = PlaygroundSession.evaluate(definition, definition.presets[definition.initialPreset]!.state);
    expect(snapshot.completedMissions).toEqual([]);
  });

  it('lists the same presets as the content guide', () => {
    expect(Object.keys(definition.presets).sort()).toEqual(guide.presets.map((p) => p.k).sort());
  });

  it('lists the same missions as the content guide', () => {
    expect(Object.keys(definition.missions).sort()).toEqual(guide.missions.map((m) => m.k).sort());
  });

  it('renders a verdict and a non-empty narrative for every preset', () => {
    for (const preset of Object.values(definition.presets)) {
      const snapshot = PlaygroundSession.evaluate(definition, preset.state);
      expect(snapshot.verdict.headline.length).toBeGreaterThan(0);
      expect(snapshot.narrative.length).toBeGreaterThan(20);
    }
  });
});
