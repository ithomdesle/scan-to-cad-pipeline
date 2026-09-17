export type Point2 = {
  readonly x: number;
  readonly y: number;
};

export type Contour = {
  readonly points: readonly Point2[];
  readonly areaInPixels: number;
};

export type PartProfile = {
  readonly outline: readonly Point2[];
  readonly cutouts: readonly (readonly Point2[])[];
  readonly widthInMillimetres: number;
  readonly heightInMillimetres: number;
  readonly thicknessInMillimetres: number;
  readonly pixelsPerMillimetre: number;
};

export type ProfileExtractionOptions = {
  readonly knownLongestEdgeInMillimetres: number;
  readonly thicknessInMillimetres: number;
  readonly simplificationTolerance: number;
  readonly minimumCutoutAreaFraction: number;
  readonly minimumCutoutIntensityMatch: number;
};

export type BinaryImage = {
  readonly width: number;
  readonly height: number;
  readonly isForeground: Uint8Array;
};
