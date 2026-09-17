import type { PartProfile, Point2 } from "../../../image-profile/index.js";

const formatPoint = (point: Point2): string => `(${point.x.toFixed(3)}, ${point.y.toFixed(3)})`;

const formatPointList = (points: readonly Point2[]): string => points.map(formatPoint).join(", ");

export const composeProfileScript = (profile: PartProfile): string => {
  const lines = [
    "from build123d import *",
    "",
    `# plate ${profile.widthInMillimetres.toFixed(2)} x ${profile.heightInMillimetres.toFixed(2)} x ${profile.thicknessInMillimetres.toFixed(2)} mm`,
    `outline = [${formatPointList(profile.outline)}]`,
    `part = extrude(make_face(Polyline(*outline, close=True)), amount=${profile.thicknessInMillimetres.toFixed(3)})`,
  ];

  profile.cutouts.forEach((cutout, cutoutIndex) => {
    lines.push(
      "",
      `# cutout ${cutoutIndex + 1}`,
      `cutout_${cutoutIndex + 1} = [${formatPointList(cutout)}]`,
      `part = part - extrude(make_face(Polyline(*cutout_${cutoutIndex + 1}, close=True)), amount=${profile.thicknessInMillimetres.toFixed(3)})`,
    );
  });

  return `${lines.join("\n")}\n`;
};
