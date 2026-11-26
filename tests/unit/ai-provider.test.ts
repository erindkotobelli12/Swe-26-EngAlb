import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { AIConfigurationError, AIResponseError, getAIProvider, parseStructured, setAIProviderForTests, type AIProvider } from "../../src/ai/providers";
import { runAgent } from "../../src/ai/runAgent";

const originalUrl = process.env.OLLAMA_BASE_URL;
const db = new PrismaClient();
afterEach(() => {
  setAIProviderForTests(null);
  if (originalUrl === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = originalUrl;
});
afterAll(() => db.$disconnect());

const Schema = z.object({ answer: z.string() });
const double = (impl: AIProvider["complete"]): AIProvider => ({ model: () => "test-double", complete: impl });

async function run(tag: string) {
  return runAgent({ agent: "test", promptVersion: "test@1", input: { tag, t: Math.random() }, inputRefs: ["X-1"], system: "s", user: "u", schema: Schema, db });
}

describe("local AI provider", () => {
  it("rejects non-loopback provider URLs so employee data stays local", () => {
    process.env.OLLAMA_BASE_URL = "https://example.com";
    expect(() => getAIProvider()).toThrow(AIConfigurationError);
  });

  it("maps invalid JSON and schema mismatches to typed errors", () => {
    expect(() => parseStructured("not json", Schema)).toThrow(AIResponseError);
    expect(() => parseStructured('{"wrong":1}', Schema)).toThrow(/did not match the required schema/);
    expect(parseStructured('{"answer":"ok"}', Schema)).toEqual({ answer: "ok" });
  });

  it("logs unavailable, timeout and invalid output as visible AIRun failures — never faked", async () => {
    const cases: [AIResponseError, string][] = [
      [new AIResponseError("down", 503, "UNAVAILABLE"), "UNAVAILABLE"],
      [new AIResponseError("slow", 504, "TIMEOUT"), "TIMEOUT"],
      [new AIResponseError("bad", 502, "INVALID_OUTPUT"), "INVALID_OUTPUT"],
    ];
    for (const [err, status] of cases) {
      setAIProviderForTests(double(async () => { throw err; }));
      const outcome = await run(status);
      expect(outcome.ok).toBe(false);
      expect(outcome.run.status).toBe(status);
      if (!outcome.ok) expect(outcome.error).toBe(err.message);
      const row = await db.aIRun.findUniqueOrThrow({ where: { id: outcome.run.id } });
      expect(row.output).toBeNull();
      expect(row.inputRefs).toBe('["X-1"]');
    }
  });

  it("records successful runs and reuses cached output for identical input", async () => {
    let calls = 0;
    setAIProviderForTests(double(async <T,>() => { calls++; return { answer: "hello" } as T; }));
    const input = { fixed: true };
    const first = await runAgent({ agent: "test", promptVersion: "test@1", input, inputRefs: [], system: "s", user: "u", schema: Schema, db });
    const second = await runAgent({ agent: "test", promptVersion: "test@1", input, inputRefs: [], system: "s", user: "u", schema: Schema, db });
    expect(first.ok && second.ok).toBe(true);
    expect(second.ok && second.cached).toBe(true);
    expect(calls).toBe(1);
  });
});
