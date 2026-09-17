import type { ScriptValidationResult } from "../../types/cad-script.types.js";

const ALLOWED_IMPORT_PATTERN =
  /^(?:from\s+(?:build123d|math)\s+import\s+.+|import\s+(?:build123d|math)(?:\s+as\s+\w+)?)$/;

const FORBIDDEN_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly reason: string }> =
  Object.freeze([
    { pattern: /\b__import__\s*\(/, reason: "dynamic import" },
    { pattern: /\beval\s*\(/, reason: "eval" },
    { pattern: /\bexec\s*\(/, reason: "exec" },
    { pattern: /\bopen\s*\(/, reason: "file access" },
    { pattern: /\bcompile\s*\(/, reason: "compile" },
    { pattern: /\bglobals\s*\(|\blocals\s*\(/, reason: "namespace access" },
    { pattern: /\bgetattr\s*\(|\bsetattr\s*\(/, reason: "attribute reflection" },
    { pattern: /\bsubprocess\b|\bos\s*\.|\bsys\s*\./, reason: "process or system access" },
  ]);

// The script is executed by a real interpreter, so anything the model emits beyond modelling calls
// is treated as hostile rather than merely wrong.
export const validateBuild123dScript = (source: string): ScriptValidationResult => {
  const violations: string[] = [];

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) violations.push(`Script uses ${reason}.`);
  }

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("import ") && !line.startsWith("from ")) continue;
    if (ALLOWED_IMPORT_PATTERN.test(line)) continue;
    violations.push(`Disallowed import: "${line}". Only build123d and math may be imported.`);
  }

  if (!/^\s*part\s*=/m.test(source)) {
    violations.push('Script must assign the finished solid to a variable named "part".');
  }

  return Object.freeze({ isValid: violations.length === 0, violations: Object.freeze(violations) });
};

export const extractCodeBlock = (rawResponse: string): string => {
  const fencedBlock = /```(?:python|py)?\s*\n([\s\S]*?)```/.exec(rawResponse);
  return (fencedBlock ? fencedBlock[1] : rawResponse).trim();
};
