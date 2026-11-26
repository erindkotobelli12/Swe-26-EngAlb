import { ACCESS_STATUS_LABEL, KT_STAGE_LABEL, roleLabel, type CaseState, type Severity } from "@/domain/types";
import { formatDate } from "@/lib/clock";
import type { ReadinessResult } from "@/modules/readiness/evaluate";
import type { DisplayState, GraphEdge, NodeResult } from "./graph";

export type MapNode = {
  key: string;
  type: NodeResult["type"];
  label: string;
  sublabel: string;
  display: DisplayState;
  proposed: boolean;
  isRootBlocker: boolean;
  owner: string | null;
  blockedBy: string[];
  downstreamImpact: string[];
  details: string[];
  evidence: { id: string; title: string; excerpt: string }[];
  findings: { id: string; title: string; severity: Severity }[];
  simulateToggle: string | null;
};
export type MapEdge = Pick<GraphEdge, "id" | "from" | "to" | "status" | "origin" | "rationale" | "dependencyId">;
export type ProposedEdge = { id: string; fromLabel: string; toLabel: string; origin: string; rationale: string; evidenceIds: string[]; excerpts: string[] };
export type MapData = { nodes: MapNode[]; edges: MapEdge[]; minimal: string[]; order: string[]; rootBlockers: string[]; proposed: ProposedEdge[]; usedProposed: boolean };

/** Read-only projection of the deterministic graph for the React Flow view. */
export function buildMapData(state: CaseState, readiness: ReadinessResult): MapData {
  const g = readiness.graph;
  const evidence = [...state.evidence, ...state.projectEvidence];
  const label = new Map(g.nodes.map((n) => [n.key, n.label]));
  const claimExcerpt = (match: (field: string) => boolean, evidenceId: string) =>
    state.claims.find((c) => c.evidenceId === evidenceId && c.reviewStatus === "APPROVED" && match(c.field.toLowerCase()))?.excerpt;

  const nodes: MapNode[] = g.nodes.map((n) => {
    let details: string[] = [];
    let simulateToggle: string | null = null;
    let match: (f: string) => boolean = () => false;
    if (n.type === "access") {
      const a = state.access.find((x) => x.id === n.refId)!;
      details = [`Status: ${ACCESS_STATUS_LABEL[a.status]}`, `Requested: ${a.requestDate ? formatDate(a.requestDate) : "unknown"}`, `Next-step owner: ${a.owner ?? "not recorded"}`, ...(a.handlerRole ? [`Handled by: ${roleLabel(a.handlerRole)}`] : []), ...(a.blockerReason ? [a.blockerReason] : [])];
      simulateToggle = a.status !== "USABLE" ? `access:${a.id}` : null;
      match = (f) => f.startsWith(`access.${a.application.toLowerCase()}.`);
    } else if (n.type === "kt") {
      const k = state.kt.find((x) => x.id === n.refId)!;
      details = [`Stage: ${KT_STAGE_LABEL[k.stage]} (${k.stageBasis.toLowerCase().replaceAll("_", " ")})`, `Scope: ${k.scopeType === "COMPLEX" ? "complex / exceptions" : "core"}`, `Owner: ${k.owner ?? "not recorded"}`, ...(k.status === "PROPOSED" ? ["Proposed requirement — not yet agreed"] : []), ...(k.originNote ? [k.originNote] : [])];
      simulateToggle = k.stage !== "INDEPENDENT_EXECUTION" ? `kt:${k.id}` : null;
      match = (f) => f.startsWith(`kt.${k.title.toLowerCase()}.`);
    } else if (n.type === "gate") {
      details = readiness.gates.find((x) => x.id === n.refId)?.reasons ?? [];
    } else if (n.type === "finding") {
      details = [state.findings.find((x) => x.id === n.refId)?.description ?? ""];
    } else {
      details = [readiness.assessedReasons.join(" ")];
    }
    const related = state.findings.filter((f) => (f.status === "OPEN" || f.status === "PROPOSED") && (f.id === n.refId || f.affectedEntities.some((e) => e.id === n.refId)));
    return {
      key: n.key, type: n.type, label: n.label, sublabel: n.sublabel, display: n.display, proposed: n.proposed, isRootBlocker: n.isRootBlocker, owner: n.owner,
      blockedBy: n.blockedBy.map((k) => label.get(k) ?? k), downstreamImpact: n.downstreamImpact, details,
      evidence: n.evidenceIds.map((id) => { const e = evidence.find((x) => x.id === id); return e ? { id, title: e.title, excerpt: claimExcerpt(match, id) ?? e.content.slice(0, 180) } : null; }).filter((x): x is NonNullable<typeof x> => Boolean(x)),
      findings: related.map((f) => ({ id: f.id, title: f.title, severity: f.severity })),
      simulateToggle,
    };
  });

  const proposed: ProposedEdge[] = g.edges.filter((e) => e.status === "PROPOSED" && e.dependencyId).map((e) => ({
    id: e.dependencyId!, fromLabel: label.get(e.from) ?? e.from, toLabel: label.get(e.to) ?? e.to,
    origin: state.dependencies.find((d) => d.id === e.dependencyId)?.origin ?? e.origin, rationale: e.rationale, evidenceIds: e.evidenceIds, excerpts: e.excerpts,
  }));
  return {
    nodes,
    edges: g.edges.map(({ id, from, to, status, origin, rationale, dependencyId }) => ({ id, from, to, status, origin, rationale, dependencyId })),
    minimal: g.minimalPrerequisites, order: g.recommendedOrder, rootBlockers: g.rootBlockers, proposed, usedProposed: g.usedProposed,
  };
}
