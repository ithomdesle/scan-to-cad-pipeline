import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  computeMeshStatistics,
  createMeshCleaningController,
  readMeshFromBuffer,
  writeBinaryStereolithography,
} from "../../../mesh/index.js";
import {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
  DEFAULT_PANEL_DETECTION_OPTIONS,
  extractPanelSet,
  getIsTurnedPart,
  FeatureKind,
  computeMeshVolume,
} from "../../../feature-extraction/index.js";
import {
  composeBuild123dScript,
  composePanelSetScript,
  composeProfileScript,
} from "../../../cad-generation/index.js";
import {
  createProfileExtractionController,
  DEFAULT_PROFILE_EXTRACTION_OPTIONS,
} from "../../../image-profile/index.js";
import { createStepExportController, StepSchema } from "../../../step-export/index.js";
import { JobStatus, type MeshJobRequest, type PhotoJobRequest } from "../../types/job.types.js";
import type { JobStore } from "../../services/job-store/job-store.js";

const stepExportController = createStepExportController({
  schema: StepSchema.AP214,
  timeoutMilliseconds: 300000,
});

export const createScanJobController = (jobStore: JobStore) =>
  Object.freeze({
    runPhotoJob: async (jobId: string, request: PhotoJobRequest): Promise<void> => {
      const job = jobStore.get(jobId);
      if (!job) return;

      try {
        jobStore.update(jobId, {
          status: JobStatus.RUNNING,
          progressMessage: "Finding the part in the photo",
        });

        await mkdir(job.outputDirectory, { recursive: true });
        await writeFile(join(job.outputDirectory, "source.jpg"), request.imageBuffer);

        const profile = await createProfileExtractionController().extract(request.imageBuffer, {
          ...DEFAULT_PROFILE_EXTRACTION_OPTIONS,
          knownLongestEdgeInMillimetres: request.knownLongestEdgeInMillimetres,
          thicknessInMillimetres: request.thicknessInMillimetres,
        });

        jobStore.update(jobId, { progressMessage: "Building the solid" });

        const exportResult = await stepExportController.exportScript(
          composeProfileScript(profile),
          job.outputDirectory,
        );

        if (!exportResult.isSuccess) {
          throw new Error(exportResult.error ?? "The solid could not be built.");
        }

        jobStore.update(jobId, {
          status: JobStatus.SUCCEEDED,
          progressMessage: "Done",
          measurements: Object.freeze({
            widthInMillimetres: profile.widthInMillimetres,
            heightInMillimetres: profile.heightInMillimetres,
            thicknessInMillimetres: profile.thicknessInMillimetres,
            cutoutCount: profile.cutouts.length,
            outlinePointCount: profile.outline.length,
            volumeInCubicMillimetres: exportResult.volume ?? 0,
          }),
          featureSummary: Object.freeze([
            `Outline with ${profile.outline.length} corners`,
            `${profile.cutouts.length} cutout${profile.cutouts.length === 1 ? "" : "s"}`,
            `${profile.widthInMillimetres.toFixed(1)} x ${profile.heightInMillimetres.toFixed(1)} x ${profile.thicknessInMillimetres.toFixed(1)} mm`,
          ]),
        });
      } catch (error) {
        jobStore.update(jobId, {
          status: JobStatus.FAILED,
          progressMessage: "Failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    runMeshJob: async (jobId: string, request: MeshJobRequest): Promise<void> => {
      const job = jobStore.get(jobId);
      if (!job) return;

      try {
        jobStore.update(jobId, { status: JobStatus.RUNNING, progressMessage: "Reading the mesh" });
        await mkdir(job.outputDirectory, { recursive: true });

        const fileExtension = request.fileName.toLowerCase().endsWith(".obj") ? ".obj" : ".stl";
        const inputMesh = readMeshFromBuffer(request.meshBuffer, fileExtension);

        jobStore.update(jobId, { progressMessage: "Cleaning the mesh" });
        const cleaningResult = await createMeshCleaningController().clean(inputMesh, {
          targetTriangleCount: 100000,
          simplificationErrorTolerance: 0.01,
          smallComponentAreaFraction: 0.01,
          isFillHolesEnabled: true,
          weldingTolerance: 1e-5,
        });

        await writeFile(
          join(job.outputDirectory, "cleaned.stl"),
          writeBinaryStereolithography(cleaningResult.mesh),
        );

        jobStore.update(jobId, { progressMessage: "Measuring features" });

        // A plate is reconstructed from its own outline and cutouts; a bounding box would throw
        // both away, and the cutout walls are too small to survive a face-area threshold.
        const specification = createFeatureExtractionController().extract(
          cleaningResult.mesh,
          DEFAULT_FEATURE_EXTRACTION_OPTIONS,
        );

        const panelSet = getIsTurnedPart(specification.features, specification.metadata.surfaceArea)
          ? null
          : extractPanelSet(
              cleaningResult.mesh,
              DEFAULT_FEATURE_EXTRACTION_OPTIONS.segmentationAngleToleranceDegrees,
              DEFAULT_PANEL_DETECTION_OPTIONS,
            );
        await writeFile(
          join(job.outputDirectory, "features.json"),
          `${JSON.stringify(specification, null, 2)}\n`,
          "utf8",
        );

        jobStore.update(jobId, { progressMessage: "Building the solid" });
        const exportResult = await stepExportController.exportScript(
          panelSet ? composePanelSetScript(panelSet) : composeBuild123dScript(specification),
          job.outputDirectory,
        );

        if (!exportResult.isSuccess) {
          throw new Error(exportResult.error ?? "The solid could not be built.");
        }

        const statistics = computeMeshStatistics(cleaningResult.mesh);
        const measuredVolume = computeMeshVolume(cleaningResult.mesh);
        const holeCount = specification.features.filter(
          (feature) => feature.kind === FeatureKind.HOLE,
        ).length;
        const planeCount = specification.features.filter(
          (feature) => feature.kind === FeatureKind.PLANAR_FACE,
        ).length;
        const cylinderCount = specification.features.filter(
          (feature) => feature.kind === FeatureKind.CYLINDRICAL_FACE,
        ).length;

        jobStore.update(jobId, {
          status: JobStatus.SUCCEEDED,
          progressMessage: "Done",
          measurements: Object.freeze({
            widthInMillimetres: specification.dimensions.length,
            heightInMillimetres: specification.dimensions.width,
            thicknessInMillimetres: specification.dimensions.height,
            cutoutCount: panelSet
              ? panelSet.panels.reduce((total, panel) => total + panel.cutouts.length, 0)
              : holeCount,
            outlinePointCount: specification.features.length,
            volumeInCubicMillimetres: exportResult.volume ?? 0,
          }),
          featureSummary: panelSet
            ? Object.freeze([
                panelSet.panels.length === 1
                  ? `Plate ${panelSet.panels[0].thicknessInMillimetres.toFixed(2)} mm thick`
                  : `${panelSet.panels.length} panels, ${panelSet.panels.map((panel) => `${panel.thicknessInMillimetres.toFixed(1)} mm`).join(" + ")}`,
                `${panelSet.panels.reduce((total, panel) => total + panel.cutouts.length, 0)} cutout${panelSet.panels.reduce((total, panel) => total + panel.cutouts.length, 0) === 1 ? "" : "s"}`,
                `${(100 * (exportResult.volume ?? 0)) / measuredVolume < 0 ? "" : ""}${Math.round((100 * (exportResult.volume ?? 0)) / measuredVolume)}% of the scanned volume`,
                `${statistics.triangleCount} triangles, ${statistics.isWatertight ? "watertight" : "open mesh"}`,
              ])
            : Object.freeze([
                `${planeCount} flat face${planeCount === 1 ? "" : "s"}`,
                `${cylinderCount} round face${cylinderCount === 1 ? "" : "s"}`,
                `${holeCount} hole${holeCount === 1 ? "" : "s"}`,
                `${statistics.triangleCount} triangles, ${statistics.isWatertight ? "watertight" : "open mesh"}`,
              ]),
        });
      } catch (error) {
        jobStore.update(jobId, {
          status: JobStatus.FAILED,
          progressMessage: "Failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
