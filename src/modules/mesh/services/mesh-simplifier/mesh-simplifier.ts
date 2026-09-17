import { MeshoptSimplifier } from "meshoptimizer";
import type { Mesh } from "../../types/mesh.types.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";

const POSITION_STRIDE = 3;

const compactUnusedVertices = (mesh: Mesh): Mesh => {
  const remap = new Int32Array(mesh.vertexCount).fill(-1);
  const positions: number[] = [];
  const indices = new Uint32Array(mesh.indices.length);

  for (let cursor = 0; cursor < mesh.indices.length; cursor += 1) {
    const originalIndex = mesh.indices[cursor];
    if (remap[originalIndex] === -1) {
      remap[originalIndex] = positions.length / 3;
      positions.push(
        mesh.positions[originalIndex * 3],
        mesh.positions[originalIndex * 3 + 1],
        mesh.positions[originalIndex * 3 + 2],
      );
    }
    indices[cursor] = remap[originalIndex];
  }

  return createMesh(new Float32Array(positions), indices);
};

export const simplifyMesh = async (
  mesh: Mesh,
  targetTriangleCount: number,
  errorTolerance: number,
): Promise<Mesh> => {
  if (mesh.triangleCount <= targetTriangleCount) return mesh;

  await MeshoptSimplifier.ready;

  const [simplifiedIndices] = MeshoptSimplifier.simplify(
    mesh.indices,
    mesh.positions,
    POSITION_STRIDE,
    targetTriangleCount * 3,
    errorTolerance,
    // Border edges are locked so a scan's open boundaries survive decimation intact.
    ["LockBorder"],
  );

  return compactUnusedVertices(createMesh(mesh.positions, simplifiedIndices));
};
