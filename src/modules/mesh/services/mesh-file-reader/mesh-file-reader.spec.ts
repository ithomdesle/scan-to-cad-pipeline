import { describe, expect, it } from "vitest";
import { createUnitCubeMesh } from "../mesh-fixtures/mesh-fixtures.js";
import { writeBinaryStereolithography } from "../binary-stereolithography-writer/binary-stereolithography-writer.js";
import { readMeshFromBuffer } from "./mesh-file-reader.js";

describe("readMeshFromBuffer", () => {
  it("round-trips a cube through the binary STL writer and reader", () => {
    // Arrange
    const originalMesh = createUnitCubeMesh(10);
    const fileContents = writeBinaryStereolithography(originalMesh);

    // Act
    const parsedMesh = readMeshFromBuffer(fileContents, ".stl");

    // Assert
    expect(parsedMesh.triangleCount).toBe(12);
    expect(parsedMesh.vertexCount).toBe(8);
  });

  it("parses an ASCII STL triangle", () => {
    // Arrange
    const asciiContents = Buffer.from(
      [
        "solid test",
        "facet normal 0 0 1",
        "  outer loop",
        "    vertex 0 0 0",
        "    vertex 1 0 0",
        "    vertex 0 1 0",
        "  endloop",
        "endfacet",
        "endsolid test",
      ].join("\n"),
      "utf8",
    );

    // Act
    const mesh = readMeshFromBuffer(asciiContents, ".stl");

    // Assert
    expect(mesh.triangleCount).toBe(1);
    expect(mesh.vertexCount).toBe(3);
  });

  it("triangulates an OBJ quad face into two triangles", () => {
    // Arrange
    const objectContents = Buffer.from(
      ["v 0 0 0", "v 1 0 0", "v 1 1 0", "v 0 1 0", "f 1 2 3 4"].join("\n"),
      "utf8",
    );

    // Act
    const mesh = readMeshFromBuffer(objectContents, ".obj");

    // Assert
    expect(mesh.triangleCount).toBe(2);
    expect(mesh.vertexCount).toBe(4);
  });

  it("resolves negative OBJ vertex references relative to the end", () => {
    // Arrange
    const objectContents = Buffer.from(
      ["v 0 0 0", "v 1 0 0", "v 0 1 0", "f -3 -2 -1"].join("\n"),
      "utf8",
    );

    // Act
    const mesh = readMeshFromBuffer(objectContents, ".obj");

    // Assert
    expect(mesh.triangleCount).toBe(1);
  });

  it("rejects an unsupported extension", () => {
    // Arrange
    const fileContents = Buffer.from("anything", "utf8");

    // Act
    const act = () => readMeshFromBuffer(fileContents, ".ply");

    // Assert
    expect(act).toThrow(/Unsupported mesh file/);
  });
});
