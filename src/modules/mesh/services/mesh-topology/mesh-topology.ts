import type { BoundingBox, Vector3 } from "../../../../shared/types/vector.types.js";
import { createVector3 } from "../../../../shared/utils/vector/vector.js";
import type { Mesh } from "../../types/mesh.types.js";

export type TriangleAttributes = {
  readonly normals: Float64Array;
  readonly areas: Float64Array;
  readonly centroids: Float64Array;
  readonly totalArea: number;
};

export type TriangleAdjacency = {
  readonly neighbourOffsets: Uint32Array;
  readonly neighbourIndices: Uint32Array;
};

export type BoundaryLoop = {
  readonly vertexIndices: readonly number[];
};

export const getTriangleCornerPositionOffsets = (
  mesh: Mesh,
  triangleIndex: number,
): readonly [number, number, number] => [
  mesh.indices[triangleIndex * 3] * 3,
  mesh.indices[triangleIndex * 3 + 1] * 3,
  mesh.indices[triangleIndex * 3 + 2] * 3,
];

export const getTriangleNormal = (mesh: Mesh, triangleIndex: number): Vector3 => {
  const [first, second, third] = getTriangleCornerPositionOffsets(mesh, triangleIndex);
  const { positions } = mesh;

  const firstEdgeX = positions[second] - positions[first];
  const firstEdgeY = positions[second + 1] - positions[first + 1];
  const firstEdgeZ = positions[second + 2] - positions[first + 2];
  const secondEdgeX = positions[third] - positions[first];
  const secondEdgeY = positions[third + 1] - positions[first + 1];
  const secondEdgeZ = positions[third + 2] - positions[first + 2];

  const normalX = firstEdgeY * secondEdgeZ - firstEdgeZ * secondEdgeY;
  const normalY = firstEdgeZ * secondEdgeX - firstEdgeX * secondEdgeZ;
  const normalZ = firstEdgeX * secondEdgeY - firstEdgeY * secondEdgeX;
  const magnitude = Math.sqrt(normalX ** 2 + normalY ** 2 + normalZ ** 2);

  if (magnitude === 0) return createVector3(0, 0, 0);
  return createVector3(normalX / magnitude, normalY / magnitude, normalZ / magnitude);
};

export const buildTriangleAttributes = (mesh: Mesh): TriangleAttributes => {
  const normals = new Float64Array(mesh.triangleCount * 3);
  const areas = new Float64Array(mesh.triangleCount);
  const centroids = new Float64Array(mesh.triangleCount * 3);
  const { positions } = mesh;
  let totalArea = 0;

  for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
    const [first, second, third] = getTriangleCornerPositionOffsets(mesh, triangleIndex);

    const firstEdgeX = positions[second] - positions[first];
    const firstEdgeY = positions[second + 1] - positions[first + 1];
    const firstEdgeZ = positions[second + 2] - positions[first + 2];
    const secondEdgeX = positions[third] - positions[first];
    const secondEdgeY = positions[third + 1] - positions[first + 1];
    const secondEdgeZ = positions[third + 2] - positions[first + 2];

    const crossX = firstEdgeY * secondEdgeZ - firstEdgeZ * secondEdgeY;
    const crossY = firstEdgeZ * secondEdgeX - firstEdgeX * secondEdgeZ;
    const crossZ = firstEdgeX * secondEdgeY - firstEdgeY * secondEdgeX;
    const magnitude = Math.sqrt(crossX ** 2 + crossY ** 2 + crossZ ** 2);

    const writeOffset = triangleIndex * 3;
    if (magnitude > 0) {
      normals[writeOffset] = crossX / magnitude;
      normals[writeOffset + 1] = crossY / magnitude;
      normals[writeOffset + 2] = crossZ / magnitude;
    }

    areas[triangleIndex] = magnitude / 2;
    totalArea += magnitude / 2;

    centroids[writeOffset] = (positions[first] + positions[second] + positions[third]) / 3;
    centroids[writeOffset + 1] =
      (positions[first + 1] + positions[second + 1] + positions[third + 1]) / 3;
    centroids[writeOffset + 2] =
      (positions[first + 2] + positions[second + 2] + positions[third + 2]) / 3;
  }

  return Object.freeze({ normals, areas, centroids, totalArea });
};

const getEdgeKey = (firstVertex: number, secondVertex: number, vertexCount: number): number =>
  firstVertex < secondVertex
    ? firstVertex * vertexCount + secondVertex
    : secondVertex * vertexCount + firstVertex;

