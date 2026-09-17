import type { PlateProfile } from "../../../feature-extraction/index.js";
import type { Point2 } from "../../../feature-extraction/index.js";

const formatNumber = (value: number): string => value.toFixed(4);

const formatPointList = (points: readonly Point2[]): string =>
  points.map((point) => `(${formatNumber(point.x)}, ${formatNumber(point.y)})`).join(", ");

const formatPlacement = (profile: PlateProfile): string =>
  `Pos(${formatNumber(profile.origin.x)}, ${formatNumber(profile.origin.y)}, ${formatNumber(profile.origin.z)}) * Rot(0, ${formatNumber(profile.pitchDegrees)}, ${formatNumber(profile.yawDegrees)})`;

export const composePlateScript = (profile: PlateProfile): string => {
  const placement = formatPlacement(profile);
  const thickness = formatNumber(profile.thicknessInMillimetres);

  const lines = [
    "from build123d import *",
    "",
    `# plate ${formatNumber(profile.thicknessInMillimetres)} mm thick, ${profile.cutouts.length} cutout${profile.cutouts.length === 1 ? "" : "s"}`,
    `outline = [${formatPointList(profile.outline)}]`,
    `part = ${placement} * extrude(make_face(Polyline(*outline, close=True)), amount=${thickness})`,
  ];

  profile.cutouts.forEach((cutout, cutoutIndex) => {
    lines.push(
      "",
      `cutout_${cutoutIndex + 1} = [${formatPointList(cutout)}]`,
      `part = part - ${placement} * extrude(make_face(Polyline(*cutout_${cutoutIndex + 1}, close=True)), amount=${thickness})`,
    );
  });

  return `${lines.join("\n")}\n`;
};
