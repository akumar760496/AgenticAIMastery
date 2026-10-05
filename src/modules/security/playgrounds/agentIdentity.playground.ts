import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { INCIDENTS, simulateAgentIdentity, type AgentIdentityResult, type AgentIdentityState } from '../simulators/agentIdentity';

export const agentIdentityPlayground = definePlayground<AgentIdentityState, AgentIdentityResult>({
  techniqueId: 'agentid',
  title: 'Identity for 30 agents',
  intro: 'A bank runs 30 agents over 12 systems and 80,00,000 customer records. One agent’s credential is stolen. Last year there were 40 agent-related incidents.',
  controls: [
    { kind: 'select', key: 'identity', label: 'Identity model', options: [{ value: 'shared', label: 'One shared admin service account' }, { value: 'peragent', label: 'One identity per agent' }, { value: 'obo', label: 'Per agent + on behalf of the user' }] },
    { kind: 'select', key: 'permissions', label: 'Permissions', options: [{ value: 'broad', label: 'Broad role for every agent' }, { value: 'least', label: 'Least privilege per agent' }, { value: 'jit', label: 'Least privilege + just-in-time elevation' }] },
    { kind: 'select', key: 'rotation', label: 'Credential rotation', options: [{ value: 'never', label: 'Never' }, { value: '90d', label: 'Every 90 days' }, { value: 'short', label: 'Short-lived: 15 minutes, automatic' }] },
  ],
  presets: {
    start: { state: { identity: 'shared', permissions: 'broad', rotation: 'never' }, expected: { systems: 12, writeSystems: 12, records: 8000000, tracedToAgent: 6, tracedToBoth: 0, standingPrivileged: 1, killSwitchStops: 30, opsHours: 2 } },
    peragent: { state: { identity: 'peragent', permissions: 'least', rotation: '90d' }, expected: { systems: 4, writeSystems: 1, tracedToBoth: 12, standingPrivileged: 12, opsHours: 30 } },
    obo: { state: { identity: 'obo', permissions: 'least', rotation: 'short' }, expected: { records: 21, tracedToBoth: 40, opsHours: 32 } },
    full: { state: { identity: 'obo', permissions: 'jit', rotation: 'short' }, expected: { systems: 3, writeSystems: 0, records: 21, standingPrivileged: 0, killSwitchStops: 1, opsHours: 38 } },
  },
  initialPreset: 'start',
  simulate: simulateAgentIdentity,
  outputs: [
    { kind: 'value', label: 'Systems one stolen credential reaches', value: (r) => `${r.systems} of 12`, detail: (r) => `write access to ${r.writeSystems}`, emphasis: (r) => (r.systems > 4 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Customer records exposed', value: (r) => formatCount(r.records), detail: (r) => `for ${r.windowLabel}`, emphasis: (r) => (r.records > 100 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Incidents traced to agent · to agent and person', value: (r) => `${r.tracedToAgent} · ${r.tracedToBoth} of ${INCIDENTS}` },
    { kind: 'value', label: 'Standing privileged accounts', value: (r) => String(r.standingPrivileged), emphasis: (r) => (r.standingPrivileged ? 'warn' : 'normal') },
    { kind: 'value', label: 'Agents stopped by one kill switch', value: (r) => String(r.killSwitchStops) },
    { kind: 'value', label: 'Upkeep', value: (r) => `${r.opsHours} hours a month` },
  ],
  verdict: (r) => (r.systems <= 4 && r.records <= 100 && r.tracedToBoth === INCIDENTS && r.standingPrivileged === 0
    ? { tone: 'ok', headline: 'Contained and accountable.', detail: 'One agent, one customer, a few minutes, and every action names both.' }
    : r.records >= 8000000 ? { tone: 'no', headline: 'One theft opens every record.', detail: 'Act on behalf of the user so a credential only reaches their data.' } : { tone: 'mid', headline: 'Better, not there yet.', detail: 'Remove standing privileges and trace every call to a person.' }),
  narrate: (r, s) => [
    s.identity === 'shared' ? 'All 30 agents log in as one admin service account, so a stolen credential is every agent’s credential.' : s.identity === 'peragent' ? 'Each agent has its own identity, so the thief holds only the dispute agent’s access.' : 'Each agent has its own identity and every call also carries the customer it is acting for.',
    `It reaches ${r.systems} of 12 systems, with write access to ${r.writeSystems}, and ${formatCount(r.records)} customer records, for ${r.windowLabel}.`,
    s.identity === 'shared' ? `Only ${r.tracedToAgent} of last year’s 40 incidents could be pinned on one agent, and none on a person; switching the account off stops all 30 agents.` : s.identity === 'peragent' ? `All 40 incidents trace to an agent, but only ${r.tracedToBoth} to the person behind them.` : 'All 40 incidents trace to both the agent and the person.',
    `${r.standingPrivileged} standing privileged accounts, ${r.opsHours} hours a month of upkeep.`,
  ].join(' '),
  missions: {
    contain: ({ result }) => result.systems <= 4 && result.records <= 100,
    trace: ({ result }) => result.tracedToBoth === INCIDENTS && result.standingPrivileged === 0,
    illusion: ({ state, result }) => state.identity === 'shared' && state.rotation === 'short' && result.records >= 8000000 && result.systems >= 10,
  },
});
