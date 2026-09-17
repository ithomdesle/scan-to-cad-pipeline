import type { Vector3 } from "../../../../shared/types/vector.types.js";
import {
  addVectors,
  createVector3,
  crossProduct,
  dotProduct,
  getPerpendicularVector,
  normalizeVector,
  scaleVector,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
import {
  decomposeSymmetricMatrix,
  type SymmetricMatrix3,
} from "../../../../shared/utils/symmetric-eigen-decomposition/symmetric-eigen-decomposition.js";
import type { TriangleAttributes } from "../../../mesh/services/mesh-topology/mesh-topology.js";
import { getVertexPosition, type Mesh } from "../../../mesh/index.js";

export type CylinderFit = {
  readonly axis: Vector3;
  readonly basePoint: Vector3;
  readonly radius: number;
  readonly height: number;
  readonly isConcave: boolean;
  readonly residual: number;
};

const solveThreeByThree = (
  matrix: readonly number[],
  rightHandSide: readonly number[],
): readonly number[] | null => {
  const working = [
    [matrix[0], matrix[1], matrix[2], rightHandSide[0]],
    [matrix[3], matrix[4], matrix[5], rightHandSide[1]],
    [matrix[6], matrix[7], matrix[8], rightHandSide[2]],
  ];

  for (let pivotIndex = 0; pivotIndex < 3; pivotIndex += 1) {
    let bestRow = pivotIndex;
    for (let rowIndex = pivotIndex + 1; rowIndex < 3; rowIndex += 1) {
      if (Math.abs(working[rowIndex][pivotIndex]) > Math.abs(working[bestRow][pivotIndex])) {
        bestRow = rowIndex;
      }
    }

    if (Math.abs(working[bestRow][pivotIndex]) < 1e-12) return null;

    const swap = working[pivotIndex];
    working[pivotIndex] = working[bestRow];
    working[bestRow] = swap;

    for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      if (rowIndex === pivotIndex) continue;
      const factor = working[rowIndex][pivotIndex] / working[pivotIndex][pivotIndex];
      for (let columnIndex = pivotIndex; columnIndex < 4; columnIndex += 1) {
        working[rowIndex][columnIndex] -= factor * working[pivotIndex][columnIndex];
      }
    }
  }

  return [
    working[0][3] / working[0][0],
    working[1][3] / working[1][1],
    working[2][3] / working[2][2],
  ];
};

const estimateAxis = (
  attributes: TriangleAttributes,
  triangleIndices: readonly number[],
): Vector3 => {
  const covariance = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (const triangleIndex of triangleIndices) {
    const weight = attributes.areas[triangleIndex];
    const normalX = attributes.normals[triangleIndex * 3];
    const normalY = attributes.normals[triangleIndex * 3 + 1];
    const normalZ = attributes.normals[triangleIndex * 3 + 2];

    covariance[0] += weight * normalX * normalX;
    covariance[1] += weight * normalX * normalY;
    covariance[2] += weight * normalX * normalZ;
    covariance[4] += weight * normalY * normalY;
    covariance[5] += weight * normalY * normalZ;
    covariance[8] += weight * normalZ * normalZ;
  }

  covariance[3] = covariance[1];
  covariance[6] = covariance[2];
  covariance[7] = covariance[5];

  // Every normal of a cylinder is perpendicular to its axis, so the axis is the direction the
  // normals never span: the eigenvector of the smallest eigenvalue.
  const eigenPairs = decomposeSymmetricMatrix(covariance as unknown as SymmetricMatrix3);
  return normalizeVector(eigenPairs[2].vector);
};

const collectSegmentVertexIndices = (
  mesh: Mesh,
  triangleIndices: readonly number[],
): readonly number[] => {
  const vertexIndices = new Set<number>();
  for (const triangleIndex of triangleIndices) {
    vertexIndices.add(mesh.indices[triangleIndex * 3]);
    vertexIndices.add(mesh.indices[triangleIndex * 3 + 1]);
    vertexIndices.add(mesh.indices[triangleIndex * 3 + 2]);
  }
  return Array.from(vertexIndices);
};

