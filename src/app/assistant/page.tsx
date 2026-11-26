import { getLLMStatus } from "@/ai/providers";
import AssistantChat from "@/components/AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const llmStatus = await getLLMStatus();
  return (
    <div className="min-h-screen px-5 py-6 md:px-8">
      <header>
        <p className="text-sm text-slate-500">Database-grounded answers</p>
        <h1 className="mt-1 text-2xl font-bold">AI assistant</h1>
      </header>
      <AssistantChat llmStatus={llmStatus} />
    </div>
  );
}
