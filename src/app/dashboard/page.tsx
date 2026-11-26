import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeFor } from "@/config/navigation";

/** The former shared dashboard is replaced by a home page per role. */
export default async function Dashboard() {
  redirect(homeFor((await getSession()).role));
}
