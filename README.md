# Verdikt

A local CLI + dashboard that turns your git history into readable
Architectural Decision Records (ADRs) — no cloud, no GitHub App, no server.
Everything runs on your machine, and it works on any git repo — GitHub,
GitLab, Bitbucket, or fully local, no PRs required.

## 60-second quickstart

```bash
# from inside any git repo — no GitHub CLI or remote required
npx verdikt scan          # scan all branches' history and save ADRs to /verdikt
npx verdikt serve         # browse them at http://localhost:4949
```

Add `--ai` to `scan` to have Claude draft a fuller ADR from the commit diff
(requires `ANTHROPIC_API_KEY` in your environment). Without `--ai`, ADRs are
generated from the commit/PR title and description directly — no API key
needed.

## How it works

1. `verdikt scan` walks the full history of every local and remote-tracking
   branch (`git log --all`) and filters commits by diff size or a `[ADR]` tag
   in the message — no GitHub or `gh` involved by default.
2. You pick which ones become ADRs (or pass `--all` to take every candidate).
3. Each selected commit becomes a markdown file at `/verdikt/YYYY-MM-DD-slug.md`.
4. `verdikt serve` starts a local dashboard that reads that folder.

Prefer to work off merged GitHub PRs instead of raw commits? Pass
`--source github` — this uses the `gh` CLI exactly like the original PR-based
flow, for repos that live on GitHub and follow a PR workflow.

## Requirements

- Node.js 18+
- Optional: [GitHub CLI](https://cli.github.com/) (`gh`), authenticated via
  `gh auth login` — only needed for `--source github`
- Optional: an `ANTHROPIC_API_KEY` environment variable, only needed for `--ai`

## CLI reference

```bash
verdikt scan [--all] [--ai] [--source <git|github>] [--limit <n>] [--since <date>] [--size-threshold <n>]
verdikt serve [-p, --port <n>]
```

| Flag | Default | Description |
|---|---|---|
| `--all` | off | Generate ADRs for every candidate without an interactive prompt |
| `--ai` | off | Draft the ADR body with Claude from the diff + description |
| `--source` | `git` | `git` scans full history across all branches; `github` scans merged PRs via `gh` |
| `--limit` | 200 (git) / 50 (github) | How many commits or merged PRs to consider |
| `--since` | none | Only include commits after this point, e.g. `30 days ago` or `2026-01-01` (git source only) |
| `--size-threshold` | 100 | Minimum lines changed (additions + deletions) to count as a candidate |
| `--port` | 4949 | Port for `verdikt serve` |

A commit or PR is also a candidate regardless of size if its title/message or
description contains `[ADR]`. Merge commits get their branch name attached
when it can be parsed from the merge message.

## Repo layout

- [`packages/cli`](packages/cli) — the `verdikt` npm package (CLI + local server)
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

## License

MIT
