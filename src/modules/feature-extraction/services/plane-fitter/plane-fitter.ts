import type { Vector3 } from "../../../../shared/types/vector.types.js";
import {
  createVector3,
  dotProduct,
  normalizeVector,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
import {
  decomposeSymmetricMatrix,
  type SymmetricMatrix3,
} from "../../../../shared/utils/symmetric-eigen-decomposition/symmetric-eigen-decomposition.js";
import type { TriangleAttributes } from "../../../mesh/services/mesh-topology/mesh-topology.js";

export type PlaneFit = {
  readonly normal: Vector3;
  readonly origin: Vector3;
  readonly residual: number;
};

export const fitPlane = (
  attributes: TriangleAttributes,
  triangleIndices: readonly number[],
): PlaneFit => {
  let totalWeight = 0;
  let centroidX = 0;
  let centroidY = 0;
  let centroidZ = 0;

  for (const triangleIndex of triangleIndices) {
    const weight = attributes.areas[triangleIndex];
    totalWeight += weight;
    centroidX += attributes.centroids[triangleIndex * 3] * weight;
    centroidY += attributes.centroids[triangleIndex * 3 + 1] * weight;
    centroidZ += attributes.centroids[triangleIndex * 3 + 2] * weight;
  }

  if (totalWeight === 0) {
    return Object.freeze({
      normal: createVector3(0, 0, 1),
      origin: createVector3(0, 0, 0),
      residual: Infinity,
    });
  }

  const origin = createVector3(
    centroidX / totalWeight,
    centroidY / totalWeight,
    centroidZ / totalWeight,
  );

  const covariance = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (const triangleIndex of triangleIndices) {
    const weight = attributes.areas[triangleIndex];
    const offsetX = attributes.centroids[triangleIndex * 3] - origin.x;
    const offsetY = attributes.centroids[triangleIndex * 3 + 1] - origin.y;
    const offsetZ = attributes.centroids[triangleIndex * 3 + 2] - origin.z;

    covariance[0] += weight * offsetX * offsetX;
    covariance[1] += weight * offsetX * offsetY;
    covariance[2] += weight * offsetX * offsetZ;
    covariance[4] += weight * offsetY * offsetY;
    covariance[5] += weight * offsetY * offsetZ;
    covariance[8] += weight * offsetZ * offsetZ;
  }

  covariance[3] = covariance[1];
  covariance[6] = covariance[2];
  covariance[7] = covariance[5];

  const eigenPairs = decomposeSymmetricMatrix(covariance as unknown as SymmetricMatrix3);
  const fittedNormal = normalizeVector(eigenPairs[2].vector);

  // The eigenvector sign is arbitrary, so it is flipped to agree with the surface winding.
  let outwardAgreement = 0;
  for (const triangleIndex of triangleIndices) {
    outwardAgreement +=
      attributes.areas[triangleIndex] *
      (fittedNormal.x * attributes.normals[triangleIndex * 3] +
        fittedNormal.y * attributes.normals[triangleIndex * 3 + 1] +
        fittedNormal.z * attributes.normals[triangleIndex * 3 + 2]);
  }

  const normal =
    outwardAgreement >= 0
      ? fittedNormal
      : createVector3(-fittedNormal.x, -fittedNormal.y, -fittedNormal.z);

  let residual = 0;
  for (const triangleIndex of triangleIndices) {
    const centroid = createVector3(
      attributes.centroids[triangleIndex * 3],
      attributes.centroids[triangleIndex * 3 + 1],
      attributes.centroids[triangleIndex * 3 + 2],
    );
    residual +=
      attributes.areas[triangleIndex] *
      Math.abs(dotProduct(subtractVectors(centroid, origin), normal));
  }

  return Object.freeze({ normal, origin, residual: residual / totalWeight });
};
