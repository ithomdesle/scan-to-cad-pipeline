import type { BoundingBox } from "../../../shared/types/vector.types.js";
import { createEnum, type EnumValues } from "../../../shared/types/enum.types.js";

export const MeshFileFormat = createEnum({
  BINARY_STEREOLITHOGRAPHY: "binary_stereolithography",
  ASCII_STEREOLITHOGRAPHY: "ascii_stereolithography",
  WAVEFRONT_OBJECT: "wavefront_object",
});
export type MeshFileFormat = EnumValues<typeof MeshFileFormat>;

export type Mesh = {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  readonly vertexCount: number;
};

export type MeshStatistics = {
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly boundingBox: BoundingBox;
  readonly surfaceArea: number;
  readonly isWatertight: boolean;
  readonly boundaryEdgeCount: number;
};
