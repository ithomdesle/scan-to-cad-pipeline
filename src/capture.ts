import { access } from 'fs/promises';
import type { PipelineConfig } from './types.js';

export async function captureMesh(config: PipelineConfig): Promise<string> {
  if (config.captureMode === 'file') {
    if (!config.inputMeshPath) {
      throw new Error('Input mesh path required for file mode');
    }

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
  /*
   * Meshroom capture placeholder: SSH into AI PC and run Meshroom headless.
   * Future implementation:
   * 1. SSH to config.aiPcHost
   * 2. Run meshroom_photogrammetry --images /path/to/images --output /path/to/output
   * 3. SCP the resulting mesh back
   * 4. Return local path
   */
  
  throw new Error(
    'Meshroom capture not yet implemented. ' +
    'Please run Meshroom on the AI PC (192.168.1.29) and pass the output mesh path directly.'
  );
}

async function captureRealityScan(_config: PipelineConfig): Promise<string> {
  /*
   * RealityScan capture placeholder: similar to Meshroom but with RealityScan CLI if available.
   */
  
  throw new Error(
    'RealityScan capture not yet implemented. ' +
    'Please run RealityScan on the AI PC and pass the output mesh path directly.'
  );
}
