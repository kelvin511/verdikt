/**
 * Parses a unified diff (the same format `git diff` and `gh pr diff` both
 * produce) into a structured file-change summary, without any AI call.
 * This is what lets the non-`--ai` template path describe what actually
 * changed instead of just echoing the commit/PR message.
 */

export interface FileChangeSummary {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: { from: string; to: string }[];
  totalFiles: number;
}

const EMPTY_SUMMARY: FileChangeSummary = {
  added: [],
  modified: [],
  deleted: [],
  renamed: [],
  totalFiles: 0,
};

export function summarizeDiff(diffText: string): FileChangeSummary {
  if (!diffText.trim()) return EMPTY_SUMMARY;

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const renamed: { from: string; to: string }[] = [];

  let currentPath: string | null = null;
  let isNew = false;
  let isDeleted = false;
  let renameFrom: string | null = null;
  let renameTo: string | null = null;

  const flush = () => {
    if (renameFrom && renameTo) {
      renamed.push({ from: renameFrom, to: renameTo });
    } else if (currentPath) {
      if (isNew) added.push(currentPath);
      else if (isDeleted) deleted.push(currentPath);
      else modified.push(currentPath);
    }
    currentPath = null;
    isNew = false;
    isDeleted = false;
    renameFrom = null;
    renameTo = null;
  };

  for (const line of diffText.split("\n")) {
    const diffMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (diffMatch) {
      flush();
      currentPath = diffMatch[2];
      continue;
    }
    if (line.startsWith("new file mode")) isNew = true;
    else if (line.startsWith("deleted file mode")) isDeleted = true;
    else if (line.startsWith("rename from ")) renameFrom = line.slice("rename from ".length);
    else if (line.startsWith("rename to ")) renameTo = line.slice("rename to ".length);
  }
  flush();

  return {
    added,
    modified,
    deleted,
    renamed,
    totalFiles: added.length + modified.length + deleted.length + renamed.length,
  };
}

/** Groups file paths by their top-level (or top-two-level) directory, for a quick "what areas did this touch" view. */
export function groupByDirectory(paths: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of paths) {
    const dirSegments = p.split("/").slice(0, -1); // drop the filename itself
    const dir = dirSegments.length === 0 ? "(root)" : dirSegments.slice(0, 2).join("/");
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  return counts;
}

export function topDirectories(summary: FileChangeSummary, limit = 5): string {
  const allPaths = [
    ...summary.added,
    ...summary.modified,
    ...summary.deleted,
    ...summary.renamed.map((r) => r.to),
  ];
  const dirs = groupByDirectory(allPaths);
  return [...dirs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([dir, count]) => `${dir} (${count})`)
    .join(", ");
}

export function formatFileList(paths: string[], limit = 8): string {
  if (paths.length <= limit) return paths.map((p) => `\`${p}\``).join(", ");
  const shown = paths.slice(0, limit).map((p) => `\`${p}\``);
  return `${shown.join(", ")}, and ${paths.length - limit} more`;
}
