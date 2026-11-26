import { afterEach, describe, expect, it } from "vitest";
import { AIConfigurationError, getAIProvider } from "../../src/ai/providers";

const originalUrl = process.env.OLLAMA_BASE_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = originalUrl;
});

describe("local live AI provider configuration", () => {
  it("rejects non-loopback provider URLs so employee data stays local", () => {
    process.env.OLLAMA_BASE_URL = "https://example.com";
    expect(() => getAIProvider()).toThrow(AIConfigurationError);
  });
});
