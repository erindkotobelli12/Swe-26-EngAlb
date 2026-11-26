import {
  ACCESS_STATUS_LABEL, GATE_IDS, GATE_LABEL, KT_STAGE_LABEL,
  type CaseState, type DependencyItem, type Gate, type GateId, type NodeType,
} from "@/domain/types";

/**
 * Deterministic dependency engine.
 *
 * Nodes: access requirements, KT activities, blocker findings, the ten readiness gates and a final Readiness node.
 * Edges: (a) structural RULE edges implied by the gate definitions (always confirmed, not stored), and
 *        (b) case-specific Dependency rows (TEMPLATE / AI / HUMAN origin) that are PROPOSED until a human confirms them.
 * Only CONFIRMED edges propagate, unless the caller explicitly opts in to proposed edges (simulator toggle).
 *
 * The graph is AND-only: a node needs every confirmed upstream node satisfied. Under that assumption the
 * unsatisfied confirmed ancestors of Readiness are exactly the minimal prerequisite set.
 */

export type Satisfaction = "SATISFIED" | "IN_PROGRESS" | "UNSATISFIED" | "UNKNOWN";
export type DisplayState = "SATISFIED" | "IN_PROGRESS" | "BLOCKED" | "UNKNOWN";

export type GraphNode = {
  key: string;
  type: NodeType;
  refId: string;
  label: string;
  sublabel: string;
  satisfaction: Satisfaction;
  proposed: boolean;
  owner: string | null;
  evidenceIds: string[];
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  status: DependencyItem["status"];
  origin: DependencyItem["origin"];
  rationale: string;
  evidenceIds: string[];
  excerpts: string[];
  dependencyId: string | null;
};

export type NodeResult = GraphNode & {
  display: DisplayState;
  isRootBlocker: boolean;
  blockedBy: string[];
  downstreamImpact: string[];
};

export type GraphResult = {
  nodes: NodeResult[];
  edges: GraphEdge[];
  usedProposed: boolean;
  /** Unsatisfied confirmed ancestors of Readiness (AND-only graph ⇒ minimal prerequisite set). */
  minimalPrerequisites: string[];
  /** Topological order of the minimal prerequisite set, ties broken by downstream impact (desc). */
  recommendedOrder: string[];
  rootBlockers: string[];
};

export const READINESS_KEY = "readiness";
export const nodeKey = (type: NodeType, id: string) => (type === "readiness" ? READINESS_KEY : `${type}:${id}`);

/** Which gate a blocker finding feeds, when it is not already represented by an access/KT node. */
function gateForFinding(entities: { type: string; id: string }[]): GateId | null {
  const gate = entities.find((e) => e.type === "gate");
  return gate && (GATE_IDS as readonly string[]).includes(gate.id) ? (gate.id as GateId) : null;
}

