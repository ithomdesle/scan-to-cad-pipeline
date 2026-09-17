import { describe, expect, it } from "vitest";
import {
  createPlateMesh,
  createUnitCubeMesh,
  createWasherMesh,
  type Mesh,
} from "../../../mesh/index.js";
import {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
} from "../../index.js";
import { planReconstruction, ReconstructionStrategy } from "./reconstruction-planner.js";

const planFor = (mesh: Mesh) =>
  planReconstruction(
    mesh,
    createFeatureExtractionController().extract(mesh, DEFAULT_FEATURE_EXTRACTION_OPTIONS),
    DEFAULT_FEATURE_EXTRACTION_OPTIONS.segmentationAngleToleranceDegrees,
  );

describe("planReconstruction", () => {
  it("models a washer with real cylinders", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 8,
      segmentCount: 64,
    });

    // Act
    const plan = planFor(mesh);

    // Assert
    expect(plan.strategy).toBe(ReconstructionStrategy.TURNED);
  });

  it("models a slotted plate as panels", () => {
    // Arrange
    const mesh = createPlateMesh({
      width: 120,
      depth: 60,
      thickness: 3,
      cutouts: [{ left: 20, bottom: 20, right: 40, top: 40 }],
    });

    // Act
    const plan = planFor(mesh);

    // Assert
    expect(plan.strategy).toBe(ReconstructionStrategy.PANELS);
    expect(plan.panelSet?.panels).toHaveLength(1);
  });

  it("measures the volume of the part it is planning for", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const plan = planFor(mesh);

    // Assert
    expect(plan.measuredVolume).toBeCloseTo(27000, -1);
  });

  it("rebuilds a solid block exactly, since overlapping panel pairs cannot account for it", () => {
    // Arrange: every opposite pair of a cube looks like a panel, and summing them triples the solid
    const mesh = createUnitCubeMesh(30);

    // Act
    const plan = planFor(mesh);

    // Assert
    expect(plan.strategy).toBe(ReconstructionStrategy.EXACT);
    expect(plan.estimatedVolume).toBeGreaterThan(plan.measuredVolume);
  });
});
