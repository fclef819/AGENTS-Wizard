# agents-wizard
[![npm version](https://img.shields.io/npm/v/@fclef819/agents-wizard.svg)](https://www.npmjs.com/package/@fclef819/agents-wizard)
[![npm downloads](https://img.shields.io/npm/dw/@fclef819/agents-wizard.svg)](https://www.npmjs.com/package/@fclef819/agents-wizard)
[![license](https://img.shields.io/npm/l/@fclef819/agents-wizard.svg)](https://github.com/fclef819/agents-wizard/blob/main/LICENSE)

`agents-wizard` is an interactive CLI that creates an `AGENTS.md` for a new project.

Run it without installing it globally:

```bash
npx agents-wizard
```

It is create-only: if `AGENTS.md` already exists (including as a symbolic link), the command exits without changing it. A successful run writes `AGENTS.md` and `.agents-wizard.yml` in the current directory.

Free-text history and personal templates are stored in the user configuration directory resolved by `env-paths("agents-wizard")` (normally a platform-specific config directory).

## Development

Install the pinned toolchain with `mise install`, then run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm pack
```

Use `pnpm build && node dist/cli.js` to run the built CLI locally.
