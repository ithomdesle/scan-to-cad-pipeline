#!/usr/bin/env node

import { Command } from "commander";
import { resolve } from "node:path";
import { StepSchema } from "./modules/step-export/index.js";
import {
  createPipelineRunController,
  loadConfiguration,
  PipelineStage,
  type ConfigurationOverrides,
} from "./modules/pipeline/index.js";

type CommandLineOptions = {
  readonly output: string;
  readonly config?: string;
  readonly targetFaces?: string;
  readonly languageModel?: string;
  readonly model?: string;
  readonly attempts?: string;
  readonly python?: string;
  readonly stepFormat?: string;
  readonly noLlm?: boolean;
  readonly llm: boolean;
};

const parsePositiveInteger = (
  rawValue: string | undefined,
  flagName: string,
): number | undefined => {
  if (rawValue === undefined) return undefined;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive whole number, received "${rawValue}".`);
  }

  return parsed;
};

const parseStepSchema = (rawValue: string | undefined): StepSchema | undefined => {
  if (rawValue === undefined) return undefined;

  const candidate = rawValue.toLowerCase();
  if (candidate !== StepSchema.AP214 && candidate !== StepSchema.AP242) {
    throw new Error(`--step-format must be ap214 or ap242, received "${rawValue}".`);
  }

  return candidate;
};

const createReporter = () => {
  const stageLabels: Readonly<Record<PipelineStage, string>> = Object.freeze({
    [PipelineStage.LOAD]: "1/5",
    [PipelineStage.CLEAN]: "2/5",
    [PipelineStage.EXTRACT]: "3/5",
    [PipelineStage.MODEL]: "4/5",
    [PipelineStage.EXPORT]: "5/5",
  });

  return Object.freeze({
    onStageStarted: (stage: PipelineStage, message: string) =>
      console.log(`\n[${stageLabels[stage]}] ${message}`),
    onDetail: (message: string) => console.log(`      ${message}`),
  });
};

const program = new Command();

program
  .name("scan2cad")
  .description("Convert a 3D scan (STL/OBJ) into an editable STEP solid for Onshape")
  .version("2.0.0")
  .argument("<input>", "Input mesh file (.stl or .obj)")
  .option("-o, --output <directory>", "Output directory", "./output")
  .option("-c, --config <file>", "Configuration file (JSON); command line flags still win")
  .option("--target-faces <count>", "Triangle budget after decimation")
  .option("--language-model <url>", "OpenAI-compatible endpoint, e.g. LM Studio")
  .option("--model <name>", "Model name to request")
  .option("--attempts <count>", "How many times the model may retry before falling back")
  .option("--python <path>", "Python interpreter that has build123d installed")
  .option("--step-format <schema>", "STEP schema: ap214 or ap242")
  .option("--no-llm", "Skip the language model and build directly from the measured geometry")
  .action(async (input: string, options: CommandLineOptions) => {
    try {
      const overrides: ConfigurationOverrides = {
        inputMeshPath: resolve(input),
        outputDirectory: resolve(options.output),
        targetTriangleCount: parsePositiveInteger(options.targetFaces, "--target-faces"),
        languageModelEndpoint: options.languageModel,
        languageModelName: options.model,
        isLanguageModelEnabled: options.llm === false ? false : undefined,
        maximumAttempts: parsePositiveInteger(options.attempts, "--attempts"),
        pythonExecutable: options.python,
        schema: parseStepSchema(options.stepFormat),
      };

      const configuration = await loadConfiguration(overrides, options.config);

      console.log("scan-to-cad pipeline");
      console.log(`      input:  ${configuration.inputMeshPath}`);
      console.log(`      output: ${configuration.outputDirectory}`);

      const result = await createPipelineRunController(createReporter()).run(configuration);

      console.log("\nDone.");
      console.log(`      STEP:     ${result.artifacts.stepFilePath}`);
      console.log(`      model:    ${result.artifacts.scriptFilePath}`);
      console.log(`      features: ${result.artifacts.specificationFilePath}`);
      console.log(`      mesh:     ${result.artifacts.cleanedMeshFilePath}`);
      console.log(
        `\nOnshape imports this as an editable B-Rep solid (${result.appliedSchema}); you can fillet, shell and sketch on its faces. It is not a parametric feature tree.`,
      );
    } catch (error) {
      console.error(`\nPipeline failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });

program.parse();
