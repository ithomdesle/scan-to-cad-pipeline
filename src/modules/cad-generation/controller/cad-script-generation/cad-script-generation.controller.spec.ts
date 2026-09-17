import { afterEach, describe, expect, it, vi } from "vitest";
import { createUnitCubeMesh } from "../../../mesh/index.js";
import {
  createFeatureExtractionController,
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
} from "../../../feature-extraction/index.js";
import { CadScriptOrigin, type CadGenerationOptions } from "../../types/cad-script.types.js";
import { createCadScriptGenerationController } from "./cad-script-generation.controller.js";

const specification = createFeatureExtractionController().extract(
  createUnitCubeMesh(30),
  DEFAULT_FEATURE_EXTRACTION_OPTIONS,
);

const generationOptions: CadGenerationOptions = {
  isLanguageModelEnabled: true,
  maximumAttempts: 3,
  languageModel: {
    endpoint: "http://language-model.test/v1",
    model: "test-model",
    temperature: 0.2,
    maximumTokens: 2000,
    timeoutMilliseconds: 1000,
  },
};

const stubCompletion = (content: string) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
    ),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createCadScriptGenerationController", () => {
  it("returns the model script when it validates and verifies", async () => {
    // Arrange
    stubCompletion("```python\nfrom build123d import *\npart = Box(30, 30, 30)\n```");
    const controller = createCadScriptGenerationController({
      verifyScript: async () => ({ isValid: true }),
    });

    // Act
    const script = await controller.generate(specification, generationOptions);

    // Assert
    expect(script.origin).toBe(CadScriptOrigin.LANGUAGE_MODEL);
    expect(script.attemptCount).toBe(1);
    expect(script.source).toContain("part = Box(30, 30, 30)");
  });

  it("falls back to the measured geometry when every model attempt fails to verify", async () => {
    // Arrange
    stubCompletion("from build123d import *\npart = Box(30, 30, 30)");
    const verifyScript = vi
      .fn()
      .mockResolvedValueOnce({ isValid: false, error: "OCCT failure" })
      .mockResolvedValueOnce({ isValid: false, error: "OCCT failure" })
      .mockResolvedValue({ isValid: true });
    const controller = createCadScriptGenerationController({
      verifyScript,
      onAttemptFailed: () => undefined,
    });

    // Act
    const script = await controller.generate(specification, {
      ...generationOptions,
      maximumAttempts: 2,
    });

    // Assert
    expect(script.origin).toBe(CadScriptOrigin.DETERMINISTIC);
    expect(verifyScript).toHaveBeenCalledTimes(3);
  });

  it("feeds the failure reason back into the next prompt", async () => {
    // Arrange
    const sentPrompts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, requestInit: RequestInit) => {
        const requestBody = JSON.parse(String(requestInit.body)) as {
          messages: Array<{ content: string }>;
        };
        sentPrompts.push(requestBody.messages[1].content);
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "part = Box(1, 1, 1)" } }] }),
          { status: 200 },
        );
      }),
    );
    const controller = createCadScriptGenerationController({
      verifyScript: vi
        .fn()
        .mockResolvedValueOnce({ isValid: false, error: "Solid is empty" })
        .mockResolvedValue({ isValid: true }),
    });

    // Act
    await controller.generate(specification, { ...generationOptions, maximumAttempts: 2 });

    // Assert
    expect(sentPrompts).toHaveLength(2);
    expect(sentPrompts[1]).toContain("Solid is empty");
  });

  it("never sends a script with a disallowed import to the interpreter", async () => {
    // Arrange
    stubCompletion("import os\nfrom build123d import *\npart = Box(1, 1, 1)");
    const verifyScript = vi.fn().mockResolvedValue({ isValid: true });
    const controller = createCadScriptGenerationController({ verifyScript });

    // Act
    const script = await controller.generate(specification, {
      ...generationOptions,
      maximumAttempts: 1,
    });

    // Assert
    expect(script.origin).toBe(CadScriptOrigin.DETERMINISTIC);
    expect(verifyScript).toHaveBeenCalledTimes(1);
    expect(verifyScript).toHaveBeenCalledWith(expect.stringContaining("Box(30.0000"));
  });

  it("skips the language model entirely when it is disabled", async () => {
    // Arrange
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = createCadScriptGenerationController({
      verifyScript: async () => ({ isValid: true }),
    });

    // Act
    const script = await controller.generate(specification, {
      ...generationOptions,
      isLanguageModelEnabled: false,
    });

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
    expect(script.origin).toBe(CadScriptOrigin.DETERMINISTIC);
  });

  it("throws when even the measured geometry cannot be built", async () => {
    // Arrange
    const controller = createCadScriptGenerationController({
      verifyScript: async () => ({ isValid: false, error: "kernel unavailable" }),
    });

    // Act
    const act = () =>
      controller.generate(specification, { ...generationOptions, isLanguageModelEnabled: false });

    // Assert
    await expect(act()).rejects.toThrow(/kernel unavailable/);
  });
});
