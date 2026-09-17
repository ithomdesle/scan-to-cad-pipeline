import type { MeshReader } from "../../types/mesh-reader.types.js";
import { MeshFileFormat, type Mesh } from "../../types/mesh.types.js";
import { DEFAULT_WELDING_TOLERANCE, weldVertices } from "../vertex-welder/vertex-welder.js";

const VERTEX_PATTERN = /^vertex\s+(\S+)\s+(\S+)\s+(\S+)/;

export const readAsciiStereolithography = (fileContents: Buffer): Mesh => {
  const vertexStream: number[] = [];

  for (const rawLine of fileContents.toString("utf8").split("\n")) {
    const match = VERTEX_PATTERN.exec(rawLine.trim());
    if (!match) continue;

    const x = Number.parseFloat(match[1]);
    const y = Number.parseFloat(match[2]);
    const z = Number.parseFloat(match[3]);

    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      throw new Error(`Malformed vertex line in ASCII STL: "${rawLine.trim()}"`);
    }

    vertexStream.push(x, y, z);
  }

  if (vertexStream.length === 0 || vertexStream.length % 9 !== 0) {
    throw new Error("ASCII STL contains no complete triangles.");
  }

  return weldVertices(vertexStream, DEFAULT_WELDING_TOLERANCE);
};

export const createAsciiStereolithographyReader = (): MeshReader =>
  Object.freeze({
    format: MeshFileFormat.ASCII_STEREOLITHOGRAPHY,
    getIsSupported: (fileContents: Buffer, fileExtension: string) =>
      fileExtension === ".stl" && fileContents.toString("utf8", 0, 5) === "solid",
    read: readAsciiStereolithography,
  });
