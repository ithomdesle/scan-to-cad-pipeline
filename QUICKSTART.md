# Quick Start Guide

Get the scan-to-CAD pipeline running in 5 minutes.

## Prerequisites Check

```bash
# Check Node.js version (need ≥18.0.0)
node --version

# Check if OpenSCAD is installed
which openscad
# If not found: sudo apt install openscad

# Verify LM Studio is running
curl http://192.168.1.144:1001/lmstudio/v1/models
```

## Setup

```bash
cd /opt/data/cad-pipeline

# Install dependencies
npm install

# Build TypeScript
npm run build

# Set environment variable
export LM_API_KEY="your-api-key-here"
```

## Test with Sample Cube

```bash
# Generate a test 10mm cube
python3 generate-test-stl.py

# Run the pipeline (this will fail at LLM/OpenSCAD stage without real setup)
npm start -- test-cube.stl -o ./output --target-faces 12

# Expected output structure:
# output/
#   cleaned.stl      - Decimated mesh
#   features.json    - Extracted geometry features
#   part.scad        - Generated OpenSCAD code
#   part.step        - Final STEP file
```

## Real Usage

```bash
# Process a real scan
npm start -- /path/to/your-scan.stl -o ./output

# With custom config
npm start -- your-scan.obj --config config.json

# Lower decimation for higher quality
npm start -- scan.stl -o ./out --target-faces 200000
```

## Verify Each Stage

### Stage 1: Mesh Loading
```bash
# Just check if your STL loads
npm start -- your-mesh.stl -o /tmp/test
# Should print mesh statistics
```

### Stage 2: Feature Extraction
Check `output/features.json`:
```json
{
  "features": [
    {
      "type": "plane",
      "normal": { "x": 0, "y": 0, "z": 1 },
      "inliers": 150
    },
    {
      "type": "cylinder",
      "radius": 5.2,
      "axis": { "x": 0, "y": 0, "z": 1 },
      "inliers": 80
    }
  ],
  "dimensions": {
    "length": 50.5,
    "width": 30.2,
    "height": 10.0
  }
}
```

### Stage 3: OpenSCAD Generation
Check `output/part.scad`:
```openscad
// Should contain cube/cylinder primitives
difference() {
  cube([50, 30, 10], center=true);
  cylinder(h=11, r=5, center=true);
}
```

Test manually:
```bash
openscad output/part.scad -o test.step
```

### Stage 4: STEP Export
```bash
# Verify STEP file exists
ls -lh output/part.step

# Try importing to Onshape:
# 1. Create new document
# 2. Insert → From file → upload part.step
# 3. Should import as solid geometry
```

## Troubleshooting

### "OpenSCAD not found"
```bash
sudo apt install openscad
# or download from openscad.org
```

### "LM Studio API error"
```bash
# Check LM Studio is running
curl http://192.168.1.144:1001/lmstudio/v1/models

# Check API key
echo $LM_API_KEY

# Try manual API call
curl -X POST http://192.168.1.144:1001/lmstudio/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LM_API_KEY" \
  -d '{"model":"local-model","messages":[{"role":"user","content":"test"}]}'
```

### "No features detected"
This is normal for:
- Organic/freeform shapes
- Very noisy scans
- Low-poly meshes

Try:
```bash
# Increase RANSAC iterations
npm start -- mesh.stl -o out --config config.json
# Edit config.json: "ransacIterations": 5000
```

### Build fails
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Next Steps

1. **Test on real scans**: Start with simple prismatic parts
2. **Tune RANSAC parameters**: Adjust based on your mesh quality
3. **Customize LLM prompt**: Edit `src/generate.ts` for better CAD generation
4. **Add post-processing**: Extend `src/export.ts` for STEP validation

## Pipeline Architecture Reminder

```
Input STL/OBJ
    ↓
Clean (decimate, remove noise)
    ↓
Extract Features (RANSAC: planes, cylinders, holes)
    ↓
Generate OpenSCAD (LLM from feature dimensions)
    ↓
Export STEP (OpenSCAD binary)
    ↓
Import to Onshape (editable solid)
```

## Performance Notes

- **Decimation**: 100k faces takes ~2-5 seconds
- **Feature extraction**: RANSAC with 1000 iterations ~5-15 seconds
- **LLM generation**: 2-10 seconds depending on model
- **STEP export**: 1-3 seconds

Total pipeline: **~15-30 seconds** for typical part
