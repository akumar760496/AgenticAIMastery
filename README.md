# Agentic AI Mastery v2

A rebuild of the Agentic AI Mastery study site with a layered, testable architecture.
**Module 1 (Evaluation, 9 techniques)** is the first migrated feature; it is the template for the rest.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + content validation + tests
npm run build      # production build in dist/ (static, deploy anywhere)
```

## Where things are

| Path | Purpose |
|---|---|
| `src/domain` | Contracts: content schema, playground spec, progress port. No dependencies on other layers. |
| `src/application` | Use cases: registry, playground session, progress, quiz grading. |
| `src/infrastructure` | Adapters: browser storage, Claude artifact storage, in-memory. |
| `src/presentation` | Generic views and renderers, router, styles. |
| `src/modules/evaluation` | The Evaluation feature: content, pure simulators, playground definitions. |
| `src/main.ts` | Composition root. |
| `tests/` | Unit and contract tests. |
| `scripts/` | Legacy migration and content validation. |
| `docs/ARCHITECTURE.md` | Diagrams, patterns, conventions and how to extend. |

See **docs/ARCHITECTURE.md** for the low-level design and the step-by-step guide to adding a module.
