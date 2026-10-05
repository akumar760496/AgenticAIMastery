/** Syntax highlighting for code samples (highlight.js core with the languages the course uses). */
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';

hljs.registerLanguage('bash', bash); hljs.registerLanguage('shell', bash);
hljs.registerLanguage('javascript', javascript); hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript); hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('json', json); hljs.registerLanguage('python', python); hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql); hljs.registerLanguage('csharp', csharp); hljs.registerLanguage('java', java);

export function highlightLine(code: string, lang: string): string | null {
  if (!hljs.getLanguage(lang)) return null;
  try { return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch { return null; }
}

export function highlightBlocks(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('pre.code code[class*="language-"]').forEach((el) => {
    const lang = /language-(\S+)/.exec(el.className)?.[1] ?? '';
    if (hljs.getLanguage(lang)) { try { hljs.highlightElement(el); } catch { /* leave plain */ } }
  });
}
