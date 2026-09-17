/**
 * Feature extraction: RANSAC-based plane/cylinder/hole detection
 * Outputs dimensions and geometry for LLM consumption
 */

import { readFile } from 'fs/promises';
import type { MeshData, FeatureSpec, Feature, Plane, Cylinder, Hole, Vec3 } from './types.js';
import { extname } from 'path';
import type { PipelineConfig } from './types.js';

export async function extractFeatures(
  meshPath: string,
  config: PipelineConfig
): Promise<FeatureSpec> {
  // Load mesh
  const ext = extname(meshPath).toLowerCase();
  let meshData: MeshData;

  if (ext === '.stl') {
    meshData = await loadSTLForFeatures(meshPath);
  } else {
    throw new Error(`Unsupported format for feature extraction: ${ext}`);
  }

  const features: Feature[] = [];

  // Extract bounding box and dimensions
  const bbox = computeBoundingBox(meshData);
  const dimensions = {
    length: bbox.max.x - bbox.min.x,
    width: bbox.max.y - bbox.min.y,
    height: bbox.max.z - bbox.min.z,
  };

  console.log(`   Bounding box: [${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}, ${bbox.min.z.toFixed(2)}] to [${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)}, ${bbox.max.z.toFixed(2)}]`);

  // RANSAC plane fitting
  const planes = await extractPlanes(meshData, config);
  features.push(...planes);
  console.log(`   Found ${planes.length} planes`);

  // RANSAC cylinder fitting
  const cylinders = await extractCylinders(meshData, config);
  features.push(...cylinders);
  console.log(`   Found ${cylinders.length} cylinders`);

  // Hole detection (circular features)
  const holes = await extractHoles(meshData, config);
  features.push(...holes);
  console.log(`   Found ${holes.length} holes`);

  return {
    features,
    boundingBox: bbox,
    dimensions,
    metadata: {
      extractedAt: new Date().toISOString(),
      meshTriangles: meshData.triangleCount,
      meshVertices: meshData.vertexCount,
    },
  };
}

async function loadSTLForFeatures(path: string): Promise<MeshData> {
  const buffer = await readFile(path);
  const header = buffer.toString('utf8', 0, 5);
  
  if (header === 'solid') {
    throw new Error('ASCII STL not supported for feature extraction. Use binary STL.');
  }
  
  return parseBinarySTL(buffer);
}

function parseBinarySTL(buffer: Buffer): MeshData {
  const triangleCount = buffer.readUInt32LE(80);
  const vertices: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();
  
  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    offset += 12; // Skip normal
    
    for (let j = 0; j < 3; j++) {
      const x = buffer.readFloatLE(offset);
      const y = buffer.readFloatLE(offset + 4);
      const z = buffer.readFloatLE(offset + 8);
      offset += 12;
      
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      let index = vertexMap.get(key);
      
      if (index === undefined) {
        index = vertices.length / 3;
        vertices.push(x, y, z);
        vertexMap.set(key, index);
      }
      
      indices.push(index);
    }
    
    offset += 2;
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    triangleCount,
    vertexCount: vertices.length / 3,
  };
}

function computeBoundingBox(mesh: MeshData): { min: Vec3; max: Vec3 } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    const x = mesh.vertices[i];
    const y = mesh.vertices[i + 1];
    const z = mesh.vertices[i + 2];
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

async function extractPlanes(mesh: MeshData, config: PipelineConfig): Promise<Plane[]> {
  const planes: Plane[] = [];
  const used = new Set<number>();
  
  // Run RANSAC multiple times to find dominant planes
  for (let iter = 0; iter < 6; iter++) { // Try to find up to 6 planes (typical box has 6 faces)
    if (used.size >= mesh.triangleCount * 0.9) break;
    
    const plane = ransacPlane(mesh, config, used);
    if (plane && plane.inliers >= config.minPlaneInliers) {
      planes.push(plane);
      
      // Mark inliers as used
      const inlierIndices = getPlaneInliers(mesh, plane, config.ransacThreshold, used);
      for (const idx of inlierIndices) {
        used.add(idx);
      }
    } else {
      break;
    }
  }
  
  return planes;
}

