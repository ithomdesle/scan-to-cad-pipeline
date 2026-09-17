import { describe, expect, it } from "vitest";
import { extractCodeBlock, validateBuild123dScript } from "./build123d-script-validator.js";

describe("validateBuild123dScript", () => {
  it("accepts a minimal modelling script", () => {
    // Arrange
    const source = "from build123d import *\n\npart = Box(10, 10, 10)\n";

    // Act
    const result = validateBuild123dScript(source);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("rejects a script that never assigns part", () => {
    // Arrange
    const source = "from build123d import *\n\nsolid = Box(10, 10, 10)\n";

    // Act
    const result = validateBuild123dScript(source);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.violations[0]).toMatch(/named "part"/);
  });

  it("rejects file access", () => {
    // Arrange
    const source = 'from build123d import *\npart = Box(1, 1, 1)\nopen("/etc/passwd")\n';

    // Act
    const result = validateBuild123dScript(source);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain("Script uses file access.");
  });

  it("rejects an import outside the allowlist", () => {
    // Arrange
    const source = "import socket\nfrom build123d import *\npart = Box(1, 1, 1)\n";

    // Act
    const result = validateBuild123dScript(source);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.violations.some((violation) => violation.includes("socket"))).toBe(true);
  });

  it("allows the math module alongside build123d", () => {
    // Arrange
    const source = "import math\nfrom build123d import *\npart = Box(math.pi, 1, 1)\n";

    // Act
    const result = validateBuild123dScript(source);

    // Assert
    expect(result.isValid).toBe(true);
  });
});

describe("extractCodeBlock", () => {
  it("unwraps a fenced python block", () => {
    // Arrange
    const rawResponse = "Here you go:\n```python\npart = Box(1, 1, 1)\n```\nEnjoy.";

    // Act
    const source = extractCodeBlock(rawResponse);

    // Assert
    expect(source).toBe("part = Box(1, 1, 1)");
  });

  it("returns the trimmed response when no fence is present", () => {
    // Arrange
    const rawResponse = "  part = Box(1, 1, 1)  ";

    // Act
    const source = extractCodeBlock(rawResponse);

    // Assert
    expect(source).toBe("part = Box(1, 1, 1)");
  });
});
