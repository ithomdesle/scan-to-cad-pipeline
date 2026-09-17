#!/usr/bin/env bash
# Creates the Python environment that turns a build123d model into a STEP file.
# build123d needs Python >= 3.10; it ships the OpenCASCADE kernel as a prebuilt wheel.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${PROJECT_ROOT}/.venv"

if [ -x "${VENV_DIR}/bin/python" ]; then
  echo "Python environment already present at ${VENV_DIR}"
else
  if command -v uv >/dev/null 2>&1; then
    echo "Creating environment with uv..."
    uv venv --python 3.11 "${VENV_DIR}"
  else
    PYTHON_BINARY=""
    for candidate in python3.12 python3.11 python3.10; do
      if command -v "${candidate}" >/dev/null 2>&1; then
        PYTHON_BINARY="${candidate}"
        break
      fi
    done

    if [ -z "${PYTHON_BINARY}" ]; then
      echo "No Python 3.10+ interpreter found. Install one, or install uv (https://docs.astral.sh/uv/)." >&2
      exit 1
    fi

    echo "Creating environment with ${PYTHON_BINARY}..."
    "${PYTHON_BINARY}" -m venv "${VENV_DIR}"
  fi
fi

echo "Installing build123d (this pulls the OpenCASCADE wheel and takes a few minutes)..."
"${VENV_DIR}/bin/python" -m pip install --upgrade pip >/dev/null
"${VENV_DIR}/bin/python" -m pip install -r "${PROJECT_ROOT}/python/requirements.txt"

echo "Verifying the kernel..."
"${VENV_DIR}/bin/python" -c "from build123d import Box, export_step; print('build123d ready')"

echo "Done. The pipeline will use ${VENV_DIR}/bin/python automatically."
