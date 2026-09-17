export type {
  CylindricalFace,
  Feature,
  FeatureExtractionOptions,
  Hole,
  PartSpecification,
  PlanarFace,
} from "./types/feature.types.js";
export { FeatureKind } from "./types/feature.types.js";
export {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
} from "./controller/feature-extraction/feature-extraction.controller.js";