export const buildTriangleAdjacency = (mesh: Mesh): TriangleAdjacency => {
  const trianglesByEdge = new Map<number, number[]>();

  for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
    for (let cornerIndex = 0; cornerIndex < 3; cornerIndex += 1) {
      const key = getEdgeKey(
        mesh.indices[triangleIndex * 3 + cornerIndex],
        mesh.indices[triangleIndex * 3 + ((cornerIndex + 1) % 3)],
        mesh.vertexCount,
      );
      const existing = trianglesByEdge.get(key);
      if (existing) {
        existing.push(triangleIndex);
        continue;
      }
      trianglesByEdge.set(key, [triangleIndex]);
    }
  }

  const neighbourCounts = new Uint32Array(mesh.triangleCount);
  for (const incidentTriangles of trianglesByEdge.values()) {
    if (incidentTriangles.length < 2) continue;
    for (const triangleIndex of incidentTriangles) {
      neighbourCounts[triangleIndex] += incidentTriangles.length - 1;
    }
  }

  const neighbourOffsets = new Uint32Array(mesh.triangleCount + 1);
  for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
    neighbourOffsets[triangleIndex + 1] =
      neighbourOffsets[triangleIndex] + neighbourCounts[triangleIndex];
  }

  const writeCursors = Uint32Array.from(neighbourOffsets.subarray(0, mesh.triangleCount));
  const neighbourIndices = new Uint32Array(neighbourOffsets[mesh.triangleCount]);

  for (const incidentTriangles of trianglesByEdge.values()) {
    if (incidentTriangles.length < 2) continue;
    for (const triangleIndex of incidentTriangles) {
      for (const neighbourIndex of incidentTriangles) {
        if (neighbourIndex === triangleIndex) continue;
        neighbourIndices[writeCursors[triangleIndex]] = neighbourIndex;
        writeCursors[triangleIndex] += 1;
      }
    }
  }

  return Object.freeze({ neighbourOffsets, neighbourIndices });
};

export const findBoundaryLoops = (mesh: Mesh): readonly BoundaryLoop[] => {
  const edgeUseCounts = new Map<number, number>();

  for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
    for (let cornerIndex = 0; cornerIndex < 3; cornerIndex += 1) {
      const key = getEdgeKey(
        mesh.indices[triangleIndex * 3 + cornerIndex],
        mesh.indices[triangleIndex * 3 + ((cornerIndex + 1) % 3)],
        mesh.vertexCount,
      );
      edgeUseCounts.set(key, (edgeUseCounts.get(key) ?? 0) + 1);
    }
  }

  const successorByVertex = new Map<number, number>();

  for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
    for (let cornerIndex = 0; cornerIndex < 3; cornerIndex += 1) {
      const startVertex = mesh.indices[triangleIndex * 3 + cornerIndex];
      const endVertex = mesh.indices[triangleIndex * 3 + ((cornerIndex + 1) % 3)];
      if (edgeUseCounts.get(getEdgeKey(startVertex, endVertex, mesh.vertexCount)) !== 1) continue;
      // The hole is traversed opposite to the triangle winding, so the loop runs end -> start.
      successorByVertex.set(endVertex, startVertex);
    }
  }

  const loops: BoundaryLoop[] = [];
  const visitedVertices = new Set<number>();

  for (const startVertex of successorByVertex.keys()) {
    if (visitedVertices.has(startVertex)) continue;

    const vertexIndices: number[] = [];
    let currentVertex: number | undefined = startVertex;

    while (currentVertex !== undefined && !visitedVertices.has(currentVertex)) {
      visitedVertices.add(currentVertex);
      vertexIndices.push(currentVertex);
      currentVertex = successorByVertex.get(currentVertex);
    }

    if (vertexIndices.length >= 3) loops.push(Object.freeze({ vertexIndices }));
  }

  return Object.freeze(loops);
};

export const computeBoundingBox = (mesh: Mesh): BoundingBox => {
  let minimumX = Infinity;
  let minimumY = Infinity;
  let minimumZ = Infinity;
  let maximumX = -Infinity;
  let maximumY = -Infinity;
  let maximumZ = -Infinity;

  for (let offset = 0; offset < mesh.positions.length; offset += 3) {
    minimumX = Math.min(minimumX, mesh.positions[offset]);
    minimumY = Math.min(minimumY, mesh.positions[offset + 1]);
    minimumZ = Math.min(minimumZ, mesh.positions[offset + 2]);
    maximumX = Math.max(maximumX, mesh.positions[offset]);
    maximumY = Math.max(maximumY, mesh.positions[offset + 1]);
    maximumZ = Math.max(maximumZ, mesh.positions[offset + 2]);
  }

  return Object.freeze({
    minimum: createVector3(minimumX, minimumY, minimumZ),
    maximum: createVector3(maximumX, maximumY, maximumZ),
  });
};

export const getVertexPosition = (mesh: Mesh, vertexIndex: number): Vector3 =>
  createVector3(
    mesh.positions[vertexIndex * 3],
    mesh.positions[vertexIndex * 3 + 1],
    mesh.positions[vertexIndex * 3 + 2],
  );
