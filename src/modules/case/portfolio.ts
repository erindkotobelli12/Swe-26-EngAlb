import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SEVERITY_RANK, type CaseState, type FindingItem } from "@/domain/types";
import { evaluateReadiness, type ReadinessResult } from "@/modules/readiness/evaluate";
import { loadCaseState, listCaseEmployeeIds } from "./loadCaseState";

export type PortfolioCase = { state: CaseState; readiness: ReadinessResult; open: FindingItem[]; proposed: FindingItem[] };

export const bySeverity = (a: FindingItem, b: FindingItem) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.title.localeCompare(b.title);

/** Read-only: loads and evaluates every official case (or only `onlyIds`, e.g. a user's scope). Never writes. */
export async function loadPortfolio(db: PrismaClient = prisma, onlyIds?: string[]): Promise<PortfolioCase[]> {
  const all = await listCaseEmployeeIds(db, Boolean(onlyIds));
  const ids = onlyIds ? all.filter((id) => onlyIds.includes(id)) : all;
  const out: PortfolioCase[] = [];
  for (const id of ids) {
    const state = await loadCaseState(id, db);
    if (!state) continue;
    out.push({
      state,
      readiness: evaluateReadiness(state),
      open: state.findings.filter((f) => f.status === "OPEN").sort(bySeverity),
      proposed: state.findings.filter((f) => f.status === "PROPOSED").sort(bySeverity),
    });
  }
  return out;
}

/** One deterministic summary line per case for the dashboard's top issues. */
export function headline(c: PortfolioCase): string | null {
  const unusable = c.state.access.filter((a) => a.required && a.status !== "USABLE");
  const top = c.open[0];
  if (!top) return null;
  if (top.category === "ACCESS" && unusable.length > 1) return `${unusable.length} access items not usable`;
  return top.title;
}

export function kpis(portfolio: PortfolioCase[]) {
  return {
    total: portfolio.length,
    needIntervention: portfolio.filter((c) => c.open.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.HIGH)).length,
    accessNotUsable: portfolio.reduce((n, c) => n + c.state.access.filter((a) => a.required && a.status !== "USABLE").length, 0),
    conflicts: portfolio.reduce((n, c) => n + c.open.filter((f) => f.category === "CONFLICT").length, 0),
    unanswered: portfolio.reduce((n, c) => n + c.open.filter((f) => f.type === "UNANSWERED_REQUEST").length, 0),
    stale: portfolio.filter((c) => c.open.some((f) => f.type === "STALE_STATUS")).length,
    validated: portfolio.filter((c) => c.readiness.validated).length,
  };
}
