import type { Mesh, MeshFileFormat } from "./mesh.types.js";

export type MeshReader = {
  readonly format: MeshFileFormat;
  readonly getIsSupported: (fileContents: Buffer, fileExtension: string) => boolean;
  readonly read: (fileContents: Buffer) => Mesh;
};

export type MeshWriter = {
  readonly write: (mesh: Mesh) => Buffer;
};
