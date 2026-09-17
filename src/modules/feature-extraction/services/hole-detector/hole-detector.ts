import type { BoundingBox } from "../../../../shared/types/vector.types.js";
import { createVector3 } from "../../../../shared/utils/vector/vector.js";
import { getExtentAlongDirection } from "../cylinder-fitter/cylinder-fitter.js";
import { FeatureKind, type CylindricalFace, type Hole } from "../../types/feature.types.js";

const THROUGH_HOLE_COVERAGE = 0.95;

export const detectHoles = (
  cylindricalFaces: readonly CylindricalFace[],
  boundingBox: BoundingBox,
): readonly Hole[] =>
  Object.freeze(
    cylindricalFaces
      .filter((face) => face.isConcave)
      .map((face) => {
        const partExtent = getExtentAlongDirection(
          face.axis,
          boundingBox.minimum,
          boundingBox.maximum,
        );

        return Object.freeze({
          kind: FeatureKind.HOLE,
          axis: face.axis,
          entryPoint: face.basePoint,
          radius: face.radius,
          depth: face.height,
          isThrough: partExtent > 0 && face.height >= partExtent * THROUGH_HOLE_COVERAGE,
        }) satisfies Hole;
      }),
  );

export const createEmptyBoundingBox = (): BoundingBox =>
  Object.freeze({
    minimum: createVector3(0, 0, 0),
    maximum: createVector3(0, 0, 0),
  });
