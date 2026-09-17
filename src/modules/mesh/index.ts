export type { Mesh, MeshStatistics } from "./types/mesh.types.js";
export { MeshFileFormat } from "./types/mesh.types.js";
export type { MeshCleaningOptions, MeshCleaningReport } from "./types/mesh-cleaning.types.js";
export { createMeshCleaningController } from "./controller/mesh-cleaning/mesh-cleaning.controller.js";
export {
  readMeshFromFile,
  readMeshFromBuffer,
} from "./services/mesh-file-reader/mesh-file-reader.js";
export { writeBinaryStereolithography } from "./services/binary-stereolithography-writer/binary-stereolithography-writer.js";
export { computeMeshStatistics } from "./services/mesh-statistics/mesh-statistics.js";
export {
  buildTriangleAdjacency,
  buildTriangleAttributes,
  computeBoundingBox,
  findBoundaryLoops,
  getVertexPosition,
} from "./services/mesh-topology/mesh-topology.js";
export { createMesh } from "./services/vertex-welder/vertex-welder.js";
export {
  createUnitCubeMesh,
  createOpenSquareMesh,
  createWasherMesh,
} from "./services/mesh-fixtures/mesh-fixtures.js";
