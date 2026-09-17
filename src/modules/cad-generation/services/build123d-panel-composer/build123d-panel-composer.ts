import type { Panel, PanelSet, Point2 } from "../../../feature-extraction/index.js";

const formatNumber = (value: number): string => value.toFixed(4);

const formatPointList = (points: readonly Point2[]): string =>
  points.map((point) => `(${formatNumber(point.x)}, ${formatNumber(point.y)})`).join(", ");

const formatPlacement = (panel: Panel): string =>
  `Pos(${formatNumber(panel.origin.x)}, ${formatNumber(panel.origin.y)}, ${formatNumber(panel.origin.z)}) * Rot(0, ${formatNumber(panel.pitchDegrees)}, ${formatNumber(panel.yawDegrees)})`;

export const composePanelSetScript = (panelSet: PanelSet): string => {
  const lines = [
    "from build123d import *",
    "",
    `# ${panelSet.panels.length} panel${panelSet.panels.length === 1 ? "" : "s"}, wall about ${formatNumber(panelSet.estimatedWallThickness)} mm`,
  ];

  panelSet.panels.forEach((panel, panelIndex) => {
    const placement = formatPlacement(panel);
    const thickness = formatNumber(panel.thicknessInMillimetres);
    const name = `panel_${panelIndex + 1}`;

    lines.push(
      "",
      `outline_${panelIndex + 1} = [${formatPointList(panel.outline)}]`,
      `${name} = ${placement} * extrude(make_face(Polyline(*outline_${panelIndex + 1}, close=True)), amount=${thickness})`,
    );

    panel.cutouts.forEach((cutout, cutoutIndex) => {
      const cutoutName = `cutout_${panelIndex + 1}_${cutoutIndex + 1}`;
      lines.push(
        `${cutoutName} = [${formatPointList(cutout)}]`,
        `${name} = ${name} - ${placement} * extrude(make_face(Polyline(*${cutoutName}, close=True)), amount=${thickness})`,
      );
    });
  });

  const unionExpression = panelSet.panels
    .map((_panel, panelIndex) => `panel_${panelIndex + 1}`)
    .join(" + ");

  lines.push("", `part = ${unionExpression}`);

  return `${lines.join("\n")}\n`;
};
