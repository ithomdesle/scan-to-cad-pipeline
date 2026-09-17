# scan-to-cad-pipeline

**Stack: Backend** — Node.js, TypeScript. Inherits `_templates/CLAUDE.backend.md` and the workspace conventions in `../CLAUDE.md`.

## Shape of this project

A command line pipeline, not a service. `src/cli.ts` is the only entry point; everything else lives in a bounded context under `src/modules/`.

| Module | Bounded context |
| --- | --- |
| `mesh` | Reading, welding, cleaning and writing triangle meshes |
| `feature-extraction` | Recovering planes, cylinders and holes from a mesh |
| `cad-generation` | Turning measurements into a build123d model, with or without a language model |
| `step-export` | Running the model through OpenCASCADE to produce STEP |
| `pipeline` | Orchestrating the five stages and loading configuration |

Cross-module imports go through each module's `index.ts` and nothing else.

## Decisions worth knowing

**Domain algorithms live in `services/`.** The workspace layout forbids a `domain/` folder and keeps `types/` free of logic, so pure, framework-free algorithms (topology, fitting, segmentation) sit in `services/` alongside the ones that touch the outside world. They import nothing but domain types.

**Imports carry `.js` extensions.** The package is ESM under `module: node16`, so specifiers must be the ones Node resolves at runtime, including `/index.js` for a module's public entry.

**Hot loops use flat typed arrays, not objects.** Per-vertex `Vector3` objects in a 100k-triangle mesh would defeat the data-invariance rules they are meant to serve. `Vector3` is for feature-level values, where there are hundreds, not millions.

**Python is a runtime dependency.** The OpenCASCADE kernel only exists as a Python wheel. `python/run_build123d_model.py` is the boundary; it speaks JSON after a sentinel line because the kernel prints to stdout uninvited.

**Model output is hostile until proven otherwise.** Anything a language model emits is screened before it reaches the interpreter, and must build a real solid before it is accepted. See `build123d-script-validator`.

## Testing

`pnpm test`. The `step-export` suite drives the real kernel and is skipped when `.venv` is absent, so a checkout without Python still runs green.
