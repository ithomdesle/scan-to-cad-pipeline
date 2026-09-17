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

## Phone app

The pipeline also runs as a mobile web app, so a part goes from your hand to a STEP file without a terminal.

```bash
pnpm install
pnpm setup:python
pnpm build:all
pnpm serve
```

Open `http://<this-machine-ip>:4000` on your phone, on the same network. No HTTPS or certificate is needed: capture uses a file input rather than a live camera stream, so iOS opens the camera over plain HTTP.

**Photo mode** — for flat, constant-thickness parts. Lay the part on a contrasting surface, shoot straight down, type its longest edge and its thickness from calipers, and tap *Create STEP*. The outline and every interior cutout are traced, scaled by the edge you measured, and extruded. A 180 x 84 x 1.5 mm plate with three 32 x 20 mm slots comes back at exactly 19800 mm3.

This is the accurate route for sheet metal: a silhouette plus two caliper readings beats photogrammetry of bare, shiny material, and it recovers the rectangular slots that the 3D feature fitter cannot see.

**3D scan mode** — upload an STL or OBJ from Scaniverse or RealityScan and it runs the full mesh pipeline: clean, fit planes and cylinders, detect holes, export.

| Mode | Good for | Not for |
| --- | --- | --- |
| Photo | Flat plates, brackets, gaskets, panels — anything of constant thickness | Bends, flanges, anything genuinely 3D |
| 3D scan | Rounded and prismatic solids with planar and cylindrical faces | Rectangular slots; unmatted shiny metal |

## Docker

```bash
docker compose up -d
```

Then open `http://<host-ip>:4000` on your phone. Finished files land in `./output` on the host.

The image carries both runtimes, because the OpenCASCADE kernel only exists as a Python wheel: Node serves the app and does the mesh and image work, Python owns the kernel that writes STEP. It is built in two stages so the toolchain and the frontend build never reach the final image, which still lands around 1.5 GB — the kernel and its VTK dependency account for most of it.

The container runs as the unprivileged `node` user, declares a healthcheck against `/api/health`, and keeps `/app/output` as a volume.

To run it without compose:

```bash
docker build -t scan-to-cad-pipeline .
docker run -d -p 4000:4000 -v "$PWD/output:/app/output" --name scan2cad scan-to-cad-pipeline
```

Note that the containerised web app always builds from the measured geometry. The language-model path is a CLI feature; it is not wired into the server, so nothing in the container reaches out to a model endpoint.

## Development

```bash
pnpm test        # 80 tests; the STEP export suite is skipped without .venv
pnpm typecheck
pnpm lint
pnpm format
```

Conventions for this workspace are in `CLAUDE.md`.
