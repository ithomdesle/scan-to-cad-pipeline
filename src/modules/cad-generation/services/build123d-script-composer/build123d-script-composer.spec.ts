import { describe, expect, it } from "vitest";
import { createWasherMesh, createUnitCubeMesh } from "../../../mesh/index.js";
import {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
} from "../../../feature-extraction/index.js";
import { createVector3 } from "../../../../shared/utils/vector/vector.js";
import {
  composeBuild123dScript,
  findDominantConvexCylinder,
  formatCylinderExpression,
  getRotationAnglesForAxis,
} from "./build123d-script-composer.js";

const controller = createFeatureExtractionController();

const washerSpecification = controller.extract(
  createWasherMesh({ outerRadius: 20, innerRadius: 6, height: 8, segmentCount: 72 }),
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
);

describe("getRotationAnglesForAxis", () => {
  it("returns no rotation for the z axis", () => {
    // Arrange
    const axis = createVector3(0, 0, 1);

    // Act
    const angles = getRotationAnglesForAxis(axis);

    // Assert
    expect(angles.pitchDegrees).toBeCloseTo(0, 6);
  });

  it("returns a quarter turn of pitch for the x axis", () => {
    // Arrange
    const axis = createVector3(1, 0, 0);

    // Act
    const angles = getRotationAnglesForAxis(axis);

    // Assert
    expect(angles.pitchDegrees).toBeCloseTo(90, 6);
    expect(angles.yawDegrees).toBeCloseTo(0, 6);
  });
});

describe("formatCylinderExpression", () => {
  it("emits a positioned and rotated build123d cylinder", () => {
    // Arrange
    const centre = createVector3(1, 2, 3);

    // Act
    const expression = formatCylinderExpression(centre, createVector3(0, 0, 1), 5, 10);

    // Assert
    expect(expression).toBe(
      "Pos(1.0000, 2.0000, 3.0000) * Rot(0, 0.0000, 0.0000) * Cylinder(radius=5.0000, height=10.0000)",
    );
  });
});

describe("findDominantConvexCylinder", () => {
  it("identifies the outer wall of a washer as the base solid", () => {
    // Arrange, Act
    const dominant = findDominantConvexCylinder(washerSpecification);

    // Assert
    expect(dominant?.radius).toBeCloseTo(20, 1);
  });

  it("finds no dominant cylinder on a cube", () => {
    // Arrange
    const cubeSpecification = controller.extract(
      createUnitCubeMesh(30),
      DEFAULT_FEATURE_EXTRACTION_OPTIONS,
    );

    // Act
    const dominant = findDominantConvexCylinder(cubeSpecification);

    // Assert
    expect(dominant).toBeNull();
  });
});

describe("composeBuild123dScript", () => {
  it("models a cube as a box", () => {
    // Arrange
    const cubeSpecification = controller.extract(
      createUnitCubeMesh(30),
      DEFAULT_FEATURE_EXTRACTION_OPTIONS,
    );

    // Act
    const source = composeBuild123dScript(cubeSpecification);

    // Assert
    expect(source).toContain("Box(30.0000, 30.0000, 30.0000)");
    expect(source).toContain("part =");
  });

  it("models a washer as a cylinder with a subtracted bore", () => {
    // Arrange, Act
    const source = composeBuild123dScript(washerSpecification);

    // Assert
    expect(source).toContain("from build123d import *");
    expect(source).toMatch(/part = part - .*Cylinder\(radius=6\./);
    expect(source).toContain(", through");
  });
});
