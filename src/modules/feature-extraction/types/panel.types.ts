import type { Vector3 } from "../../../shared/types/vector.types.js";

export type Point2 = {
  readonly x: number;
  readonly y: number;
};

export type Panel = {
  readonly outline: readonly Point2[];
  readonly cutouts: readonly (readonly Point2[])[];
  readonly thicknessInMillimetres: number;
  readonly origin: Vector3;
  readonly pitchDegrees: number;
  readonly yawDegrees: number;
  readonly faceArea: number;
};

export type PanelSet = {
  readonly panels: readonly Panel[];
  readonly estimatedWallThickness: number;
  readonly coveredAreaShare: number;
};

export type PanelDetectionOptions = {
  readonly parallelNormalTolerance: number;
  readonly minimumPanelAreaFraction: number;
  readonly wallThicknessLowerFactor: number;
  readonly wallThicknessUpperFactor: number;
  readonly boundarySimplificationTolerance: number;
  readonly minimumCoveredAreaShare: number;
};
