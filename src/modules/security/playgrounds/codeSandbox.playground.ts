import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateSandbox, type SandboxResult, type SandboxState } from '../simulators/codeSandbox';

export const codeSandboxPlayground = definePlayground<SandboxState, SandboxResult>({
  techniqueId: 'sandbox',
  title: 'Contain model-written code',
  intro: 'A prompt injection makes the model write hostile code. The same tool must still install packages and read the customer’s transactions.',
  controls: [
    { kind: 'select', key: 'isolation', label: 'Isolation', options: [{ value: 'host', label: 'None: the app’s own process' }, { value: 'container', label: 'Plain container' }, { value: 'gvisor', label: 'gVisor container' }, { value: 'microvm', label: 'Firecracker microVM' }] },
    { kind: 'select', key: 'network', label: 'Network', options: [{ value: 'open', label: 'Open' }, { value: 'proxy', label: 'Egress proxy: package mirror only' }, { value: 'none', label: 'None' }] },
    { kind: 'select', key: 'credentials', label: 'Credentials', options: [{ value: 'host', label: 'Host environment variables' }, { value: 'scoped', label: 'Scoped 15-minute token' }, { value: 'none', label: 'None' }] },
    { kind: 'toggle', key: 'limits', label: 'CPU, memory and time limits' },
  ],
  presets: {
    start: { state: { isolation: 'host', network: 'open', credentials: 'host', limits: false }, expected: { blocked: 0, installWorks: true, bankTaskWorks: true } },
    container: { state: { isolation: 'container', network: 'open', credentials: 'host', limits: true }, expected: { blocked: 1 } },
    locked: { state: { isolation: 'gvisor', network: 'none', credentials: 'none', limits: true }, expected: { blocked: 4, installWorks: false, bankTaskWorks: false } },
    useful: { state: { isolation: 'microvm', network: 'proxy', credentials: 'scoped', limits: true }, expected: { blocked: 4, installWorks: true, bankTaskWorks: true } },
  },
  initialPreset: 'start',
  simulate: simulateSandbox,
  outputs: [
    { kind: 'itemList', title: 'Hostile code tries to…', items: (r) => r.attacks.map((a) => ({ label: 'attack', text: a.name, status: a.succeeds ? 'succeeds' : 'blocked', tone: a.succeeds ? 'no' : 'ok', flagged: a.succeeds })) },
    { kind: 'check', label: 'Install a package', value: (r) => r.installWorks },
    { kind: 'check', label: 'Read this customer’s transactions via the bank API', value: (r) => r.bankTaskWorks },
  ],
  verdict: (r) => (r.blocked === 4 && r.installWorks && r.bankTaskWorks
    ? { tone: 'ok', headline: 'Contained and still useful.', detail: 'A microVM, a package-only proxy and a scoped token.' }
    : r.blocked === 4 ? { tone: 'mid', headline: 'Locked down, but useless.', detail: 'Open exactly what the tasks need: a package mirror and a scoped token.' } : { tone: 'no', headline: `${4 - r.blocked} attack${4 - r.blocked > 1 ? 's' : ''} still succeed.`, detail: 'Isolation, egress, credentials and limits each stop a different attack.' }),
  narrate: (_r, s) => [
    s.isolation === 'host' ? 'The code runs inside the application itself, so it can read anything the app can.' : s.isolation === 'container' ? 'A plain container shares the host’s kernel, so a kernel exploit could escape.' : `A ${s.isolation === 'gvisor' ? 'gVisor container' : 'microVM'} keeps the code off the host kernel.`,
    s.network === 'open' ? 'With an open network, stolen data can go anywhere.' : s.network === 'proxy' ? 'Only the package mirror is reachable, so installs work and nothing else leaves.' : 'With no network, nothing leaves, but installs fail too.',
    s.credentials === 'host' ? 'Host environment variables hand the code the service’s own secrets.' : s.credentials === 'scoped' ? 'A 15-minute token scoped to one customer is all there is to steal.' : 'Without credentials the code cannot reach the bank API at all.',
  ].join(' '),
  missions: {
    secrets: ({ result }) => !result.secretsRead && result.bankTaskWorks,
    egress: ({ result }) => !result.dataLeaves && result.installWorks,
    all: ({ result }) => result.blocked === 4 && result.installWorks && result.bankTaskWorks,
  },
});
