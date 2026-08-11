import { cpSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

const src = path.resolve("packages/dashboard/dist");
const dest = path.resolve("packages/cli/dashboard-dist");

if (!existsSync(src)) {
  console.error(`Dashboard build not found at ${src}. Run the dashboard build first.`);
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

cpSync(src, dest, { recursive: true });
console.log(`Copied dashboard build to ${dest}`);
