export type Point3 = readonly [number, number, number];

export type PolyhedralFace = {
  readonly outer: readonly Point3[];
  readonly inners: readonly (readonly Point3[])[];
};

export type PolyhedralSolid = {
  readonly faces: readonly PolyhedralFace[];
  readonly mergedFaceCount: number;
  readonly triangleFaceCount: number;
};

export type PolyhedralReconstructionOptions = {
  readonly coplanarAngleToleranceDegrees: number;
  readonly maximumPlaneResidual: number;
  readonly maximumBoundaryDeviation: number;
};
