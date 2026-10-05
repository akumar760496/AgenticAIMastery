import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { simulateSkills, type SkillsResult, type SkillsState } from '../simulators/agentSkills';

const good = (r: SkillsResult) => r.success >= 0.9 && r.costPer1000 <= 2000 && !r.unreadSkill;

export const agentSkillsPlayground = definePlayground<SkillsState, SkillsResult>({
  techniqueId: 'skills',
  title: 'Package Paisapath’s 30 procedures (fictional)',
  intro: 'KYC re-checks, chargebacks, GST invoice fixes and 27 more. One procedure came from a public skills site. Input costs about ₹0.25 per 1,000 tokens.',
  controls: [
    { kind: 'select', key: 'packaging', label: 'Packaging', options: [{ value: 'prompt', label: 'All 30 in the system prompt' }, { value: 'tools', label: '30 tools with schemas' }, { value: 'skills', label: '30 skills, loaded when needed' }] },
    { kind: 'select', key: 'descriptions', label: 'Descriptions', options: [{ value: 'vague', label: 'Vague: “helps with payments”' }, { value: 'specific', label: 'Specific: what it does and when to use it' }] },
    { kind: 'toggle', key: 'scripts', label: 'Bundle scripts for exact steps (dates, amounts, checks)' },
    { kind: 'toggle', key: 'reviewed', label: 'Review the third-party skill before installing' },
  ],
  presets: {
    start: { state: { packaging: 'prompt', descriptions: 'vague', scripts: false, reviewed: false }, expected: { upFrontTokens: 45000, chosen: 0.9, success: 0.765, costPer1000: 11625 } },
    tools: { state: { packaging: 'tools', descriptions: 'specific', scripts: false, reviewed: false }, expected: { upFrontTokens: 9000, chosen: 0.88, success: 0.748, costPer1000: 2625 } },
    vague: { state: { packaging: 'skills', descriptions: 'vague', scripts: true, reviewed: false }, expected: { upFrontTokens: 3000, chosen: 0.7, costPer1000: 1625, unreadSkill: true } },
    full: { state: { packaging: 'skills', descriptions: 'specific', scripts: true, reviewed: true }, expected: { chosen: 0.93, success: 0.9021, costPer1000: 1625, unreadSkill: false } },
  },
  initialPreset: 'start',
  simulate: simulateSkills,
  outputs: [
    { kind: 'value', label: 'Context before any task', value: (r) => `${formatCount(r.upFrontTokens)} tokens` },
    { kind: 'meter', label: 'Right procedure chosen', value: (r) => r.chosen, emphasis: (r) => (r.chosen < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Tasks done correctly', value: (r) => r.success, emphasis: (r) => (r.success < 0.85 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost per 1,000 tasks', value: (r) => `₹${formatCount(Math.round(r.costPer1000))}` },
    { kind: 'value', label: 'Unreviewed third-party skill', value: (r) => (r.unreadSkill ? 'loaded with a hidden instruction' : 'none'), emphasis: (r) => (r.unreadSkill ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (good(r)) return { tone: 'ok', headline: 'Small context, right procedure, safe.', detail: 'Descriptions choose, scripts compute, review protects.' };
    if (r.unreadSkill) return { tone: 'no', headline: 'An unread skill is running.', detail: 'Read third-party skills before installing.' };
    if (r.costPer1000 > 5000) return { tone: 'mid', headline: 'Every task pays for all 30 procedures.', detail: 'Load procedures only when needed.' };
    if (r.chosen < 0.85) return { tone: 'mid', headline: 'The agent picks the wrong procedure.', detail: 'Write specific descriptions.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: 'Bundle scripts for the exact steps.' };
  },
  narrate: (_r, s) => [
    s.packaging === 'prompt' ? 'All 30 procedures ride in every prompt: 45,000 tokens before the task starts.' : s.packaging === 'tools' ? 'Thirty tools with schemas cost 9,000 tokens up front.' : 'Thirty skill descriptions cost 3,000 tokens; a skill’s body loads only for its task.',
    s.packaging !== 'prompt' ? (s.descriptions === 'specific' ? 'Specific descriptions let the agent pick the right procedure.' : 'Vague descriptions make it pick the wrong one about three times in ten.') : '',
    s.scripts ? 'Scripts compute deadlines and amounts exactly.' : 'The model works out deadlines itself and slips on some.',
    s.packaging === 'skills' ? (s.reviewed ? 'The third-party skill was read and cleaned before install.' : 'The downloaded skill was installed unread and carries an instruction to email statements to an outside address.') : '',
  ].filter(Boolean).join(' '),
  missions: {
    best: ({ result }) => good(result),
    lean: ({ result }) => result.upFrontTokens <= 5000,
    review: ({ result }) => result.unreadSkill,
  },
});
