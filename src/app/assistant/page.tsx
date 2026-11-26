import { PageHeader } from "@/components/ui/PageHeader";
import { getLLMStatus } from "@/ai/providers";
import { getSession } from "@/lib/auth";
import AssistantChat from "@/components/AssistantChat";

export default async function AssistantPage() {
  const [llmStatus, session] = await Promise.all([getLLMStatus(), getSession()]);
  return (
    <div className="min-h-screen px-5 py-6 md:px-8">
      <PageHeader title="Assistant" subtitle={`Answers from the records${session.role === "EMPLOYEE" ? " about your own onboarding" : " you can see"}, with sources.`} breadcrumbs={[{ label: "Assistant" }]} />
      <AssistantChat llmStatus={llmStatus} placeholder={session.role === "EMPLOYEE" ? "What is still blocking my readiness?" : "Why is Eva not independently ready?"} />
    </div>
  );
}
