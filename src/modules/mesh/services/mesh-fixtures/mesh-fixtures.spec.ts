import { describe, expect, it } from "vitest";
import { buildTriangleAttributes, findBoundaryLoops } from "../mesh-topology/mesh-topology.js";
import { createWasherMesh } from "./mesh-fixtures.js";

describe("createWasherMesh", () => {
  it("produces a watertight solid", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 8,
      segmentCount: 48,
    });

    // Act
    const loops = findBoundaryLoops(mesh);

    // Assert
    expect(loops).toHaveLength(0);
  });

  it("orients the bore normals toward the axis and the outer wall away from it", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 8,
      segmentCount: 48,
    });
    const attributes = buildTriangleAttributes(mesh);

    // Act
    const radialAgreements = Array.from({ length: mesh.triangleCount }, (_value, triangleIndex) => {
      const radialX = attributes.centroids[triangleIndex * 3];
      const radialY = attributes.centroids[triangleIndex * 3 + 1];
      const radialLength = Math.hypot(radialX, radialY);
      if (radialLength === 0) return 0;
      return (
        (radialX / radialLength) * attributes.normals[triangleIndex * 3] +
        (radialY / radialLength) * attributes.normals[triangleIndex * 3 + 1]
      );
    });

    // Assert
    expect(radialAgreements.some((agreement) => agreement > 0.9)).toBe(true);
    expect(radialAgreements.some((agreement) => agreement < -0.9)).toBe(true);
  });
});
