import type { Vector3 } from "../../../../shared/types/vector.types.js";
import {
  createVector3,
  dotProduct,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
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

  // The normal comes from the triangles' own orientations rather than a covariance of their
  // centroids: a face of two triangles has only two centroids, which do not determine a plane, and
  // the eigen solver then returns an arbitrary direction out of the null space.
  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;

  for (const triangleIndex of triangleIndices) {
    const weight = attributes.areas[triangleIndex];
    normalX += weight * attributes.normals[triangleIndex * 3];
    normalY += weight * attributes.normals[triangleIndex * 3 + 1];
    normalZ += weight * attributes.normals[triangleIndex * 3 + 2];
  }

  const normalLength = Math.sqrt(normalX ** 2 + normalY ** 2 + normalZ ** 2);
  if (normalLength === 0) {
    return Object.freeze({ normal: createVector3(0, 0, 1), origin, residual: Infinity });
  }

  const normal = createVector3(
    normalX / normalLength,
    normalY / normalLength,
    normalZ / normalLength,
  );

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
