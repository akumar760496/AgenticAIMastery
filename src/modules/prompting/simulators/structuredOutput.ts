/** NBFC invoice extraction: output mode, schema complexity and a reasoning field, for 10,000 invoices into the ledger. */
export type OutputMode = 'prompt' | 'json' | 'strict';
export type SchemaComplexity = 'flat' | 'nested';
export interface StructuredOutputState { readonly mode: OutputMode; readonly complexity: SchemaComplexity; readonly reasoning: boolean }
export interface StructuredOutputResult { readonly parses: number; readonly schemaValid: number; readonly valuesCorrect: number; readonly outputTokens: number; readonly usable: number }

const PARSE_RATE: Readonly<Record<OutputMode, number>> = { prompt: 0.93, json: 1, strict: 1 };

export function simulateStructuredOutput(s: StructuredOutputState): StructuredOutputResult {
  const nested = s.complexity === 'nested';
  const schemaValid = s.mode === 'strict' ? 1 : s.mode === 'json' ? (nested ? 0.86 : 0.94) : (nested ? 0.74 : 0.85);
  let valuesCorrect = nested ? 0.88 : 0.9;
  if (s.mode === 'strict' && !s.reasoning && nested) valuesCorrect -= 0.02;
  if (s.reasoning) valuesCorrect += 0.03;
  const outputTokens = (nested ? 900 : 600) + (s.reasoning ? 250 : 0);
  return { parses: PARSE_RATE[s.mode], schemaValid, valuesCorrect, outputTokens, usable: schemaValid * valuesCorrect };
}
