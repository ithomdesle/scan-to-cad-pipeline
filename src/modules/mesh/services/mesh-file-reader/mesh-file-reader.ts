import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import type { Mesh } from "../../types/mesh.types.js";
import type { MeshReader } from "../../types/mesh-reader.types.js";
import { createAsciiStereolithographyReader } from "../ascii-stereolithography-reader/ascii-stereolithography-reader.js";
import { createBinaryStereolithographyReader } from "../binary-stereolithography-reader/binary-stereolithography-reader.js";
import { createWavefrontObjectReader } from "../wavefront-object-reader/wavefront-object-reader.js";

const readers: readonly MeshReader[] = Object.freeze([
  createBinaryStereolithographyReader(),
  createAsciiStereolithographyReader(),
  createWavefrontObjectReader(),
]);

export const readMeshFromBuffer = (fileContents: Buffer, fileExtension: string): Mesh => {
  const reader = readers.find((candidate) =>
    candidate.getIsSupported(fileContents, fileExtension.toLowerCase()),
  );

  if (!reader) {
    throw new Error(
      `Unsupported mesh file "${fileExtension}". Supported formats: binary STL, ASCII STL, OBJ.`,
    );
  }

  return reader.read(fileContents);
};

export const readMeshFromFile = async (filePath: string): Promise<Mesh> =>
  readMeshFromBuffer(await readFile(filePath), extname(filePath));
