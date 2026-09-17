import { describe, expect, it } from "vitest";
import {
  decomposeSymmetricMatrix,
  type SymmetricMatrix3,
} from "./symmetric-eigen-decomposition.js";

describe("decomposeSymmetricMatrix", () => {
  it("returns the diagonal of a diagonal matrix sorted descending", () => {
    // Arrange
    const matrix: SymmetricMatrix3 = [2, 0, 0, 0, 9, 0, 0, 0, 5];

    // Act
    const pairs = decomposeSymmetricMatrix(matrix);

    // Assert
    expect(pairs.map((pair) => pair.value)).toEqual([9, 5, 2]);
  });

  it("recovers the dominant axis of a rank-one matrix", () => {
    // Arrange
    const matrix: SymmetricMatrix3 = [1, 0, 0, 0, 0, 0, 0, 0, 0];

    // Act
    const pairs = decomposeSymmetricMatrix(matrix);

    // Assert
    expect(pairs[0].value).toBeCloseTo(1, 10);
    expect(Math.abs(pairs[0].vector.x)).toBeCloseTo(1, 10);
  });

  it("produces eigenvectors that satisfy the eigenvalue equation", () => {
    // Arrange
    const matrix: SymmetricMatrix3 = [4, 1, 1, 1, 3, 0, 1, 0, 2];

    // Act
    const pairs = decomposeSymmetricMatrix(matrix);

    // Assert
    pairs.forEach(({ value, vector }) => {
      const transformed = [
        matrix[0] * vector.x + matrix[1] * vector.y + matrix[2] * vector.z,
        matrix[3] * vector.x + matrix[4] * vector.y + matrix[5] * vector.z,
        matrix[6] * vector.x + matrix[7] * vector.y + matrix[8] * vector.z,
      ];
      expect(transformed[0]).toBeCloseTo(value * vector.x, 8);
      expect(transformed[1]).toBeCloseTo(value * vector.y, 8);
      expect(transformed[2]).toBeCloseTo(value * vector.z, 8);
    });
  });
});
