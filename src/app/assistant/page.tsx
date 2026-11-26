import { getLLMStatus } from "@/ai/providers";
import { getSession } from "@/lib/auth";
import AssistantChat from "@/components/AssistantChat";

export default async function AssistantPage() {
  const [llmStatus, session] = await Promise.all([getLLMStatus(), getSession()]);
  return (
    <div className="min-h-screen px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Database-grounded answers{session.role === "EMPLOYEE" ? " about your own case" : ""}</p>
        <h1 className="mt-1 text-2xl font-bold">AI assistant</h1>
      </header>
      <AssistantChat llmStatus={llmStatus} placeholder={session.role === "EMPLOYEE" ? "What is still blocking my readiness?" : "Why is Eva not independently ready?"} />
    </div>
  );
}
