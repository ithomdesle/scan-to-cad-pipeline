import { describe, expect, it } from "vitest";
import { createUnitCubeMesh } from "../mesh-fixtures/mesh-fixtures.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";
import { findConnectedComponents, removeSmallComponents } from "./connected-component-filter.js";

const createCubeWithDetachedSpeck = () => {
  const cube = createUnitCubeMesh(10);
  const positions = new Float32Array([...cube.positions, 50, 50, 50, 50.1, 50, 50, 50, 50.1, 50]);
  const speckStart = cube.vertexCount;
  const indices = new Uint32Array([...cube.indices, speckStart, speckStart + 1, speckStart + 2]);
  return createMesh(positions, indices);
};

describe("findConnectedComponents", () => {
  it("returns a single component for a closed cube", () => {
    // Arrange
    const mesh = createUnitCubeMesh();

    // Act
    const components = findConnectedComponents(mesh);

    // Assert
    expect(components).toHaveLength(1);
  });

  it("separates a detached speck from the main body", () => {
    // Arrange
    const mesh = createCubeWithDetachedSpeck();

    // Act
    const components = findConnectedComponents(mesh);

    // Assert
    expect(components).toHaveLength(2);
  });
});

describe("removeSmallComponents", () => {
  it("drops a speck whose area is below the fraction threshold", () => {
    // Arrange
    const mesh = createCubeWithDetachedSpeck();

    // Act
    const result = removeSmallComponents(mesh, 0.01);

    // Assert
    expect(result.removedComponentCount).toBe(1);
    expect(result.mesh.triangleCount).toBe(12);
  });

  it("keeps every component when the threshold is zero", () => {
    // Arrange
    const mesh = createCubeWithDetachedSpeck();

    // Act
    const result = removeSmallComponents(mesh, 0);

    // Assert
    expect(result.removedComponentCount).toBe(0);
    expect(result.mesh.triangleCount).toBe(13);
  });

  it("keeps the largest component even when the threshold excludes everything", () => {
    // Arrange
    const mesh = createCubeWithDetachedSpeck();

    // Act
    const result = removeSmallComponents(mesh, 1.5);

    // Assert
    expect(result.mesh.triangleCount).toBe(12);
  });
});
