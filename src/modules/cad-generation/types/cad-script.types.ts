import { createEnum, type EnumValues } from "../../../shared/types/enum.types.js";

export const CadScriptOrigin = createEnum({
  LANGUAGE_MODEL: "language_model",
  DETERMINISTIC: "deterministic",
});
export type CadScriptOrigin = EnumValues<typeof CadScriptOrigin>;

export type CadScript = {
  readonly source: string;
  readonly origin: CadScriptOrigin;
  readonly attemptCount: number;
};

export type ScriptValidationResult = {
  readonly isValid: boolean;
  readonly violations: readonly string[];
};

export type LanguageModelOptions = {
  readonly endpoint: string;
  readonly model: string;
  readonly temperature: number;
  readonly maximumTokens: number;
  readonly apiKey?: string;
  readonly timeoutMilliseconds: number;
};

export type CadGenerationOptions = {
  readonly isLanguageModelEnabled: boolean;
  readonly maximumAttempts: number;
  readonly languageModel: LanguageModelOptions;
};

export type ScriptVerification = {
  readonly isValid: boolean;
  readonly error?: string;
};
