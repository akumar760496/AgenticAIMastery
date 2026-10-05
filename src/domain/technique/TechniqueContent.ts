/**
 * Content model for a technique and a module.
 *
 * Decision (see docs/ARCHITECTURE.md, ADR-003): Zod schemas live in the domain layer and the
 * TypeScript types are inferred from them, so the contract is written once and enforced at
 * build time (scripts/validate-content.ts) and in tests.
 */
import { z } from 'zod';

const NonEmpty = z.string().min(1);
const Url = z.string().url();

export const CodeLineSchema = z.object({ text: z.string(), steps: z.array(z.number().int().positive()) });

export const LessonSchema = z.object({
  file: NonEmpty,
  language: NonEmpty,
  code: z.array(CodeLineSchema).min(1),
  steps: z.array(z.object({ title: NonEmpty, text: NonEmpty })).min(1),
  sceneHeight: z.number().positive(),
  scenes: z.array(z.object({ step: z.number().int().positive(), svg: NonEmpty })),
});

export const QuizQuestionSchema = z
  .object({
    id: NonEmpty,
    kind: z.enum(['single', 'multi']),
    industry: NonEmpty,
    question: NonEmpty,
    options: z.array(NonEmpty).length(4),
    correct: z.array(z.number().int().min(0).max(3)).min(1),
    explanation: NonEmpty,
  })
  .refine((q) => q.kind === 'multi' || q.correct.length === 1, { message: 'single-answer question must have exactly one correct option' });

const GuideItemSchema = z.object({ k: NonEmpty, text: NonEmpty, hint: NonEmpty });

export const PlaygroundGuideSchema = z.object({
  scenario: NonEmpty,
  controls: z.array(NonEmpty),
  outputs: z.array(z.object({ name: NonEmpty, meaning: NonEmpty })),
  presets: z.array(z.object({ k: NonEmpty, name: NonEmpty, expect: NonEmpty })).min(1),
  missions: z.array(GuideItemSchema).min(1),
  tools: z.array(z.record(z.string(), z.unknown())),
  quickPicks: z.array(z.object({ need: NonEmpty, tool: NonEmpty })),
  goals: z.array(NonEmpty),
});

export const TechniqueContentSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*$/),
  moduleSlug: NonEmpty,
  name: NonEmpty,
  shortName: NonEmpty,
  question: NonEmpty,
  summary: NonEmpty,
  useCases: z.array(NonEmpty).min(1),
  keyFacts: z.object({ label: NonEmpty, items: z.array(z.object({ term: NonEmpty, detail: NonEmpty })).min(1) }),
  steps: z.array(NonEmpty).min(1),
  pitfalls: z.array(NonEmpty).min(1),
  tools: z.array(NonEmpty).min(1),
  remember: NonEmpty,
  caption: NonEmpty,
  comparison: z.object({ scope: NonEmpty, cost: z.number().int().min(1).max(4), needs: NonEmpty, best: NonEmpty }),
  diagram: z.object({ file: NonEmpty }),
  lesson: LessonSchema,
  decision: z.object({
    pros: z.array(NonEmpty).min(1),
    cons: z.array(NonEmpty).min(1),
    avoidWhen: z.array(NonEmpty),
    tools: z.array(z.object({ name: NonEmpty, type: NonEmpty, what: NonEmpty, url: Url })),
  }),
  playgroundGuide: PlaygroundGuideSchema,
  practice: z.object({
    scenario: NonEmpty,
    industries: z.array(z.object({ industry: NonEmpty, use: NonEmpty })),
    analogy: NonEmpty,
    library: z.object({ name: NonEmpty, what: NonEmpty, install: NonEmpty.optional() }),
    note: NonEmpty.optional(),
    samples: z.array(z.object({ file: NonEmpty, language: NonEmpty, code: NonEmpty })).min(1),
  }),
  numericDrill: z.object({
    question: NonEmpty,
    answer: NonEmpty,
    expected: z.object({ value: z.number(), tolerance: z.number().nonnegative(), label: NonEmpty }).optional(),
    interview: z.array(z.object({ question: NonEmpty, answer: NonEmpty })),
    mistakes: z.array(z.object({ mistake: NonEmpty, fix: NonEmpty })),
  }),
  quiz: z.array(QuizQuestionSchema).min(20),
});

export const ModuleContentSchema = z.object({
  slug: NonEmpty,
  number: z.number().int().positive(),
  techniqueOrder: z.array(NonEmpty).min(1),
  glossary: z.array(z.object({ term: NonEmpty, definition: NonEmpty })),
  sources: z.array(z.object({ id: z.string().regex(/^S\d+$/), title: NonEmpty, url: Url })),
  symptomRouter: z.array(z.object({ symptom: NonEmpty, techniqueId: NonEmpty, advice: NonEmpty })),
});

export type TechniqueContent = z.infer<typeof TechniqueContentSchema>;
export type ModuleContent = z.infer<typeof ModuleContentSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
