import { describe, expect, it } from "vitest";
import { createUnitCubeMesh, createOpenSquareMesh } from "../mesh-fixtures/mesh-fixtures.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";
import {
  buildTriangleAdjacency,
  buildTriangleAttributes,
  computeBoundingBox,
  findBoundaryLoops,
  getTriangleNormal,
} from "./mesh-topology.js";

describe("buildTriangleAttributes", () => {
  it("computes the total surface area of a cube", () => {
    // Arrange
    const mesh = createUnitCubeMesh(10);

    // Act
    const attributes = buildTriangleAttributes(mesh);

    // Assert
    expect(attributes.totalArea).toBeCloseTo(600, 4);
  });

  it("produces unit-length normals for every triangle", () => {
    // Arrange
    const mesh = createUnitCubeMesh();

    // Act
    const attributes = buildTriangleAttributes(mesh);

    // Assert
    for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
      const offset = triangleIndex * 3;
      const magnitude = Math.hypot(
        attributes.normals[offset],
        attributes.normals[offset + 1],
        attributes.normals[offset + 2],
      );
      expect(magnitude).toBeCloseTo(1, 10);
    }
  });

  it("reports zero area for a degenerate triangle", () => {
    // Arrange
    const mesh = createMesh(
      new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0]),
      new Uint32Array([0, 1, 2]),
    );

    // Act
    const attributes = buildTriangleAttributes(mesh);

    // Assert
    expect(attributes.areas[0]).toBeCloseTo(0, 10);
  });
});

describe("getTriangleNormal", () => {
  it("orients the normal by the right-hand rule of the winding", () => {
    // Arrange
    const mesh = createMesh(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      new Uint32Array([0, 1, 2]),
    );

    // Act
    const normal = getTriangleNormal(mesh, 0);

    // Assert
    expect(normal.z).toBeCloseTo(1, 10);
  });
});

describe("buildTriangleAdjacency", () => {
  it("gives every triangle of a closed cube exactly three neighbours", () => {
    // Arrange
    const mesh = createUnitCubeMesh();

    // Act
    const adjacency = buildTriangleAdjacency(mesh);

    // Assert
    for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
      const neighbourCount =
        adjacency.neighbourOffsets[triangleIndex + 1] - adjacency.neighbourOffsets[triangleIndex];
      expect(neighbourCount).toBe(3);
    }
  });
});

describe("findBoundaryLoops", () => {
  it("finds no boundary loop on a closed mesh", () => {
    // Arrange
    const mesh = createUnitCubeMesh();

    // Act
    const loops = findBoundaryLoops(mesh);

    // Assert
    expect(loops).toHaveLength(0);
  });

  it("finds the outer loop of an open quad", () => {
    // Arrange
    const mesh = createOpenSquareMesh();

    // Act
    const loops = findBoundaryLoops(mesh);

    // Assert
    expect(loops).toHaveLength(1);
    expect(loops[0].vertexIndices).toHaveLength(4);
  });
});

describe("computeBoundingBox", () => {
  it("spans the extents of the mesh", () => {
    // Arrange
    const mesh = createUnitCubeMesh(4);

    // Act
    const boundingBox = computeBoundingBox(mesh);

    // Assert
    expect(boundingBox.minimum).toEqual({ x: -2, y: -2, z: -2 });
    expect(boundingBox.maximum).toEqual({ x: 2, y: 2, z: 2 });
  });
});
