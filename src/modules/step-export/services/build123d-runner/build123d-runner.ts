import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { runProcess } from "../../../../shared/utils/process-runner/process-runner.js";
import type { StepExportOptions, StepExportResult } from "../../types/step-export.types.js";
import {
  getModelRunnerPath,
  resolvePythonExecutable,
} from "../python-environment/python-environment.js";

type RunnerPayload = {
  readonly isSuccess?: boolean;
  readonly volume?: number;
  readonly appliedSchema?: string | null;
  readonly error?: string;
  readonly traceback?: string;
};

const RESULT_MARKER = "---SCAN2CAD-RESULT---";

// The kernel writes progress banners to stdout, so the result is read from after a sentinel
// rather than by scanning for the first brace.
const parseRunnerPayload = (standardOutput: string): RunnerPayload | null => {
  const markerIndex = standardOutput.lastIndexOf(RESULT_MARKER);
  if (markerIndex === -1) return null;

  try {
    return JSON.parse(standardOutput.slice(markerIndex + RESULT_MARKER.length)) as RunnerPayload;
  } catch {
    return null;
  }
};

export const runBuild123dScript = async (
  source: string,
  scriptFilePath: string,
  stepFilePath: string,
  options: StepExportOptions,
): Promise<StepExportResult> => {
  const pythonExecutable = resolvePythonExecutable(options.pythonExecutable);

  await mkdir(dirname(scriptFilePath), { recursive: true });
  await mkdir(dirname(stepFilePath), { recursive: true });
  await writeFile(scriptFilePath, source, "utf8");

  const processResult = await runProcess({
    executable: pythonExecutable,
    argumentList: [
      getModelRunnerPath(),
      "--script",
      scriptFilePath,
      "--output",
      stepFilePath,
      "--schema",
      options.schema,
    ],
    timeoutMilliseconds: options.timeoutMilliseconds,
  });

  if (processResult.isTimedOut) {
    return Object.freeze({
      isSuccess: false,
      error: `The model took longer than ${options.timeoutMilliseconds} ms to build and was stopped.`,
    });
  }

  const payload = parseRunnerPayload(processResult.standardOutput);

  if (!payload) {
    return Object.freeze({
      isSuccess: false,
      error: [
        `The Python runner exited with code ${processResult.exitCode} and produced no result.`,
        processResult.standardError.trim(),
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (!payload.isSuccess) {
    return Object.freeze({
      isSuccess: false,
      error: payload.error ?? "The model script failed for an unknown reason.",
    });
  }

  return Object.freeze({
    isSuccess: true,
    stepFilePath,
    volume: payload.volume,
    appliedSchema: payload.appliedSchema ?? undefined,
  });
};
