import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StepSchema } from "../../types/step-export.types.js";
import { createStepExportController } from "./step-export.controller.js";

// These exercise the real OpenCASCADE kernel, so they only run once `pnpm setup:python` has been
// executed; on a machine without the environment they are skipped rather than reported as failures.
const isPythonEnvironmentPresent = existsSync(join(process.cwd(), ".venv", "bin", "python"));

const exportOptions = {
  schema: StepSchema.AP214,
  timeoutMilliseconds: 120000,
};

describe.skipIf(!isPythonEnvironmentPresent)("createStepExportController", () => {
  it("exports a solid to a STEP file", async () => {
    // Arrange
    const outputDirectory = await mkdtemp(join(tmpdir(), "scan2cad-export-"));
    const controller = createStepExportController(exportOptions);

    // Act
    const result = await controller.exportScript(
      "from build123d import *\npart = Box(10, 20, 30)\n",
      outputDirectory,
    );

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.volume).toBeCloseTo(6000, 3);
    expect(readFileSync(result.stepFilePath as string, "utf8")).toContain("ISO-10303-21");
  }, 120000);

  it("writes the requested STEP schema into the file header", async () => {
    // Arrange
    const outputDirectory = await mkdtemp(join(tmpdir(), "scan2cad-schema-"));
    const controller = createStepExportController({
      ...exportOptions,
      schema: StepSchema.AP242,
    });

    // Act
    const result = await controller.exportScript(
      "from build123d import *\npart = Box(1, 1, 1)\n",
      outputDirectory,
    );

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(readFileSync(result.stepFilePath as string, "utf8")).toContain("AP242");
  }, 120000);

  it("reports a modelling error instead of throwing", async () => {
    // Arrange
    const outputDirectory = await mkdtemp(join(tmpdir(), "scan2cad-failure-"));
    const controller = createStepExportController(exportOptions);

    // Act
    const result = await controller.exportScript(
      "from build123d import *\npart = Cylinder(radius=-5, height=10)\n",
      outputDirectory,
    );

    // Assert
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeTruthy();
  }, 120000);

  it("rejects a script that never produces a solid", async () => {
    // Arrange
    const outputDirectory = await mkdtemp(join(tmpdir(), "scan2cad-empty-"));
    const controller = createStepExportController(exportOptions);

    // Act
    const result = await controller.exportScript(
      "from build123d import *\nsolid = Box(1, 1, 1)\n",
      outputDirectory,
    );

    // Assert
    expect(result.isSuccess).toBe(false);
    expect(result.error).toMatch(/part/);
  }, 120000);
});
