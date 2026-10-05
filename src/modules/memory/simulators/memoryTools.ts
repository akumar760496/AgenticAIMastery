/** A file-based memory tool across three sessions of a 30-item checklist, plus path validation against traversal. */
export const PATHS = ['/memories/progress.md', '/memories/../config.env', '/memories/clients/../progress.md', '/etc/passwd'] as const;
export type PathCheck = 'prefix' | 'resolve';
const ITEMS = 30;
const SESSIONS = 3;

export const normalisePath = (p: string) => {
  const out: string[] = [];
  for (const part of p.split('/')) { if (!part || part === '.') continue; if (part === '..') out.pop(); else out.push(part); }
  return `/${out.join('/')}`;
};

export interface MemoryToolsState { readonly memoryTool: boolean; readonly contextEditing: boolean; readonly writeEvery: number; readonly pathCheck: PathCheck; readonly pathIndex: number }
export interface MemoryToolsResult { readonly sessionTokensK: readonly number[]; readonly totalK: number; readonly done: number; readonly redone: number; readonly writes: number; readonly finishedInSession: number; readonly success: boolean; readonly path: string; readonly resolved: string; readonly inside: boolean; readonly allowed: boolean; readonly escaped: boolean; readonly blocked: boolean }

export function simulateMemoryTools(s: MemoryToolsState): MemoryToolsResult {
  const capacity = s.contextEditing ? 16 : 12;
  const perItem = s.contextEditing ? 7 : 10;
  const orient = s.memoryTool ? 4 : 40;
  let saved = 0; let done = 0; let redone = 0; let writes = 0; let finishedInSession = 0;
  const sessionTokensK: number[] = [];
  for (let session = 1; session <= SESSIONS; session++) {
    const start = s.memoryTool ? saved + 1 : 1;
    if (start > ITEMS) { sessionTokensK.push(0); continue; }
    const end = Math.min(ITEMS, start + capacity - 1);
    const items = end - start + 1;
    redone += Math.max(0, Math.min(end, done) - start + 1);
    const w = s.memoryTool && s.writeEvery ? Math.floor(end / s.writeEvery) - Math.floor((start - 1) / s.writeEvery) : 0;
    writes += w;
    if (s.memoryTool && s.writeEvery) saved = Math.max(saved, Math.floor(end / s.writeEvery) * s.writeEvery);
    sessionTokensK.push(orient + items * perItem + w);
    done = Math.max(done, end);
    if (done >= ITEMS && !finishedInSession) finishedInSession = session;
  }
  const path = PATHS[s.pathIndex] ?? PATHS[0];
  const resolved = normalisePath(path);
  const inside = resolved === '/memories' || resolved.startsWith('/memories/');
  const allowed = s.pathCheck === 'prefix' ? path.startsWith('/memories') : inside;
  return { sessionTokensK, totalK: sessionTokensK.reduce((a, b) => a + b, 0), done, redone, writes, finishedInSession, success: done >= ITEMS, path, resolved, inside, allowed, escaped: allowed && !inside, blocked: !allowed };
}
