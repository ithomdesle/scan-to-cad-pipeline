/**
 * Capture stage: invoke Meshroom/RealityScan or accept pre-captured mesh
 */

import { access } from 'fs/promises';
import type { PipelineConfig } from './types.js';

export async function captureMesh(config: PipelineConfig): Promise<string> {
  if (config.captureMode === 'file') {
    if (!config.inputMeshPath) {
      throw new Error('Input mesh path required for file mode');
    }

    // Verify file exists
    try {
      await access(config.inputMeshPath);
    } catch {
      throw new Error(`Input mesh not found: ${config.inputMeshPath}`);
    }

    return config.inputMeshPath;
  }

  if (config.captureMode === 'meshroom') {
    return await captureMeshroom(config);
  }

  if (config.captureMode === 'realityscan') {
    return await captureRealityScan(config);
  }

  throw new Error(`Unknown capture mode: ${config.captureMode}`);
}

async function captureMeshroom(_config: PipelineConfig): Promise<string> {
  // TODO: SSH into AI PC and run Meshroom headless
  // For now, this is a placeholder that expects manual capture
  
  throw new Error(
    'Meshroom capture not yet implemented. ' +
    'Please run Meshroom on the AI PC (192.168.1.29) and pass the output mesh path directly.'
  );
  
  // Future implementation:
  // 1. SSH to config.aiPcHost
  // 2. Run meshroom_photogrammetry --images /path/to/images --output /path/to/output
  // 3. SCP the resulting mesh back
  // 4. Return local path
}

async function captureRealityScan(_config: PipelineConfig): Promise<string> {
  // TODO: Invoke RealityScan on AI PC
  
  throw new Error(
    'RealityScan capture not yet implemented. ' +
    'Please run RealityScan on the AI PC and pass the output mesh path directly.'
  );
  
  // Future implementation:
  // Similar to Meshroom but with RealityScan CLI (if available)
}
