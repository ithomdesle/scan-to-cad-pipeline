import type { Vector3 } from "../../../../shared/types/vector.types.js";
import {
  addVectors,
  createVector3,
  normalizeVector,
  scaleVector,
} from "../../../../shared/utils/vector/vector.js";
import {
  FeatureKind,
  type CylindricalFace,
  type Hole,
  type PartSpecification,
} from "../../../feature-extraction/index.js";

const THROUGH_HOLE_OVERSHOOT = 1.05;
const DOMINANT_CYLINDER_DIAMETER_TOLERANCE = 0.08;

const formatNumber = (value: number): string => value.toFixed(4);

export const getRotationAnglesForAxis = (
  axis: Vector3,
): { readonly pitchDegrees: number; readonly yawDegrees: number } => {
  const unitAxis = normalizeVector(axis);
  const pitchDegrees = (Math.acos(Math.min(1, Math.max(-1, unitAxis.z))) * 180) / Math.PI;
  const yawDegrees = (Math.atan2(unitAxis.y, unitAxis.x) * 180) / Math.PI;
  return { pitchDegrees, yawDegrees };
};

export const formatCylinderExpression = (
  centre: Vector3,
  axis: Vector3,
  radius: number,
  height: number,
): string => {
  const { pitchDegrees, yawDegrees } = getRotationAnglesForAxis(axis);
  return [
    `Pos(${formatNumber(centre.x)}, ${formatNumber(centre.y)}, ${formatNumber(centre.z)})`,
    `Rot(0, ${formatNumber(pitchDegrees)}, ${formatNumber(yawDegrees)})`,
    `Cylinder(radius=${formatNumber(radius)}, height=${formatNumber(height)})`,
  ].join(" * ");
};

const getHoleCentre = (hole: Hole, height: number): Vector3 =>
  addVectors(hole.entryPoint, scaleVector(normalizeVector(hole.axis), height / 2));

export const findDominantConvexCylinder = (
  specification: PartSpecification,
): CylindricalFace | null => {
  const { dimensions } = specification;
  const smallestPlanSpan = Math.min(dimensions.length, dimensions.width);

  const candidates = specification.features
    .filter((feature): feature is CylindricalFace => feature.kind === FeatureKind.CYLINDRICAL_FACE)
    .filter((cylinder) => !cylinder.isConcave)
    .filter(
      (cylinder) =>
        Math.abs(cylinder.radius * 2 - smallestPlanSpan) <=
        smallestPlanSpan * DOMINANT_CYLINDER_DIAMETER_TOLERANCE,
    );

  return candidates.length === 0
    ? null
    : candidates.reduce((largest, candidate) =>
        candidate.area > largest.area ? candidate : largest,
      );
};

const composeBaseSolid = (specification: PartSpecification): string => {
  const { boundingBox, dimensions } = specification;
  const centre = createVector3(
    (boundingBox.minimum.x + boundingBox.maximum.x) / 2,
    (boundingBox.minimum.y + boundingBox.maximum.y) / 2,
    (boundingBox.minimum.z + boundingBox.maximum.z) / 2,
  );

  const dominantCylinder = findDominantConvexCylinder(specification);
  if (dominantCylinder) {
    return formatCylinderExpression(
      centre,
      dominantCylinder.axis,
      dominantCylinder.radius,
      dominantCylinder.height,
    );
  }

  return [
    `Pos(${formatNumber(centre.x)}, ${formatNumber(centre.y)}, ${formatNumber(centre.z)})`,
    `Box(${formatNumber(dimensions.length)}, ${formatNumber(dimensions.width)}, ${formatNumber(dimensions.height)})`,
  ].join(" * ");
};

export const composeBuild123dScript = (specification: PartSpecification): string => {
  const holes = specification.features.filter(
    (feature): feature is Hole => feature.kind === FeatureKind.HOLE,
  );

  const lines = ["from build123d import *", "", `part = ${composeBaseSolid(specification)}`];

  holes.forEach((hole, holeIndex) => {
    const cutHeight = hole.isThrough ? hole.depth * THROUGH_HOLE_OVERSHOOT : hole.depth;
    const centre = getHoleCentre(hole, hole.depth);
    lines.push(
      `# hole ${holeIndex + 1}: diameter ${formatNumber(hole.radius * 2)} mm${hole.isThrough ? ", through" : ""}`,
      `part = part - ${formatCylinderExpression(centre, hole.axis, hole.radius, cutHeight)}`,
    );
  });

  return `${lines.join("\n")}\n`;
};
