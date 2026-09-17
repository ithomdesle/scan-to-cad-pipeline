import { buildTriangleAdjacency, buildTriangleAttributes, type Mesh } from "../../../mesh/index.js";
import {
  createVector3,
  dotProduct,
  getVectorLength,
  scaleVector,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
import type { Panel, PanelDetectionOptions, PanelSet, Point2 } from "../../types/panel.types.js";
import { fitPlane } from "../plane-fitter/plane-fitter.js";
import { growSegments } from "../surface-segmentation/surface-segmentation.js";
import {
  createPlanePlacement,
  findFaceBoundaryLoops,
  projectLoopToPlane,
} from "../face-boundary-extractor/face-boundary-extractor.js";
import { simplifyClosedPolygon } from "../../../image-profile/index.js";

export const DEFAULT_PANEL_DETECTION_OPTIONS: PanelDetectionOptions = Object.freeze({
  parallelNormalTolerance: 0.03,
  minimumPanelAreaFraction: 0.01,
  wallThicknessLowerFactor: 0.25,
  wallThicknessUpperFactor: 3,
  boundarySimplificationTolerance: 0.05,
  minimumCoveredAreaShare: 0.3,
});

// Paired faces never account for the whole surface: a panel's own side walls belong to no pair and
// grow with its thickness, so the bar for "this really is a panelled part" has to stay well below
// half the area. Fidelity is judged afterwards by comparing built volume against the mesh.

export const computeMeshVolume = (mesh: Mesh): number => {
  let signedVolume = 0;

  for (let triangleIndex = 0; triangleIndex < mesh.triangleCount; triangleIndex += 1) {
    const first = mesh.indices[triangleIndex * 3] * 3;
    const second = mesh.indices[triangleIndex * 3 + 1] * 3;
    const third = mesh.indices[triangleIndex * 3 + 2] * 3;
    const { positions } = mesh;

    signedVolume +=
      (positions[first] *
        (positions[second + 1] * positions[third + 2] -
          positions[second + 2] * positions[third + 1]) -
        positions[first + 1] *
          (positions[second] * positions[third + 2] - positions[second + 2] * positions[third]) +
        positions[first + 2] *
          (positions[second] * positions[third + 1] - positions[second + 1] * positions[third])) /
      6;
  }

  return Math.abs(signedVolume);
};

// A folded sheet part is a set of panels, each a pair of parallel faces one wall apart. The wall is
// estimated from the solid itself - twice volume over surface area - so the same test works for a
// 2 mm plate and a 5 mm bracket without a hand-tuned threshold.
export const extractPanelSet = (
  mesh: Mesh,
  segmentationAngleToleranceDegrees: number,
  options: PanelDetectionOptions,
): PanelSet | null => {
  const attributes = buildTriangleAttributes(mesh);
  const adjacency = buildTriangleAdjacency(mesh);
  const meshVolume = computeMeshVolume(mesh);

  if (meshVolume <= 0 || attributes.totalArea <= 0) return null;

  const estimatedWallThickness = (2 * meshVolume) / attributes.totalArea;
  const lowerThickness = estimatedWallThickness * options.wallThicknessLowerFactor;
  const upperThickness = estimatedWallThickness * options.wallThicknessUpperFactor;

  const segments = growSegments({
    mesh,
    attributes,
    adjacency,
    assignedTriangles: new Uint8Array(mesh.triangleCount),
    angleToleranceDegrees: segmentationAngleToleranceDegrees,
    isComparedToSeed: false,
  });

  const planarFaces = segments
    .map((segment) => ({ segment, ...fitPlane(attributes, segment.triangleIndices) }))
    .filter((candidate) => candidate.residual <= 0.05)
    .filter(
      (candidate) =>
        candidate.segment.area >= attributes.totalArea * options.minimumPanelAreaFraction,
    )
    .sort((left, right) => right.segment.area - left.segment.area);

  const isPaired = new Array<boolean>(planarFaces.length).fill(false);
  const panels: Panel[] = [];
  let coveredArea = 0;

  for (let frontIndex = 0; frontIndex < planarFaces.length; frontIndex += 1) {
    if (isPaired[frontIndex]) continue;
    const frontFace = planarFaces[frontIndex];

    for (let backIndex = frontIndex + 1; backIndex < planarFaces.length; backIndex += 1) {
      if (isPaired[backIndex]) continue;
      const backFace = planarFaces[backIndex];

      if (dotProduct(frontFace.normal, backFace.normal) > -1 + options.parallelNormalTolerance) {
        continue;
      }

      const separationVector = subtractVectors(frontFace.origin, backFace.origin);
      const thickness = Math.abs(dotProduct(separationVector, frontFace.normal));
      if (thickness < lowerThickness || thickness > upperThickness) continue;

      // The two faces must sit on top of each other, not merely be parallel somewhere else.
      const inPlaneOffset = getVectorLength(
        subtractVectors(separationVector, scaleVector(frontFace.normal, thickness)),
      );
      if (inPlaneOffset > Math.sqrt(frontFace.segment.area)) continue;

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

      if (loops.length === 0) continue;

      panels.push(
        Object.freeze({
          outline: Object.freeze(
            loops[0].points.map((point) => Object.freeze({ ...point }) as Point2),
          ),
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
        }),
      );

      coveredArea += frontFace.segment.area + backFace.segment.area;
      isPaired[frontIndex] = true;
      isPaired[backIndex] = true;
      break;
    }
  }

  if (panels.length === 0) return null;

  const coveredAreaShare = coveredArea / attributes.totalArea;
  if (coveredAreaShare < options.minimumCoveredAreaShare) return null;

  return Object.freeze({
    panels: Object.freeze(panels),
    estimatedWallThickness,
    coveredAreaShare,
  });
};

// A turned part is better described by a real cylinder than by a many-sided polygon: extruding a
// discretised circle would replace one curved face with as many flat ones as the scan had facets.
export const getIsTurnedPart = (
  features: readonly {
    readonly kind: string;
    readonly area?: number;
    readonly isConcave?: boolean;
  }[],
  totalArea: number,
  minimumRoundAreaShare = 0.15,
): boolean => {
  const convexRoundArea = features
    .filter((feature) => feature.kind === "cylindrical_face" && feature.isConcave === false)
    .reduce((total, feature) => total + (feature.area ?? 0), 0);

  return totalArea > 0 && convexRoundArea / totalArea >= minimumRoundAreaShare;
};
