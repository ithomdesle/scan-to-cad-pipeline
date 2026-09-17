/**
 * Clean stage: meshoptimizer WASM integration
 * Decimate, remove small components, fill holes
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname, extname } from 'path';
import type { PipelineConfig, MeshData } from './types.js';

export async function cleanMesh(
  inputPath: string,
  config: PipelineConfig
): Promise<string> {
  console.log(`   Loading mesh: ${inputPath}`);
  
  const ext = extname(inputPath).toLowerCase();
  let meshData: MeshData;

  if (ext === '.stl') {
    meshData = await loadSTL(inputPath);
  } else if (ext === '.obj') {
    meshData = await loadOBJ(inputPath);
  } else {
    throw new Error(`Unsupported mesh format: ${ext}. Use .stl or .obj`);
  }

  console.log(`   Input: ${meshData.triangleCount} triangles, ${meshData.vertexCount} vertices`);

  // Decimate to target face count
  if (meshData.triangleCount > config.targetFaceCount) {
    console.log(`   Decimating to ${config.targetFaceCount} faces...`);
    meshData = await decimateMesh(meshData, config.targetFaceCount);
  }

  // Remove small disconnected components
  if (config.removeSmallComponentsThreshold > 0) {
    console.log(`   Removing small components (threshold: ${config.removeSmallComponentsThreshold})...`);
    meshData = await removeSmallComponents(meshData, config.removeSmallComponentsThreshold);
  }

  // Fill holes (simple approach: just clean up the mesh)
  if (config.fillHoles) {
    console.log(`   Filling holes...`);
    meshData = await fillHolesMesh(meshData);
  }

  console.log(`   Output: ${meshData.triangleCount} triangles, ${meshData.vertexCount} vertices`);

  // Save cleaned mesh
  const outputPath = resolve(config.outputDir, 'cleaned.stl');
  await mkdir(dirname(outputPath), { recursive: true });
  await saveSTL(outputPath, meshData);

  return outputPath;
}

async function loadSTL(path: string): Promise<MeshData> {
  const buffer = await readFile(path);
  
  // Check if binary or ASCII
  const header = buffer.toString('utf8', 0, 5);
  if (header === 'solid') {
    return parseASCIISTL(buffer.toString('utf8'));
  } else {
    return parseBinarySTL(buffer);
  }
}

function parseBinarySTL(buffer: Buffer): MeshData {
  // Binary STL format:
  // 80 bytes header
  // 4 bytes triangle count (uint32)
  // For each triangle:
  //   12 bytes normal (3 × float32)
  //   12 bytes v1 (3 × float32)
  //   12 bytes v2 (3 × float32)
  //   12 bytes v3 (3 × float32)
  //   2 bytes attribute (uint16)
  
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
    
    offset += 2; // Skip attribute
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    triangleCount,
    vertexCount: vertices.length / 3,
  };
}

function parseASCIISTL(content: string): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();
  let triangleCount = 0;
  
  const lines = content.split('\n');
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.startsWith('facet')) {
      triangleCount++;
      i++; // Skip facet normal
      i++; // Skip outer loop
      
      for (let j = 0; j < 3; j++) {
        const vertexLine = lines[i++].trim();
        const match = vertexLine.match(/vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/);
        if (match) {
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);
          const z = parseFloat(match[3]);
          
          const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
          let index = vertexMap.get(key);
          
          if (index === undefined) {
            index = vertices.length / 3;
            vertices.push(x, y, z);
            vertexMap.set(key, index);
          }
          
          indices.push(index);
        }
      }
      
      i++; // Skip endloop
      i++; // Skip endfacet
    } else {
      i++;
    }
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    triangleCount,
    vertexCount: vertices.length / 3,
  };
}

async function loadOBJ(path: string): Promise<MeshData> {
  const content = await readFile(path, 'utf-8');
  const vertices: number[] = [];
  const indices: number[] = [];
  let triangleCount = 0;
  
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      vertices.push(
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3])
      );
    } else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      const faceIndices = parts.map(p => {
        const idx = parseInt(p.split('/')[0], 10);
        return idx > 0 ? idx - 1 : vertices.length / 3 + idx;
      });
      
      // Triangulate if needed
      for (let i = 1; i < faceIndices.length - 1; i++) {
        indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
        triangleCount++;
      }
    }
  }
  
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    triangleCount,
    vertexCount: vertices.length / 3,
  };
}

async function decimateMesh(mesh: MeshData, targetFaceCount: number): Promise<MeshData> {
  // Simple decimation using edge collapse
  // This is a simplified version - in production, use meshoptimizer WASM
  
  if (mesh.triangleCount <= targetFaceCount) {
    return mesh;
  }
  
  const ratio = targetFaceCount / mesh.triangleCount;
  
  // For now, just sample triangles uniformly
  // TODO: Replace with proper meshoptimizer simplification
  const newIndices: number[] = [];
  
  for (let i = 0; i < mesh.indices.length; i += 3) {
    if (Math.random() < ratio) {
      newIndices.push(
        mesh.indices[i],
        mesh.indices[i + 1],
        mesh.indices[i + 2]
      );
    }
  }
  
  return {
    vertices: mesh.vertices,
    indices: new Uint32Array(newIndices),
    triangleCount: newIndices.length / 3,
    vertexCount: mesh.vertexCount,
  };
}

async function removeSmallComponents(
  mesh: MeshData,
  threshold: number
): Promise<MeshData> {
  // Build adjacency graph
  const adjacency = new Map<number, Set<number>>();
  
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const i0 = mesh.indices[i];
    const i1 = mesh.indices[i + 1];
    const i2 = mesh.indices[i + 2];
    
    if (!adjacency.has(i0)) adjacency.set(i0, new Set());
    if (!adjacency.has(i1)) adjacency.set(i1, new Set());
    if (!adjacency.has(i2)) adjacency.set(i2, new Set());
    
    adjacency.get(i0)!.add(i / 3);
    adjacency.get(i1)!.add(i / 3);
    adjacency.get(i2)!.add(i / 3);
  }
  
  // Find connected components
  const visited = new Set<number>();
  const components: number[][] = [];
  
  for (let triIdx = 0; triIdx < mesh.triangleCount; triIdx++) {
    if (visited.has(triIdx)) continue;
    
    const component: number[] = [];
    const queue = [triIdx];
    visited.add(triIdx);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      
      const i0 = mesh.indices[current * 3];
      const i1 = mesh.indices[current * 3 + 1];
      const i2 = mesh.indices[current * 3 + 2];
      
      for (const neighbor of [
        ...(adjacency.get(i0) || []),
        ...(adjacency.get(i1) || []),
        ...(adjacency.get(i2) || []),
      ]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    
    components.push(component);
  }
  
  // Keep only large components
  const minSize = mesh.triangleCount * threshold;
  const keepTriangles = new Set<number>();
  
  for (const component of components) {
    if (component.length >= minSize) {
      for (const tri of component) {
        keepTriangles.add(tri);
      }
    }
  }
  
  // Build new mesh
  const newIndices: number[] = [];
  for (const tri of keepTriangles) {
    newIndices.push(
      mesh.indices[tri * 3],
      mesh.indices[tri * 3 + 1],
      mesh.indices[tri * 3 + 2]
    );
  }
  
  return {
    vertices: mesh.vertices,
    indices: new Uint32Array(newIndices),
    triangleCount: newIndices.length / 3,
    vertexCount: mesh.vertexCount,
  };
}

async function fillHolesMesh(mesh: MeshData): Promise<MeshData> {
  // Simplified hole filling - just return the mesh
  // TODO: Implement proper hole detection and filling
  return mesh;
}

async function saveSTL(path: string, mesh: MeshData): Promise<void> {
  // Write binary STL
  const buffer = Buffer.alloc(80 + 4 + mesh.triangleCount * 50);
  
  // Header (80 bytes)
  buffer.write('Binary STL generated by scan-to-cad-pipeline', 0);
  
  // Triangle count
  buffer.writeUInt32LE(mesh.triangleCount, 80);
  
  let offset = 84;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const i0 = mesh.indices[i] * 3;
    const i1 = mesh.indices[i + 1] * 3;
    const i2 = mesh.indices[i + 2] * 3;
    
    const v1 = [mesh.vertices[i0], mesh.vertices[i0 + 1], mesh.vertices[i0 + 2]];
    const v2 = [mesh.vertices[i1], mesh.vertices[i1 + 1], mesh.vertices[i1 + 2]];
    const v3 = [mesh.vertices[i2], mesh.vertices[i2 + 1], mesh.vertices[i2 + 2]];
    
    // Calculate normal
    const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
    const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
    const normal = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0],
    ];
    const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    if (len > 0) {
      normal[0] /= len;
      normal[1] /= len;
      normal[2] /= len;
    }
    
    // Write normal
    buffer.writeFloatLE(normal[0], offset);
    buffer.writeFloatLE(normal[1], offset + 4);
    buffer.writeFloatLE(normal[2], offset + 8);
    offset += 12;
    
    // Write vertices
    for (const v of [v1, v2, v3]) {
      buffer.writeFloatLE(v[0], offset);
      buffer.writeFloatLE(v[1], offset + 4);
      buffer.writeFloatLE(v[2], offset + 8);
      offset += 12;
    }
    
    // Attribute (unused)
    buffer.writeUInt16LE(0, offset);
    offset += 2;
  }
  
  await writeFile(path, buffer);
}
