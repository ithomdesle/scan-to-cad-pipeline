# Scan-to-CAD Pipeline

Automated pipeline: 3D scan (STL/OBJ) → feature extraction → LLM-generated OpenSCAD → STEP for Onshape

**One command in, one STEP file out.** Fully headless, no GUI steps.

## Architecture

1. **Capture**: Meshroom or RealityScan on RTX 5090 (AI PC: 192.168.1.29) → STL/OBJ mesh
2. **Clean**: meshoptimizer WASM — decimate to ~100k faces, remove small components, fill holes
3. **Features**: RANSAC plane/cylinder/hole fitting → `features.json` with dimensions
4. **Generate**: Local LLM (LM Studio @ 192.168.1.144:1001) drafts OpenSCAD from dimension spec
5. **Export**: `openscad -o part.step part.scad` → STEP AP214/AP242

## Installation

### Prerequisites

- **Node.js** ≥18.0.0
- **OpenSCAD** installed and in PATH
- **LM Studio** running at http://192.168.1.144:1001/lmstudio/v1 with a model loaded
- **LM_API_KEY** environment variable set

```bash
# Install OpenSCAD (Ubuntu/Debian)
sudo apt install openscad

# Or download from: https://openscad.org/downloads.html
```

### Setup

```bash
cd cad-pipeline
npm install
npm run build
```

### Environment

```bash
export LM_API_KEY="your-lm-studio-api-key"
```

## Usage

### Basic: Convert existing mesh

```bash
npm start -- input.stl -o ./output
```

### With custom config

```bash
npm start -- input.obj --config config.json
```

### CLI Options

```
scan2cad <input>

Arguments:
  input                 Input mesh file (STL/OBJ) or "capture" to run photogrammetry

Options:
  -o, --output <dir>    Output directory (default: "./output")
  -c, --config <file>   Configuration file (JSON)
  --target-faces <n>    Target face count for decimation (default: "100000")
  --ai-pc <host>        AI PC host for capture (default: "192.168.1.29")
  --lm-studio <url>     LM Studio API endpoint (default: "http://192.168.1.144:1001/lmstudio/v1")
  --openscad <path>     OpenSCAD binary path (default: "openscad")
  --step-format <format> STEP format (AP214/AP242) (default: "AP214")
  -h, --help            Display help
  -V, --version         Display version
```

## Configuration

Copy `config.example.json` to `config.json` and adjust:

```json
{
  "captureMode": "file",
  "targetFaceCount": 100000,
  "ransacIterations": 1000,
  "ransacThreshold": 0.01,
  "lmStudioEndpoint": "http://192.168.1.144:1001/lmstudio/v1",
  "lmStudioModel": "local-model",
  "openscadBinary": "openscad",
  "stepFormat": "AP214",
  "outputDir": "./output"
}
```

## Output

The pipeline produces:

- `output/cleaned.stl` — decimated and cleaned mesh
- `output/features.json` — extracted geometry features and dimensions
- `output/part.scad` — LLM-generated OpenSCAD code
- `output/part.step` — **Final STEP file for Onshape**

## Onshape Import

**Editable Solid, NOT Parametric**

- ✅ Import as solid B-Rep geometry
- ✅ Fillet edges, shell, sketch on faces
- ❌ NOT parametric feature tree (unless source has embedded PMI/history)
- ❌ NOT editable dimension-driven features

For organic/freeform shapes: Use the mesh as a reference underlay and re-model manually.

## Limitations

### What Works Well

- **Prismatic mechanical parts**: bores, flats, flanges, fillets, mounting holes
- **Box-like objects** with clear faces and cylindrical features
- **Simple brackets, mounts, enclosures**

### What Doesn't Work

- **Organic shapes**: sculptures, figurines, anatomy (no clear geometric primitives)
- **Complex freeform surfaces**: use mesh as reference, re-model by hand
- **Fine details** below ~1mm (lost in decimation)

### LLM Behavior

- **LLM generates CAD code** from verbal/dimensional spec, NOT from mesh
- **Feature extraction (RANSAC)** is pure geometry processing, not LLM work
- Quality depends on:
  1. Mesh cleanliness (sharp features, minimal noise)
  2. Feature extraction accuracy (RANSAC parameters)
  3. LLM's CAD knowledge (local model varies)

### Recommended Workflow for Organic Shapes

1. Import cleaned mesh into Onshape as reference
2. Manually sketch and extrude over the mesh
3. Use mesh for visual guide, not direct conversion

## Development

```bash
npm run dev      # Watch mode (recompile on save)
npm run build    # Compile TypeScript
npm run clean    # Remove build artifacts
```

## Pipeline Stages

Each stage is isolated in its own module:

- `src/capture.ts` — Invoke Meshroom/RealityScan or load file
- `src/clean.ts` — STL/OBJ parsing, decimation, cleanup
- `src/features.ts` — RANSAC plane/cylinder/hole detection
- `src/generate.ts` — LM Studio API call, OpenSCAD generation
- `src/export.ts` — OpenSCAD binary invocation, STEP export

## Troubleshooting

### "OpenSCAD not found"

Ensure `openscad` is in PATH:

```bash
which openscad
# If not found, install or specify full path with --openscad
```

### "LM Studio API error"

1. Verify LM Studio is running at the configured endpoint
2. Check that a model is loaded in LM Studio
3. Ensure `LM_API_KEY` is set
4. Test endpoint: `curl http://192.168.1.144:1001/lmstudio/v1/models`

### "No features detected"

- Increase `ransacIterations` in config (try 5000)
- Decrease `ransacThreshold` (try 0.005)
- Check mesh quality — noisy scans produce poor features
- For organic shapes, features won't be detected (expected)

### STEP file won't import to Onshape

- Try switching `stepFormat` from AP214 to AP242
- Verify OpenSCAD code is valid (open `part.scad` in OpenSCAD GUI)
- Check for OpenSCAD errors in pipeline output

## License

MIT
