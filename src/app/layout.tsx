import "./globals.css";
import type { Metadata } from "next";
import Sidebar, { type NavLink } from "@/components/Sidebar";
import { getSession, listDemoUsers } from "@/lib/auth";
import { formatDate, getEvaluationDate } from "@/lib/clock";
import { navigationFor } from "@/config/navigation";

export const metadata: Metadata = { title: "OnboardIQ", description: "Evidence-based onboarding decision support" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, users] = await Promise.all([getSession(), listDemoUsers()]);
  const links: NavLink[] = navigationFor(session.role);
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
          <Sidebar links={links} user={{ id: session.userId, name: session.name, role: session.role }} users={users} evaluationDate={formatDate(getEvaluationDate())} />
          <main className="min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
