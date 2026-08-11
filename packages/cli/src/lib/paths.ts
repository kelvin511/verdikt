import path from "node:path";
import { simpleGit } from "simple-git";

export async function findRepoRoot(cwd: string = process.cwd()): Promise<string> {
  const git = simpleGit(cwd);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error(
      "Not inside a git repository. Run this command from within a git repo."
    );
  }
  const root = await git.revparse(["--show-toplevel"]);
  return root.trim();
}

export function verdiktDir(repoRoot: string): string {
  return path.join(repoRoot, "verdikt");
}
