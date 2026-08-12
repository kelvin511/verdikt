# Verdikt

[![CI](https://github.com/kelvin511/verdikt/actions/workflows/ci.yml/badge.svg)](https://github.com/kelvin511/verdikt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A local CLI + dashboard that turns your git history into readable
Architectural Decision Records (ADRs) — no cloud, no GitHub App, no server.
Everything runs on your machine, and it works on any git repo — GitHub,
GitLab, Bitbucket, or fully local, no PRs required.

## 60-second quickstart

```bash
# from inside any git repo — no GitHub CLI or remote required
npx verdikt-adr scan      # scan all branches' history and save ADRs to /verdikt
npx verdikt-adr serve     # browse them at http://localhost:4949
```

Add `--ai` to `scan` to have an LLM draft a fuller ADR from the commit diff.
Without `--ai`, ADRs are generated from the commit/PR title and description
directly — no API key needed at all.

## How it works

1. `verdikt-adr scan` walks the full history of every local and remote-tracking
   branch (`git log --all`) and filters commits by diff size or a `[ADR]` tag
   in the message — no GitHub or `gh` involved by default.
2. You pick which ones become ADRs (or pass `--all` to take every candidate).
3. Each selected commit becomes a markdown file at `/verdikt/YYYY-MM-DD-slug.md`.
4. `verdikt-adr serve` starts a local dashboard that reads that folder.

Prefer to work off merged GitHub PRs instead of raw commits? Pass
`--source github` — this uses the `gh` CLI exactly like the original PR-based
flow, for repos that live on GitHub and follow a PR workflow.

## Requirements

- Node.js 18+
- Optional: [GitHub CLI](https://cli.github.com/) (`gh`), authenticated via
  `gh auth login` — only needed for `--source github`
- Optional, only for `--ai`: an API key for one AI provider (see below)

## AI providers

`--ai` works with any of these — pick whichever you have a key for. Set the
key as a regular environment variable, or drop it in a `.env` file in the
directory you run `verdikt-adr` from (copy [`.env.example`](.env.example) to
`.env` and fill it in — it's gitignored). If you don't pass `--provider`,
Verdikt checks your environment in this order and uses the first one it
finds a key for, favoring the free-tier options:

| Provider | `--provider` value | Environment variable | Notes |
|---|---|---|---|
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | Free-tier models available — get a key at [openrouter.ai/keys](https://openrouter.ai/keys) |
| Google Gemini | `google` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | Free tier — get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic Claude | `anthropic` | `ANTHROPIC_API_KEY` | Paid — get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys) |

OpenRouter and Google Gemini pick their model **live** at run time — Verdikt
queries the provider's current model catalog and picks a suitable free
text-generation model, so the default doesn't silently break when a provider
retires or renames one (this happened twice while building this feature —
see [`lib/ai/openrouter.ts`](packages/cli/src/lib/ai/openrouter.ts) and
[`lib/ai/google.ts`](packages/cli/src/lib/ai/google.ts) for the selection
logic and hardcoded last-resort fallback). Anthropic uses a fixed alias
(`claude-opus-5`) since Claude model names don't rotate the same way.
Override any of this with `VERDIKT_MODEL` to pin an exact model, or force a
specific provider regardless of what keys are set with `--provider` or
`VERDIKT_AI_PROVIDER`.

## CLI reference

```bash
verdikt-adr scan [--all] [--dry-run] [--ai] [--provider <name>] [--source <git|github>] [--limit <n>] [--since <date>] [--size-threshold <n>]
verdikt-adr serve [-p, --port <n>]
```

| Flag | Default | Description |
|---|---|---|
| `--all` | off | Generate ADRs for every candidate without an interactive prompt |
| `--dry-run` | off | Show which ADRs would be generated, without drafting or writing anything |
| `--ai` | off | Draft the ADR body from the diff + description using an AI provider |
| `--provider` | auto-detected | Which AI provider to use for `--ai` — see the table above |
| `--source` | `git` | `git` scans full history across all branches; `github` scans merged PRs via `gh` |
| `--limit` | 200 (git) / 50 (github) | How many commits or merged PRs to consider |
| `--since` | none | Only include commits after this point, e.g. `30 days ago` or `2026-01-01` (git source only) |
| `--size-threshold` | 100 | Minimum lines changed (additions + deletions) to count as a candidate |
| `--port` | 4949 | Port for `verdikt-adr serve` |

A commit or PR is also a candidate regardless of size if its title/message or
description contains `[ADR]`. Merge commits get their branch name attached
when it can be parsed from the merge message.

## Repo layout

- [`packages/cli`](packages/cli) — the `verdikt-adr` npm package (CLI + local server)
- [`packages/dashboard`](packages/dashboard) — the Vite + React dashboard, built and bundled into the CLI

## Development

```bash
npm install
npm run build                       # builds the dashboard, then the CLI
node packages/cli/dist/index.js scan
```

To iterate on the dashboard with hot reload against a running CLI server:

```bash
node packages/cli/dist/index.js serve   # terminal 1
npm run dev:dashboard                   # terminal 2 — proxies /api to :4949
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) builds the
monorepo and smoke-tests the compiled CLI on every push and PR against `main`.

## Publishing

Published on npm as [`verdikt-adr`](https://www.npmjs.com/package/verdikt-adr)
— the plain `verdikt` name was already taken by an unrelated package, and the
CLI command is also `verdikt-adr` (not `verdikt`) so there's no ambiguity.
**Always type the full name** — a bare `npx verdikt` silently runs that other,
unrelated package instead of this one:

```bash
npx verdikt-adr scan
# or: npm install -g verdikt-adr && verdikt-adr scan
```

`packages/cli/package.json` already points `repository`/`homepage`/`bugs` at
`github.com/kelvin511/verdikt` — update that if the repo ends up somewhere
else.

To cut a new release from the repo root:

```bash
npm run build          # builds the dashboard and copies it into packages/cli
cd packages/cli
npm publish            # prepublishOnly refuses to run if the dashboard wasn't built
```

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the
development setup, project layout, and what's in/out of scope. This project
follows a [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT — see [LICENSE](LICENSE).
