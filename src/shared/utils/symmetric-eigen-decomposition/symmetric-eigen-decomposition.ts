import type { Vector3 } from "../../types/vector.types.js";
import { createVector3 } from "../vector/vector.js";

export type SymmetricMatrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type EigenPair = {
  readonly value: number;
  readonly vector: Vector3;
};

const MAXIMUM_SWEEPS = 64;
const CONVERGENCE_EPSILON = 1e-12;

const rotate = (
  matrix: number[],
  vectors: number[],
  rowIndex: number,
  columnIndex: number,
): void => {
  const diagonalDifference =
    matrix[columnIndex * 3 + columnIndex] - matrix[rowIndex * 3 + rowIndex];
  const offDiagonal = matrix[rowIndex * 3 + columnIndex];
  const theta = diagonalDifference / (2 * offDiagonal);
  const signedTheta = theta >= 0 ? 1 : -1;
  const tangent = signedTheta / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const cosine = 1 / Math.sqrt(tangent * tangent + 1);
  const sine = tangent * cosine;

  for (let index = 0; index < 3; index += 1) {
    const rowValue = matrix[rowIndex * 3 + index];
    const columnValue = matrix[columnIndex * 3 + index];
    matrix[rowIndex * 3 + index] = cosine * rowValue - sine * columnValue;
    matrix[columnIndex * 3 + index] = sine * rowValue + cosine * columnValue;
  }

  for (let index = 0; index < 3; index += 1) {
    const rowValue = matrix[index * 3 + rowIndex];
    const columnValue = matrix[index * 3 + columnIndex];
    matrix[index * 3 + rowIndex] = cosine * rowValue - sine * columnValue;
    matrix[index * 3 + columnIndex] = sine * rowValue + cosine * columnValue;
  }

  for (let index = 0; index < 3; index += 1) {
    const rowValue = vectors[index * 3 + rowIndex];
    const columnValue = vectors[index * 3 + columnIndex];
    vectors[index * 3 + rowIndex] = cosine * rowValue - sine * columnValue;
    vectors[index * 3 + columnIndex] = sine * rowValue + cosine * columnValue;
  }
};

export const decomposeSymmetricMatrix = (input: SymmetricMatrix3): readonly EigenPair[] => {
  const matrix = [...input];
  const vectors = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  for (let sweep = 0; sweep < MAXIMUM_SWEEPS; sweep += 1) {
    const offDiagonalMagnitude = Math.abs(matrix[1]) + Math.abs(matrix[2]) + Math.abs(matrix[5]);
    if (offDiagonalMagnitude < CONVERGENCE_EPSILON) break;

    if (Math.abs(matrix[1]) > CONVERGENCE_EPSILON) rotate(matrix, vectors, 0, 1);
    if (Math.abs(matrix[2]) > CONVERGENCE_EPSILON) rotate(matrix, vectors, 0, 2);
    if (Math.abs(matrix[5]) > CONVERGENCE_EPSILON) rotate(matrix, vectors, 1, 2);
  }

  const pairs = [0, 1, 2].map((index) =>
    Object.freeze({
      value: matrix[index * 3 + index],
      vector: createVector3(vectors[index], vectors[3 + index], vectors[6 + index]),
    }),
  );

  return Object.freeze([...pairs].sort((left, right) => right.value - left.value));
};
