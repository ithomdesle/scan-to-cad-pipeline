import type { Vector3 } from "../../../shared/types/vector.types.js";

export type Point2 = {
  readonly x: number;
  readonly y: number;
};

export type PlateProfile = {
  readonly outline: readonly Point2[];
  readonly cutouts: readonly (readonly Point2[])[];
  readonly thicknessInMillimetres: number;
  readonly origin: Vector3;
  readonly pitchDegrees: number;
  readonly yawDegrees: number;
  readonly faceArea: number;
};

export type PlateDetectionOptions = {
  readonly minimumFaceAreaShare: number;
  readonly parallelNormalTolerance: number;
  readonly boundarySimplificationTolerance: number;
};
