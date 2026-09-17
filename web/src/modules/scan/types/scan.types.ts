export const CaptureMode = Object.freeze({
  PHOTO: "photo",
  MESH: "mesh",
});
export type CaptureMode = (typeof CaptureMode)[keyof typeof CaptureMode];

export const JobStatus = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
});
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export type JobMeasurements = {
  readonly widthInMillimetres: number;
  readonly heightInMillimetres: number;
  readonly thicknessInMillimetres: number;
  readonly cutoutCount: number;
  readonly volumeInCubicMillimetres: number;
};

export type JobState = {
  readonly id: string;
  readonly status: JobStatus;
  readonly progressMessage: string;
  readonly measurements?: JobMeasurements;
  readonly featureSummary?: readonly string[];
  readonly error?: string;
};
