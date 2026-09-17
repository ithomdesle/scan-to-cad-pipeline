export type MeshCleaningOptions = {
  readonly targetTriangleCount: number;
  readonly simplificationErrorTolerance: number;
  readonly smallComponentAreaFraction: number;
  readonly isFillHolesEnabled: boolean;
  readonly weldingTolerance: number;
};

export type MeshCleaningReport = {
  readonly inputTriangleCount: number;
  readonly weldedVertexCount: number;
  readonly simplifiedTriangleCount: number;
  readonly removedComponentCount: number;
  readonly filledHoleCount: number;
  readonly outputTriangleCount: number;
};
