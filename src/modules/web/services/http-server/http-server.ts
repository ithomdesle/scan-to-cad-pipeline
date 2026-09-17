import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { CaptureMode, JobStatus } from "../../types/job.types.js";
import { createJobStore } from "../job-store/job-store.js";
import { createScanJobController } from "../../controller/scan-job/scan-job.controller.js";

export type HttpServerOptions = {
  readonly port: number;
  readonly host: string;
  readonly workingDirectory: string;
  readonly staticDirectory: string;
};

const MAXIMUM_UPLOAD_BYTES = 80 * 1024 * 1024;

const parseNumberField = (value: unknown, fallback: number): number => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const createHttpServer = async (options: HttpServerOptions): Promise<FastifyInstance> => {
  const server = Fastify({ bodyLimit: MAXIMUM_UPLOAD_BYTES });
  const jobStore = createJobStore();
  const scanJobController = createScanJobController(jobStore);

  await server.register(fastifyMultipart, { limits: { fileSize: MAXIMUM_UPLOAD_BYTES } });

  if (existsSync(options.staticDirectory)) {
    await server.register(fastifyStatic, { root: options.staticDirectory });
  }

  server.post("/api/jobs", async (request, reply) => {
    const uploaded = await request.file();
    if (!uploaded) return reply.code(400).send({ error: "No file was uploaded." });

    const fileBuffer = await uploaded.toBuffer();
    const fields = uploaded.fields as Record<string, { value?: unknown } | undefined>;
    const requestedMode = String(fields.mode?.value ?? CaptureMode.PHOTO);
    const mode = requestedMode === CaptureMode.MESH ? CaptureMode.MESH : CaptureMode.PHOTO;

    const job = jobStore.create(mode, "");
    const outputDirectory = resolve(options.workingDirectory, job.id);
    jobStore.update(job.id, { outputDirectory });

    // The response returns as soon as the job exists; the phone polls for progress.
    if (mode === CaptureMode.PHOTO) {
      void scanJobController.runPhotoJob(job.id, {
        imageBuffer: fileBuffer,
        knownLongestEdgeInMillimetres: parseNumberField(fields.knownLongestEdge?.value, 100),
        thicknessInMillimetres: parseNumberField(fields.thickness?.value, 2),
      });
    } else {
      void scanJobController.runMeshJob(job.id, {
        meshBuffer: fileBuffer,
        fileName: uploaded.filename ?? "scan.stl",
      });
    }

    return reply.code(202).send({ id: job.id, status: JobStatus.QUEUED });
  });

  server.get<{ Params: { id: string } }>("/api/jobs/:id", async (request, reply) => {
    const job = jobStore.get(request.params.id);
    if (!job) return reply.code(404).send({ error: "No such job." });

    return reply.send({
      id: job.id,
      mode: job.mode,
      status: job.status,
      progressMessage: job.progressMessage,
      measurements: job.measurements,
      featureSummary: job.featureSummary,
      error: job.error,
    });
  });

  server.get<{ Params: { id: string; artifact: string } }>(
    "/api/jobs/:id/artifacts/:artifact",
    async (request, reply) => {
      const job = jobStore.get(request.params.id);
      if (!job) return reply.code(404).send({ error: "No such job." });

      const allowedArtifacts: Readonly<Record<string, string>> = Object.freeze({
        step: "part.step",
        model: "part.py",
        features: "features.json",
        mesh: "cleaned.stl",
      });

      const fileName = allowedArtifacts[request.params.artifact];
      if (!fileName) return reply.code(404).send({ error: "No such artifact." });

      const filePath = join(job.outputDirectory, fileName);
      if (!existsSync(filePath)) return reply.code(404).send({ error: "Artifact not ready." });

      return reply
        .header("Content-Disposition", `attachment; filename="${fileName}"`)
        .header("Content-Type", "application/octet-stream")
        .send(await readFile(filePath));
    },
  );

  server.get("/api/health", async () => ({ isHealthy: true }));

  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found." });
    }

    const indexPath = join(options.staticDirectory, "index.html");
    if (!existsSync(indexPath)) {
      return reply.code(503).type("text/plain").send("The web interface has not been built yet.");
    }

    return reply.type("text/html").send(await readFile(indexPath, "utf8"));
  });

  return server;
};
