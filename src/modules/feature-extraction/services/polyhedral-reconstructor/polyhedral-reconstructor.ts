import {
  buildTriangleAdjacency,
  buildTriangleAttributes,
  getVertexPosition,
  type Mesh,
} from "../../../mesh/index.js";
import type {
  PolyhedralFace,
  PolyhedralReconstructionOptions,
  PolyhedralSolid,
  Point3,
} from "../../types/polyhedron.types.js";
import {
  createVector3,
  dotProduct,
  subtractVectors,
} from "../../../../shared/utils/vector/vector.js";
import { fitPlane } from "../plane-fitter/plane-fitter.js";
import type {
  TriangleAdjacency,
  TriangleAttributes,
} from "../../../mesh/services/mesh-topology/mesh-topology.js";
import {
  createPlanePlacement,
  findFaceBoundaryLoops,
  projectLoopToPlane,
} from "../face-boundary-extractor/face-boundary-extractor.js";

export const DEFAULT_POLYHEDRAL_RECONSTRUCTION_OPTIONS: PolyhedralReconstructionOptions =
  Object.freeze({
    coplanarAngleToleranceDegrees: 0.1,
    maximumPlaneResidual: 0.001,
    maximumBoundaryDeviation: 0.0001,
  });

const getTrianglePoints = (mesh: Mesh, triangleIndex: number): readonly Point3[] =>
  [0, 1, 2].map((corner) => {
    const position = getVertexPosition(mesh, mesh.indices[triangleIndex * 3 + corner]);
    return [position.x, position.y, position.z] as Point3;
  });

// A designed STL already carries the exact geometry, only tessellated. Merging each set of
// coplanar triangles back into one face and sewing the result reproduces the solid exactly, which
// no primitive description of an irregular part can do.
type CoplanarGroup = { readonly triangleIndices: readonly number[] };

// Two triangles belong to the same face only when they share a plane, not merely a direction: on a
// curved surface a normal-only test walks a band right around the curvature.
const groupCoplanarTriangles = (
  mesh: Mesh,
  attributes: TriangleAttributes,
  adjacency: TriangleAdjacency,
  options: PolyhedralReconstructionOptions,
): readonly CoplanarGroup[] => {
  const minimumCosine = Math.cos((options.coplanarAngleToleranceDegrees * Math.PI) / 180);
  const isAssigned = new Uint8Array(mesh.triangleCount);
  const groups: CoplanarGroup[] = [];

  for (let seedTriangle = 0; seedTriangle < mesh.triangleCount; seedTriangle += 1) {
    if (isAssigned[seedTriangle] === 1) continue;
    if (attributes.areas[seedTriangle] <= 0) {
      isAssigned[seedTriangle] = 1;
      continue;
    }

    const seedNormal = createVector3(
      attributes.normals[seedTriangle * 3],
      attributes.normals[seedTriangle * 3 + 1],
      attributes.normals[seedTriangle * 3 + 2],
    );
    const seedOrigin = createVector3(
      attributes.centroids[seedTriangle * 3],
      attributes.centroids[seedTriangle * 3 + 1],
      attributes.centroids[seedTriangle * 3 + 2],
    );

    const triangleIndices: number[] = [];
    const stack = [seedTriangle];
    isAssigned[seedTriangle] = 1;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      triangleIndices.push(current);

      for (
        let cursor = adjacency.neighbourOffsets[current];
        cursor < adjacency.neighbourOffsets[current + 1];
        cursor += 1
      ) {
        const neighbour = adjacency.neighbourIndices[cursor];
        if (isAssigned[neighbour] === 1 || attributes.areas[neighbour] <= 0) continue;

        const neighbourNormal = createVector3(
          attributes.normals[neighbour * 3],
          attributes.normals[neighbour * 3 + 1],
          attributes.normals[neighbour * 3 + 2],
        );
        if (dotProduct(seedNormal, neighbourNormal) < minimumCosine) continue;

        const isOnSeedPlane = [0, 1, 2].every((corner) => {
          const offset = subtractVectors(
            getVertexPosition(mesh, mesh.indices[neighbour * 3 + corner]),
            seedOrigin,
          );
          return Math.abs(dotProduct(offset, seedNormal)) <= options.maximumBoundaryDeviation;
        });
        if (!isOnSeedPlane) continue;

        isAssigned[neighbour] = 1;
        stack.push(neighbour);
      }
    }

    groups.push(Object.freeze({ triangleIndices }));
  }

  return Object.freeze(groups);
};

export const reconstructPolyhedron = (
  mesh: Mesh,
  options: PolyhedralReconstructionOptions,
): PolyhedralSolid => {
  const attributes = buildTriangleAttributes(mesh);
  const adjacency = buildTriangleAdjacency(mesh);

  const segments = groupCoplanarTriangles(mesh, attributes, adjacency, options);

  const faces: PolyhedralFace[] = [];
  let mergedFaceCount = 0;
  let triangleFaceCount = 0;

  for (const segment of segments) {
    const fit = fitPlane(attributes, segment.triangleIndices);

    const emitTrianglesIndividually = () => {
      for (const triangleIndex of segment.triangleIndices) {
        faces.push(Object.freeze({ outer: getTrianglePoints(mesh, triangleIndex), inners: [] }));
        triangleFaceCount += 1;
      }
    };

    if (fit.residual > options.maximumPlaneResidual) {
      emitTrianglesIndividually();
      continue;
    }

    const placement = createPlanePlacement(fit.normal, fit.origin);
    const loops = findFaceBoundaryLoops(mesh, segment.triangleIndices)
      .map((loop) => ({
        vertexIndices: loop,
        signedArea: projectLoopToPlane(mesh, loop, placement).signedArea,
      }))
      .filter((loop) => loop.vertexIndices.length >= 3)
      .sort((left, right) => Math.abs(right.signedArea) - Math.abs(left.signedArea));

    if (loops.length === 0) {
      emitTrianglesIndividually();
      continue;
    }

    const toPoints = (vertexIndices: readonly number[]): readonly Point3[] =>
      vertexIndices.map((vertexIndex) => {
        const position = getVertexPosition(mesh, vertexIndex);
        return [position.x, position.y, position.z] as Point3;
      });

    // The segment being flat on average is not enough: the kernel needs every boundary point to
    // lie in the plane, or it refuses the wire outright.
    const getIsLoopPlanar = (vertexIndices: readonly number[]): boolean =>
      vertexIndices.every((vertexIndex) => {
        const offset = subtractVectors(getVertexPosition(mesh, vertexIndex), fit.origin);
        return Math.abs(dotProduct(offset, fit.normal)) <= options.maximumBoundaryDeviation;
      });

    if (!loops.every((loop) => getIsLoopPlanar(loop.vertexIndices))) {
      emitTrianglesIndividually();
      continue;
    }

    faces.push(
      Object.freeze({
        outer: toPoints(loops[0].vertexIndices),
        inners: Object.freeze(loops.slice(1).map((loop) => toPoints(loop.vertexIndices))),
      }),
    );
    mergedFaceCount += 1;
  }

  return Object.freeze({
    faces: Object.freeze(faces),
    mergedFaceCount,
    triangleFaceCount,
  });
};
