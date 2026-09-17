import type { MeshReader } from "../../types/mesh-reader.types.js";
import { MeshFileFormat, type Mesh } from "../../types/mesh.types.js";
import { DEFAULT_WELDING_TOLERANCE, weldVertices } from "../vertex-welder/vertex-welder.js";

const HEADER_BYTE_LENGTH = 80;
const TRIANGLE_COUNT_BYTE_LENGTH = 4;
const TRIANGLE_BYTE_LENGTH = 50;

export const getIsBinaryStereolithography = (fileContents: Buffer): boolean => {
  if (fileContents.length < HEADER_BYTE_LENGTH + TRIANGLE_COUNT_BYTE_LENGTH) return false;

  const declaredTriangleCount = fileContents.readUInt32LE(HEADER_BYTE_LENGTH);
  const expectedLength =
    HEADER_BYTE_LENGTH + TRIANGLE_COUNT_BYTE_LENGTH + declaredTriangleCount * TRIANGLE_BYTE_LENGTH;

  // The declared length matching exactly is the only reliable discriminator: an ASCII file may
  // still begin with bytes that read as "solid".
  return expectedLength === fileContents.length;
};

export const readBinaryStereolithography = (fileContents: Buffer): Mesh => {
  if (!getIsBinaryStereolithography(fileContents)) {
    throw new Error("File is not a valid binary STL: declared triangle count does not match size.");
  }

  const triangleCount = fileContents.readUInt32LE(HEADER_BYTE_LENGTH);
  const vertexStream: number[] = new Array(triangleCount * 9);

  let byteOffset = HEADER_BYTE_LENGTH + TRIANGLE_COUNT_BYTE_LENGTH;
  let streamCursor = 0;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    byteOffset += 12;

    for (let cornerIndex = 0; cornerIndex < 3; cornerIndex += 1) {
      vertexStream[streamCursor] = fileContents.readFloatLE(byteOffset);
      vertexStream[streamCursor + 1] = fileContents.readFloatLE(byteOffset + 4);
      vertexStream[streamCursor + 2] = fileContents.readFloatLE(byteOffset + 8);
      byteOffset += 12;
      streamCursor += 3;
    }

    byteOffset += 2;
  }

  return weldVertices(vertexStream, DEFAULT_WELDING_TOLERANCE);
};

export const createBinaryStereolithographyReader = (): MeshReader =>
  Object.freeze({
    format: MeshFileFormat.BINARY_STEREOLITHOGRAPHY,
    getIsSupported: (fileContents: Buffer, fileExtension: string) =>
      fileExtension === ".stl" && getIsBinaryStereolithography(fileContents),
    read: readBinaryStereolithography,
  });
