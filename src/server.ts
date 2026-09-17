#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHttpServer } from "./modules/web/services/http-server/http-server.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const host = process.env.HOST ?? "0.0.0.0";
const workingDirectory = resolve(
  process.env.SCAN_OUTPUT_DIRECTORY ?? join(projectRoot, "output", "jobs"),
);
const staticDirectory = resolve(projectRoot, "web", "dist");

const start = async () => {
  await mkdir(workingDirectory, { recursive: true });

  const server = await createHttpServer({ port, host, workingDirectory, staticDirectory });
  await server.listen({ port, host });

  console.log(`scan2cad web interface listening on http://${host}:${port}`);
  console.log(`artifacts: ${workingDirectory}`);
};

start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
