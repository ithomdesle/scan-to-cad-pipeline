import { createEnum, type EnumValues } from "../../../shared/types/enum.types.js";
import type { MeshCleaningOptions } from "../../mesh/index.js";
import type { FeatureExtractionOptions } from "../../feature-extraction/index.js";
import type { CadGenerationOptions } from "../../cad-generation/index.js";
import type { StepExportOptions } from "../../step-export/index.js";

export const PipelineStage = createEnum({
  LOAD: "load",
  CLEAN: "clean",
  EXTRACT: "extract",
  MODEL: "model",
  EXPORT: "export",
});
export type PipelineStage = EnumValues<typeof PipelineStage>;

export type PipelineConfiguration = {
  readonly inputMeshPath: string;
  readonly outputDirectory: string;
  readonly meshCleaning: MeshCleaningOptions;
  readonly featureExtraction: FeatureExtractionOptions;
  readonly cadGeneration: CadGenerationOptions;
  readonly stepExport: StepExportOptions;
};

export type PipelineArtifacts = {
  readonly cleanedMeshFilePath: string;
  readonly specificationFilePath: string;
  readonly scriptFilePath: string;
  readonly stepFilePath: string;
};

export type PipelineResult = {
  readonly isSuccess: boolean;
  readonly artifacts: PipelineArtifacts;
  readonly scriptOrigin: string;
  readonly attemptCount: number;
  readonly featureCount: number;
  readonly solidVolume: number;
  readonly appliedSchema: string;
};

export type PipelineReporter = {
  readonly onStageStarted: (stage: PipelineStage, message: string) => void;
  readonly onDetail: (message: string) => void;
};
