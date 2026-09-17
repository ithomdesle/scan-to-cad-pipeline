# Scan-to-CAD Pipeline

One command in, one STEP file out: a 3D scan (STL/OBJ) becomes an editable B-Rep solid you can open in Onshape.

```bash
scan2cad scan.stl -o ./output
```

## How it works

| Stage | What happens |
| --- | --- |
| 1. Load | Binary STL, ASCII STL or OBJ is parsed and its vertices welded |
| 2. Clean | meshoptimizer decimation, stray-component removal by surface area, boundary-loop hole filling |
| 3. Extract | Surface patches grown by normal continuity, then fitted as planes and cylinders; concave cylinders become holes |
| 4. Model | The measurements become a build123d model — drafted by a local language model, or directly from the geometry |
| 5. Export | OpenCASCADE writes STEP AP214 or AP242 |

The output is a real B-Rep solid. A 40 mm washer with a 12 mm bore exports as four faces — two planar, two cylindrical — not a tessellated shell. You can fillet, shell and sketch on those faces in Onshape.

## Why build123d and not OpenSCAD

OpenSCAD cannot export STEP. Its `-o` flag supports STL, OFF, AMF, 3MF, DXF, SVG, CSG and PNG, and STEP export has been an [open request since 2014](https://github.com/openscad/openscad/issues/893) with [no native implementation](https://github.com/openscad/openscad/wiki/Project:-Add-support-for-exporting-models-in-STEP-format). This pipeline targets build123d instead, which drives the OpenCASCADE kernel directly and treats STEP as a first-class output.

## Installation

Requirements: Node.js >= 18, Python >= 3.10.

```bash
pnpm install
pnpm setup:python   # creates .venv and installs build123d + the OpenCASCADE kernel
pnpm build
```

`pnpm setup:python` uses `uv` when it is available and falls back to `python3.12`/`3.11`/`3.10` with `venv`. The OpenCASCADE wheel is large; the first install takes a few minutes.

## Usage

```bash
# Straight from the measured geometry, no language model involved
node dist/cli.js scan.stl -o ./output --no-llm

# With a local model drafting the CAD script
node dist/cli.js scan.stl -o ./output --language-model http://127.0.0.1:1234/v1 --model my-model

# AP242 instead of AP214
node dist/cli.js scan.stl -o ./output --step-format ap242
```

### Options

| Flag | Meaning | Default |
| --- | --- | --- |
| `-o, --output <directory>` | Where the artifacts are written | `./output` |
| `-c, --config <file>` | JSON configuration; command line flags still win | none |
| `--target-faces <count>` | Triangle budget after decimation | `100000` |
| `--language-model <url>` | OpenAI-compatible endpoint (LM Studio, Ollama, vLLM) | `http://127.0.0.1:1234/v1` |
| `--model <name>` | Model to request | `local-model` |
| `--attempts <count>` | Model retries before falling back to the measured geometry | `3` |
| `--python <path>` | Interpreter that has build123d | `.venv/bin/python` |
| `--step-format <schema>` | `ap214` or `ap242` | `ap214` |
| `--no-llm` | Skip the model entirely | off |

`LM_API_KEY` is sent as a bearer token when it is set. It is optional: a local LM Studio server does not need one.

### Output

| File | Contents |
| --- | --- |
| `part.step` | The solid, ready to import into Onshape |
| `part.py` | The build123d model that produced it — readable and re-runnable |
| `features.json` | Every fitted plane, cylinder and hole with its residual |
| `cleaned.stl` | The decimated, repaired mesh the measurements came from |

## The language model is optional, and never trusted

The model drafts a build123d script; it does not get the last word.

1. Its output is screened: only `build123d` and `math` may be imported, and file, process, `eval`/`exec` and reflection access are refused outright. A rejected script is never handed to the interpreter.
2. A surviving script must actually build a solid with positive volume in OpenCASCADE. Verification and export are the same step, so the STEP file on disk is always one the kernel really produced.
3. Failures go back to the model as feedback, up to `--attempts` times.
4. If every attempt fails, the pipeline composes the model directly from the fitted geometry and exports that. It always produces a STEP file.

With `--no-llm`, step 4 is the whole story.

## Accuracy

The deterministic path reconstructs a 40 x 8 mm washer with a 12 mm bore at 9148.32 mm3 against an analytic 9148.318 mm3. Accuracy is bounded by the scan, not the pipeline.

## What this does not do

- **Photogrammetry.** Capture is out of scope; bring your own mesh. Run Meshroom or RealityScan yourself and pass the result in.
- **A parametric feature tree.** Onshape receives an editable solid, not a history of modelling operations. That is a limit of STEP, not of this pipeline.
- **Freeform surfaces.** Only planes and cylinders are fitted. Spheres, cones, tori and splines fall back to the bounding shape.

## Development

```bash
pnpm test        # 80 tests; the STEP export suite is skipped without .venv
pnpm typecheck
pnpm lint
pnpm format
```

Conventions for this workspace are in `CLAUDE.md`.
