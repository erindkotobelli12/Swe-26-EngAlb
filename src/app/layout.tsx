import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = { title: "OnboardIQ", description: "Evidence-based employee onboarding" };

export default async function RootLayout({children}:{children:React.ReactNode}) {
  const cookieStore = await cookies();
  const role = cookieStore.get("demo_role")?.value ?? "PMO";
  return <html lang="en"><body>
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <Sidebar role={role} />
      <main className="min-w-0">{children}</main>
    </div>
  </body></html>;
}