function ransacPlane(
  mesh: MeshData,
  config: PipelineConfig,
  used: Set<number>
): Plane | null {
  let bestPlane: Plane | null = null;
  let bestInliers = 0;
  
  for (let i = 0; i < config.ransacIterations; i++) {
    // Sample 3 random points not in 'used'
    const samples: Vec3[] = [];
    const maxAttempts = 100;
    let attempts = 0;
    
    while (samples.length < 3 && attempts < maxAttempts) {
      const triIdx = Math.floor(Math.random() * mesh.triangleCount);
      if (used.has(triIdx)) {
        attempts++;
        continue;
      }
      
      const vertIdx = mesh.indices[triIdx * 3] * 3;
      samples.push({
        x: mesh.vertices[vertIdx],
        y: mesh.vertices[vertIdx + 1],
        z: mesh.vertices[vertIdx + 2],
      });
      attempts++;
    }
    
    if (samples.length < 3) continue;
    
    // Compute plane from 3 points
    const v1 = subtract(samples[1], samples[0]);
    const v2 = subtract(samples[2], samples[0]);
    const normal = normalize(cross(v1, v2));
    
    if (isNaN(normal.x) || isNaN(normal.y) || isNaN(normal.z)) continue;
    
    // Count inliers
    let inliers = 0;
    for (let j = 0; j < mesh.triangleCount; j++) {
      if (used.has(j)) continue;
      
      const vertIdx = mesh.indices[j * 3] * 3;
      const point = {
        x: mesh.vertices[vertIdx],
        y: mesh.vertices[vertIdx + 1],
        z: mesh.vertices[vertIdx + 2],
      };
      
      const dist = Math.abs(dot(subtract(point, samples[0]), normal));
      if (dist < config.ransacThreshold) {
        inliers++;
      }
    }
    
    if (inliers > bestInliers) {
      bestInliers = inliers;
      bestPlane = {
        type: 'plane',
        normal,
        point: samples[0],
        area: 0, // Will compute later
        inliers,
      };
    }
  }
  
  return bestPlane;
}

function getPlaneInliers(
  mesh: MeshData,
  plane: Plane,
  threshold: number,
  exclude: Set<number>
): number[] {
  const inliers: number[] = [];
  
  for (let i = 0; i < mesh.triangleCount; i++) {
    if (exclude.has(i)) continue;
    
    const vertIdx = mesh.indices[i * 3] * 3;
    const point = {
      x: mesh.vertices[vertIdx],
      y: mesh.vertices[vertIdx + 1],
      z: mesh.vertices[vertIdx + 2],
    };
    
    const dist = Math.abs(dot(subtract(point, plane.point), plane.normal));
    if (dist < threshold) {
      inliers.push(i);
    }
  }
  
  return inliers;
}

async function extractCylinders(mesh: MeshData, config: PipelineConfig): Promise<Cylinder[]> {
  const cylinders: Cylinder[] = [];
  const used = new Set<number>();
  
  // Run RANSAC to find cylinders
  for (let iter = 0; iter < 4; iter++) { // Try to find up to 4 cylinders
    if (used.size >= mesh.triangleCount * 0.8) break;
    
    const cylinder = ransacCylinder(mesh, config, used);
    if (cylinder && cylinder.inliers >= config.minCylinderInliers) {
      cylinders.push(cylinder);
      
      const inlierIndices = getCylinderInliers(mesh, cylinder, config.ransacThreshold, used);
      for (const idx of inlierIndices) {
        used.add(idx);
      }
    } else {
      break;
    }
  }
  
  return cylinders;
}

