import type { Mesh, MeshStatistics } from "../../types/mesh.types.js";
import {
  buildTriangleAttributes,
  computeBoundingBox,
  findBoundaryLoops,
} from "../mesh-topology/mesh-topology.js";

export const computeMeshStatistics = (mesh: Mesh): MeshStatistics => {
  const attributes = buildTriangleAttributes(mesh);
  const boundaryLoops = findBoundaryLoops(mesh);
  const boundaryEdgeCount = boundaryLoops.reduce(
    (total, loop) => total + loop.vertexIndices.length,
    0,
  );

  return Object.freeze({
    triangleCount: mesh.triangleCount,
    vertexCount: mesh.vertexCount,
    boundingBox: computeBoundingBox(mesh),
    surfaceArea: attributes.totalArea,
    isWatertight: boundaryEdgeCount === 0,
    boundaryEdgeCount,
  });
};
