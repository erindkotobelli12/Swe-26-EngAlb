import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { EmptyState } from "@/components/ui/primitives";

/** "My profile": the signed-in person's profile page. */
export default async function MyProfile() {
  const session = await getSession();
  if (session.personId) redirect(`/people/${session.personId}`);
  return <EmptyState title="Your account isn't linked to a profile yet." />;
}
