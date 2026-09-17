import {
  buildTriangleAdjacency,
  buildTriangleAttributes,
  computeBoundingBox,
  computeMeshStatistics,
  type Mesh,
} from "../../../mesh/index.js";
import {
  FeatureKind,
  type CylindricalFace,
  type Feature,
  type FeatureExtractionOptions,
  type PartSpecification,
  type PlanarFace,
} from "../../types/feature.types.js";
import { fitCylinder } from "../../services/cylinder-fitter/cylinder-fitter.js";
import { fitPlane } from "../../services/plane-fitter/plane-fitter.js";
import { detectHoles } from "../../services/hole-detector/hole-detector.js";
import { growSegments } from "../../services/surface-segmentation/surface-segmentation.js";

export const DEFAULT_FEATURE_EXTRACTION_OPTIONS: FeatureExtractionOptions = Object.freeze({
  segmentationAngleToleranceDegrees: 30,
  planarDistanceTolerance: 0.25,
  minimumFaceAreaFraction: 0.01,
  maximumCylinderFitResidualFraction: 0.08,
});

// Patches are grown by neighbour-to-neighbour normal continuity so a faceted cylinder survives as
// one surface, then each patch is classified by which primitive actually explains it.
export const createFeatureExtractionController = () =>
  Object.freeze({
    extract: (mesh: Mesh, options: FeatureExtractionOptions): PartSpecification => {
      const attributes = buildTriangleAttributes(mesh);
      const adjacency = buildTriangleAdjacency(mesh);
      const statistics = computeMeshStatistics(mesh);
      const boundingBox = computeBoundingBox(mesh);
      const minimumArea = attributes.totalArea * options.minimumFaceAreaFraction;

      const segments = growSegments({
        mesh,
        attributes,
        adjacency,
        assignedTriangles: new Uint8Array(mesh.triangleCount),
        angleToleranceDegrees: options.segmentationAngleToleranceDegrees,
        isComparedToSeed: false,
      });

      const planarFaces: PlanarFace[] = [];
      const cylindricalFaces: CylindricalFace[] = [];

      for (const segment of segments) {
        if (segment.area < minimumArea) continue;

        const planeFit = fitPlane(attributes, segment.triangleIndices);

        if (planeFit.residual <= options.planarDistanceTolerance) {
          planarFaces.push(
            Object.freeze({
              kind: FeatureKind.PLANAR_FACE,
              normal: planeFit.normal,
              origin: planeFit.origin,
              area: segment.area,
              triangleCount: segment.triangleIndices.length,
              fitResidual: planeFit.residual,
            }),
          );
          continue;
        }

        const cylinderFit = fitCylinder(mesh, attributes, segment.triangleIndices);
        if (!cylinderFit) continue;
        if (
          cylinderFit.residual >
          cylinderFit.radius * options.maximumCylinderFitResidualFraction
        ) {
          continue;
        }

        cylindricalFaces.push(
          Object.freeze({
            kind: FeatureKind.CYLINDRICAL_FACE,
            axis: cylinderFit.axis,
            basePoint: cylinderFit.basePoint,
            radius: cylinderFit.radius,
            height: cylinderFit.height,
            area: segment.area,
            triangleCount: segment.triangleIndices.length,
            isConcave: cylinderFit.isConcave,
            fitResidual: cylinderFit.residual,
          }),
        );
      }

      const holes = detectHoles(cylindricalFaces, boundingBox);

      const features: readonly Feature[] = Object.freeze([
        ...[...planarFaces].sort((left, right) => right.area - left.area),
        ...[...cylindricalFaces].sort((left, right) => right.area - left.area),
        ...holes,
      ]);

      return Object.freeze({
        features,
        boundingBox,
        dimensions: Object.freeze({
          length: boundingBox.maximum.x - boundingBox.minimum.x,
          width: boundingBox.maximum.y - boundingBox.minimum.y,
          height: boundingBox.maximum.z - boundingBox.minimum.z,
        }),
        metadata: Object.freeze({
          extractedAt: new Date().toISOString(),
          triangleCount: mesh.triangleCount,
          vertexCount: mesh.vertexCount,
          surfaceArea: statistics.surfaceArea,
          isWatertight: statistics.isWatertight,
        }),
      });
    },
  });
