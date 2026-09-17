import type { BinaryImage } from "../../types/profile.types.js";

export const computeOtsuThreshold = (greyscale: Uint8Array): number => {
  const histogram = new Uint32Array(256);
  for (const value of greyscale) histogram[value] += 1;

  const total = greyscale.length;
  let sumOfAll = 0;
  for (let level = 0; level < 256; level += 1) sumOfAll += level * histogram[level];

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let bestThreshold = 127;

  for (let level = 0; level < 256; level += 1) {
    backgroundWeight += histogram[level];
    if (backgroundWeight === 0) continue;

    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;

    backgroundSum += level * histogram[level];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sumOfAll - backgroundSum) / foregroundWeight;
    const betweenClassVariance =
      backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

    if (betweenClassVariance > bestVariance) {
      bestVariance = betweenClassVariance;
      bestThreshold = level;
    }
  }

  return bestThreshold;
};

// The part is whichever class does not dominate the image border, so the photo does not have to be
// taken on a specifically light or dark surface.
export const binarizeImage = (
  greyscale: Uint8Array,
  width: number,
  height: number,
): BinaryImage => {
  const threshold = computeOtsuThreshold(greyscale);
  const isAboveThreshold = new Uint8Array(greyscale.length);
  for (let index = 0; index < greyscale.length; index += 1) {
    isAboveThreshold[index] = greyscale[index] > threshold ? 1 : 0;
  }

  let borderAboveCount = 0;
  let borderTotal = 0;

  for (let column = 0; column < width; column += 1) {
    borderAboveCount += isAboveThreshold[column];
    borderAboveCount += isAboveThreshold[(height - 1) * width + column];
    borderTotal += 2;
  }
  for (let row = 0; row < height; row += 1) {
    borderAboveCount += isAboveThreshold[row * width];
    borderAboveCount += isAboveThreshold[row * width + width - 1];
    borderTotal += 2;
  }

  const isBorderMostlyAbove = borderAboveCount * 2 > borderTotal;
  const isForeground = new Uint8Array(greyscale.length);
  for (let index = 0; index < greyscale.length; index += 1) {
    isForeground[index] = isAboveThreshold[index] === (isBorderMostlyAbove ? 0 : 1) ? 1 : 0;
  }

  return Object.freeze({ width, height, isForeground });
};
