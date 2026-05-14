import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import type { QuiverData } from "@/lib/api-types";
import { Button } from "@/components/ui/button";

// react-force-graph-2d pulls in d3-force at import time; lazy-load so the
// initial bundle stays small.
const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

interface Node {
  id: string;
  label: string;
  size: number;
  n_refs: number;
  year: number | null;
  authors: string[];
  journal: string;
  loops: number;
  // d3 mutates these:
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Link {
  source: string;
  target: string;
  weight: number;
}

interface Props {
  data?: QuiverData;
  loading?: boolean;
  height?: number | string;
}

export function QuiverGraph({ data, loading, height = 620 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: typeof height === "number" ? height : 620 });
  const [hover, setHover] = useState<Node | null>(null);

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          w: entry.contentRect.width,
          h: typeof height === "number" ? height : entry.contentRect.height || 620,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height]);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as Node[], links: [] as Link[] };
    const loopMap = new Map<string, number>();
    for (const l of data.loops) loopMap.set(l.id, l.count);
    const nodes: Node[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      size: n.size,
      n_refs: n.n_refs,
      year: n.year,
      authors: n.authors,
      journal: n.journal,
      loops: loopMap.get(n.id) ?? 0,
    }));
    const links: Link[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));
    return { nodes, links };
  }, [data]);

  // Tune the d3-force simulation so nodes fill the canvas evenly.
  //
  // Strategy: aggressive repulsion (charge) makes the graph expand to
  // the viewport edges; a moderate `forceX`/`forceY` keeps it centred
  // without collapsing inward; collision prevents overlap.
  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    import("d3-force").then((d3) => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force("charge")
        ?.strength((n: any) => -500 - nodeRadius(n) * 20)
        .distanceMax(Math.max(size.w, size.h));
      fg.d3Force("link")?.distance((l: any) => 80 + (l.weight ?? 1) * 4);
      fg.d3Force("collide", d3.forceCollide((n: any) => nodeRadius(n) + 6));
      // Gentle centring keeps the cloud from drifting off-canvas.
      fg.d3Force("x", d3.forceX().strength(0.03));
      fg.d3Force("y", d3.forceY().strength(0.03));
      fg.d3ReheatSimulation();
    });
  }, [graphData, size.w, size.h]);

  if (loading || !data) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground"
      >
        Cargando quiver…
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground"
      >
        Sin nodos para mostrar.
      </div>
    );
  }

  const truncated = data.n_total_polygons > data.n_shown;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {data.n_shown} / {data.n_total_polygons} nodos
          {data.loops.length > 0 && ` · ${data.loops.length} loops`}
          {truncated && " · truncado por densidad"}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => fgRef.current?.zoomToFit(400, 40)}
          >
            Fit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => fgRef.current?.d3ReheatSimulation()}
          >
            Reheat
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className="relative overflow-hidden rounded-md border bg-white"
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Inicializando motor físico…
            </div>
          }
        >
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={size.w}
            height={size.h}
            backgroundColor="#ffffff"
            nodeLabel={(n: any) =>
              `<div style="background:#0f172a;color:#fff;padding:6px 8px;border-radius:4px;font-size:12px;max-width:280px;">
                <div style="font-weight:600">${escapeHtml(n.label)}</div>
                <div style="opacity:0.7;margin-top:2px">${n.year ?? "—"} · ${n.n_refs} refs${n.loops ? ` · ${n.loops} loops` : ""}</div>
                ${n.authors.length ? `<div style="opacity:0.6;margin-top:2px;font-size:11px">${escapeHtml(n.authors.join(", "))}</div>` : ""}
              </div>`
            }
            nodeVal={(n: any) => nodeRadius(n)}
            nodeRelSize={1}
            nodeColor={(n: any) => colorForSize(n.size)}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const r = nodeRadius(node);
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
              ctx.fillStyle = colorForSize(node.size);
              ctx.globalAlpha = 0.85;
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.lineWidth = 1 / globalScale;
              ctx.strokeStyle = "#1e3a8a";
              ctx.stroke();
              // Loop badge
              if (node.loops > 0) {
                ctx.fillStyle = "#a855f7";
                ctx.font = `${10 / globalScale}px sans-serif`;
                ctx.textAlign = "center";
                ctx.fillText(`↻${node.loops}`, node.x!, node.y! - r - 2 / globalScale);
              }
              // Label on hover/zoom-in
              if (globalScale > 1.6) {
                ctx.fillStyle = "#0f172a";
                ctx.font = `${9 / globalScale}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(truncate(node.label, 26), node.x!, node.y! + r + 2 / globalScale);
              }
            }}
            nodeCanvasObjectMode={() => "replace"}
            linkColor={() => "rgba(100,116,139,0.4)"}
            linkWidth={(l: any) => Math.min(0.5 + l.weight * 0.4, 4)}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkDirectionalArrowColor={() => "rgba(100,116,139,0.6)"}
            linkLabel={(l: any) => (l.weight > 1 ? `${l.weight} flechas` : "")}
            onNodeHover={(n: any) => {
              setHover(n);
              if (containerRef.current) {
                containerRef.current.style.cursor = n ? "pointer" : "default";
              }
            }}
            cooldownTicks={300}
            warmupTicks={80}
            onEngineStop={() => fgRef.current?.zoomToFit(600, 60)}
          />
        </Suspense>
      </div>

      {hover && (
        <div className="rounded-md border bg-card px-3 py-2 text-xs">
          <div className="font-semibold">{hover.label}</div>
          <div className="text-muted-foreground">
            {hover.year ? `${hover.year} · ` : ""}{hover.n_refs} referencias
            {hover.loops ? ` · ${hover.loops} loops` : ""}
            {hover.journal ? ` · ${hover.journal}` : ""}
          </div>
          {hover.authors.length > 0 && (
            <div className="mt-1 truncate text-muted-foreground">
              {hover.authors.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Logarithmic radius: a polygon with 30 refs is only ~2× bigger than
 * one with 5 refs, instead of 6× under linear scaling. Keeps the big
 * papers visible without obscuring the rest of the graph.
 */
function nodeRadius(n: { size?: number }): number {
  const s = Math.max(0, n.size ?? 0);
  return 3 + Math.log1p(s) * 2.5;
}

function colorForSize(size: number): string {
  // Blue → purple scale by polygon size (# refs)
  const ratio = Math.min(size / 30, 1);
  const hue = 220 - ratio * 60; // 220 (blue) → 160 (teal-ish)
  return `hsl(${hue}, 65%, 55%)`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
