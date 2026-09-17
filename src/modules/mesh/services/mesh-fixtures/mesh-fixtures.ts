import type { Mesh } from "../../types/mesh.types.js";
import {
  createMesh,
  DEFAULT_WELDING_TOLERANCE,
  weldVertices,
} from "../vertex-welder/vertex-welder.js";

export const createUnitCubeMesh = (sideLength = 1): Mesh => {
  const half = sideLength / 2;
  const positions = new Float32Array([
    -half,
    -half,
    -half,
    half,
    -half,
    -half,
    half,
    half,
    -half,
    -half,
    half,
    -half,
    -half,
    -half,
    half,
    half,
    -half,
    half,
    half,
    half,
    half,
    -half,
    half,
    half,
  ]);

  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4,
    7, 0, 7, 3,
  ]);

  return createMesh(positions, indices);
};

export const createOpenSquareMesh = (): Mesh =>
  createMesh(
    new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    new Uint32Array([0, 1, 2, 0, 2, 3]),
  );

export type WasherFixtureOptions = {
  readonly outerRadius: number;
  readonly innerRadius: number;
  readonly height: number;
  readonly segmentCount: number;
};

// A washer exercises every feature kind at once: two annular planes, a convex outer wall and a
// concave bore that must be recognised as a through hole.
export const createWasherMesh = ({
  outerRadius,
  innerRadius,
  height,
  segmentCount,
}: WasherFixtureOptions): Mesh => {
  const positions: number[] = [];
  const indices: number[] = [];

  const outerBottomAt = (segment: number) => segment * 4;
  const outerTopAt = (segment: number) => segment * 4 + 1;
  const innerBottomAt = (segment: number) => segment * 4 + 2;
  const innerTopAt = (segment: number) => segment * 4 + 3;

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const angle = (segment / segmentCount) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    positions.push(outerRadius * cosine, outerRadius * sine, 0);
    positions.push(outerRadius * cosine, outerRadius * sine, height);
    positions.push(innerRadius * cosine, innerRadius * sine, 0);
    positions.push(innerRadius * cosine, innerRadius * sine, height);
  }

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const next = (segment + 1) % segmentCount;

    indices.push(outerBottomAt(segment), outerBottomAt(next), outerTopAt(next));
    indices.push(outerBottomAt(segment), outerTopAt(next), outerTopAt(segment));

    indices.push(innerBottomAt(segment), innerTopAt(next), innerBottomAt(next));
    indices.push(innerBottomAt(segment), innerTopAt(segment), innerTopAt(next));

    indices.push(innerTopAt(segment), outerTopAt(segment), outerTopAt(next));
    indices.push(innerTopAt(segment), outerTopAt(next), innerTopAt(next));

    indices.push(innerBottomAt(segment), outerBottomAt(next), outerBottomAt(segment));
    indices.push(innerBottomAt(segment), innerBottomAt(next), outerBottomAt(next));
  }

  return createMesh(new Float32Array(positions), new Uint32Array(indices));
};

export type PlateFixtureOptions = {
  readonly width: number;
  readonly depth: number;
  readonly thickness: number;
  readonly cutouts: readonly {
    readonly left: number;
    readonly bottom: number;
    readonly right: number;
    readonly top: number;
  }[];
};

// A rectangular plate with rectangular through cutouts: the shape a bounding box cannot represent
// and whose cutout walls are far too small to survive a face-area threshold. Both faces and every
// wall are split on the same grid of cutout edges, so the result is manifold with no T-junctions.
export const createPlateMesh = ({
  width,
  depth,
  thickness,
  cutouts,
}: PlateFixtureOptions): Mesh => {
  const vertexStream: number[] = [];
  const toSortedUnique = (values: readonly number[]) =>
    [...new Set(values)].sort((left, right) => left - right);

  const columnEdges = toSortedUnique([
    0,
    width,
    ...cutouts.flatMap((cutout) => [cutout.left, cutout.right]),
  ]);
  const rowEdges = toSortedUnique([
    0,
    depth,
    ...cutouts.flatMap((cutout) => [cutout.bottom, cutout.top]),
  ]);

  const addQuad = (
    first: readonly [number, number, number],
    second: readonly [number, number, number],
    third: readonly [number, number, number],
    fourth: readonly [number, number, number],
  ) => {
    vertexStream.push(...first, ...second, ...third, ...first, ...third, ...fourth);
  };

  const getIsInsideCutout = (x: number, y: number) =>
    cutouts.some(
      (cutout) => x > cutout.left && x < cutout.right && y > cutout.bottom && y < cutout.top,
    );

  for (let columnIndex = 0; columnIndex < columnEdges.length - 1; columnIndex += 1) {
    for (let rowIndex = 0; rowIndex < rowEdges.length - 1; rowIndex += 1) {
      const left = columnEdges[columnIndex];
      const right = columnEdges[columnIndex + 1];
      const bottom = rowEdges[rowIndex];
      const top = rowEdges[rowIndex + 1];

      if (getIsInsideCutout((left + right) / 2, (bottom + top) / 2)) continue;

      addQuad(
        [left, bottom, thickness],
        [right, bottom, thickness],
        [right, top, thickness],
        [left, top, thickness],
      );
      addQuad([left, top, 0], [right, top, 0], [right, bottom, 0], [left, bottom, 0]);
    }
  }

  const addWallSegment = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    isOutward: boolean,
  ) => {
    const corners: readonly (readonly [number, number, number])[] = [
      [fromX, fromY, 0],
      [toX, toY, 0],
      [toX, toY, thickness],
      [fromX, fromY, thickness],
    ];
    if (isOutward) addQuad(corners[0], corners[1], corners[2], corners[3]);
    else addQuad(corners[3], corners[2], corners[1], corners[0]);
  };

  const addSplitWall = (
    isHorizontal: boolean,
    fixedValue: number,
    from: number,
    to: number,
    isOutward: boolean,
  ) => {
    const edges = (isHorizontal ? columnEdges : rowEdges).filter(
      (edge) => edge > Math.min(from, to) && edge < Math.max(from, to),
    );
    const steps = from < to ? [from, ...edges, to] : [from, ...[...edges].reverse(), to];

    for (let index = 0; index < steps.length - 1; index += 1) {
      if (isHorizontal) {
        addWallSegment(steps[index], fixedValue, steps[index + 1], fixedValue, isOutward);
        continue;
      }
      addWallSegment(fixedValue, steps[index], fixedValue, steps[index + 1], isOutward);
    }
  };

  addSplitWall(true, 0, 0, width, true);
  addSplitWall(false, width, 0, depth, true);
  addSplitWall(true, depth, width, 0, true);
  addSplitWall(false, 0, depth, 0, true);

  for (const cutout of cutouts) {
    addWallSegment(cutout.left, cutout.bottom, cutout.right, cutout.bottom, false);
    addWallSegment(cutout.right, cutout.bottom, cutout.right, cutout.top, false);
    addWallSegment(cutout.right, cutout.top, cutout.left, cutout.top, false);
    addWallSegment(cutout.left, cutout.top, cutout.left, cutout.bottom, false);
  }

  return weldVertices(vertexStream, DEFAULT_WELDING_TOLERANCE);
};
