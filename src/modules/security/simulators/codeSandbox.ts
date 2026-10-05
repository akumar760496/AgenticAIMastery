/** Sandboxing model-written code: isolation, network, credentials and limits against four attacks and two real tasks. */
export type Isolation = 'host' | 'container' | 'gvisor' | 'microvm';
export type Network = 'open' | 'proxy' | 'none';
export type Credentials = 'host' | 'scoped' | 'none';

export interface SandboxState { readonly isolation: Isolation; readonly network: Network; readonly credentials: Credentials; readonly limits: boolean }
export interface SandboxResult { readonly attacks: readonly { readonly name: string; readonly succeeds: boolean }[]; readonly blocked: number; readonly installWorks: boolean; readonly bankTaskWorks: boolean; readonly secretsRead: boolean; readonly dataLeaves: boolean }

export function simulateSandbox(s: SandboxState): SandboxResult {
  const secretsRead = s.credentials === 'host' || s.isolation === 'host';
  const dataLeaves = s.network === 'open';
  const attacks = [
    { name: 'Read host secrets', succeeds: secretsRead }, { name: 'Send data to an attacker', succeeds: dataLeaves },
    { name: 'Mine crypto on your CPUs', succeeds: !s.limits }, { name: 'Escape to the host', succeeds: s.isolation === 'host' || s.isolation === 'container' },
  ];
  return { attacks, blocked: attacks.filter((a) => !a.succeeds).length, installWorks: s.network !== 'none', bankTaskWorks: s.credentials !== 'none', secretsRead, dataLeaves };
}
