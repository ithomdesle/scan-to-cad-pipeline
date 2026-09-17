import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RUNNER_RELATIVE_PATH = join("python", "run_build123d_model.py");

export const findProjectRoot = (startDirectory: string): string | null => {
  let currentDirectory = startDirectory;

  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(join(currentDirectory, RUNNER_RELATIVE_PATH))) return currentDirectory;

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) return null;
    currentDirectory = parentDirectory;
  }

  return null;
};

export const getModelRunnerPath = (): string => {
  const projectRoot = findProjectRoot(dirname(fileURLToPath(import.meta.url)));

  if (!projectRoot) {
    throw new Error(
      `Could not locate ${RUNNER_RELATIVE_PATH}. Run the pipeline from a complete checkout.`,
    );
  }

  return join(projectRoot, RUNNER_RELATIVE_PATH);
};

export const resolvePythonExecutable = (configuredExecutable?: string): string => {
  if (configuredExecutable) return configuredExecutable;

  const projectRoot = findProjectRoot(dirname(fileURLToPath(import.meta.url)));
  const virtualEnvironmentPython = projectRoot
    ? resolve(projectRoot, ".venv", "bin", "python")
    : null;

  if (virtualEnvironmentPython && existsSync(virtualEnvironmentPython)) {
    return virtualEnvironmentPython;
  }

  throw new Error(
    [
      "No build123d Python environment was found.",
      "Run `pnpm setup:python` once to create it, or pass --python <path> to use your own.",
    ].join(" "),
  );
};
