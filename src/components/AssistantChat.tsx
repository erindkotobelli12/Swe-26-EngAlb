"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Send, Sparkles } from "lucide-react";

type AssistantResult = { answer: string; evidenceIds: string[] };
type LLMStatus = { available: boolean; model: string; message: string };

export default function AssistantChat({ llmStatus }: { llmStatus: LLMStatus }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error
          : "The assistant request failed.";
        setError(message);
      } else if (
        typeof data === "object" &&
        data !== null &&
        "answer" in data &&
        typeof data.answer === "string" &&
        "evidenceIds" in data &&
        Array.isArray(data.evidenceIds) &&
        data.evidenceIds.every((id) => typeof id === "string")
      ) {
        setResult({ answer: data.answer, evidenceIds: data.evidenceIds });
      } else {
        setError("The assistant returned an invalid response.");
      }
    } catch {
      setError("Could not reach the assistant service. Check the server and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-3xl">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-indigo-600"><Sparkles /><b>Ask about cases and evidence</b></div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${llmStatus.available ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
            {llmStatus.available ? `Live local LLM · ${llmStatus.model}` : "Local LLM unavailable"}
          </span>
        </div>
        {!llmStatus.available && (
          <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {llmStatus.message} No simulated answers are provided.
          </p>
        )}
        <form onSubmit={ask} className="mt-4 flex gap-2">
          <input
            aria-label="Ask a question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Why is Eva not independently ready?"
            minLength={3}
            maxLength={2000}
            required
            className="flex-1 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={loading || !llmStatus.available}
            className="grid h-12 w-12 place-items-center rounded-lg bg-indigo-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Ask"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      {loading && <p role="status" className="mt-4 text-sm text-slate-500">Requesting a live answer from the local model…</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {result && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm leading-7">{result.answer}</p>
          {result.evidenceIds.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-bold uppercase text-slate-500">Database evidence</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.evidenceIds.map((id) => <Link key={id} href={`/evidence#${encodeURIComponent(id)}`} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">{id}</Link>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
