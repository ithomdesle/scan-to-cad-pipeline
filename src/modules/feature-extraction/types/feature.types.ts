import { createEnum, type EnumValues } from "../../../shared/types/enum.types.js";
import type { BoundingBox, Dimensions, Vector3 } from "../../../shared/types/vector.types.js";

export const FeatureKind = createEnum({
  PLANAR_FACE: "planar_face",
  CYLINDRICAL_FACE: "cylindrical_face",
  HOLE: "hole",
});
export type FeatureKind = EnumValues<typeof FeatureKind>;

export type PlanarFace = {
  readonly kind: typeof FeatureKind.PLANAR_FACE;
  readonly normal: Vector3;
  readonly origin: Vector3;
  readonly area: number;
  readonly triangleCount: number;
  readonly fitResidual: number;
};

export type CylindricalFace = {
  readonly kind: typeof FeatureKind.CYLINDRICAL_FACE;
  readonly axis: Vector3;
  readonly basePoint: Vector3;
  readonly radius: number;
  readonly height: number;
  readonly area: number;
  readonly triangleCount: number;
  readonly isConcave: boolean;
  readonly fitResidual: number;
};

export type Hole = {
  readonly kind: typeof FeatureKind.HOLE;
  readonly axis: Vector3;
  readonly entryPoint: Vector3;
  readonly radius: number;
  readonly depth: number;
  readonly isThrough: boolean;
};

export type Feature = PlanarFace | CylindricalFace | Hole;

export type PartSpecification = {
  readonly features: readonly Feature[];
  readonly boundingBox: BoundingBox;
  readonly dimensions: Dimensions;
  readonly metadata: {
    readonly extractedAt: string;
    readonly triangleCount: number;
    readonly vertexCount: number;
    readonly surfaceArea: number;
    readonly isWatertight: boolean;
  };
};

export type FeatureExtractionOptions = {
  readonly segmentationAngleToleranceDegrees: number;
  readonly planarDistanceTolerance: number;
  readonly minimumFaceAreaFraction: number;
  readonly maximumCylinderFitResidualFraction: number;
};
