import type { Mesh } from "../../../mesh/index.js";
import type {
  TriangleAdjacency,
  TriangleAttributes,
} from "../../../mesh/services/mesh-topology/mesh-topology.js";

export type Segment = {
  readonly triangleIndices: readonly number[];
  readonly area: number;
};

export type SegmentationInput = {
  readonly mesh: Mesh;
  readonly attributes: TriangleAttributes;
  readonly adjacency: TriangleAdjacency;
  readonly assignedTriangles: Uint8Array;
  readonly angleToleranceDegrees: number;
  readonly isComparedToSeed: boolean;
};

const getNormalDotProduct = (
  normals: Float64Array,
  firstTriangle: number,
  secondTriangle: number,
): number =>
  normals[firstTriangle * 3] * normals[secondTriangle * 3] +
  normals[firstTriangle * 3 + 1] * normals[secondTriangle * 3 + 1] +
  normals[firstTriangle * 3 + 2] * normals[secondTriangle * 3 + 2];

// Seed comparison isolates flat faces; neighbour comparison follows curvature around a cylinder.
export const growSegments = ({
  mesh,
  attributes,
  adjacency,
  assignedTriangles,
  angleToleranceDegrees,
  isComparedToSeed,
}: SegmentationInput): readonly Segment[] => {
  const minimumCosine = Math.cos((angleToleranceDegrees * Math.PI) / 180);

  const seedOrder = Array.from({ length: mesh.triangleCount }, (_value, index) => index).sort(
    (left, right) => attributes.areas[right] - attributes.areas[left],
  );

  const segments: Segment[] = [];

  for (const seedTriangle of seedOrder) {
    if (assignedTriangles[seedTriangle] === 1) continue;

    const triangleIndices: number[] = [];
    const stack = [seedTriangle];
    assignedTriangles[seedTriangle] = 1;
    let area = 0;

    while (stack.length > 0) {
      const currentTriangle = stack.pop() as number;
      triangleIndices.push(currentTriangle);
      area += attributes.areas[currentTriangle];

      const start = adjacency.neighbourOffsets[currentTriangle];
      const end = adjacency.neighbourOffsets[currentTriangle + 1];

      for (let cursor = start; cursor < end; cursor += 1) {
        const neighbourTriangle = adjacency.neighbourIndices[cursor];
        if (assignedTriangles[neighbourTriangle] === 1) continue;

        const referenceTriangle = isComparedToSeed ? seedTriangle : currentTriangle;
        const cosine = getNormalDotProduct(
          attributes.normals,
          referenceTriangle,
          neighbourTriangle,
        );
        if (cosine < minimumCosine) continue;

        assignedTriangles[neighbourTriangle] = 1;
        stack.push(neighbourTriangle);
      }
    }

    segments.push(Object.freeze({ triangleIndices, area }));
  }

  return Object.freeze(segments);
};