function ransacCylinder(
  mesh: MeshData,
  config: PipelineConfig,
  used: Set<number>
): Cylinder | null {
  let bestCylinder: Cylinder | null = null;
  let bestInliers = 0;
  
  // Simplified cylinder fitting: assume axis-aligned cylinders for now
  const axes: Vec3[] = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
  
  for (const axis of axes) {
    for (let i = 0; i < config.ransacIterations / 3; i++) {
      // Sample random point
      const triIdx = Math.floor(Math.random() * mesh.triangleCount);
      if (used.has(triIdx)) continue;
      
      const vertIdx = mesh.indices[triIdx * 3] * 3;
      const point = {
        x: mesh.vertices[vertIdx],
        y: mesh.vertices[vertIdx + 1],
        z: mesh.vertices[vertIdx + 2],
      };
      
      // Compute center on perpendicular plane
      const center = projectOntoPlane(point, { x: 0, y: 0, z: 0 }, axis);
      
      // Estimate radius from nearby points
      let radius = 0;
      let count = 0;
      for (let j = 0; j < Math.min(100, mesh.triangleCount); j++) {
        const idx = Math.floor(Math.random() * mesh.triangleCount);
        if (used.has(idx)) continue;
        
        const vIdx = mesh.indices[idx * 3] * 3;
        const p = {
          x: mesh.vertices[vIdx],
          y: mesh.vertices[vIdx + 1],
          z: mesh.vertices[vIdx + 2],
        };
        
        const proj = projectOntoPlane(p, center, axis);
        const dist = distance(p, proj);
        radius += dist;
        count++;
      }
      
      if (count === 0) continue;
      radius /= count;
      
      if (radius < 0.1) continue; // Too small
      
      // Count inliers
      let inliers = 0;
      for (let j = 0; j < mesh.triangleCount; j++) {
        if (used.has(j)) continue;
        
        const vIdx = mesh.indices[j * 3] * 3;
        const p = {
          x: mesh.vertices[vIdx],
          y: mesh.vertices[vIdx + 1],
          z: mesh.vertices[vIdx + 2],
        };
        
        const proj = projectOntoPlane(p, center, axis);
        const dist = Math.abs(distance(p, proj) - radius);
        
        if (dist < config.ransacThreshold) {
          inliers++;
        }
      }
      
      if (inliers > bestInliers && inliers >= config.minCylinderInliers) {
        bestInliers = inliers;
        bestCylinder = {
          type: 'cylinder',
          axis,
          center,
          radius,
          height: 0, // Will estimate later
          inliers,
        };
      }
    }
  }
  
  return bestCylinder;
}

function getCylinderInliers(
  mesh: MeshData,
  cylinder: Cylinder,
  threshold: number,
  exclude: Set<number>
): number[] {
  const inliers: number[] = [];
  
  for (let i = 0; i < mesh.triangleCount; i++) {
    if (exclude.has(i)) continue;
    
    const vertIdx = mesh.indices[i * 3] * 3;
    const p = {
      x: mesh.vertices[vertIdx],
      y: mesh.vertices[vertIdx + 1],
      z: mesh.vertices[vertIdx + 2],
    };
    
    const proj = projectOntoPlane(p, cylinder.center, cylinder.axis);
    const dist = Math.abs(distance(p, proj) - cylinder.radius);
    
    if (dist < threshold) {
      inliers.push(i);
    }
  }
  
  return inliers;
}

async function extractHoles(_mesh: MeshData, _config: PipelineConfig): Promise<Hole[]> {
  // Simplified hole detection: look for circular boundary edges
  // For now, return empty array - holes are complex to detect
  return [];
}

// Vector math utilities
function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function distance(a: Vec3, b: Vec3): number {
  return length(subtract(a, b));
}

function projectOntoPlane(point: Vec3, planePoint: Vec3, normal: Vec3): Vec3 {
  const v = subtract(point, planePoint);
  const d = dot(v, normal);
  return {
    x: point.x - d * normal.x,
    y: point.y - d * normal.y,
    z: point.z - d * normal.z,
  };
}
