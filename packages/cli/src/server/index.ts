import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApiRouter } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  adrDir: string;
  port: number;
}

export async function startServer({ adrDir, port }: ServerOptions): Promise<void> {
  const app = express();
  app.use("/api", createApiRouter(adrDir));

  const dashboardDist = path.join(__dirname, "..", "..", "dashboard-dist");
  if (fs.existsSync(dashboardDist)) {
    app.use(express.static(dashboardDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(dashboardDist, "index.html"));
    });
  } else {
    app.get("*", (_req, res) => {
      res
        .status(503)
        .send(
          "Dashboard assets not found. Run the package build (npm run build) before publishing/running verdikt serve."
        );
    });
  }

  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Verdikt dashboard running at http://localhost:${port}`);
      resolve();
    });
  });
}
