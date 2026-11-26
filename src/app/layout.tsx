import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { BreadcrumbProvider } from "@/components/layout/breadcrumbs";
import { ToastProvider } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/overlays";
import { formatDate, getEvaluationDate } from "@/lib/clock";
import { loadShell } from "@/server/shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = { title: "OnboardIQ", description: "Evidence-based onboarding decision support" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = await loadShell();
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <ToastProvider>
          <TooltipProvider>
            <BreadcrumbProvider>
              <div className="flex min-h-screen">
                <Sidebar groups={shell.nav} homeHref="/" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <TopBar user={shell.user} accounts={shell.accounts} dataAsOf={formatDate(getEvaluationDate())} groups={shell.nav} />
                  <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-8">{children}</main>
                </div>
              </div>
            </BreadcrumbProvider>
          </TooltipProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
