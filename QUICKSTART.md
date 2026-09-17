# Quickstart

From a clean checkout to a STEP file in Onshape.

## 1. Install

```bash
pnpm install
pnpm setup:python
pnpm build
```

The Python step creates `.venv` and installs build123d with the OpenCASCADE kernel. Expect a few minutes and roughly 500 MB.

Verify it:

```bash
.venv/bin/python -c "from build123d import Box; print('ready')"
```

## 2. Run it on the test cube

```bash
node dist/cli.js test-cube.stl -o ./output --no-llm
```

Expected:

```
[1/5] Loading mesh
      12 triangles, 8 vertices, watertight
[2/5] Cleaning mesh
[3/5] Extracting features
      6 features; 10.0 x 10.0 x 10.0 mm
[4/5] Building solid model
[5/5] Writing STEP
      model source: deterministic; solid volume 1000.00 mm3
```

A 10 mm cube is 1000 mm3, so the round trip is exact.

## 3. Check each stage

| Question | Where to look |
| --- | --- |
| Was the mesh read correctly? | Triangle count and watertightness in stage 1 |
| Did cleaning remove too much? | Open `output/cleaned.stl` |
| Were the right features found? | `output/features.json` — every fit carries its residual |
| Is the model sensible? | `output/part.py` is plain build123d you can read and re-run |
| Is the solid real? | The reported volume; `output/part.step` should contain `ADVANCED_FACE` |

## 4. Add a local model

Start LM Studio (or any OpenAI-compatible server) and point the pipeline at it:

```bash
node dist/cli.js scan.stl -o ./output --language-model http://127.0.0.1:1234/v1 --model your-model
```

The last line of stage 5 says `model source: language_model` when the model's script was accepted, or `deterministic` when it fell back to the measured geometry. Both produce a valid STEP file.

## 5. Import into Onshape

Onshape > Document > Insert > Import, and choose `output/part.step`. It arrives as an editable solid: fillet, shell and sketch on its faces. It is not a parametric feature tree — STEP carries geometry, not modelling history.

## Troubleshooting

**"No build123d Python environment was found"** — run `pnpm setup:python`, or pass `--python /path/to/python`.

**"The script produced a shape with no volume"** — the fitted geometry did not close into a solid. Check `features.json`: if nothing but a bounding box was found, the scan is probably too noisy. Loosen `featureExtraction.planarDistanceTolerance` or lower `meshCleaning.targetTriangleCount`.

**The model keeps getting rejected** — the reason is printed for each attempt. Disallowed imports mean the model is ignoring the system prompt; a lower temperature usually fixes it. The pipeline falls back on its own regardless.

**Extraction finds one giant face** — `segmentationAngleToleranceDegrees` is too loose for the scan, so separate surfaces merged. Lower it.
