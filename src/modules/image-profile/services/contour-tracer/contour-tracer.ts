import type { BinaryImage, Contour, Point2 } from "../../types/profile.types.js";

export type LabelledRegions = {
  readonly labels: Int32Array;
  readonly regionSizes: readonly number[];
  readonly isRegionTouchingBorder: readonly boolean[];
};

const NEIGHBOUR_OFFSETS: readonly (readonly [number, number])[] = Object.freeze([
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]);

export const labelRegions = (
  image: BinaryImage,
  targetValue: number,
  isEightConnected: boolean,
): LabelledRegions => {
  const { width, height, isForeground } = image;
  const labels = new Int32Array(width * height).fill(-1);
  const regionSizes: number[] = [];
  const isRegionTouchingBorder: boolean[] = [];
  const connectivity = isEightConnected
    ? NEIGHBOUR_OFFSETS
    : NEIGHBOUR_OFFSETS.filter(([columnStep, rowStep]) => columnStep === 0 || rowStep === 0);

  for (let seedIndex = 0; seedIndex < labels.length; seedIndex += 1) {
    if (labels[seedIndex] !== -1 || isForeground[seedIndex] !== targetValue) continue;

    const label = regionSizes.length;
    const stack = [seedIndex];
    labels[seedIndex] = label;
    let size = 0;
    let isTouchingBorder = false;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      const column = index % width;
      const row = (index - column) / width;
      size += 1;

      if (column === 0 || row === 0 || column === width - 1 || row === height - 1) {
        isTouchingBorder = true;
      }

      for (const [columnStep, rowStep] of connectivity) {
        const nextColumn = column + columnStep;
        const nextRow = row + rowStep;
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= width || nextRow >= height) continue;

        const nextIndex = nextRow * width + nextColumn;
        if (labels[nextIndex] !== -1 || isForeground[nextIndex] !== targetValue) continue;

        labels[nextIndex] = label;
        stack.push(nextIndex);
      }
    }

    regionSizes.push(size);
    isRegionTouchingBorder.push(isTouchingBorder);
  }

  return Object.freeze({ labels, regionSizes, isRegionTouchingBorder });
};

export const getLargestRegionLabel = (regions: LabelledRegions): number => {
  let bestLabel = -1;
  let bestSize = 0;

  regions.regionSizes.forEach((size, label) => {
    if (size > bestSize) {
      bestSize = size;
      bestLabel = label;
    }
  });

  return bestLabel;
};

// Moore-neighbour tracing with Jacob's stopping criterion: walk the region boundary clockwise,
// always resuming the search from where the previous step entered the current pixel.
export const traceRegionBoundary = (
  labels: Int32Array,
  width: number,
  height: number,
  label: number,
): Contour => {
  let startIndex = -1;
  for (let index = 0; index < labels.length; index += 1) {
    if (labels[index] === label) {
      startIndex = index;
      break;
    }
  }

  if (startIndex === -1) return Object.freeze({ points: Object.freeze([]), areaInPixels: 0 });

  const getIsInRegion = (column: number, row: number): boolean =>
    column >= 0 &&
    row >= 0 &&
    column < width &&
    row < height &&
    labels[row * width + column] === label;

  const startColumn = startIndex % width;
  const startRow = (startIndex - startColumn) / width;
  const points: Point2[] = [];

  let currentColumn = startColumn;
  let currentRow = startRow;
  let entryDirection = 6;
  const maximumSteps = width * height * 4;

  for (let step = 0; step < maximumSteps; step += 1) {
    points.push(Object.freeze({ x: currentColumn, y: currentRow }));

    let hasMoved = false;
    for (let probe = 0; probe < 8; probe += 1) {
      const direction = (entryDirection + 1 + probe) % 8;
      const [columnStep, rowStep] = NEIGHBOUR_OFFSETS[direction];
      const nextColumn = currentColumn + columnStep;
      const nextRow = currentRow + rowStep;

      if (!getIsInRegion(nextColumn, nextRow)) continue;

      entryDirection = (direction + 4 + 1) % 8;
      currentColumn = nextColumn;
      currentRow = nextRow;
      hasMoved = true;
      break;
    }

    if (!hasMoved) break;
    if (currentColumn === startColumn && currentRow === startRow) break;
  }

  return Object.freeze({ points: Object.freeze(points), areaInPixels: getPolygonArea(points) });
};

export const getPolygonArea = (points: readonly Point2[]): number => {
  let doubledArea = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    doubledArea += current.x * next.y - next.x * current.y;
  }

  return Math.abs(doubledArea) / 2;
};
