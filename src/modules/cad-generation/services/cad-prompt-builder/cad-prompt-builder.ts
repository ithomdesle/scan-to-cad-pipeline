import {
  FeatureKind,
  type Feature,
  type PartSpecification,
} from "../../../feature-extraction/index.js";

const formatNumber = (value: number): string => value.toFixed(2);

const describeFeature = (feature: Feature): string => {
  if (feature.kind === FeatureKind.PLANAR_FACE) {
    return `- Planar face: normal (${formatNumber(feature.normal.x)}, ${formatNumber(feature.normal.y)}, ${formatNumber(feature.normal.z)}), passing through (${formatNumber(feature.origin.x)}, ${formatNumber(feature.origin.y)}, ${formatNumber(feature.origin.z)}), area ${formatNumber(feature.area)} mm2`;
  }

  if (feature.kind === FeatureKind.CYLINDRICAL_FACE) {
    return `- ${feature.isConcave ? "Concave" : "Convex"} cylindrical face: radius ${formatNumber(feature.radius)} mm, height ${formatNumber(feature.height)} mm, axis (${formatNumber(feature.axis.x)}, ${formatNumber(feature.axis.y)}, ${formatNumber(feature.axis.z)}), base centre (${formatNumber(feature.basePoint.x)}, ${formatNumber(feature.basePoint.y)}, ${formatNumber(feature.basePoint.z)})`;
  }

  return `- Hole: diameter ${formatNumber(feature.radius * 2)} mm, depth ${formatNumber(feature.depth)} mm${feature.isThrough ? " (through)" : ""}, axis (${formatNumber(feature.axis.x)}, ${formatNumber(feature.axis.y)}, ${formatNumber(feature.axis.z)}), entry point (${formatNumber(feature.entryPoint.x)}, ${formatNumber(feature.entryPoint.y)}, ${formatNumber(feature.entryPoint.z)})`;
};

export const CAD_SYSTEM_PROMPT = [
  "You are a mechanical CAD engineer who writes build123d models in Python.",
  "You reply with Python source code only: no prose, no markdown fences, no explanation.",
  "You use build123d algebra mode (Pos, Rot, Box, Cylinder, Sphere and the operators + - &).",
  "You assign the finished solid to a variable named exactly `part`.",
  "You import nothing except build123d and math.",
  "You never read files, spawn processes or touch the operating system.",
].join(" ");

export const buildCadPrompt = (
  specification: PartSpecification,
  previousError?: string,
): string => {
  const { dimensions, boundingBox, features, metadata } = specification;

  const sections = [
    "Reconstruct this scanned mechanical part as a clean parametric build123d solid.",
    "",
    "## Overall size (millimetres)",
    `- Length (x): ${formatNumber(dimensions.length)}`,
    `- Width (y): ${formatNumber(dimensions.width)}`,
    `- Height (z): ${formatNumber(dimensions.height)}`,
    `- Bounding box minimum: (${formatNumber(boundingBox.minimum.x)}, ${formatNumber(boundingBox.minimum.y)}, ${formatNumber(boundingBox.minimum.z)})`,
    `- Bounding box maximum: (${formatNumber(boundingBox.maximum.x)}, ${formatNumber(boundingBox.maximum.y)}, ${formatNumber(boundingBox.maximum.z)})`,
    "",
    "## Fitted surfaces",
    features.length === 0
      ? "- None were recovered; model the part as a simple block of the size above."
      : features.map(describeFeature).join("\n"),
    "",
    "## Rules",
    "1. Work in millimetres and keep the part in the same coordinate frame as the measurements above.",
    "2. Build the outer shape first, then subtract every hole listed.",
    "3. Prefer a few large primitives over many small ones; this must stay editable in a CAD package.",
    "4. Assign the result to `part`.",
    "5. Output Python source only.",
    `6. The scan was ${metadata.isWatertight ? "watertight" : "not watertight, so treat thin features with suspicion"}.`,
  ];

  if (previousError) {
    sections.push(
      "",
      "## Your previous attempt failed",
      "Fix this and return the corrected full script:",
      previousError,
    );
  }

  return sections.join("\n");
};