// The circle and the axial extent are fitted to vertices rather than centroids: on a faceted
// cylinder a centroid lies on the chord, inside the true surface, which biases both low.
export const fitCylinder = (
  mesh: Mesh,
  attributes: TriangleAttributes,
  triangleIndices: readonly number[],
): CylinderFit | null => {
  if (triangleIndices.length < 8) return null;

  const axis = estimateAxis(attributes, triangleIndices);
  if (axis.x === 0 && axis.y === 0 && axis.z === 0) return null;

  const firstBasis = getPerpendicularVector(axis);
  const secondBasis = normalizeVector(crossProduct(axis, firstBasis));

  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;
  let sumSquaredRadius = 0;
  let sumAtimesSquaredRadius = 0;
  let sumBtimesSquaredRadius = 0;
  let sampleCount = 0;
  let minimumAxial = Infinity;
  let maximumAxial = -Infinity;

  for (const vertexIndex of collectSegmentVertexIndices(mesh, triangleIndices)) {
    const position = getVertexPosition(mesh, vertexIndex);
    const first = dotProduct(position, firstBasis);
    const second = dotProduct(position, secondBasis);
    const axial = dotProduct(position, axis);

    const squaredRadius = first * first + second * second;
    sumA += first;
    sumB += second;
    sumAA += first * first;
    sumBB += second * second;
    sumAB += first * second;
    sumSquaredRadius += squaredRadius;
    sumAtimesSquaredRadius += first * squaredRadius;
    sumBtimesSquaredRadius += second * squaredRadius;
    sampleCount += 1;
    minimumAxial = Math.min(minimumAxial, axial);
    maximumAxial = Math.max(maximumAxial, axial);
  }

  if (sampleCount < 3) return null;

  // Kasa circle fit in the plane perpendicular to the axis.
  const solution = solveThreeByThree(
    [sumAA, sumAB, sumA, sumAB, sumBB, sumB, sumA, sumB, sampleCount],
    [sumAtimesSquaredRadius, sumBtimesSquaredRadius, sumSquaredRadius],
  );

  if (!solution) return null;

  const centreFirst = solution[0] / 2;
  const centreSecond = solution[1] / 2;
  const radiusSquared = solution[2] + centreFirst * centreFirst + centreSecond * centreSecond;
  if (!Number.isFinite(radiusSquared) || radiusSquared <= 0) return null;

  const radius = Math.sqrt(radiusSquared);

  let residual = 0;
  let concaveAgreement = 0;

  for (const triangleIndex of triangleIndices) {
    const centroid = createVector3(
      attributes.centroids[triangleIndex * 3],
      attributes.centroids[triangleIndex * 3 + 1],
      attributes.centroids[triangleIndex * 3 + 2],
    );
    const radialFirst = dotProduct(centroid, firstBasis) - centreFirst;
    const radialSecond = dotProduct(centroid, secondBasis) - centreSecond;
    residual += Math.abs(Math.hypot(radialFirst, radialSecond) - radius);

    const outwardRadial = addVectors(
      scaleVector(firstBasis, radialFirst),
      scaleVector(secondBasis, radialSecond),
    );
    const normal = createVector3(
      attributes.normals[triangleIndex * 3],
      attributes.normals[triangleIndex * 3 + 1],
      attributes.normals[triangleIndex * 3 + 2],
    );
    concaveAgreement += dotProduct(normalizeVector(outwardRadial), normal) < 0 ? 1 : -1;
  }

  const centreInSpace = addVectors(
    scaleVector(firstBasis, centreFirst),
    scaleVector(secondBasis, centreSecond),
  );

  return Object.freeze({
    axis,
    basePoint: addVectors(centreInSpace, scaleVector(axis, minimumAxial)),
    radius,
    height: maximumAxial - minimumAxial,
    isConcave: concaveAgreement > 0,
    residual: residual / triangleIndices.length,
  });
};

export const getCylinderTopPoint = (fit: CylinderFit): Vector3 =>
  addVectors(fit.basePoint, scaleVector(fit.axis, fit.height));

export const getExtentAlongDirection = (
  direction: Vector3,
  minimumCorner: Vector3,
  maximumCorner: Vector3,
): number => {
  const halfSpan = scaleVector(subtractVectors(maximumCorner, minimumCorner), 0.5);
  return (
    2 *
    (Math.abs(direction.x * halfSpan.x) +
      Math.abs(direction.y * halfSpan.y) +
      Math.abs(direction.z * halfSpan.z))
  );
};
