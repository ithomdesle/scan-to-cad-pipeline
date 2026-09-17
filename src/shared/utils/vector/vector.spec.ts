import { describe, expect, it } from "vitest";
import {
  createVector3,
  crossProduct,
  dotProduct,
  getAngleBetweenVectorsInDegrees,
  getPerpendicularVector,
  getVectorLength,
  normalizeVector,
  subtractVectors,
} from "./vector.js";

describe("vector", () => {
  it("creates frozen vectors", () => {
    // Arrange
    const vector = createVector3(1, 2, 3);

    // Act
    const isFrozen = Object.isFrozen(vector);

    // Assert
    expect(isFrozen).toBe(true);
  });

  it("computes the cross product following the right-hand rule", () => {
    // Arrange
    const unitX = createVector3(1, 0, 0);
    const unitY = createVector3(0, 1, 0);

    // Act
    const result = crossProduct(unitX, unitY);

    // Assert
    expect(result).toEqual(createVector3(0, 0, 1));
  });

  it("normalizes a vector to unit length", () => {
    // Arrange
    const vector = createVector3(0, 3, 4);

    // Act
    const normalized = normalizeVector(vector);

    // Assert
    expect(getVectorLength(normalized)).toBeCloseTo(1, 10);
  });

  it("returns a zero vector when normalizing a zero vector", () => {
    // Arrange
    const vector = createVector3(0, 0, 0);

    // Act
    const normalized = normalizeVector(vector);

    // Assert
    expect(normalized).toEqual(createVector3(0, 0, 0));
  });

  it("measures the angle between two orthogonal vectors as ninety degrees", () => {
    // Arrange
    const first = createVector3(1, 0, 0);
    const second = createVector3(0, 5, 0);

    // Act
    const angle = getAngleBetweenVectorsInDegrees(first, second);

    // Assert
    expect(angle).toBeCloseTo(90, 10);
  });

  it("returns a perpendicular unit vector for any axis", () => {
    // Arrange
    const axis = normalizeVector(createVector3(1, 1, 1));

    // Act
    const perpendicular = getPerpendicularVector(axis);

    // Assert
    expect(dotProduct(axis, perpendicular)).toBeCloseTo(0, 10);
    expect(getVectorLength(perpendicular)).toBeCloseTo(1, 10);
  });

  it("subtracts componentwise", () => {
    // Arrange
    const left = createVector3(5, 5, 5);
    const right = createVector3(1, 2, 3);

    // Act
    const result = subtractVectors(left, right);

    // Assert
    expect(result).toEqual(createVector3(4, 3, 2));
  });
});
