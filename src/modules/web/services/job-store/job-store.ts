import { randomUUID } from "node:crypto";
import { JobStatus, type CaptureMode, type Job } from "../../types/job.types.js";

export type JobStore = {
  readonly create: (mode: CaptureMode, outputDirectory: string) => Job;
  readonly get: (id: string) => Job | undefined;
  readonly update: (id: string, changes: Partial<Omit<Job, "id">>) => Job | undefined;
  readonly list: () => readonly Job[];
};

export const createJobStore = (): JobStore => {
  const jobsById = new Map<string, Job>();

  return Object.freeze({
    create: (mode: CaptureMode, outputDirectory: string): Job => {
      const job: Job = Object.freeze({
        id: randomUUID(),
        mode,
        status: JobStatus.QUEUED,
        createdAt: new Date().toISOString(),
        progressMessage: "Waiting to start",
        outputDirectory,
      });
      jobsById.set(job.id, job);
      return job;
    },

    get: (id: string) => jobsById.get(id),

    // Every update replaces the whole record so a job never carries a partially applied shape.
    update: (id: string, changes: Partial<Omit<Job, "id">>): Job | undefined => {
      const existing = jobsById.get(id);
      if (!existing) return undefined;

      const updated: Job = Object.freeze({ ...existing, ...changes, id: existing.id });
      jobsById.set(id, updated);
      return updated;
    },

    list: () => Object.freeze([...jobsById.values()]),
  });
};
