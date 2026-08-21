import ts from "typescript";
import { simpleGit } from "simple-git";
import type { FileChangeSummary } from "./diffsummary.js";

/**
 * Real static analysis for the non-`--ai` template path: parses the
 * before/after version of each changed TS/JS file with the TypeScript
 * compiler API and diffs their top-level declarations. This is
 * deliberately not regex/line-matching — a comment or string that merely
 * looks like `function foo(` would produce a false positive there, and
 * "precise changes" is the whole point of this module.
 *
 * Only git-sourced candidates can use this (it needs `git show ref:path`
 * to fetch both file versions) — GitHub PR candidates fall back to the
 * file-level summary only, since there's no equivalent local blob access
 * for an arbitrary PR without extra API calls.
 */

export interface SymbolChange {
  file: string;
  kind: "function" | "class" | "interface" | "type";
  name: string;
  change: "added" | "removed" | "modified";
  /** For "modified": the old and new signature, for a precise before → after. */
  detail?: string;
}

const ANALYZABLE_EXTENSIONS: Record<string, ts.ScriptKind> = {
  ".ts": ts.ScriptKind.TS,
  ".tsx": ts.ScriptKind.TSX,
  ".js": ts.ScriptKind.JS,
  ".jsx": ts.ScriptKind.JSX,
  ".mjs": ts.ScriptKind.JS,
  ".cjs": ts.ScriptKind.JS,
};

function extensionOf(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  return dot === -1 ? "" : filePath.slice(dot);
}

export function isAnalyzableSource(filePath: string): boolean {
  return extensionOf(filePath) in ANALYZABLE_EXTENSIONS;
}

interface SymbolInfo {
  kind: SymbolChange["kind"];
  name: string;
  signature: string;
}

function renderParams(params: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile): string {
  return params.map((p) => p.getText(sourceFile)).join(", ");
}

function renderReturnType(type: ts.TypeNode | undefined, sourceFile: ts.SourceFile): string {
  return type ? `: ${type.getText(sourceFile)}` : "";
}

/** Extracts top-level function/class/interface/type declarations. Deliberately
 * shallow — class members aren't diffed individually, to avoid noisy output;
 * a class whose internals changed but whose declaration line didn't just
 * won't show up here, which is a conservative (not a wrong) omission. */
function extractSymbols(sourceText: string, fileName: string): Map<string, SymbolInfo> {
  const symbols = new Map<string, SymbolInfo>();
  const scriptKind = ANALYZABLE_EXTENSIONS[extensionOf(fileName)] ?? ts.ScriptKind.TS;

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  } catch {
    return symbols; // unparsable — return no symbols rather than guessing
  }

  const add = (kind: SymbolInfo["kind"], name: string, signature: string) => {
    symbols.set(`${kind}:${name}`, { kind, name, signature });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      add(
        "function",
        name,
        `${name}(${renderParams(statement.parameters, sourceFile)})${renderReturnType(statement.type, sourceFile)}`
      );
    } else if (ts.isClassDeclaration(statement) && statement.name) {
      add("class", statement.name.text, `class ${statement.name.text}`);
    } else if (ts.isInterfaceDeclaration(statement)) {
      add("interface", statement.name.text, `interface ${statement.name.text}`);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      add("type", statement.name.text, `type ${statement.name.text}`);
    } else if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          const name = decl.name.text;
          const fn = decl.initializer;
          add("function", name, `${name}(${renderParams(fn.parameters, sourceFile)})${renderReturnType(fn.type, sourceFile)}`);
        }
      }
    }
  }

  return symbols;
}

function diffSymbols(file: string, before: Map<string, SymbolInfo>, after: Map<string, SymbolInfo>): SymbolChange[] {
  const changes: SymbolChange[] = [];

  for (const [key, sym] of after) {
    const prev = before.get(key);
    if (!prev) {
      changes.push({ file, kind: sym.kind, name: sym.name, change: "added" });
    } else if (prev.signature !== sym.signature) {
      changes.push({
        file,
        kind: sym.kind,
        name: sym.name,
        change: "modified",
        detail: `${prev.signature} → ${sym.signature}`,
      });
    }
  }
  for (const [key, sym] of before) {
    if (!after.has(key)) {
      changes.push({ file, kind: sym.kind, name: sym.name, change: "removed" });
    }
  }

  return changes;
}

async function readFileAtRef(repoRoot: string, ref: string, filePath: string): Promise<string | null> {
  const git = simpleGit(repoRoot);
  try {
    return await git.show([`${ref}:${filePath}`]);
  } catch {
    // File doesn't exist at this ref — e.g. it was added or deleted here.
    return null;
  }
}

export interface AnalyzableFile {
  path: string;
  oldPath: string;
  status: "added" | "modified" | "deleted" | "renamed";
}

export function toAnalyzableFiles(summary: FileChangeSummary): AnalyzableFile[] {
  const files: AnalyzableFile[] = [];
  for (const p of summary.added) files.push({ path: p, oldPath: p, status: "added" });
  for (const p of summary.modified) files.push({ path: p, oldPath: p, status: "modified" });
  for (const p of summary.deleted) files.push({ path: p, oldPath: p, status: "deleted" });
  for (const r of summary.renamed) files.push({ path: r.to, oldPath: r.from, status: "renamed" });
  return files.filter((f) => isAnalyzableSource(f.path) || isAnalyzableSource(f.oldPath));
}

/**
 * `sha` is the commit being analyzed; `parentRef` is anything `git show` can
 * resolve the pre-change tree from (a real parent SHA for merges, or the
 * `${sha}^` syntax for a normal commit — both work identically here since
 * git resolves `^` itself).
 */
export async function analyzeCodeChanges(
  repoRoot: string,
  sha: string,
  parentRef: string,
  files: AnalyzableFile[]
): Promise<SymbolChange[]> {
  const changes: SymbolChange[] = [];

  for (const file of files) {
    const [beforeText, afterText] = await Promise.all([
      file.status === "added" ? Promise.resolve(null) : readFileAtRef(repoRoot, parentRef, file.oldPath),
      file.status === "deleted" ? Promise.resolve(null) : readFileAtRef(repoRoot, sha, file.path),
    ]);

    const before = beforeText !== null ? extractSymbols(beforeText, file.oldPath) : new Map<string, SymbolInfo>();
    const after = afterText !== null ? extractSymbols(afterText, file.path) : new Map<string, SymbolInfo>();

    changes.push(...diffSymbols(file.path, before, after));
  }

  return changes;
}
