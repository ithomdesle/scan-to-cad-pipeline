import type { Mesh } from "../../types/mesh.types.js";
import { buildTriangleAdjacency, buildTriangleAttributes } from "../mesh-topology/mesh-topology.js";
import { createMesh } from "../vertex-welder/vertex-welder.js";

export type ComponentFilterResult = {
  readonly mesh: Mesh;
  readonly removedComponentCount: number;
};

export const findConnectedComponents = (mesh: Mesh): readonly (readonly number[])[] => {
  const adjacency = buildTriangleAdjacency(mesh);
  const componentByTriangle = new Int32Array(mesh.triangleCount).fill(-1);
  const components: number[][] = [];

  for (let seedIndex = 0; seedIndex < mesh.triangleCount; seedIndex += 1) {
    if (componentByTriangle[seedIndex] !== -1) continue;

    const component: number[] = [];
    const stack = [seedIndex];
    componentByTriangle[seedIndex] = components.length;

    while (stack.length > 0) {
      const currentTriangle = stack.pop() as number;
      component.push(currentTriangle);

      const start = adjacency.neighbourOffsets[currentTriangle];
      const end = adjacency.neighbourOffsets[currentTriangle + 1];

      for (let cursor = start; cursor < end; cursor += 1) {
        const neighbourIndex = adjacency.neighbourIndices[cursor];
        if (componentByTriangle[neighbourIndex] !== -1) continue;
        componentByTriangle[neighbourIndex] = components.length;
        stack.push(neighbourIndex);
      }
    }

    components.push(component);
  }

  return components;
};

export const removeSmallComponents = (
  mesh: Mesh,
  minimumAreaFraction: number,
): ComponentFilterResult => {
  if (minimumAreaFraction <= 0) return Object.freeze({ mesh, removedComponentCount: 0 });

  const attributes = buildTriangleAttributes(mesh);
  const components = findConnectedComponents(mesh);
  const minimumArea = attributes.totalArea * minimumAreaFraction;

  const keptComponents = components.filter(
    (component) =>
      component.reduce((total, triangleIndex) => total + attributes.areas[triangleIndex], 0) >=
      minimumArea,
  );

  if (keptComponents.length === components.length) {
    return Object.freeze({ mesh, removedComponentCount: 0 });
  }

  // Dropping every component would leave nothing to model, so the largest one always survives.
  const survivingComponents =
    keptComponents.length > 0
      ? keptComponents
      : [
          components.reduce((largest, candidate) =>
            candidate.length > largest.length ? candidate : largest,
          ),
        ];

  const indices: number[] = [];
  for (const component of survivingComponents) {
    for (const triangleIndex of component) {
      indices.push(
        mesh.indices[triangleIndex * 3],
        mesh.indices[triangleIndex * 3 + 1],
        mesh.indices[triangleIndex * 3 + 2],
      );
    }
  }

  return Object.freeze({
    mesh: createMesh(mesh.positions, new Uint32Array(indices)),
    removedComponentCount: components.length - survivingComponents.length,
  });
};
