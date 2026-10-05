/** Shared need profiles reused as presets across the framework chooser playgrounds. */
import { BASE_NEEDS, type ChooserState } from '../simulators/frameworkChooser';

const B = BASE_NEEDS;
export const SCENARIOS = {
  base: B,
  bank: { ...B, durable: 2, control: 2, typed: 1, lean: 1, speed: 0, builtin: 0, multi: 0 },
  proto: { ...B, model: 'openai', speed: 2, durable: 0, control: 0, lean: 0, multi: 1, typed: 1, builtin: 1 },
  ops: { ...B, model: 'claude', builtin: 2, durable: 1, control: 0, multi: 1, typed: 0, speed: 2, lean: 0 },
  java: { ...B, lang: 'jvm', cloud: 'gcp', multi: 2, durable: 1 },
  dotnet: { ...B, lang: 'dotnet', cloud: 'azure', multi: 2, durable: 1 },
  simple: { ...B, lean: 2, control: 2, durable: 0, multi: 0, builtin: 0, speed: 1, typed: 0 },
  typed: { ...B, typed: 2, lean: 1, durable: 1, multi: 0, builtin: 0, control: 1, speed: 2 },
  claudeCommit: { ...B, model: 'claude' },
} as const satisfies Record<string, ChooserState>;
