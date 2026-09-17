import type { Vector3 } from "../../../../shared/types/vector.types.js";
import {
  createVector3,
  dotProduct,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
import { getVertexPosition, type Mesh } from "../../../mesh/index.js";

export type PlanePlacement = {
  readonly origin: Vector3;
  readonly firstAxis: Vector3;
  readonly secondAxis: Vector3;
  readonly pitchDegrees: number;
  readonly yawDegrees: number;
};

export type Loop2 = {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly signedArea: number;
};

// The basis must match what build123d's Rot(0, pitch, yaw) produces, so a profile measured here
// lands back in the original coordinate frame when it is placed.
export const createPlanePlacement = (normal: Vector3, origin: Vector3): PlanePlacement => {
  const pitch = Math.acos(Math.min(1, Math.max(-1, normal.z)));
  const yaw = Math.atan2(normal.y, normal.x);

  return Object.freeze({
    origin,
    firstAxis: createVector3(
      Math.cos(pitch) * Math.cos(yaw),
      Math.cos(pitch) * Math.sin(yaw),
      -Math.sin(pitch),
    ),
    secondAxis: createVector3(-Math.sin(yaw), Math.cos(yaw), 0),
    pitchDegrees: (pitch * 180) / Math.PI,
    yawDegrees: (yaw * 180) / Math.PI,
  });
};

const getEdgeKey = (first: number, second: number, vertexCount: number): number =>
  first < second ? first * vertexCount + second : second * vertexCount + first;

// An edge used by exactly one triangle of the subset lies on that face's border, even though the
// mesh as a whole is closed.
export const findFaceBoundaryLoops = (
  mesh: Mesh,
  triangleIndices: readonly number[],
): readonly (readonly number[])[] => {
  const useCounts = new Map<number, number>();
  const directedEdges: Array<readonly [number, number]> = [];

  for (const triangleIndex of triangleIndices) {
    for (let corner = 0; corner < 3; corner += 1) {
      const start = mesh.indices[triangleIndex * 3 + corner];
      const end = mesh.indices[triangleIndex * 3 + ((corner + 1) % 3)];
      const key = getEdgeKey(start, end, mesh.vertexCount);
      useCounts.set(key, (useCounts.get(key) ?? 0) + 1);
      directedEdges.push([start, end]);
    }
  }

  const successorByVertex = new Map<number, number>();
  for (const [start, end] of directedEdges) {
    if (useCounts.get(getEdgeKey(start, end, mesh.vertexCount)) !== 1) continue;
    successorByVertex.set(start, end);
  }

  const loops: number[][] = [];
  const visited = new Set<number>();

  for (const startVertex of successorByVertex.keys()) {
    if (visited.has(startVertex)) continue;

    const loop: number[] = [];
    let current: number | undefined = startVertex;

    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      loop.push(current);
      current = successorByVertex.get(current);
    }

    if (loop.length >= 3) loops.push(loop);
  }

  return Object.freeze(loops);
};

export const projectLoopToPlane = (
  mesh: Mesh,
  loop: readonly number[],
  placement: PlanePlacement,
): Loop2 => {
  const points = loop.map((vertexIndex) => {
    const offset = subtractVectors(getVertexPosition(mesh, vertexIndex), placement.origin);
    return Object.freeze({
      x: dotProduct(offset, placement.firstAxis),
      y: dotProduct(offset, placement.secondAxis),
    });
  });

  let doubledArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    doubledArea += current.x * next.y - next.x * current.y;
  }

  return Object.freeze({ points: Object.freeze(points), signedArea: doubledArea / 2 });
};
