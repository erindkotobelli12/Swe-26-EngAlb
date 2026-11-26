"use client";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import { graphlib, layout } from "@dagrejs/dagre";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { FlaskConical, Route, X } from "lucide-react";
import type { MapData, MapNode } from "@/modules/dependencies/viewModel";

const W = 200;
const H = 68;
const STATE_STYLE: Record<MapNode["display"], { box: string; dot: string; label: string }> = {
  SATISFIED: { box: "border-emerald-300 bg-emerald-50", dot: "bg-emerald-500", label: "Satisfied" },
  IN_PROGRESS: { box: "border-amber-300 bg-amber-50", dot: "bg-amber-500", label: "Open / in progress" },
  BLOCKED: { box: "border-red-300 bg-red-50", dot: "bg-red-500", label: "Blocked" },
  UNKNOWN: { box: "border-slate-300 bg-slate-50", dot: "bg-slate-400", label: "Unknown" },
};
const TYPE_LABEL: Record<string, string> = { access: "Access", kt: "KT activity", gate: "Readiness gate", readiness: "Final", finding: "Blocker", competency: "Competency", responsibility: "Responsibility" };

type FlowData = { node: MapNode; dim: boolean; highlight: boolean };

function OnboardNode({ data }: NodeProps<Node<FlowData>>) {
  const { node, dim, highlight } = data;
  const s = STATE_STYLE[node.display];
  return (
    <div data-node-key={node.key} data-display={node.display} style={{ width: W, height: H }}
      className={`overflow-hidden rounded-lg border-2 px-2.5 py-1 text-left shadow-sm transition ${s.box} ${node.proposed ? "border-dashed" : ""} ${node.isRootBlocker ? "ring-2 ring-red-600 ring-offset-1" : ""} ${highlight ? "ring-2 ring-indigo-500" : ""} ${dim ? "opacity-30" : ""} ${node.type === "readiness" ? "font-bold" : ""}`}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-400" />
      <div className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span>{TYPE_LABEL[node.type] ?? node.type}{node.proposed ? " · proposed" : ""}</span>
        <span className={`h-2 w-2 rounded-full ${s.dot}`} title={s.label} />
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-tight text-slate-800" title={node.label}>{node.label}</p>
      <p className="truncate text-[10px] text-slate-500">{node.isRootBlocker ? "ROOT BLOCKER · " : ""}{node.sublabel}</p>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-slate-400" />
    </div>
  );
}
const nodeTypes = { onboard: OnboardNode };

function layoutPositions(data: MapData): Map<string, { x: number; y: number }> {
  const g = new graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 12, ranksep: 60, marginx: 6, marginy: 6 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of data.nodes) g.setNode(n.key, { width: W, height: H });
  for (const e of data.edges) g.setEdge(e.from, e.to);
  layout(g);
  return new Map(data.nodes.map((n) => {
    const p = g.node(n.key);
    return [n.key, { x: (p?.x ?? 0) - W / 2, y: (p?.y ?? 0) - H / 2 }];
  }));
}

