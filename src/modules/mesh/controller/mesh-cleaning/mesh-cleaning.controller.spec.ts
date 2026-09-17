import { describe, expect, it } from "vitest";
import { createUnitCubeMesh } from "../../services/mesh-fixtures/mesh-fixtures.js";
import { createMesh } from "../../services/vertex-welder/vertex-welder.js";
import { createMeshCleaningController } from "./mesh-cleaning.controller.js";

const cleaningOptions = {
  targetTriangleCount: 100000,
  simplificationErrorTolerance: 0.01,
  smallComponentAreaFraction: 0.01,
  isFillHolesEnabled: true,
  weldingTolerance: 1e-5,
};

describe("createMeshCleaningController", () => {
  it("leaves a clean cube unchanged", async () => {
    // Arrange
    const controller = createMeshCleaningController();
    const mesh = createUnitCubeMesh(10);

    // Act
    const result = await controller.clean(mesh, cleaningOptions);

    // Assert
    expect(result.report.outputTriangleCount).toBe(12);
    expect(result.report.filledHoleCount).toBe(0);
    expect(result.report.removedComponentCount).toBe(0);
  });

  it("closes an open cube when hole filling is enabled", async () => {
    // Arrange
    const controller = createMeshCleaningController();
    const cube = createUnitCubeMesh(10);
    const openMesh = createMesh(cube.positions, cube.indices.slice(0, cube.indices.length - 6));

    // Act
    const result = await controller.clean(openMesh, cleaningOptions);

    // Assert
    expect(result.report.filledHoleCount).toBe(1);
  });

  it("skips hole filling when disabled", async () => {
    // Arrange
    const controller = createMeshCleaningController();
    const cube = createUnitCubeMesh(10);
    const openMesh = createMesh(cube.positions, cube.indices.slice(0, cube.indices.length - 6));

    // Act
    const result = await controller.clean(openMesh, {
      ...cleaningOptions,
      isFillHolesEnabled: false,
    });

    // Assert
    expect(result.report.filledHoleCount).toBe(0);
    expect(result.report.outputTriangleCount).toBe(10);
  });

  it("decimates a dense mesh toward the target triangle count", async () => {
    // Arrange
    const controller = createMeshCleaningController();
    const subdivisions = 60;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= subdivisions; row += 1) {
      for (let column = 0; column <= subdivisions; column += 1) {
        positions.push(column, row, Math.sin(column / 6) * 2);
      }
    }
    for (let row = 0; row < subdivisions; row += 1) {
      for (let column = 0; column < subdivisions; column += 1) {
        const corner = row * (subdivisions + 1) + column;
        indices.push(corner, corner + 1, corner + subdivisions + 2);
        indices.push(corner, corner + subdivisions + 2, corner + subdivisions + 1);
      }
    }
    const denseMesh = createMesh(new Float32Array(positions), new Uint32Array(indices));

    // Act
    const result = await controller.clean(denseMesh, {
      ...cleaningOptions,
      targetTriangleCount: 400,
      isFillHolesEnabled: false,
    });

    // Assert
    expect(denseMesh.triangleCount).toBe(7200);
    expect(result.report.simplifiedTriangleCount).toBeLessThan(1000);
    expect(result.report.simplifiedTriangleCount).toBeGreaterThan(0);
  });
});
