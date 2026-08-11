import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import matter from "gray-matter";

const SLUG_PATTERN = /^[a-zA-Z0-9._-]+$/;

interface ADRRecord {
  slug: string;
  [key: string]: unknown;
}

export function createApiRouter(adrDir: string): Router {
  const router = Router();

  router.get("/adrs", (_req, res) => {
    if (!fs.existsSync(adrDir)) {
      res.json([]);
      return;
    }

    const files = fs.readdirSync(adrDir).filter((f) => f.endsWith(".md"));
    const adrs: ADRRecord[] = files.map((file) => {
      const raw = fs.readFileSync(path.join(adrDir, file), "utf8");
      const data = matter(raw).data as Record<string, unknown>;
      return { slug: file.replace(/\.md$/, ""), ...data };
    });

    adrs.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    res.json(adrs);
  });

  router.get("/adrs/:slug", (req, res) => {
    const { slug } = req.params;
    if (!SLUG_PATTERN.test(slug)) {
      res.status(400).json({ error: "Invalid ADR slug" });
      return;
    }

    const filePath = path.join(adrDir, `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "ADR not found" });
      return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);
    res.json({ slug, ...data, content });
  });

  return router;
}