export default function DependencyMap({ data, employeeId }: { data: MapData; employeeId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [critical, setCritical] = useState(false);
  const positions = useMemo(() => layoutPositions(data), [data]);
  const byKey = useMemo(() => new Map(data.nodes.map((n) => [n.key, n])), [data]);
  const sel = selected ? byKey.get(selected) ?? null : null;

  const focus = useMemo(() => {
    if (critical) return new Set([...data.minimal, "readiness"]);
    if (sel) return new Set([sel.key, ...sel.downstreamImpact]);
    return null;
  }, [critical, sel, data.minimal]);

  const nodes: Node<FlowData>[] = data.nodes.map((n) => ({
    id: n.key, type: "onboard", position: positions.get(n.key)!, data: { node: n, dim: Boolean(focus && !focus.has(n.key)), highlight: n.key === selected },
  }));
  const edges: Edge[] = data.edges.map((e) => {
    const onPath = focus ? focus.has(e.from) && focus.has(e.to) : false;
    const proposed = e.status === "PROPOSED";
    const rule = e.origin === "RULE";
    const color = onPath ? "#dc2626" : proposed ? "#d97706" : rule ? "#cbd5e1" : "#475569";
    return {
      id: e.id, source: e.from, target: e.to, animated: onPath,
      label: proposed ? "Proposed" : undefined, labelStyle: { fontSize: 10, fill: "#b45309", fontWeight: 700 }, labelBgStyle: { fill: "#fffbeb" },
      style: { stroke: color, strokeWidth: onPath ? 2.5 : rule ? 1 : 2, strokeDasharray: proposed ? "6 4" : undefined, opacity: focus && !onPath ? 0.25 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
          {(Object.keys(STATE_STYLE) as MapNode["display"][]).map((k) => <span key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${STATE_STYLE[k].dot}`} />{STATE_STYLE[k].label}</span>)}
          <span className="flex items-center gap-1"><span className="inline-block w-6 border-t-2 border-dashed border-amber-600" />Proposed edge (does not propagate)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-6 border-t-2 border-slate-600" />Confirmed</span>
          <span className="flex items-center gap-1"><span className="inline-block w-6 border-t border-slate-300" />Gate rule</span>
          <button type="button" onClick={() => { setCritical((c) => !c); setSelected(null); }} className={`ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 font-bold ${critical ? "border-red-300 bg-red-50 text-red-700" : ""}`}><Route size={13} />{critical ? "Hide critical path" : "Show critical path"}</button>
        </div>
        <div className="h-[760px] rounded-xl border border-slate-200 bg-white" data-testid="dependency-map">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.04 }} minZoom={0.2} nodesDraggable={false} nodesConnectable={false}
            onNodeClick={(_, n) => { setCritical(false); setSelected(n.id); }} onPaneClick={() => setSelected(null)}>
            <Background gap={18} color="#e2e8f0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <p className="mt-2 text-xs text-slate-500">AND-only graph: a node needs every confirmed upstream node. A node is <b>blocked</b> when it is unsatisfied and has an unsatisfied confirmed upstream node. Click a node to highlight its downstream impact.</p>
      </div>

      <aside className="grid items-start gap-3 md:grid-cols-2">
        {sel ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="node-panel">
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-[11px] font-bold uppercase text-slate-400">{TYPE_LABEL[sel.type]}{sel.proposed ? " · proposed" : ""}</p><h3 className="font-bold">{sel.label}</h3></div>
              <button type="button" aria-label="Close panel" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>
            <p className="mt-1 text-sm"><span className={`mr-1 inline-block h-2 w-2 rounded-full ${STATE_STYLE[sel.display].dot}`} />{STATE_STYLE[sel.display].label}{sel.isRootBlocker && <b className="ml-2 text-red-700">Root blocker</b>}</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">{sel.details.filter(Boolean).map((d) => <li key={d}>{d}</li>)}</ul>
            {sel.blockedBy.length > 0 && <p className="mt-2 text-xs"><b>Blocked by:</b> {sel.blockedBy.join(", ")}</p>}
            {sel.downstreamImpact.length > 0 && <p className="mt-2 text-xs"><b>Downstream impact ({sel.downstreamImpact.length}):</b> {sel.downstreamImpact.map((k) => byKey.get(k)?.label ?? k).join(", ")}</p>}
            {sel.evidence.length > 0 && <div className="mt-3 space-y-1">{sel.evidence.map((e) => <p key={e.id} className="border-l-2 border-emerald-300 pl-2 text-xs italic text-slate-600">“{e.excerpt}” <Link href={`/evidence#${e.id}`} className="not-italic font-semibold text-indigo-700">{e.id}</Link></p>)}</div>}
            {sel.findings.length > 0 && <div className="mt-3"><p className="text-xs font-bold">Related findings</p><ul className="mt-1 space-y-1 text-xs">{sel.findings.map((f) => <li key={f.id}><Link href={`/employees/${employeeId}?tab=investigation#${f.id}`} className="text-indigo-700 hover:underline">{f.severity.toLowerCase()} · {f.title}</Link></li>)}</ul></div>}
            {sel.simulateToggle && <Link href={`/employees/${employeeId}?tab=simulator&preset=${encodeURIComponent(sel.simulateToggle)}`} className="mt-3 inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white"><FlaskConical size={13} />Simulate resolving this</Link>}
          </div>
        ) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">Select a node to see its status, owner, evidence and downstream impact.</div>}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold">Minimal prerequisite set ({data.minimal.length})</p>
          <p className="mt-1 text-xs text-slate-500">Unsatisfied confirmed ancestors of Readiness, in recommended order (dependencies first, then by downstream impact).</p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">{data.order.map((k) => <li key={k} className={data.rootBlockers.includes(k) ? "font-bold text-red-700" : ""}>{byKey.get(k)?.label ?? k}</li>)}</ol>
        </div>
      </aside>
    </div>
  );
}
