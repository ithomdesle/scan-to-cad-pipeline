import { describe, expect, it } from "vitest";
import { createPlateMesh, createUnitCubeMesh, createWasherMesh } from "../../../mesh/index.js";
import {
  DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS,
  reconstructPolyhedron,
} from "./polyhedral-reconstructor.js";

describe("reconstructPolyhedron", () => {
  it("merges the tessellated faces of a cube back into six", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const solid = reconstructPolyhedron(mesh, DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS);

    // Assert
    expect(solid.faces).toHaveLength(6);
    expect(solid.triangleFaceCount).toBe(0);
  });

  it("gives every face of a cube four corners", () => {
    // Arrange
    const mesh = createUnitCubeMesh(30);

    // Act
    const solid = reconstructPolyhedron(mesh, DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS);

    // Assert
    solid.faces.forEach((face) => expect(face.outer).toHaveLength(4));
  });

  it("carries a plate's cutouts as inner loops rather than separate faces", () => {
    // Arrange
    const mesh = createPlateMesh({
      width: 120,
      depth: 60,
      thickness: 3,
      cutouts: [
        { left: 20, bottom: 20, right: 40, top: 40 },
        { left: 70, bottom: 20, right: 90, top: 40 },
      ],
    });

    // Act
    const solid = reconstructPolyhedron(mesh, DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS);

    // Assert
    const facesWithHoles = solid.faces.filter((face) => face.inners.length > 0);
    expect(facesWithHoles).toHaveLength(2);
    expect(facesWithHoles[0].inners).toHaveLength(2);
  });

  it("keeps each facet of a curved surface as its own face", () => {
    // Arrange
    const mesh = createWasherMesh({
      outerRadius: 20,
      innerRadius: 6,
      height: 8,
      segmentCount: 48,
    });

    // Act
    const solid = reconstructPolyhedron(mesh, DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS);

    // Assert: one face per facet, not one flat face across the curve and not one per triangle
    expect(solid.faces.length).toBeGreaterThan(50);
    expect(solid.faces.length).toBeLessThan(mesh.triangleCount);
  });
});
