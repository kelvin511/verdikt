# verdikt-adr

[![CI](https://github.com/kelvin511/verdikt/actions/workflows/ci.yml/badge.svg)](https://github.com/kelvin511/verdikt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A local CLI + dashboard that turns your git history into readable
Architectural Decision Records (ADRs) — no cloud, no GitHub App, no server.
Works on any git repo (GitHub, GitLab, Bitbucket, or fully local), no PRs
required. The plain `verdikt` package name is taken by an unrelated tool —
always use the full `verdikt-adr` name, for both the package and the command.

Full project docs, source, and issue tracker:
[github.com/kelvin511/verdikt](https://github.com/kelvin511/verdikt).

## 60-second quickstart

```bash
# from inside any git repo — no GitHub CLI or remote required
npx verdikt-adr scan      # scan all branches' history and save ADRs to /verdikt
npx verdikt-adr serve     # browse them at http://localhost:4949
```

Or install it once:

```bash
npm install -g verdikt-adr
verdikt-adr scan
verdikt-adr serve
```

Add `--ai` to `scan` to have an LLM draft a fuller ADR from the commit diff.
Without `--ai`, ADRs are still generated from real analysis, not just the raw
commit message — no API key needed at all: Verdikt parses the diff itself
(files added/modified/deleted/renamed, grouped by directory), classifies the
commit type from a conventional-commit prefix (`feat:`, `fix:`, `refactor:`,
etc.) if present, pulls out bullet points from the message body, and flags a
few consequences it can actually infer (dependency-manifest changes, CI
workflow changes, file deletions).

For TypeScript/JavaScript files on the `git` source, it goes further: it
parses the before/after version of each changed file with the TypeScript
compiler API — not regex — and reports the exact top-level functions,
classes, interfaces, and type aliases that were added, removed, or had
their signature change. Using a real parser means a comment or string
that merely looks like a declaration is never mistaken for one. This adds
`typescript` (~23 MB) to the install.

## How it works

1. `verdikt-adr scan` walks the full history of every local and remote-tracking
   branch (`git log --all`) and filters commits by diff size or a `[ADR]` tag
   in the message — no GitHub or `gh` involved by default.
2. You pick which ones become ADRs (or pass `--all` to take every candidate).
3. Each selected commit becomes a markdown file at `/verdikt/YYYY-MM-DD-slug.md`.
4. `verdikt-adr serve` starts a local dashboard that reads that folder.

Prefer to work off merged GitHub PRs instead of raw commits? Pass
`--source github` — this uses the `gh` CLI, for repos that live on GitHub and
follow a PR workflow.

## Requirements

- Node.js 18+
- Optional: [GitHub CLI](https://cli.github.com/) (`gh`), authenticated via
  `gh auth login` — only needed for `--source github`
- Optional, only for `--ai`: an API key for one AI provider (see below)

## AI providers

`--ai` works with any of these — pick whichever you have a key for. Set the
key as a regular environment variable, or drop it in a `.env` file in the
directory you run `verdikt-adr` from — it's loaded automatically. If you don't
pass `--provider`, Verdikt checks your environment in this order and uses
the first one it finds a key for, favoring the free-tier options:

| Provider | `--provider` value | Environment variable | Notes |
|---|---|---|---|
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | Free-tier models available — get a key at [openrouter.ai/keys](https://openrouter.ai/keys) |
| Google Gemini | `google` | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | Free tier — get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic Claude | `anthropic` | `ANTHROPIC_API_KEY` | Paid — get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys) |

OpenRouter and Google Gemini pick their model **live** at run time — Verdikt
queries the provider's current model catalog and picks a suitable free
text-generation model, so the default doesn't silently break when a provider
retires or renames one. Anthropic uses a fixed alias (`claude-opus-5`) since
Claude model names don't rotate the same way. Override any of this with
`VERDIKT_MODEL` to pin an exact model, or force a specific provider
regardless of what keys are set with `--provider` or `VERDIKT_AI_PROVIDER`.

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

## Contributing

See [CONTRIBUTING.md](https://github.com/kelvin511/verdikt/blob/main/CONTRIBUTING.md)
in the main repo.

## License

MIT — see [LICENSE](LICENSE).
