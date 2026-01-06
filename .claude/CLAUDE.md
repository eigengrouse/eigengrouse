# eigengrouse (proper-phase)

## Stack

- **Language**: TypeScript (strict mode via `astro/tsconfigs/strict`)
- **Framework**: Astro 5.x
- **Runtime**: Node.js, ESM (`"type": "module"`)
- **Package manager**: npm

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Preview | `npm run preview` |

## Conventions

- All source files use ES module syntax (`import`/`export`) — no `require()` or `module.exports`
- TypeScript strict mode enforced via Astro's tsconfig preset
- Formatting: prettier + eslint (auto-applied via PostToolUse hook)

## Activated agent templates

- `ts-enforcer` — TypeScript strict mode compliance
- `esm-enforcer` — ES module hygiene (no CJS patterns)
- `front-end-testing` — Frontend testing standards
