import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardDist = path.join(here, "..", "dashboard-dist");

if (!existsSync(dashboardDist)) {
  console.error(
    "dashboard-dist is missing. Run `npm run build` from the repo root (not just this package) before publishing — it builds the dashboard and copies it in here."
  );
  process.exit(1);
}
