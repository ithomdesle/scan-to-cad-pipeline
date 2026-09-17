import sharp from "sharp";
import type { PartProfile, Point2, ProfileExtractionOptions } from "../../types/profile.types.js";
import { binarizeImage } from "../../services/image-binarizer/image-binarizer.js";
import {
  getLargestRegionLabel,
  getPolygonArea,
  labelRegions,
  traceRegionBoundary,
} from "../../services/contour-tracer/contour-tracer.js";
import {
  expandPolygonByOnePixel,
  simplifyClosedPolygon,
} from "../../services/polygon-simplifier/polygon-simplifier.js";

export const DEFAULT_PROFILE_EXTRACTION_OPTIONS: ProfileExtractionOptions = Object.freeze({
  knownLongestEdgeInMillimetres: 100,
  thicknessInMillimetres: 2,
  simplificationTolerance: 2,
  minimumCutoutAreaFraction: 0.0005,
  minimumCutoutIntensityMatch: 25,
});

const MAXIMUM_ANALYSIS_WIDTH = 1400;

export const decodeImageToGreyscale = async (
  imageBuffer: Buffer,
): Promise<{ greyscale: Uint8Array; width: number; height: number }> => {
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .greyscale()
    .resize({ width: MAXIMUM_ANALYSIS_WIDTH, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { greyscale: new Uint8Array(data), width: info.width, height: info.height };
};

const measureBorderIntensity = (
  greyscale: Uint8Array,
  width: number,
  height: number,
): { readonly mean: number; readonly deviation: number } => {
  const samples: number[] = [];

  for (let column = 0; column < width; column += 1) {
    samples.push(greyscale[column], greyscale[(height - 1) * width + column]);
  }
  for (let row = 0; row < height; row += 1) {
    samples.push(greyscale[row * width], greyscale[row * width + width - 1]);
  }

  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  const variance =
    samples.reduce((total, value) => total + (value - mean) ** 2, 0) / samples.length;

  return { mean, deviation: Math.sqrt(variance) };
};

const measureRegionIntensity = (
  greyscale: Uint8Array,
  labels: Int32Array,
  label: number,
): number => {
  let total = 0;
  let count = 0;

  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] !== label) continue;
    total += greyscale[index];
    count += 1;
  }

  return count === 0 ? 0 : total / count;
};

const getBoundingBox = (points: readonly Point2[]) => {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  return {
    minimumX: Math.min(...xValues),
    maximumX: Math.max(...xValues),
    minimumY: Math.min(...yValues),
    maximumY: Math.max(...yValues),
  };
};

export const createProfileExtractionController = () =>
  Object.freeze({
    extract: async (
      imageBuffer: Buffer,
      options: ProfileExtractionOptions,
    ): Promise<PartProfile> => {
      const { greyscale, width, height } = await decodeImageToGreyscale(imageBuffer);
      const binaryImage = binarizeImage(greyscale, width, height);

      const partRegions = labelRegions(binaryImage, 1, true);
      const partLabel = getLargestRegionLabel(partRegions);

      if (partLabel === -1) {
        throw new Error(
          "No part could be separated from the background. Photograph the part against a plainly contrasting surface.",
        );
      }

      // A silhouette that runs off the edge of the frame is not the outline of the part: whatever
      // continues past the border is unknown, and anything touching the part is traced with it.
      if (partRegions.isRegionTouchingBorder[partLabel]) {
        throw new Error(
          "The part runs off the edge of the photo, or something touching it does. Lay the part on its own, fully inside the frame, and shoot straight down.",
        );
      }

      const outlineContour = traceRegionBoundary(partRegions.labels, width, height, partLabel);
      if (outlineContour.points.length < 8) {
        throw new Error("The detected outline was too small to be a part.");
      }

      const backgroundRegions = labelRegions(binaryImage, 0, false);
      const partAreaInPixels = partRegions.regionSizes[partLabel];
      const minimumCutoutArea = partAreaInPixels * options.minimumCutoutAreaFraction;

      // A real opening shows the background through it. Printing, labels and glare are the same
      // class as the background to a threshold, but they are not the same colour as it, so an
      // enclosed region only counts as a cutout when it looks like what surrounds the part.
      const backgroundIntensity = measureBorderIntensity(greyscale, width, height);

      const cutoutContours = backgroundRegions.regionSizes
        .map((size: number, label: number) => ({ size, label }))
        .filter(
          ({ size, label }) =>
            !backgroundRegions.isRegionTouchingBorder[label] && size >= minimumCutoutArea,
        )
        .filter(({ label }) => {
          const meanIntensity = measureRegionIntensity(greyscale, backgroundRegions.labels, label);
          return (
            Math.abs(meanIntensity - backgroundIntensity.mean) <=
            Math.max(backgroundIntensity.deviation * 2, options.minimumCutoutIntensityMatch)
          );
        })
        .map(({ label }) => traceRegionBoundary(backgroundRegions.labels, width, height, label))
        .filter((contour) => contour.points.length >= 8);

      const outlinePixels = expandPolygonByOnePixel(outlineContour.points);
      const outlineBounds = getBoundingBox(outlinePixels);
      const longestSideInPixels = Math.max(
        outlineBounds.maximumX - outlineBounds.minimumX,
        outlineBounds.maximumY - outlineBounds.minimumY,
      );

      if (longestSideInPixels <= 0) throw new Error("The detected outline has no extent.");

      const pixelsPerMillimetre = longestSideInPixels / options.knownLongestEdgeInMillimetres;

      // Image rows run downwards while CAD y runs upwards, so the vertical axis is mirrored.
      const toMillimetres = (point: Point2): Point2 =>
        Object.freeze({
          x: (point.x - outlineBounds.minimumX) / pixelsPerMillimetre,
          y: (outlineBounds.maximumY - point.y) / pixelsPerMillimetre,
        });

      const simplifyAndConvert = (points: readonly Point2[]): readonly Point2[] =>
        Object.freeze(
          simplifyClosedPolygon(
            expandPolygonByOnePixel(points),
            options.simplificationTolerance,
          ).map(toMillimetres),
        );

      const outline = Object.freeze(
        simplifyClosedPolygon(outlinePixels, options.simplificationTolerance).map(toMillimetres),
      );

      const cutouts = Object.freeze(
        cutoutContours
          .map((contour) => simplifyAndConvert(contour.points))
          .filter((points) => points.length >= 3 && getPolygonArea(points) > 0),
      );

      return Object.freeze({
        outline,
        cutouts,
        widthInMillimetres: (outlineBounds.maximumX - outlineBounds.minimumX) / pixelsPerMillimetre,
        heightInMillimetres:
          (outlineBounds.maximumY - outlineBounds.minimumY) / pixelsPerMillimetre,
        thicknessInMillimetres: options.thicknessInMillimetres,
        pixelsPerMillimetre,
      });
    },
  });
