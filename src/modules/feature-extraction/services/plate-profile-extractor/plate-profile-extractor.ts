import { buildTriangleAdjacency, buildTriangleAttributes, type Mesh } from "../../../mesh/index.js";
import {
  createVector3,
  dotProduct,
  scaleVector,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
import type { PlateDetectionOptions, PlateProfile, Point2 } from "../../types/plate.types.js";
import { fitPlane } from "../plane-fitter/plane-fitter.js";
import { growSegments, type Segment } from "../surface-segmentation/surface-segmentation.js";
import {
  createPlanePlacement,
  findFaceBoundaryLoops,
  projectLoopToPlane,
} from "../face-boundary-extractor/face-boundary-extractor.js";
import { simplifyClosedPolygon } from "../../../image-profile/index.js";

export const DEFAULT_PLATE_DETECTION_OPTIONS: PlateDetectionOptions = Object.freeze({
  minimumFaceAreaShare: 0.25,
  parallelNormalTolerance: 0.02,
  boundarySimplificationTolerance: 0.05,
});

type PlanarSegment = {
  readonly segment: Segment;
  readonly normal: ReturnType<typeof fitPlane>["normal"];
  readonly origin: ReturnType<typeof fitPlane>["origin"];
};

// A plate is two large parallel faces looking away from each other. Reconstructing it from the
// face outline rather than a bounding box is the only way to keep a non-rectangular edge and every
// cutout, whatever shape those cutouts are.
export const extractPlateProfile = (
  mesh: Mesh,
  segmentationAngleToleranceDegrees: number,
  options: PlateDetectionOptions,
): PlateProfile | null => {
  const attributes = buildTriangleAttributes(mesh);
  const adjacency = buildTriangleAdjacency(mesh);

  const segments = growSegments({
    mesh,
    attributes,
    adjacency,
    assignedTriangles: new Uint8Array(mesh.triangleCount),
    angleToleranceDegrees: segmentationAngleToleranceDegrees,
    isComparedToSeed: false,
  });

  const planarSegments: PlanarSegment[] = segments
    .map((segment) => {
      const fit = fitPlane(attributes, segment.triangleIndices);
      return { segment, normal: fit.normal, origin: fit.origin, residual: fit.residual };
    })
    .filter((candidate) => candidate.residual <= 0.05)
    .sort((left, right) => right.segment.area - left.segment.area);

  if (planarSegments.length < 2) return null;

  const frontFace = planarSegments[0];
  if (frontFace.segment.area < attributes.totalArea * options.minimumFaceAreaShare) return null;

  const backFace = planarSegments
    .slice(1)
    .find(
      (candidate) =>
        dotProduct(candidate.normal, frontFace.normal) < -1 + options.parallelNormalTolerance,
    );

  if (!backFace) return null;

  const thickness = Math.abs(
    dotProduct(subtractVectors(frontFace.origin, backFace.origin), frontFace.normal),
  );

  if (thickness <= 0) return null;

  const placement = createPlanePlacement(
    frontFace.normal,
    subtractVectors(frontFace.origin, scaleVector(frontFace.normal, thickness)),
  );

  const loops = findFaceBoundaryLoops(mesh, frontFace.segment.triangleIndices)
    .map((loop) => projectLoopToPlane(mesh, loop, placement))
    .map((loop) => ({
      points: simplifyClosedPolygon(loop.points, options.boundarySimplificationTolerance),
      absoluteArea: Math.abs(loop.signedArea),
    }))
    .filter((loop) => loop.points.length >= 3)
    .sort((left, right) => right.absoluteArea - left.absoluteArea);

  if (loops.length === 0) return null;

  return Object.freeze({
    outline: Object.freeze(loops[0].points.map((point) => Object.freeze({ ...point }) as Point2)),
    cutouts: Object.freeze(
      loops
        .slice(1)
        .map((loop) =>
          Object.freeze(loop.points.map((point) => Object.freeze({ ...point }) as Point2)),
        ),
    ),
    thicknessInMillimetres: thickness,
    origin: createVector3(placement.origin.x, placement.origin.y, placement.origin.z),
    pitchDegrees: placement.pitchDegrees,
    yawDegrees: placement.yawDegrees,
    faceArea: frontFace.segment.area,
  });
};
