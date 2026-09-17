import type { Mesh } from "../../types/mesh.types.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";

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
