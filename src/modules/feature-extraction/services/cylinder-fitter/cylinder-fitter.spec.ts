import { describe, expect, it } from "vitest";
import { buildTriangleAttributes, createWasherMesh } from "../../../mesh/index.js";
import { fitCylinder, getExtentAlongDirection } from "./cylinder-fitter.js";
import { createVector3 } from "../../../../shared/utils/vector/vector.js";

const washer = createWasherMesh({
  outerRadius: 20,
  innerRadius: 6,
  height: 8,
  segmentCount: 64,
});
const attributes = buildTriangleAttributes(washer);

const selectWallTriangles = (isOuterWall: boolean) =>
  Array.from({ length: washer.triangleCount }, (_value, index) => index).filter((index) => {
    const radialDistance = Math.hypot(
      attributes.centroids[index * 3],
      attributes.centroids[index * 3 + 1],
    );
    const isVerticalFace = Math.abs(attributes.normals[index * 3 + 2]) < 0.1;
    return isVerticalFace && (isOuterWall ? radialDistance > 15 : radialDistance < 10);
  });

describe("fitCylinder", () => {
  it("recovers the radius and axis of the outer wall", () => {
    // Arrange
    const outerWallTriangles = selectWallTriangles(true);

    // Act
    const fit = fitCylinder(washer, attributes, outerWallTriangles);

    // Assert
    expect(fit).not.toBeNull();
    expect(fit?.radius).toBeCloseTo(20, 3);
    expect(Math.abs(fit?.axis.z ?? 0)).toBeCloseTo(1, 4);
  });

  it("marks the outer wall as convex", () => {
    // Arrange
    const outerWallTriangles = selectWallTriangles(true);

    // Act
    const fit = fitCylinder(washer, attributes, outerWallTriangles);

    // Assert
    expect(fit?.isConcave).toBe(false);
  });

  it("marks the bore as concave and recovers its radius", () => {
    // Arrange
    const boreTriangles = selectWallTriangles(false);

    // Act
    const fit = fitCylinder(washer, attributes, boreTriangles);

    // Assert
    expect(fit?.isConcave).toBe(true);
    expect(fit?.radius).toBeCloseTo(6, 3);
  });

  it("measures the axial height of the bore", () => {
    // Arrange
    const boreTriangles = selectWallTriangles(false);

    // Act
    const fit = fitCylinder(washer, attributes, boreTriangles);

    // Assert
    expect(fit?.height).toBeCloseTo(8, 4);
  });

  it("returns null for a segment with too few triangles", () => {
    // Arrange
    const tinySegment = [0, 1, 2];

    // Act
    const fit = fitCylinder(washer, attributes, tinySegment);

    // Assert
    expect(fit).toBeNull();
  });
});

describe("getExtentAlongDirection", () => {
  it("returns the full span of the box along an axis", () => {
    // Arrange
    const minimumCorner = createVector3(-5, -5, 0);
    const maximumCorner = createVector3(5, 5, 8);

    // Act
    const extent = getExtentAlongDirection(createVector3(0, 0, 1), minimumCorner, maximumCorner);

    // Assert
    expect(extent).toBeCloseTo(8, 6);
  });
});
