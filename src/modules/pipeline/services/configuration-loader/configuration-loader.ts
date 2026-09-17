import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_FEATURE_EXTRACTION_OPTIONS } from "../../../feature-extraction/index.js";
import { StepSchema } from "../../../step-export/index.js";
import type { PipelineConfiguration } from "../../types/pipeline.types.js";

export type ConfigurationOverrides = {
  readonly inputMeshPath?: string;
  readonly outputDirectory?: string;
  readonly targetTriangleCount?: number;
  readonly languageModelEndpoint?: string;
  readonly languageModelName?: string;
  readonly isLanguageModelEnabled?: boolean;
  readonly maximumAttempts?: number;
  readonly pythonExecutable?: string;
  readonly schema?: StepSchema;
};

const getRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getNumber = (value: unknown, fallback: number, fieldName: string): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Configuration field "${fieldName}" must be a finite number.`);
  }
  return value;
};

const getBoolean = (value: unknown, fallback: boolean, fieldName: string): boolean => {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw new Error(`Configuration field "${fieldName}" must be true or false.`);
  }
  return value;
};

const getString = (value: unknown, fallback: string, fieldName: string): string => {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new Error(`Configuration field "${fieldName}" must be a string.`);
  }
  return value;
};

const getStepSchema = (value: unknown, fallback: StepSchema): StepSchema => {
  if (value === undefined) return fallback;
  const candidate = String(value).toLowerCase();
  if (candidate !== StepSchema.AP214 && candidate !== StepSchema.AP242) {
    throw new Error(`Configuration field "stepExport.schema" must be "ap214" or "ap242".`);
  }
  return candidate;
};

export const createDefaultConfiguration = (
  inputMeshPath: string,
  outputDirectory: string,
): PipelineConfiguration =>
  Object.freeze({
    inputMeshPath,
    outputDirectory,
    meshCleaning: Object.freeze({
      targetTriangleCount: 100000,
      simplificationErrorTolerance: 0.01,
      smallComponentAreaFraction: 0.01,
      isFillHolesEnabled: true,
      weldingTolerance: 1e-5,
    }),
    featureExtraction: DEFAULT_FEATURE_EXTRACTION_OPTIONS,
    cadGeneration: Object.freeze({
      isLanguageModelEnabled: true,
      maximumAttempts: 3,
      languageModel: Object.freeze({
        endpoint: "http://127.0.0.1:1234/v1",
        model: "local-model",
        temperature: 0.2,
        maximumTokens: 2000,
        apiKey: process.env.LM_API_KEY,
        timeoutMilliseconds: 120000,
      }),
    }),
    stepExport: Object.freeze({
      schema: StepSchema.AP214,
      timeoutMilliseconds: 300000,
    }),
  });

export const applyConfigurationFile = (
  base: PipelineConfiguration,
  fileContents: unknown,
): PipelineConfiguration => {
  const root = getRecord(fileContents);
  const meshCleaning = getRecord(root.meshCleaning);
  const featureExtraction = getRecord(root.featureExtraction);
  const cadGeneration = getRecord(root.cadGeneration);
  const languageModel = getRecord(cadGeneration.languageModel);
  const stepExport = getRecord(root.stepExport);

  return Object.freeze({
    inputMeshPath: getString(root.inputMeshPath, base.inputMeshPath, "inputMeshPath"),
    outputDirectory: getString(root.outputDirectory, base.outputDirectory, "outputDirectory"),
    meshCleaning: Object.freeze({
      targetTriangleCount: getNumber(
        meshCleaning.targetTriangleCount,
        base.meshCleaning.targetTriangleCount,
        "meshCleaning.targetTriangleCount",
      ),
      simplificationErrorTolerance: getNumber(
        meshCleaning.simplificationErrorTolerance,
        base.meshCleaning.simplificationErrorTolerance,
        "meshCleaning.simplificationErrorTolerance",
      ),
      smallComponentAreaFraction: getNumber(
        meshCleaning.smallComponentAreaFraction,
        base.meshCleaning.smallComponentAreaFraction,
        "meshCleaning.smallComponentAreaFraction",
      ),
      isFillHolesEnabled: getBoolean(
        meshCleaning.isFillHolesEnabled,
        base.meshCleaning.isFillHolesEnabled,
        "meshCleaning.isFillHolesEnabled",
      ),
      weldingTolerance: getNumber(
        meshCleaning.weldingTolerance,
        base.meshCleaning.weldingTolerance,
        "meshCleaning.weldingTolerance",
      ),
    }),
    featureExtraction: Object.freeze({
      segmentationAngleToleranceDegrees: getNumber(
        featureExtraction.segmentationAngleToleranceDegrees,
        base.featureExtraction.segmentationAngleToleranceDegrees,
        "featureExtraction.segmentationAngleToleranceDegrees",
      ),
      planarDistanceTolerance: getNumber(
        featureExtraction.planarDistanceTolerance,
        base.featureExtraction.planarDistanceTolerance,
        "featureExtraction.planarDistanceTolerance",
      ),
      minimumFaceAreaFraction: getNumber(
        featureExtraction.minimumFaceAreaFraction,
        base.featureExtraction.minimumFaceAreaFraction,
        "featureExtraction.minimumFaceAreaFraction",
      ),
      maximumCylinderFitResidualFraction: getNumber(
        featureExtraction.maximumCylinderFitResidualFraction,
        base.featureExtraction.maximumCylinderFitResidualFraction,
        "featureExtraction.maximumCylinderFitResidualFraction",
      ),
    }),
    cadGeneration: Object.freeze({
      isLanguageModelEnabled: getBoolean(
        cadGeneration.isLanguageModelEnabled,
        base.cadGeneration.isLanguageModelEnabled,
        "cadGeneration.isLanguageModelEnabled",
      ),
      maximumAttempts: getNumber(
        cadGeneration.maximumAttempts,
        base.cadGeneration.maximumAttempts,
        "cadGeneration.maximumAttempts",
      ),
      languageModel: Object.freeze({
        endpoint: getString(
          languageModel.endpoint,
          base.cadGeneration.languageModel.endpoint,
          "cadGeneration.languageModel.endpoint",
        ),
        model: getString(
          languageModel.model,
          base.cadGeneration.languageModel.model,
          "cadGeneration.languageModel.model",
        ),
        temperature: getNumber(
          languageModel.temperature,
          base.cadGeneration.languageModel.temperature,
          "cadGeneration.languageModel.temperature",
        ),
        maximumTokens: getNumber(
          languageModel.maximumTokens,
          base.cadGeneration.languageModel.maximumTokens,
          "cadGeneration.languageModel.maximumTokens",
        ),
        apiKey: base.cadGeneration.languageModel.apiKey,
        timeoutMilliseconds: getNumber(
          languageModel.timeoutMilliseconds,
          base.cadGeneration.languageModel.timeoutMilliseconds,
          "cadGeneration.languageModel.timeoutMilliseconds",
        ),
      }),
    }),
    stepExport: Object.freeze({
      pythonExecutable:
        stepExport.pythonExecutable === undefined
          ? base.stepExport.pythonExecutable
          : getString(stepExport.pythonExecutable, "", "stepExport.pythonExecutable"),
      schema: getStepSchema(stepExport.schema, base.stepExport.schema),
      timeoutMilliseconds: getNumber(
        stepExport.timeoutMilliseconds,
        base.stepExport.timeoutMilliseconds,
        "stepExport.timeoutMilliseconds",
      ),
    }),
  });
};

export const applyOverrides = (
  base: PipelineConfiguration,
  overrides: ConfigurationOverrides,
): PipelineConfiguration =>
  Object.freeze({
    inputMeshPath: overrides.inputMeshPath ?? base.inputMeshPath,
    outputDirectory: overrides.outputDirectory ?? base.outputDirectory,
    meshCleaning: Object.freeze({
      ...base.meshCleaning,
      targetTriangleCount: overrides.targetTriangleCount ?? base.meshCleaning.targetTriangleCount,
    }),
    featureExtraction: base.featureExtraction,
    cadGeneration: Object.freeze({
      isLanguageModelEnabled:
        overrides.isLanguageModelEnabled ?? base.cadGeneration.isLanguageModelEnabled,
      maximumAttempts: overrides.maximumAttempts ?? base.cadGeneration.maximumAttempts,
      languageModel: Object.freeze({
        ...base.cadGeneration.languageModel,
        endpoint: overrides.languageModelEndpoint ?? base.cadGeneration.languageModel.endpoint,
        model: overrides.languageModelName ?? base.cadGeneration.languageModel.model,
      }),
    }),
    stepExport: Object.freeze({
      ...base.stepExport,
      pythonExecutable: overrides.pythonExecutable ?? base.stepExport.pythonExecutable,
      schema: overrides.schema ?? base.stepExport.schema,
    }),
  });

export const loadConfiguration = async (
  overrides: ConfigurationOverrides,
  configurationFilePath?: string,
): Promise<PipelineConfiguration> => {
  const base = createDefaultConfiguration(
    resolve(overrides.inputMeshPath ?? ""),
    resolve(overrides.outputDirectory ?? "./output"),
  );

  if (!configurationFilePath) return applyOverrides(base, overrides);

  const rawContents = await readFile(configurationFilePath, "utf8");
  let parsedContents: unknown;

  try {
    parsedContents = JSON.parse(rawContents);
  } catch (error) {
    throw new Error(
      `Configuration file "${configurationFilePath}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Command line flags are applied last so an explicit flag always beats the file.
  return applyOverrides(applyConfigurationFile(base, parsedContents), overrides);
};
