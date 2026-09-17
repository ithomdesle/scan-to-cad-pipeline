import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  computeMeshStatistics,
  createMeshCleaningController,
  readMeshFromFile,
  writeBinaryStereolithography,
} from "../../../mesh/index.js";
import {
  createFeatureExtractionController,
  DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS,
  planReconstruction,
  reconstructPolyhedron,
  ReconstructionStrategy,
} from "../../../feature-extraction/index.js";
import {
  composePanelSetScript,
  createCadScriptGenerationController,
} from "../../../cad-generation/index.js";
import { createStepExportController, type StepExportResult } from "../../../step-export/index.js";
import {
  PipelineStage,
  type PipelineConfiguration,
  type PipelineReporter,
  type PipelineResult,
} from "../../types/pipeline.types.js";

export const createPipelineRunController = (reporter: PipelineReporter) =>
  Object.freeze({
    run: async (configuration: PipelineConfiguration): Promise<PipelineResult> => {
      await mkdir(configuration.outputDirectory, { recursive: true });

      reporter.onStageStarted(PipelineStage.LOAD, "Loading mesh");
      const inputMesh = await readMeshFromFile(configuration.inputMeshPath);
      const inputStatistics = computeMeshStatistics(inputMesh);
      reporter.onDetail(
        `${inputMesh.triangleCount} triangles, ${inputMesh.vertexCount} vertices, ${inputStatistics.isWatertight ? "watertight" : `${inputStatistics.boundaryEdgeCount} boundary edges`}`,
      );

      reporter.onStageStarted(PipelineStage.CLEAN, "Cleaning mesh");
      const cleaningResult = await createMeshCleaningController().clean(
        inputMesh,
        configuration.meshCleaning,
      );
      const cleanedMeshFilePath = join(configuration.outputDirectory, "cleaned.stl");
      await writeFile(cleanedMeshFilePath, writeBinaryStereolithography(cleaningResult.mesh));
      reporter.onDetail(
        `${cleaningResult.report.outputTriangleCount} triangles after cleaning, ${cleaningResult.report.removedComponentCount} stray components removed, ${cleaningResult.report.filledHoleCount} holes filled`,
      );

      reporter.onStageStarted(PipelineStage.EXTRACT, "Extracting features");
      const specification = createFeatureExtractionController().extract(
        cleaningResult.mesh,
        configuration.featureExtraction,
      );
      const specificationFilePath = join(configuration.outputDirectory, "features.json");
      await writeFile(specificationFilePath, `${JSON.stringify(specification, null, 2)}\n`, "utf8");
      reporter.onDetail(
        `${specification.features.length} features; ${specification.dimensions.length.toFixed(1)} x ${specification.dimensions.width.toFixed(1)} x ${specification.dimensions.height.toFixed(1)} mm`,
      );

      reporter.onStageStarted(PipelineStage.MODEL, "Building solid model");
      const stepExportController = createStepExportController(configuration.stepExport);

      const plan = planReconstruction(
        cleaningResult.mesh,
        specification,
        configuration.featureExtraction.segmentationAngleToleranceDegrees,
      );
      const panelSet = plan.panelSet;
      reporter.onDetail(`${plan.strategy}: ${plan.reason}`);

      if (plan.strategy === ReconstructionStrategy.EXACT) {
        const polyhedron = reconstructPolyhedron(
          cleaningResult.mesh,
          DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS,
        );
        reporter.onDetail(
          `${polyhedron.faces.length} faces (${polyhedron.mergedFaceCount} merged, ${polyhedron.triangleFaceCount} tessellated)`,
        );

        const exactExport = await stepExportController.exportFaces(
          polyhedron.faces,
          configuration.outputDirectory,
        );

        if (!exactExport.isSuccess) {
          throw new Error(exactExport.error ?? "The mesh could not be rebuilt as a solid.");
        }

        reporter.onStageStarted(PipelineStage.EXPORT, "Writing STEP");
        reporter.onDetail(
          `model source: exact; solid volume ${(exactExport.volume ?? 0).toFixed(2)} mm3 of ${plan.measuredVolume.toFixed(2)} measured`,
        );

        return Object.freeze({
          isSuccess: true,
          artifacts: Object.freeze({
            cleanedMeshFilePath,
            specificationFilePath,
            scriptFilePath: join(configuration.outputDirectory, "faces.json"),
            stepFilePath: exactExport.stepFilePath as string,
          }),
          scriptOrigin: "exact",
          attemptCount: 0,
          featureCount: specification.features.length,
          solidVolume: exactExport.volume ?? 0,
          appliedSchema: exactExport.appliedSchema ?? configuration.stepExport.schema,
        });
      }

      let lastSuccessfulExport: StepExportResult | null = null;

      const script = await createCadScriptGenerationController({
        verifyScript: async (source) => {
          const exportResult = await stepExportController.exportScript(
            source,
            configuration.outputDirectory,
          );
          if (exportResult.isSuccess) lastSuccessfulExport = exportResult;
          return Object.freeze({ isValid: exportResult.isSuccess, error: exportResult.error });
        },
        onAttemptFailed: (attemptNumber, reason) =>
          reporter.onDetail(`Attempt ${attemptNumber} rejected: ${reason}`),
      }).generate(
        specification,
        {
          ...configuration.cadGeneration,
          isLanguageModelEnabled: panelSet
            ? false
            : configuration.cadGeneration.isLanguageModelEnabled,
        },
        panelSet ? composePanelSetScript(panelSet) : undefined,
      );

      const acceptedExport = lastSuccessfulExport as StepExportResult | null;
      if (!acceptedExport?.stepFilePath) {
        throw new Error("The solid was verified but no STEP file was recorded.");
      }

      reporter.onStageStarted(PipelineStage.EXPORT, "Writing STEP");
      reporter.onDetail(
        `model source: ${script.origin}; solid volume ${(acceptedExport.volume ?? 0).toFixed(2)} mm3`,
      );

      return Object.freeze({
        isSuccess: true,
        artifacts: Object.freeze({
          cleanedMeshFilePath,
          specificationFilePath,
          scriptFilePath: join(configuration.outputDirectory, "part.py"),
          stepFilePath: acceptedExport.stepFilePath,
        }),
        scriptOrigin: script.origin,
        attemptCount: script.attemptCount,
        featureCount: specification.features.length,
        solidVolume: acceptedExport.volume ?? 0,
        appliedSchema: acceptedExport.appliedSchema ?? configuration.stepExport.schema,
      });
    },
  });
