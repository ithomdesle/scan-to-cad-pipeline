import type { MeshReader } from "../../types/mesh-reader.types.js";
import { MeshFileFormat, type Mesh } from "../../types/mesh.types.js";
import { DEFAULT_WELDING_TOLERANCE, weldVertices } from "../vertex-welder/vertex-welder.js";

const resolveVertexReference = (reference: string, declaredVertexCount: number): number => {
  const parsed = Number.parseInt(reference.split("/")[0], 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Malformed face reference in OBJ file: "${reference}"`);
  }

  return parsed > 0 ? parsed - 1 : declaredVertexCount + parsed;
};

export const readWavefrontObject = (fileContents: Buffer): Mesh => {
  const declaredPositions: number[] = [];
  const vertexStream: number[] = [];

  for (const rawLine of fileContents.toString("utf8").split("\n")) {
    const line = rawLine.trim();

    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      declaredPositions.push(
        Number.parseFloat(parts[1]),
        Number.parseFloat(parts[2]),
        Number.parseFloat(parts[3]),
      );
      continue;
    }

    if (!line.startsWith("f ")) continue;

    const declaredVertexCount = declaredPositions.length / 3;
    const cornerIndices = line
      .split(/\s+/)
      .slice(1)
      .map((reference) => resolveVertexReference(reference, declaredVertexCount));

    for (let fanIndex = 1; fanIndex < cornerIndices.length - 1; fanIndex += 1) {
      for (const cornerIndex of [
        cornerIndices[0],
        cornerIndices[fanIndex],
        cornerIndices[fanIndex + 1],
      ]) {
        if (cornerIndex < 0 || cornerIndex >= declaredVertexCount) {
          throw new Error(`Face references vertex ${cornerIndex + 1} which does not exist.`);
        }

        vertexStream.push(
          declaredPositions[cornerIndex * 3],
          declaredPositions[cornerIndex * 3 + 1],
          declaredPositions[cornerIndex * 3 + 2],
        );
      }
    }
  }

  if (vertexStream.length === 0) {
    throw new Error("OBJ file contains no faces.");
  }

  return weldVertices(vertexStream, DEFAULT_WELDING_TOLERANCE);
};

export const createWavefrontObjectReader = (): MeshReader =>
  Object.freeze({
    format: MeshFileFormat.WAVEFRONT_OBJECT,
    getIsSupported: (_fileContents: Buffer, fileExtension: string) => fileExtension === ".obj",
    read: readWavefrontObject,
  });
