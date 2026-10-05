/** DiskANN capacity and latency model for a billion-scale index on one 256 GB server (sizes exact; recall and latency modelled). */
export type DiskKind = 'nvme' | 'net';
export const RAM_BUDGET = 256e9;
const SECTOR = 4096;
const DEGREE = 64;
const HNSW_LINKS = 32;
const CACHE_BYTES = 16e9;
export const PQ_SIZES = [16, 32, 64, 128] as const;
const PQ_TAU: Readonly<Record<number, number>> = { 16: 60, 32: 40, 64: 30, 128: 25 };

export interface DiskAnnState { readonly millions: number; readonly dims: number; readonly pqBytes: number; readonly listSize: number; readonly beamWidth: number; readonly disk: DiskKind }
export interface DiskAnnResult {
  readonly fullBytes: number;
  readonly hnswRamBytes: number;
  readonly ramBytes: number;
  readonly ssdBytes: number;
  readonly recall: number;
  readonly roundTrips: number;
  readonly reads: number;
  readonly latencyMs: number;
  readonly fits: boolean;
  readonly hnswFits: boolean;
}

export function simulateDiskAnn(s: DiskAnnState): DiskAnnResult {
  const n = s.millions * 1e6;
  const vectorBytes = s.dims * 4;
  const nodeBytes = vectorBytes + DEGREE * 4 + 4;
  const perSector = nodeBytes <= SECTOR ? Math.floor(SECTOR / nodeBytes) : 0;
  const sectorsPerNode = perSector ? 1 : Math.ceil(nodeBytes / SECTOR);
  const fullBytes = n * vectorBytes;
  const hnswRamBytes = fullBytes + n * (HNSW_LINKS * 4 + 4);
  const ramBytes = n * s.pqBytes + CACHE_BYTES;
  const roundTrips = Math.ceil(s.listSize / s.beamWidth);
  const readMs = s.disk === 'nvme' ? 0.1 : 1;
  return {
    fullBytes, hnswRamBytes, ramBytes,
    ssdBytes: perSector ? Math.ceil(n / perSector) * SECTOR : n * sectorsPerNode * SECTOR,
    recall: 1 - 0.6 * Math.exp(-s.listSize / (PQ_TAU[s.pqBytes] ?? 40)),
    roundTrips,
    reads: Math.round(s.listSize * (1 + 0.04 * (s.beamWidth - 1))) * sectorsPerNode,
    latencyMs: roundTrips * readMs * (sectorsPerNode > 1 ? 1.25 : 1) + 0.4,
    fits: ramBytes <= RAM_BUDGET,
    hnswFits: hnswRamBytes <= RAM_BUDGET,
  };
}
