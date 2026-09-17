import { spawn } from 'child_process';
import { resolve } from 'path';
import { access } from 'fs/promises';
import type { PipelineConfig } from './types.js';

export async function exportSTEP(
  openscadPath: string,
  config: PipelineConfig
): Promise<string> {
  try {
    await access(openscadPath);
  } catch {
    throw new Error(`OpenSCAD file not found: ${openscadPath}`);
  }

  const stepPath = resolve(config.outputDir, 'part.step');

  console.log(`   Running: ${config.openscadBinary} -o ${stepPath} ${openscadPath}`);

  return new Promise((resolve, reject) => {
    const args = ['-o', stepPath, openscadPath];
    
    const proc = spawn(config.openscadBinary, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn OpenSCAD: ${error.message}. Ensure OpenSCAD is installed and in PATH.`));
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`OpenSCAD exited with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
        return;
      }

      try {
        await access(stepPath);
        resolve(stepPath);
      } catch {
        reject(new Error(`OpenSCAD succeeded but STEP file not found: ${stepPath}`));
      }
    });
  });
}
