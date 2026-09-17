import type { Mesh } from "../../types/mesh.types.js";
import { findBoundaryLoops } from "../mesh-topology/mesh-topology.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";

export type HoleFillResult = {
  readonly mesh: Mesh;
  readonly filledHoleCount: number;
};

const MAXIMUM_LOOP_LENGTH = 512;

export const fillHoles = (mesh: Mesh): HoleFillResult => {
  const loops = findBoundaryLoops(mesh).filter(
    (loop) => loop.vertexIndices.length <= MAXIMUM_LOOP_LENGTH,
  );

  if (loops.length === 0) return Object.freeze({ mesh, filledHoleCount: 0 });

  const positions = Array.from(mesh.positions);
  const indices = Array.from(mesh.indices);

  for (const loop of loops) {
    const { vertexIndices } = loop;

    let centroidX = 0;
    let centroidY = 0;
    let centroidZ = 0;

    for (const vertexIndex of vertexIndices) {
      centroidX += mesh.positions[vertexIndex * 3];
      centroidY += mesh.positions[vertexIndex * 3 + 1];
      centroidZ += mesh.positions[vertexIndex * 3 + 2];
    }

    const centroidVertexIndex = positions.length / 3;
    positions.push(
      centroidX / vertexIndices.length,
      centroidY / vertexIndices.length,
      centroidZ / vertexIndices.length,
    );

    for (let cursor = 0; cursor < vertexIndices.length; cursor += 1) {
      indices.push(
        centroidVertexIndex,
        vertexIndices[cursor],
        vertexIndices[(cursor + 1) % vertexIndices.length],
      );
    }
  }

  return Object.freeze({
    mesh: createMesh(new Float32Array(positions), new Uint32Array(indices)),
    filledHoleCount: loops.length,
  });
};
