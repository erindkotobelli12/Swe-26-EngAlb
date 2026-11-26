import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/config/navigation";

/** Sends each person to their role's home page. */
export default async function Page() {
  const session = await getSession();
  redirect(homeFor(session.role));
}
