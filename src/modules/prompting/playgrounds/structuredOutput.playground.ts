import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { simulateStructuredOutput, type StructuredOutputResult, type StructuredOutputState } from '../simulators/structuredOutput';

const MODE_NAME = { prompt: 'Asking for JSON in the prompt', json: 'JSON mode', strict: 'Strict structured outputs' } as const;

export const structuredOutputPlayground = definePlayground<StructuredOutputState, StructuredOutputResult>({
  techniqueId: 'schema',
  title: 'Extract NBFC vendor invoices',
  intro: '10,000 invoices. The output goes straight into the ledger.',
  controls: [
    { kind: 'select', key: 'mode', label: 'Output mode', options: [{ value: 'prompt', label: 'Prompt: “return JSON only”' }, { value: 'json', label: 'JSON mode' }, { value: 'strict', label: 'Strict structured outputs' }] },
    { kind: 'select', key: 'complexity', label: 'Schema', options: [{ value: 'flat', label: 'Flat: 6 fields' }, { value: 'nested', label: 'Nested: line items, enums' }] },
    { kind: 'toggle', key: 'reasoning', label: 'A reasoning field before the values' },
  ],
  presets: {
    start: { state: { mode: 'prompt', complexity: 'flat', reasoning: false }, expected: { parses: 0.93, schemaValid: 0.85, usable: 0.765 } },
    json: { state: { mode: 'json', complexity: 'nested', reasoning: false }, expected: { parses: 1, schemaValid: 0.86 } },
    strict: { state: { mode: 'strict', complexity: 'nested', reasoning: false }, expected: { schemaValid: 1, valuesCorrect: 0.86 } },
    best: { state: { mode: 'strict', complexity: 'nested', reasoning: true }, expected: { schemaValid: 1, valuesCorrect: 0.91, outputTokens: 1150 } },
  },
  initialPreset: 'start',
  simulate: simulateStructuredOutput,
  outputs: [
    { kind: 'meter', label: 'Parses as JSON', value: (r) => r.parses, emphasis: (r) => (r.parses < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Matches the schema', value: (r) => r.schemaValid, detail: () => '= every field present with the right type', emphasis: (r) => (r.schemaValid < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Values correct', value: (r) => r.valuesCorrect, detail: () => '= totals, dates and GSTINs actually right', emphasis: (r) => (r.valuesCorrect < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Usable without review', value: (r) => formatPercent(r.usable, 1) },
    { kind: 'value', label: 'Output tokens', value: (r) => formatCount(r.outputTokens) },
  ],
  verdict: (r) => (r.schemaValid === 1 && r.valuesCorrect >= 0.9
    ? { tone: 'ok', headline: 'Right shape, right values.', detail: 'Strict decoding fixes the shape; reasoning first protects accuracy.' }
    : r.schemaValid === 1 ? { tone: 'mid', headline: 'Right shape, wrong values.', detail: 'The schema is always met, but some values are wrong: validate business rules too.' }
      : { tone: 'no', headline: 'Broken outputs reach your code.', detail: 'Some outputs fail to parse or miss fields.' }),
  narrate: (r, s) => [
    `${MODE_NAME[s.mode]} gives ${formatPercent(r.parses, 1)} parseable output and ${formatPercent(r.schemaValid, 1)} that match the ${s.complexity} schema.`,
    s.mode === 'strict' ? 'The decoder cannot produce anything else.' : s.mode === 'json' ? 'JSON is always valid, but fields and types are not enforced.' : 'Some replies include text around the JSON or leave fields out.',
    `Values are correct ${formatPercent(r.valuesCorrect, 1)} of the time${s.mode === 'strict' && s.complexity === 'nested' && !s.reasoning ? ': the tight format left no room to work out the totals' : ''}${s.reasoning ? ', helped by reasoning before the numbers' : ''}.`,
  ].join(' '),
  missions: {
    valid: ({ result }) => result.schemaValid >= 1,
    both: ({ state, result }) => result.schemaValid >= 1 && state.complexity === 'nested' && result.valuesCorrect >= 0.9,
    trap: ({ result }) => result.schemaValid >= 1 && result.valuesCorrect < 0.9,
  },
});
