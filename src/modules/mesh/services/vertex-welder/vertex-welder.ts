import type { Mesh } from "../../types/mesh.types.js";

export const DEFAULT_WELDING_TOLERANCE = 1e-5;

// Grid quantisation can split two points that straddle a cell boundary; this is the accepted
// trade-off for O(n) welding and matches what every STL toolchain does.
export const weldVertices = (vertexStream: readonly number[], weldingTolerance: number): Mesh => {
  const positions: number[] = [];
  const indices: number[] = [];
  const indexByCell = new Map<string, number>();
  const inverseTolerance = 1 / weldingTolerance;

  for (let cursor = 0; cursor < vertexStream.length; cursor += 3) {
    const x = vertexStream[cursor];
    const y = vertexStream[cursor + 1];
    const z = vertexStream[cursor + 2];
    const cellKey = `${Math.round(x * inverseTolerance)},${Math.round(y * inverseTolerance)},${Math.round(z * inverseTolerance)}`;

    const existingIndex = indexByCell.get(cellKey);
    if (existingIndex === undefined) {
      const newIndex = positions.length / 3;
      positions.push(x, y, z);
      indexByCell.set(cellKey, newIndex);
      indices.push(newIndex);
      continue;
    }

    indices.push(existingIndex);
  }

  return createMesh(new Float32Array(positions), new Uint32Array(indices));
};

export const createMesh = (positions: Float32Array, indices: Uint32Array): Mesh =>
  Object.freeze({
    positions,
    indices,
    triangleCount: indices.length / 3,
    vertexCount: positions.length / 3,
  });
