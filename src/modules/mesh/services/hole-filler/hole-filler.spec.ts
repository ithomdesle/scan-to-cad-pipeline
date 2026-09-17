import { describe, expect, it } from "vitest";
import { createOpenSquareMesh, createUnitCubeMesh } from "../mesh-fixtures/mesh-fixtures.js";
import { findBoundaryLoops } from "../mesh-topology/mesh-topology.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";
import { fillHoles } from "./hole-filler.js";

const createCubeMissingOneFace = () => {
  const cube = createUnitCubeMesh(10);
  return createMesh(cube.positions, cube.indices.slice(0, cube.indices.length - 6));
};

describe("fillHoles", () => {
  it("leaves a watertight mesh untouched", () => {
    // Arrange
    const mesh = createUnitCubeMesh();

    // Act
    const result = fillHoles(mesh);

    // Assert
    expect(result.filledHoleCount).toBe(0);
    expect(result.mesh).toBe(mesh);
  });

  it("closes the opening left by a missing face", () => {
    // Arrange
    const mesh = createCubeMissingOneFace();

    // Act
    const result = fillHoles(mesh);

    // Assert
    expect(result.filledHoleCount).toBe(1);
    expect(findBoundaryLoops(result.mesh)).toHaveLength(0);
  });

  it("adds a fan of triangles around the loop centroid", () => {
    // Arrange
    const mesh = createOpenSquareMesh();

    // Act
    const result = fillHoles(mesh);

    // Assert
    expect(result.mesh.triangleCount).toBe(mesh.triangleCount + 4);
    expect(result.mesh.vertexCount).toBe(mesh.vertexCount + 1);
  });
});