export function buildNodes(state: CaseState, gates: Gate[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  for (const a of state.access) {
    nodes.push({
      key: nodeKey("access", a.id), type: "access", refId: a.id, label: a.application,
      sublabel: ACCESS_STATUS_LABEL[a.status],
      satisfaction: a.status === "USABLE" ? "SATISFIED" : a.status === "NOT_REQUESTED" || a.status === "REJECTED" ? "UNSATISFIED" : "IN_PROGRESS",
      proposed: false, owner: a.owner, evidenceIds: [a.evidenceId, a.usableEvidenceId].filter((x): x is string => Boolean(x)),
    });
  }
  for (const k of state.kt) {
    if (k.status === "REJECTED") continue;
    const observedIndependent = k.stage === "INDEPENDENT_EXECUTION" && k.stageBasis === "OBSERVED";
    nodes.push({
      key: nodeKey("kt", k.id), type: "kt", refId: k.id, label: k.title,
      sublabel: `${KT_STAGE_LABEL[k.stage]}${k.stage !== "NOT_STARTED" ? ` · ${k.stageBasis.toLowerCase().replaceAll("_", "-")}` : ""}`,
      satisfaction: observedIndependent ? "SATISFIED" : k.stage === "NOT_STARTED" ? "UNSATISFIED" : "IN_PROGRESS",
      proposed: k.status === "PROPOSED", owner: k.owner, evidenceIds: k.evidenceId ? [k.evidenceId] : [],
    });
  }
  for (const f of state.findings) {
    if (f.status !== "OPEN" || !["HIGH", "CRITICAL"].includes(f.severity)) continue;
    if (f.affectedEntities.some((e) => e.type === "access" || e.type === "kt")) continue;
    if (!gateForFinding(f.affectedEntities)) continue;
    nodes.push({
      key: nodeKey("finding", f.id), type: "finding", refId: f.id, label: f.title, sublabel: `${f.severity.toLowerCase()} · ${f.origin === "AI" ? "AI" : "rule"} finding`,
      satisfaction: "UNSATISFIED", proposed: false, owner: f.ownerRole, evidenceIds: f.evidenceIds,
    });
  }
  for (const g of gates) {
    nodes.push({
      key: nodeKey("gate", g.id), type: "gate", refId: g.id, label: GATE_LABEL[g.id], sublabel: g.status.toLowerCase(),
      satisfaction: g.status === "SATISFIED" ? "SATISFIED" : g.status === "UNKNOWN" ? "UNKNOWN" : "UNSATISFIED",
      proposed: false, owner: null, evidenceIds: g.evidenceIds,
    });
  }
  const allGates = gates.every((g) => g.status === "SATISFIED");
  nodes.push({
    key: READINESS_KEY, type: "readiness", refId: "READINESS", label: "Readiness", sublabel: allGates ? "all gates satisfied" : "gates outstanding",
    satisfaction: allGates ? "SATISFIED" : "UNSATISFIED", proposed: false, owner: null, evidenceIds: [],
  });
  return nodes;
}

/** Structural edges implied by the gate definitions. Always confirmed; not stored as rows. */
export function structuralEdges(state: CaseState, nodes: GraphNode[]): GraphEdge[] {
  const has = new Set(nodes.map((n) => n.key));
  const edges: GraphEdge[] = [];
  const rule = (from: string, to: string, rationale: string): void => {
    if (has.has(from) && has.has(to)) edges.push({ id: `rule:${from}->${to}`, from, to, status: "CONFIRMED", origin: "RULE", rationale, evidenceIds: [], excerpts: [], dependencyId: null });
  };
  for (const a of state.access) if (a.required) rule(nodeKey("access", a.id), nodeKey("gate", "ACCESS_USABLE"), "Gate rule: every required access item must be usable.");
  for (const k of state.kt) {
    if (k.status === "CONFIRMED" && k.required) rule(nodeKey("kt", k.id), nodeKey("gate", "EXECUTION_OBSERVED"), "Gate rule: every agreed KT activity needs observed independent execution.");
  }
  for (const n of nodes) {
    if (n.type === "finding") {
      const f = state.findings.find((x) => x.id === n.refId);
      const gate = f ? gateForFinding(f.affectedEntities) : null;
      if (gate) rule(n.key, nodeKey("gate", gate), "An open blocker finding prevents this gate.");
    }
  }
  rule(nodeKey("gate", "EXECUTION_OBSERVED"), nodeKey("gate", "TECH_VALIDATION_APPROVED"), "Final validation is based on observed independent execution.");
  for (const g of GATE_IDS) rule(nodeKey("gate", g), READINESS_KEY, "Independent readiness requires every gate.");
  return edges;
}

export function dependencyEdges(state: CaseState, nodes: GraphNode[]): GraphEdge[] {
  const has = new Set(nodes.map((n) => n.key));
  return state.dependencies
    .filter((d) => d.status !== "REJECTED")
    .map((d) => ({
      id: d.id, from: nodeKey(d.fromType, d.fromId), to: nodeKey(d.toType, d.toId), status: d.status, origin: d.origin,
      rationale: d.rationale, evidenceIds: d.evidenceIds, excerpts: d.excerpts, dependencyId: d.id,
    }))
    .filter((e) => has.has(e.from) && has.has(e.to) && e.from !== e.to);
}

function dedupe(edges: GraphEdge[]): GraphEdge[] {
  const byPair = new Map<string, GraphEdge>();
  for (const e of edges) {
    const key = `${e.from}->${e.to}`;
    const prior = byPair.get(key);
    // Prefer a stored dependency row (it carries rationale/evidence) and a confirmed edge over a proposed one.
    if (!prior || (prior.status !== "CONFIRMED" && e.status === "CONFIRMED") || (prior.status === e.status && !prior.dependencyId && e.dependencyId)) byPair.set(key, e);
  }
  return [...byPair.values()];
}

export function propagate(nodes: GraphNode[], allEdges: GraphEdge[], includeProposed = false): GraphResult {
  const edges = dedupe(allEdges);
  const active = edges.filter((e) => e.status === "CONFIRMED" || (includeProposed && e.status === "PROPOSED"));
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const upstream = new Map<string, string[]>();
  const downstream = new Map<string, string[]>();
  for (const e of active) {
    upstream.set(e.to, [...(upstream.get(e.to) ?? []), e.from]);
    downstream.set(e.from, [...(downstream.get(e.from) ?? []), e.to]);
  }
  const satisfied = (key: string) => byKey.get(key)?.satisfaction === "SATISFIED";

  const blockedBy = new Map<string, string[]>();
  for (const n of nodes) {
    if (satisfied(n.key)) continue;
    const ups = (upstream.get(n.key) ?? []).filter((u) => !satisfied(u));
    if (ups.length) blockedBy.set(n.key, ups);
  }

  const reach = (start: string, adj: Map<string, string[]>): string[] => {
    const seen = new Set<string>();
    const stack = [...(adj.get(start) ?? [])];
    while (stack.length) {
      const k = stack.pop()!;
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push(...(adj.get(k) ?? []));
    }
    return [...seen];
  };

  const downstreamImpact = new Map<string, string[]>();
  for (const n of nodes) {
    if (satisfied(n.key)) { downstreamImpact.set(n.key, []); continue; }
    downstreamImpact.set(n.key, reach(n.key, downstream).filter((k) => !satisfied(k)));
  }

  const ancestors = reach(READINESS_KEY, upstream);
  const minimal = ancestors.filter((k) => !satisfied(k));
  const minimalSet = new Set(minimal);

  // Kahn's algorithm on the minimal set; ties broken by downstream impact count (desc), then label.
  const indeg = new Map<string, number>(minimal.map((k) => [k, (upstream.get(k) ?? []).filter((u) => minimalSet.has(u)).length]));
  const order: string[] = [];
  const impact = (k: string) => downstreamImpact.get(k)?.length ?? 0;
  const label = (k: string) => byKey.get(k)?.label ?? k;
  let ready = minimal.filter((k) => indeg.get(k) === 0);
  while (ready.length) {
    ready.sort((a, b) => impact(b) - impact(a) || label(a).localeCompare(label(b)));
    const next = ready.shift()!;
    order.push(next);
    for (const d of downstream.get(next) ?? []) {
      if (!minimalSet.has(d)) continue;
      indeg.set(d, (indeg.get(d) ?? 0) - 1);
      if (indeg.get(d) === 0) ready.push(d);
    }
  }
  // Any cycle remainder (should not happen with AND-only templates) is appended deterministically.
  for (const k of minimal) if (!order.includes(k)) order.push(k);

  const results: NodeResult[] = nodes.map((n) => {
    const isBlocked = blockedBy.has(n.key);
    const display: DisplayState = n.satisfaction === "SATISFIED" ? "SATISFIED" : isBlocked ? "BLOCKED" : n.satisfaction === "UNKNOWN" ? "UNKNOWN" : "IN_PROGRESS";
    const isRootBlocker = !satisfied(n.key) && !isBlocked && (downstreamImpact.get(n.key) ?? []).some((k) => blockedBy.get(k)?.includes(n.key) || blockedBy.has(k));
    // Gates and the final node are checklist items, not work items: only access, KT and blocker nodes are flagged as root blockers.
    const workItem = n.type !== "readiness" && n.type !== "gate";
    return { ...n, display, isRootBlocker: isRootBlocker && workItem, blockedBy: blockedBy.get(n.key) ?? [], downstreamImpact: downstreamImpact.get(n.key) ?? [] };
  });
  const rootBlockers = results.filter((r) => r.isRootBlocker && minimalSet.has(r.key)).map((r) => r.key);

  return { nodes: results, edges, usedProposed: includeProposed, minimalPrerequisites: minimal, recommendedOrder: order, rootBlockers };
}

export function buildGraph(state: CaseState, gates: Gate[], includeProposed = false): GraphResult {
  const nodes = buildNodes(state, gates);
  return propagate(nodes, [...structuralEdges(state, nodes), ...dependencyEdges(state, nodes)], includeProposed);
}
