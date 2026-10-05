/** Marks the first use of each glossary term inside `root` with a dotted, focusable definition tooltip. */
const SKIP = 'pre,code,button,summary,svg,.term,h1,h2,h3,h4,input,label,a,.chip,.lib-name,dt,.tab,.q-text,.opt,.eyebrow';

export function glossify(root: Element | null, gloss: readonly (readonly [string, string])[]): void {
  if (!root || !gloss.length) return;
  const terms = [...gloss].sort((a, b) => b[0].length - a[0].length);
  const used = new Set<string>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => { const p = n.parentElement; return !p || p.closest(SKIP) || !n.nodeValue?.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    for (const [term, def] of terms) {
      if (used.has(term)) continue;
      const re = new RegExp(`(^|[^A-Za-z0-9_])(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![A-Za-z0-9_])`, term === term.toUpperCase() ? '' : 'i');
      const m = re.exec(node.nodeValue ?? '');
      if (!m) continue;
      const mid = node.splitText(m.index + (m[1]?.length ?? 0));
      mid.splitText(m[2]?.length ?? 0);
      const span = document.createElement('span');
      span.className = 'term'; span.tabIndex = 0; span.dataset['def'] = def; span.textContent = mid.nodeValue;
      mid.replaceWith(span); used.add(term);
      break;
    }
  }
}
