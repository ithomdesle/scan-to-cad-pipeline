export type Vector3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type BoundingBox = {
  readonly minimum: Vector3;
  readonly maximum: Vector3;
};

export type Dimensions = {
  readonly length: number;
  readonly width: number;
  readonly height: number;
};
