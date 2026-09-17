import type { PartSpecification } from "../../../feature-extraction/index.js";
import {
  CadScriptOrigin,
  type CadGenerationOptions,
  type CadScript,
  type ScriptVerification,
} from "../../types/cad-script.types.js";
import { composeBuild123dScript } from "../../services/build123d-script-composer/build123d-script-composer.js";
import {
  extractCodeBlock,
  validateBuild123dScript,
} from "../../services/build123d-script-validator/build123d-script-validator.js";
import {
  buildCadPrompt,
  CAD_SYSTEM_PROMPT,
} from "../../services/cad-prompt-builder/cad-prompt-builder.js";
import { requestChatCompletion } from "../../services/language-model-client/language-model-client.js";

export type VerifyScript = (source: string) => Promise<ScriptVerification>;

export type CadScriptGenerationDependencies = {
  readonly verifyScript: VerifyScript;
  readonly onAttemptFailed?: (attemptNumber: number, reason: string) => void;
};

export const createCadScriptGenerationController = ({
  verifyScript,
  onAttemptFailed,
}: CadScriptGenerationDependencies) =>
  Object.freeze({
    generate: async (
      specification: PartSpecification,
      options: CadGenerationOptions,
    ): Promise<CadScript> => {
      const deterministicSource = composeBuild123dScript(specification);

      if (options.isLanguageModelEnabled) {
        let previousError: string | undefined;

        for (let attemptNumber = 1; attemptNumber <= options.maximumAttempts; attemptNumber += 1) {
          const failAttempt = (reason: string) => {
            previousError = reason;
            onAttemptFailed?.(attemptNumber, reason);
          };

          try {
            const completion = await requestChatCompletion(
              options.languageModel,
              CAD_SYSTEM_PROMPT,
              buildCadPrompt(specification, previousError),
            );
            const source = extractCodeBlock(completion);
            const validation = validateBuild123dScript(source);

            if (!validation.isValid) {
              failAttempt(validation.violations.join(" "));
              continue;
            }

            const verification = await verifyScript(source);
            if (!verification.isValid) {
              failAttempt(verification.error ?? "The script did not produce a solid.");
              continue;
            }

            return Object.freeze({
              source,
              origin: CadScriptOrigin.LANGUAGE_MODEL,
              attemptCount: attemptNumber,
            });
          } catch (error) {
            failAttempt(error instanceof Error ? error.message : String(error));
          }
        }
      }

      const deterministicVerification = await verifyScript(deterministicSource);
      if (!deterministicVerification.isValid) {
        throw new Error(
          `The measured geometry could not be turned into a solid: ${deterministicVerification.error ?? "unknown error"}`,
        );
      }

      return Object.freeze({
        source: deterministicSource,
        origin: CadScriptOrigin.DETERMINISTIC,
        attemptCount: options.isLanguageModelEnabled ? options.maximumAttempts : 0,
      });
    },
  });
