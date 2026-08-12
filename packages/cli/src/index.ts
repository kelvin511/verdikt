#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import { runScan } from "./commands/scan.js";
import { runServe } from "./commands/serve.js";

// Loads a .env file from the current directory, if present — lets AI
// provider keys live in a (gitignored) project .env instead of the shell
// environment. Silently does nothing if there's no .env file.
loadEnv();

const program = new Command();

program
  .name("verdikt")
  .description("Turn your git history into readable Architectural Decision Records.")
  .version("0.1.1");

program
  .command("scan")
  .description("Scan git history (or merged GitHub PRs) and generate ADRs")
  .option("--all", "Generate ADRs for every candidate without prompting")
  .option("--dry-run", "Show which ADRs would be generated without writing or drafting anything")
  .option("--ai", "Draft a fuller ADR from the diff using an AI provider")
  .option(
    "--provider <anthropic|openrouter|google>",
    "AI provider for --ai. Defaults to whichever of OPENROUTER_API_KEY, GOOGLE_API_KEY/GEMINI_API_KEY, or ANTHROPIC_API_KEY is set (checked in that order)."
  )
  .option(
    "--source <git|github>",
    "Where to look for decisions: full git history across all branches (default), or merged GitHub PRs via gh",
    "git"
  )
  .option(
    "--limit <n>",
    "Number of commits (git) or merged PRs (github) to consider. Defaults: 200 for git, 50 for github.",
    (v) => parseInt(v, 10)
  )
  .option(
    "--since <date>",
    "Only consider commits after this point, e.g. '30 days ago' or '2026-01-01' (git source only)"
  )
  .option(
    "--size-threshold <n>",
    "Minimum lines changed to be considered a candidate",
    (v) => parseInt(v, 10),
    100
  )
  .action(async (opts) => {
    try {
      if (opts.source !== "git" && opts.source !== "github") {
        throw new Error(`Invalid --source "${opts.source}". Use "git" or "github".`);
      }
      await runScan(opts);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program
  .command("serve")
  .description("Launch the local dashboard")
  .option("-p, --port <n>", "Port to serve on", (v) => parseInt(v, 10), 4949)
  .action(async (opts) => {
    try {
      await runServe(opts);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv);
