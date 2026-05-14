import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import type { CoauthorshipGraph as Graph } from "@/lib/api-types";

const ForceGraph2D = lazy(() => import("react-force-graph-2d"));

interface Node {
  id: string;
  label: string;
  size: number;
  x?: number;
  y?: number;
}

interface Link {
  source: string;
  target: string;
}

interface Props {
  data?: Graph;
  loading?: boolean;
  height?: number | string;
}

export function CoauthorshipGraph({ data, loading, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: typeof height === "number" ? height : 560 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          w: entry.contentRect.width,
          h: typeof height === "number" ? height : entry.contentRect.height || 560,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height]);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as Node[], links: [] as Link[] };
    return {
      nodes: data.nodes.map((n) => ({ id: n.id, label: n.label, size: n.size })),
      links: data.edges.map((e) => ({ source: e.source, target: e.target })),
    };
  }, [data]);

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    import("d3-force").then((d3) => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force("charge")
        ?.strength((n: any) => -300 - nodeRadius(n) * 15)
        .distanceMax(Math.max(size.w, size.h));
      fg.d3Force("link")?.distance(60);
      fg.d3Force("collide", d3.forceCollide((n: any) => nodeRadius(n) + 4));
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
        Cargando grafo…
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

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {data.nodes.length} nodos · {data.edges.length} aristas
        {data.n_total_authors !== undefined && ` (de ${data.n_total_authors} autores totales)`}
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className="overflow-hidden rounded-md border bg-white"
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
            nodeLabel={(n: any) => n.label}
            nodeVal={(n: any) => nodeRadius(n)}
            nodeRelSize={1}
            nodeColor={() => "#10b981"}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const r = nodeRadius(node);
              ctx.beginPath();
              ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI);
              ctx.fillStyle = "#10b981";
              ctx.globalAlpha = 0.85;
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.lineWidth = 1 / globalScale;
              ctx.strokeStyle = "#065f46";
              ctx.stroke();
              if (globalScale > 2) {
                ctx.fillStyle = "#0f172a";
                ctx.font = `${8 / globalScale}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(truncate(node.label, 18), node.x!, node.y! + r + 2 / globalScale);
              }
            }}
            nodeCanvasObjectMode={() => "replace"}
            linkColor={() => "rgba(100,116,139,0.3)"}
            linkWidth={0.6}
            cooldownTicks={300}
            warmupTicks={80}
            onEngineStop={() => fgRef.current?.zoomToFit(600, 60)}
          />
        </Suspense>
      </div>
    </div>
  );
}

function nodeRadius(n: { size?: number }): number {
  const s = Math.max(0, n.size ?? 0);
  return 2 + Math.log1p(s) * 1.2;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
