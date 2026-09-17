import { describe, expect, it } from "vitest";
import {
  createMesh,
  createPlateMesh,
  createUnitCubeMesh,
  createWasherMesh,
} from "../../../mesh/index.js";
import {
  computeMeshVolume,
  DEFAULT_PANEL_DETECTION_OPTIONS,
  extractPanelSet,
  getIsTurnedPart,
} from "./panel-set-extractor.js";
import {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
} from "../../index.js";

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

const createTwoStackedPlates = () => {
  const lower = createSlottedPlate();
  const upper = createSlottedPlate();
  const offsetPositions = Float32Array.from(upper.positions);
  for (let offset = 2; offset < offsetPositions.length; offset += 3) {
    offsetPositions[offset] += 40;
  }

  const positions = Float32Array.from([...lower.positions, ...offsetPositions]);
  const indices = Uint32Array.from([
    ...lower.indices,
    ...Array.from(upper.indices, (index) => index + lower.vertexCount),
  ]);

  return createMesh(positions, indices);
};

describe("extractPanelSet", () => {
  it("reads a plate as a single panel of the right thickness", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    expect(panelSet?.panels).toHaveLength(1);
    expect(panelSet?.panels[0].thicknessInMillimetres).toBeCloseTo(3, 4);
  });

  it("keeps every cutout, however small its wall area", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    expect(panelSet?.panels[0].cutouts).toHaveLength(2);
  });

  it("keeps the real outline rather than a bounding rectangle", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    const outline = panelSet?.panels[0].outline ?? [];
    const xValues = outline.map((point) => point.x);
    const yValues = outline.map((point) => point.y);
    expect(Math.max(...xValues) - Math.min(...xValues)).toBeCloseTo(120, 2);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeCloseTo(60, 2);
  });

  it("reconstructs a volume close to the mesh it measured", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    const panel = panelSet?.panels[0];
    const reconstructed = (panel?.faceArea ?? 0) * (panel?.thicknessInMillimetres ?? 0);
    expect(reconstructed).toBeCloseTo(computeMeshVolume(mesh), -1);
  });

  it("finds both panels of a part made of two plates", () => {
    // Arrange
    const mesh = createTwoStackedPlates();

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    expect(panelSet?.panels).toHaveLength(2);
  });

  it("estimates the wall thickness from the solid itself", () => {
    // Arrange
    const mesh = createSlottedPlate();

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    expect(panelSet?.estimatedWallThickness).toBeGreaterThan(1);
    expect(panelSet?.estimatedWallThickness).toBeLessThan(3.5);
  });

  it("reads a solid cube as one panel that rebuilds it exactly", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const panelSet = extractPanelSet(mesh, 30, DEFAULT_PANEL_DETECTION_OPTIONS);

    // Assert
    const panel = panelSet?.panels[0];
    expect((panel?.faceArea ?? 0) * (panel?.thicknessInMillimetres ?? 0)).toBeCloseTo(27000, -1);
  });
});

describe("getIsTurnedPart", () => {
  it("recognises a washer by the share of area on convex round faces", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 20,
      segmentCount: 64,
    });
    const specification = createFeatureExtractionController().extract(
      mesh,
      DEFAULT_FEATURE_EXTRACTION_OPTIONS,
    );

    // Act
    const isTurned = getIsTurnedPart(specification.features, specification.metadata.surfaceArea);

    // Assert
    expect(isTurned).toBe(true);
  });

  it("does not call a slotted plate a turned part", () => {
    // Arrange
    const specification = createFeatureExtractionController().extract(
      createSlottedPlate(),
      DEFAULT_FEATURE_EXTRACTION_OPTIONS,
    );

    // Act
    const isTurned = getIsTurnedPart(specification.features, specification.metadata.surfaceArea);

    // Assert
    expect(isTurned).toBe(false);
  });
});
