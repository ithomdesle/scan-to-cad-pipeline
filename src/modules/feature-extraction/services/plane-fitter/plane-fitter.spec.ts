import { describe, expect, it } from "vitest";
import { createUnitCubeMesh, createWasherMesh } from "../../../mesh/index.js";
import { buildTriangleAttributes } from "../../../mesh/index.js";
import { fitPlane } from "./plane-fitter.js";

describe("fitPlane", () => {
  it("recovers the plane of the top face of a cube", () => {
    // Arrange
    const mesh = createUnitCubeMesh(10);
    const attributes = buildTriangleAttributes(mesh);
    const topTriangles = Array.from(
      { length: mesh.triangleCount },
      (_value, index) => index,
    ).filter((index) => attributes.normals[index * 3 + 2] > 0.9);

    // Act
    const fit = fitPlane(attributes, topTriangles);

    // Assert
    expect(fit.normal.z).toBeCloseTo(1, 6);
    expect(fit.origin.z).toBeCloseTo(5, 6);
    expect(fit.residual).toBeCloseTo(0, 6);
  });

  it("orients the fitted normal to agree with the surface winding", () => {
    // Arrange
    const mesh = createUnitCubeMesh(10);
    const attributes = buildTriangleAttributes(mesh);
    const bottomTriangles = Array.from(
      { length: mesh.triangleCount },
      (_value, index) => index,
    ).filter((index) => attributes.normals[index * 3 + 2] < -0.9);

    // Act
    const fit = fitPlane(attributes, bottomTriangles);

    // Assert
    expect(fit.normal.z).toBeCloseTo(-1, 6);
  });

  it("reports a large residual for a curved surface", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 8,
      segmentCount: 48,
    });
    const attributes = buildTriangleAttributes(mesh);
    const outerWallTriangles = Array.from(
      { length: mesh.triangleCount },
      (_value, index) => index,
    ).filter(
      (index) =>
        Math.hypot(attributes.centroids[index * 3], attributes.centroids[index * 3 + 1]) > 15 &&
        Math.abs(attributes.normals[index * 3 + 2]) < 0.1,
    );

    // Act
    const fit = fitPlane(attributes, outerWallTriangles);

    // Assert
    expect(fit.residual).toBeGreaterThan(1);
  });
});
