import { redirect } from "next/navigation";

/** Former "My workspace": now "My onboarding". */
export default function Workspace() {
  redirect("/my-onboarding");
}
