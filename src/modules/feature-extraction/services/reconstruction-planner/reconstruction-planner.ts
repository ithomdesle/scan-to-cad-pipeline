import { createEnum, type EnumValues } from "../../../../shared/types/enum.types.js";
import type { Mesh } from "../../../mesh/index.js";
import type { PartSpecification } from "../../types/feature.types.js";
import type { PanelSet } from "../../types/panel.types.js";
import {
  computeMeshVolume,
  DEFAULT_PANEL_DETECTION_OPTIONS,
  extractPanelSet,
  getIsTurnedPart,
} from "../panel-set-extractor/panel-set-extractor.js";

export const ReconstructionStrategy = createEnum({
  TURNED: "turned",
  PANELS: "panels",
  EXACT: "exact",
});
export type ReconstructionStrategy = EnumValues<typeof ReconstructionStrategy>;

export type ReconstructionPlan = {
  readonly strategy: ReconstructionStrategy;
  readonly panelSet: PanelSet | null;
  readonly measuredVolume: number;
  readonly estimatedVolume: number;
  readonly reason: string;
};

export const MAXIMUM_PANEL_VOLUME_ERROR = 0.15;

// The strategy is chosen by measuring, not by guessing at the shape: a description that cannot
// reproduce the volume it was measured from is not a description of that part.
export const planReconstruction = (
  mesh: Mesh,
  specification: PartSpecification,
  segmentationAngleToleranceDegrees: number,
): ReconstructionPlan => {
  const measuredVolume = computeMeshVolume(mesh);

  if (getIsTurnedPart(specification.features, specification.metadata.surfaceArea)) {
    return Object.freeze({
      strategy: ReconstructionStrategy.TURNED,
      panelSet: null,
      measuredVolume,
      estimatedVolume: measuredVolume,
      reason: "round faces dominate, so the part is modelled with real cylinders",
    });
  }

  const panelSet = extractPanelSet(
    mesh,
    segmentationAngleToleranceDegrees,
    DEFAULT_PANEL_DETECTION_OPTIONS,
  );

  if (panelSet) {
    const estimatedVolume = panelSet.panels.reduce(
      (total, panel) => total + panel.faceArea * panel.thicknessInMillimetres,
      0,
    );
    const volumeError =
      measuredVolume > 0 ? Math.abs(estimatedVolume - measuredVolume) / measuredVolume : 1;

    if (volumeError <= MAXIMUM_PANEL_VOLUME_ERROR) {
      return Object.freeze({
        strategy: ReconstructionStrategy.PANELS,
        panelSet,
        measuredVolume,
        estimatedVolume,
        reason: `${panelSet.panels.length} panel${panelSet.panels.length === 1 ? "" : "s"} account for ${Math.round((1 - volumeError) * 100)}% of the measured volume`,
      });
    }

    return Object.freeze({
      strategy: ReconstructionStrategy.EXACT,
      panelSet: null,
      measuredVolume,
      estimatedVolume,
      reason: `panels would account for only ${Math.round((estimatedVolume / measuredVolume) * 100)}% of the measured volume, so the mesh is rebuilt exactly`,
    });
  }

  return Object.freeze({
    strategy: ReconstructionStrategy.EXACT,
    panelSet: null,
    measuredVolume,
    estimatedVolume: measuredVolume,
    reason: "no primitive description fits, so the mesh is rebuilt exactly",
  });
};
