#!/usr/bin/env node

/**
 * CLI entry point for scan-to-CAD pipeline
 * One command in, one STEP file out
 */

import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { captureMesh } from './capture.js';
import { cleanMesh } from './clean.js';
import { extractFeatures } from './features.js';
import { generateOpenSCAD } from './generate.js';
import { exportSTEP } from './export.js';
import type { PipelineConfig, PipelineResult } from './types.js';

const program = new Command();

program
  .name('scan2cad')
  .description('Convert 3D scans (STL/OBJ) to editable STEP files for Onshape')
  .version('1.0.0')
  .argument('<input>', 'Input mesh file (STL/OBJ) or "capture" to run photogrammetry')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-c, --config <file>', 'Configuration file (JSON)')
  .option('--target-faces <n>', 'Target face count for decimation', '100000')
  .option('--ai-pc <host>', 'AI PC host for capture', '192.168.1.29')
  .option('--lm-studio <url>', 'LM Studio API endpoint', 'http://192.168.1.144:1001/lmstudio/v1')
  .option('--openscad <path>', 'OpenSCAD binary path', 'openscad')
  .option('--step-format <format>', 'STEP format (AP214/AP242)', 'AP214')
  .action(async (input: string, options: any) => {
    try {
      console.log('🚀 Scan-to-CAD Pipeline starting...\n');

      // Load config
      let config: PipelineConfig;
      if (options.config) {
        const configData = await readFile(options.config, 'utf-8');
        config = JSON.parse(configData);
      } else {
        // Default config
        config = {
          captureMode: input === 'capture' ? 'meshroom' : 'file',
          aiPcHost: options.aiPc,
          aiPcPort: 22,
          inputMeshPath: input === 'capture' ? undefined : resolve(input),
          targetFaceCount: parseInt(options.targetFaces, 10),
          removeSmallComponentsThreshold: 0.01,
          fillHoles: true,
          ransacIterations: 1000,
          ransacThreshold: 0.01,
          minPlaneInliers: 100,
          minCylinderInliers: 50,
          lmStudioEndpoint: options.lmStudio,
          lmStudioModel: 'local-model',
          llmTemperature: 0.2,
          llmMaxTokens: 2000,
          openscadBinary: options.openscad,
          stepFormat: options.stepFormat as 'AP214' | 'AP242',
          outputDir: resolve(options.output),
        };
      }

      const result: PipelineResult = {
        success: false,
        stages: {
          capture: false,
          clean: false,
          features: false,
          generate: false,
          export: false,
        },
      };

      // Stage 1: Capture or load mesh
      console.log('📷 Stage 1: Capture/Load');
      const meshPath = await captureMesh(config);
      console.log(`   ✓ Mesh: ${meshPath}\n`);
      result.stages.capture = true;

      // Stage 2: Clean mesh
      console.log('🧹 Stage 2: Clean mesh');
      const cleanedPath = await cleanMesh(meshPath, config);
      console.log(`   ✓ Cleaned: ${cleanedPath}`);
      console.log(`   ✓ Target: ${config.targetFaceCount} faces\n`);
      result.cleanedMeshFile = cleanedPath;
      result.stages.clean = true;

      // Stage 3: Extract features
      console.log('🔍 Stage 3: Feature extraction');
      const featureSpec = await extractFeatures(cleanedPath, config);
      const featuresPath = resolve(config.outputDir, 'features.json');
      await mkdir(dirname(featuresPath), { recursive: true });
      await writeFile(featuresPath, JSON.stringify(featureSpec, null, 2), 'utf-8');
      console.log(`   ✓ Features: ${featureSpec.features.length} detected`);
      console.log(`   ✓ Dimensions: ${featureSpec.dimensions.length.toFixed(1)}×${featureSpec.dimensions.width.toFixed(1)}×${featureSpec.dimensions.height.toFixed(1)} mm`);
      console.log(`   ✓ Saved: ${featuresPath}\n`);
      result.featuresFile = featuresPath;
      result.stages.features = true;

      // Stage 4: Generate OpenSCAD
      console.log('🤖 Stage 4: LLM → OpenSCAD');
      const openscadCode = await generateOpenSCAD(featureSpec, config);
      const openscadPath = resolve(config.outputDir, 'part.scad');
      await mkdir(dirname(openscadPath), { recursive: true });
      await writeFile(openscadPath, openscadCode, 'utf-8');
      console.log(`   ✓ Generated: ${openscadPath}`);
      console.log(`   ✓ Model: ${config.lmStudioModel}\n`);
      result.openscadFile = openscadPath;
      result.stages.generate = true;

      // Stage 5: Export STEP
      console.log('📦 Stage 5: OpenSCAD → STEP');
      const stepPath = await exportSTEP(openscadPath, config);
      console.log(`   ✓ STEP file: ${stepPath}`);
      console.log(`   ✓ Format: ${config.stepFormat}\n`);
      result.stepFile = stepPath;
      result.stages.export = true;

      result.success = true;

      console.log('✅ Pipeline complete!');
      console.log(`\n📄 Output: ${stepPath}`);
      console.log('\n⚠️  Import note: Onshape will import as editable solid B-Rep,');
      console.log('   NOT parametric feature tree. You can fillet/shell/sketch on faces.');

    } catch (error) {
      console.error('\n❌ Pipeline failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
