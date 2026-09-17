export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Triangle {
  v1: Vec3;
  v2: Vec3;
  v3: Vec3;
  normal: Vec3;
}

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
  vertexCount: number;
}

export interface Plane {
  type: 'plane';
  normal: Vec3;
  point: Vec3;
  area: number;
  inliers: number;
}

export interface Cylinder {
  type: 'cylinder';
  axis: Vec3;
  center: Vec3;
  radius: number;
  height: number;
  inliers: number;
}

export interface Hole {
  type: 'hole';
  center: Vec3;
  normal: Vec3;
  radius: number;
  depth: number;
}

export type Feature = Plane | Cylinder | Hole;

export interface FeatureSpec {
  features: Feature[];
  boundingBox: {
    min: Vec3;
    max: Vec3;
  };
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  metadata: {
    extractedAt: string;
    meshTriangles: number;
    meshVertices: number;
  };
}

export interface PipelineConfig {
  captureMode: 'meshroom' | 'realityscan' | 'file';
  aiPcHost: string;
  aiPcPort: number;
  inputMeshPath?: string;

  targetFaceCount: number;
  removeSmallComponentsThreshold: number;
  isFillHoles: boolean;

  ransacIterations: number;
  ransacThreshold: number;
  minPlaneInliers: number;
  minCylinderInliers: number;

  lmStudioEndpoint: string;
  lmStudioModel: string;
  llmTemperature: number;
  llmMaxTokens: number;

  openscadBinary: string;
  stepFormat: 'AP214' | 'AP242';
  outputDir: string;
}

export interface PipelineResult {
  isSuccess: boolean;
  stepFile?: string;
  openscadFile?: string;
  featuresFile?: string;
  cleanedMeshFile?: string;
  error?: string;
  stages: {
    isCapture: boolean;
    isClean: boolean;
    isFeatures: boolean;
    isGenerate: boolean;
    isExport: boolean;
  };
}

export interface OpenSCADGenerationRequest {
  features: Feature[];
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  boundingBox: {
    min: Vec3;
    max: Vec3;
  };
}
