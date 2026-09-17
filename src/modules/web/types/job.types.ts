import { createEnum, type EnumValues } from "../../../shared/types/enum.types.js";

export const JobStatus = createEnum({
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
});
export type JobStatus = EnumValues<typeof JobStatus>;

export const CaptureMode = createEnum({
  PHOTO: "photo",
  MESH: "mesh",
});
export type CaptureMode = EnumValues<typeof CaptureMode>;

export type JobMeasurements = {
  readonly widthInMillimetres: number;
  readonly heightInMillimetres: number;
  readonly thicknessInMillimetres: number;
  readonly cutoutCount: number;
  readonly outlinePointCount: number;
  readonly volumeInCubicMillimetres: number;
};

export type Job = {
  readonly id: string;
  readonly mode: CaptureMode;
  readonly status: JobStatus;
  readonly createdAt: string;
  readonly progressMessage: string;
  readonly outputDirectory: string;
  readonly measurements?: JobMeasurements;
  readonly featureSummary?: readonly string[];
  readonly error?: string;
};

export type PhotoJobRequest = {
  readonly imageBuffer: Buffer;
  readonly knownLongestEdgeInMillimetres: number;
  readonly thicknessInMillimetres: number;
};

export type MeshJobRequest = {
  readonly meshBuffer: Buffer;
  readonly fileName: string;
};
