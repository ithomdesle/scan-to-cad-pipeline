import { describe, expect, it } from "vitest";
import { createMesh, weldVertices } from "./vertex-welder.js";

describe("weldVertices", () => {
  it("collapses duplicate positions into a single vertex", () => {
    // Arrange
    const vertexStream = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    // Act
    const mesh = weldVertices(vertexStream, 1e-5);

    // Assert
    expect(mesh.vertexCount).toBe(4);
    expect(mesh.triangleCount).toBe(2);
  });

  it("keeps positions that differ by more than the tolerance", () => {
    // Arrange
    const vertexStream = [0, 0, 0, 0.01, 0, 0, 0, 1, 0];

    // Act
    const mesh = weldVertices(vertexStream, 1e-5);

    // Assert
    expect(mesh.vertexCount).toBe(3);
  });

  it("preserves the winding order of every triangle", () => {
    // Arrange
    const vertexStream = [0, 0, 0, 1, 0, 0, 0, 1, 0];

    // Act
    const mesh = weldVertices(vertexStream, 1e-5);

    // Assert
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
  });
});

describe("createMesh", () => {
  it("derives counts from the supplied buffers", () => {
    // Arrange
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices = new Uint32Array([0, 1, 2]);

    // Act
    const mesh = createMesh(positions, indices);

    // Assert
    expect(mesh.vertexCount).toBe(3);
    expect(mesh.triangleCount).toBe(1);
    expect(Object.isFrozen(mesh)).toBe(true);
  });
});
