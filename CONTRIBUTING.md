# Contributing to Verdikt

Thanks for considering a contribution. Verdikt is intentionally small and
local-first — see [What's IN scope](#whats-in-scope) before proposing a big
feature.

## Development setup

```bash
git clone https://github.com/kelvin511/verdikt.git
cd verdikt
npm install
npm run build                          # builds the dashboard, then the CLI
node packages/cli/dist/index.js scan --dry-run
```

## Project layout

- [`packages/cli`](packages/cli) — the `verdikt` npm package: CLI commands, git/GitHub scanning, AI providers, and the local Express server
- [`packages/dashboard`](packages/dashboard) — the Vite + React dashboard, built and bundled into the CLI package

## Making changes

- CLI logic lives in `packages/cli/src`; dashboard UI in `packages/dashboard/src`.
- The CLI's `serve` command reads the **built** dashboard (`packages/cli/dashboard-dist`), not a dev server — after changing dashboard source, run `npm run build` from the repo root before testing `verdikt serve`.
- To iterate on the dashboard with hot reload: run `node packages/cli/dist/index.js serve` in one terminal, then `npm run dev:dashboard` in another — it proxies `/api` to the running CLI server on port 4949.
- Keep dependencies boring and minimal — this project deliberately avoids heavy frameworks and a database. If a change needs a new dependency, explain why in the PR description.

## Before opening a PR

- `npm run build` succeeds from the repo root — this is what CI checks on every push and PR.
- If you added or changed a CLI flag, update the CLI reference table in [README.md](README.md).
- Keep PRs small and scoped to one change; it's easier to review and easier to turn into an ADR later (this project dogfoods itself — `verdikt scan` over its own history is a real test).

## What's IN scope

- Reading local git history (any host, any branch) or GitHub PRs via `gh`, and turning candidate decisions into ADR markdown files
- The local dashboard for browsing generated ADRs
- Optional AI-assisted drafting via a pluggable provider (`packages/cli/src/lib/ai`)

## What's OUT of scope (for now)

- A hosted/cloud version, multi-user accounts, or a database — ADRs are just files in `/verdikt`, on purpose
- Non-git integrations (Jira, Linear, Slack, etc.)
- Automatic drafting on every commit/PR — this stays on-demand (`verdikt scan`), not a bot

If you want to propose one of these anyway, open an issue first to discuss —
it'll save you from writing a PR that doesn't land.

## Reporting bugs / requesting features

Open a GitHub issue. For bugs, include your OS, Node version, the exact
command you ran, and whether you're on the `git` or `github` source.

## License

By contributing, you agree that your contributions are licensed under the
MIT License (see [LICENSE](LICENSE)).
