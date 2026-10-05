/** Shared vs prefill/decode-split serving on 8 GPUs with 200 live chats and 30,000-token uploads. */
export type KvLink = 'nvlink' | 'rdma' | 'eth';
export const KV_LINK: Readonly<Record<KvLink, { readonly gbPerS: number; readonly label: string }>> = {
  nvlink: { gbPerS: 400, label: 'NVLink, same node (≈400 GB/s)' },
  rdma: { gbPerS: 50, label: 'RDMA 400 Gb/s (≈50 GB/s)' },
  eth: { gbPerS: 3.125, label: '25 Gb Ethernet (≈3 GB/s)' },
};
export const GPUS = 8;
export const CHATS = 200;
export const TTFT_TARGET_S = 2.5;
export const TPOT_TARGET_MS = 50;
const PREFILL_S = 1.5;
const SHARED_PREFILL_S = 1.95;
const KV_GB = 3.93;
const decodeBase = (decodeGpus: number) => 18 + (0.5 * CHATS) / decodeGpus;

export interface DisaggState { readonly split: boolean; readonly uploadsPerMinute: number; readonly prefillGpus: number; readonly link: KvLink }
export interface DisaggResult { readonly ttftS: number; readonly tpotMs: number; readonly transferS: number; readonly prefillBusy: number; readonly stolenShare: number; readonly ttftOk: boolean; readonly tpotOk: boolean }

/** M/M/1-style queueing inflation at utilisation rho. */
const queued = (service: number, rho: number) => (rho >= 1 ? Infinity : service * (1 + (1.5 * rho) / (1 - rho)));

export function simulateDisagg(s: DisaggState): DisaggResult {
  const stolenShare = (s.uploadsPerMinute * PREFILL_S) / (60 * GPUS);
  let ttftS: number;
  let tpotMs: number;
  let transferS = 0;
  let prefillBusy: number;
  if (!s.split) {
    prefillBusy = (s.uploadsPerMinute * SHARED_PREFILL_S) / (60 * GPUS);
    ttftS = queued(SHARED_PREFILL_S, prefillBusy);
    tpotMs = decodeBase(GPUS) / (1 - stolenShare) + 450 * stolenShare;
  } else {
    prefillBusy = (s.uploadsPerMinute * PREFILL_S) / (60 * s.prefillGpus);
    transferS = KV_GB / KV_LINK[s.link].gbPerS;
    ttftS = queued(PREFILL_S, prefillBusy) + transferS;
    tpotMs = decodeBase(GPUS - s.prefillGpus);
  }
  return { ttftS, tpotMs, transferS, prefillBusy, stolenShare, ttftOk: ttftS <= TTFT_TARGET_S, tpotOk: tpotMs <= TPOT_TARGET_MS };
}
