import { findRepoRoot, verdiktDir } from "../lib/paths.js";
import { startServer } from "../server/index.js";

export interface ServeOptions {
  port?: number;
}

export async function runServe(options: ServeOptions): Promise<void> {
  const repoRoot = await findRepoRoot();
  const adrDir = verdiktDir(repoRoot);
  const port = options.port ?? 4949;
  await startServer({ adrDir, port });
}
