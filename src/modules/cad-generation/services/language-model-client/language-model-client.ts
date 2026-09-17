import type { LanguageModelOptions } from "../../types/cad-script.types.js";

type ChatCompletionResponse = {
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string } }>;
};

export const requestChatCompletion = async (
  options: LanguageModelOptions,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), options.timeoutMilliseconds);

  try {
    const response = await fetch(`${options.endpoint.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: abortController.signal,
      headers: Object.freeze({
        "Content-Type": "application/json",
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      }),
      body: JSON.stringify({
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maximumTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Language model returned ${response.status} ${response.statusText}: ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) throw new Error("Language model returned no completion content.");

    return content;
  } finally {
    clearTimeout(timeoutHandle);
  }
};
