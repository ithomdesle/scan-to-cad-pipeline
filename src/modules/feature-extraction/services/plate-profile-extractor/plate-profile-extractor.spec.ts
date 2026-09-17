import { describe, expect, it } from "vitest";
import { createPlateMesh, createUnitCubeMesh, createWasherMesh } from "../../../mesh/index.js";
import { DEFAULT_PLATE_DETECTION_OPTIONS, extractPlateProfile } from "./plate-profile-extractor.js";

const createSlottedPlate = () =>
  createPlateMesh({
    width: 120,
    depth: 60,
    thickness: 3,
    cutouts: [
      { left: 20, bottom: 20, right: 40, top: 40 },
      { left: 70, bottom: 20, right: 90, top: 40 },
    ],
  });

describe("extractPlateProfile", () => {
  it("measures the thickness of a plate", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const profile = extractPlateProfile(mesh, 30, DEFAULT_PLATE_DETECTION_OPTIONS);

    // Assert
    expect(profile?.thicknessInMillimetres).toBeCloseTo(3, 4);
  });

  it("recovers every cutout, however small its wall area", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const profile = extractPlateProfile(mesh, 30, DEFAULT_PLATE_DETECTION_OPTIONS);

    // Assert
    expect(profile?.cutouts).toHaveLength(2);
  });

  it("keeps the outline rather than a bounding rectangle", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const profile = extractPlateProfile(mesh, 30, DEFAULT_PLATE_DETECTION_OPTIONS);

    // Assert
    const xValues = profile?.outline.map((point) => point.x) ?? [];
    const yValues = profile?.outline.map((point) => point.y) ?? [];
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeCloseTo(120, 2);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeCloseTo(60, 2);
  });

  it("declines a cube, which is not a plate", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const profile = extractPlateProfile(mesh, 30, DEFAULT_PLATE_DETECTION_OPTIONS);

    // Assert
    expect(profile).toBeNull();
  });

  it("declines a washer, whose faces do not dominate its area", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 20,
      segmentCount: 64,
    });

    // Act
    const profile = extractPlateProfile(mesh, 30, DEFAULT_PLATE_DETECTION_OPTIONS);

    // Assert
    expect(profile).toBeNull();
  });
});
