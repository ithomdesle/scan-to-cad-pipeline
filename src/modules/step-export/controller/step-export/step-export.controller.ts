import { join } from "node:path";
import type { StepExportOptions, StepExportResult } from "../../types/step-export.types.js";
import { runBuild123dScript } from "../../services/build123d-runner/build123d-runner.js";

export type StepExportController = {
  readonly exportScript: (source: string, outputDirectory: string) => Promise<StepExportResult>;
};

export const createStepExportController = (options: StepExportOptions): StepExportController =>
  Object.freeze({
    // Verification and export are the same operation: a script is only proven valid by the kernel
    // actually producing a solid, so the accepted attempt is the one whose STEP file remains.
    exportScript: (source: string, outputDirectory: string) =>
      runBuild123dScript(
        source,
        join(outputDirectory, "part.py"),
        join(outputDirectory, "part.step"),
        options,
      ),
  });
