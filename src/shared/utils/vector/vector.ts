import type { Vector3 } from "../../types/vector.types.js";

export const createVector3 = (x: number, y: number, z: number): Vector3 =>
  Object.freeze({ x, y, z });

export const addVectors = (left: Vector3, right: Vector3): Vector3 =>
  createVector3(left.x + right.x, left.y + right.y, left.z + right.z);

export const subtractVectors = (left: Vector3, right: Vector3): Vector3 =>
  createVector3(left.x - right.x, left.y - right.y, left.z - right.z);

export const scaleVector = (vector: Vector3, factor: number): Vector3 =>
  createVector3(vector.x * factor, vector.y * factor, vector.z * factor);

export const dotProduct = (left: Vector3, right: Vector3): number =>
  left.x * right.x + left.y * right.y + left.z * right.z;

export const crossProduct = (left: Vector3, right: Vector3): Vector3 =>
  createVector3(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );

export const getVectorLength = (vector: Vector3): number => Math.sqrt(dotProduct(vector, vector));

export const normalizeVector = (vector: Vector3): Vector3 => {
  const magnitude = getVectorLength(vector);
  if (magnitude === 0) return createVector3(0, 0, 0);
  return scaleVector(vector, 1 / magnitude);
};

export const getDistanceBetweenVectors = (left: Vector3, right: Vector3): number =>
  getVectorLength(subtractVectors(left, right));

export const getAngleBetweenVectorsInDegrees = (left: Vector3, right: Vector3): number => {
  const cosine = dotProduct(normalizeVector(left), normalizeVector(right));
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI;
};

export const getPerpendicularVector = (vector: Vector3): Vector3 => {
  const reference =
    Math.abs(vector.x) < Math.abs(vector.z) ? createVector3(1, 0, 0) : createVector3(0, 0, 1);
  return normalizeVector(crossProduct(vector, reference));
};

export const roundVectorComponents = (vector: Vector3, decimals: number): Vector3 => {
  const factor = 10 ** decimals;
  return createVector3(
    Math.round(vector.x * factor) / factor,
    Math.round(vector.y * factor) / factor,
    Math.round(vector.z * factor) / factor,
  );
};
