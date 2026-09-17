import { describe, expect, it } from "vitest";
import { createUnitCubeMesh, createWasherMesh } from "../../../mesh/index.js";
import {
  FeatureKind,
  type CylindricalFace,
  type Hole,
  type PlanarFace,
} from "../../types/feature.types.js";
import {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
} from "./feature-extraction.controller.js";

const controller = createFeatureExtractionController();

const extractWasherSpecification = () =>
  controller.extract(
    createWasherMesh({ outerRadius: 20, innerRadius: 6, height: 8, segmentCount: 72 }),
    DEFAULT_FEATURE_EXTRACTION_OPTIONS,
  );

describe("createFeatureExtractionController", () => {
  it("finds exactly the six faces of a cube", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const specification = controller.extract(mesh, DEFAULT_FEATURE_EXTRACTION_OPTIONS);

    // Assert
    const planarFaces = specification.features.filter(
      (feature) => feature.kind === FeatureKind.PLANAR_FACE,
    );
    expect(planarFaces).toHaveLength(6);
  });

  it("reports the cube dimensions from its bounding box", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const specification = controller.extract(mesh, DEFAULT_FEATURE_EXTRACTION_OPTIONS);

    // Assert
    expect(specification.dimensions.length).toBeCloseTo(30, 4);
    expect(specification.dimensions.width).toBeCloseTo(30, 4);
    expect(specification.dimensions.height).toBeCloseTo(30, 4);
  });

  it("separates the two annular faces of a washer from its walls", () => {
    // Arrange, Act
    const specification = extractWasherSpecification();

    // Assert
    const planarFaces = specification.features.filter(
      (feature): feature is PlanarFace => feature.kind === FeatureKind.PLANAR_FACE,
    );
    expect(planarFaces).toHaveLength(2);
    expect(Math.abs(planarFaces[0].normal.z)).toBeCloseTo(1, 4);
  });

  it("recovers the outer wall and the bore as cylinders with correct radii", () => {
    // Arrange, Act
    const specification = extractWasherSpecification();

    // Assert
    const cylinders = specification.features.filter(
      (feature): feature is CylindricalFace => feature.kind === FeatureKind.CYLINDRICAL_FACE,
    );
    const radii = cylinders.map((cylinder) => Math.round(cylinder.radius));
    expect(radii).toContain(20);
    expect(radii).toContain(6);
  });

  it("classifies the bore as a through hole", () => {
    // Arrange, Act
    const specification = extractWasherSpecification();

    // Assert
    const holes = specification.features.filter(
      (feature): feature is Hole => feature.kind === FeatureKind.HOLE,
    );
    expect(holes).toHaveLength(1);
    expect(holes[0].radius).toBeCloseTo(6, 1);
    expect(holes[0].depth).toBeCloseTo(8, 1);
    expect(holes[0].isThrough).toBe(true);
  });

  it("records watertightness in the metadata", () => {
    // Arrange, Act
    const specification = extractWasherSpecification();

    // Assert
    expect(specification.metadata.isWatertight).toBe(true);
    expect(specification.metadata.triangleCount).toBeGreaterThan(0);
  });
});
