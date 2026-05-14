import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type LayoutOptions } from "cytoscape";
import dagre from "cytoscape-dagre";
import coseBilkent from "cytoscape-cose-bilkent";
import type { QuiverData } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

cytoscape.use(dagre);
cytoscape.use(coseBilkent);

type LayoutKind = "dagre" | "cose-bilkent" | "circle" | "concentric";

interface Props {
  data?: QuiverData;
  loading?: boolean;
  height?: number | string;
}

const LAYOUTS: Record<LayoutKind, LayoutOptions> = {
  dagre: {
    name: "dagre",
    rankDir: "LR",
    nodeSep: 40,
    rankSep: 80,
    padding: 30,
    animate: true,
    animationDuration: 400,
  } as LayoutOptions,
  "cose-bilkent": {
    name: "cose-bilkent",
    animate: false,
    nodeRepulsion: 8000,
    idealEdgeLength: 90,
    edgeElasticity: 0.45,
    gravity: 0.25,
    numIter: 2500,
    tile: true,
    padding: 30,
  } as LayoutOptions,
  circle: { name: "circle", padding: 30, animate: true, animationDuration: 400 },
  concentric: {
    name: "concentric",
    padding: 30,
    minNodeSpacing: 30,
    animate: true,
    animationDuration: 400,
  } as LayoutOptions,
};

export function QuiverGraph({ data, loading, height = 620 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [layout, setLayout] = useState<LayoutKind>("dagre");
  const [hover, setHover] = useState<string | null>(null);

  // Build elements once per data change. Cytoscape supports loops natively
  // (an edge with source==target). For visual loops we encode them by
  // adding self-edges flagged with `loop: true` so the stylesheet renders
  // them with a label of count and a curved bezier.
  const elements = useMemo<ElementDefinition[]>(() => {
    if (!data) return [];
    const els: ElementDefinition[] = [];
    for (const n of data.nodes) {
      els.push({
        data: {
          id: n.id,
          label: n.label,
          year: n.year,
          size: n.size,
          n_refs: n.n_refs,
          authors: n.authors.join(", "),
          journal: n.journal,
        },
      });
    }
    for (const e of data.edges) {
      els.push({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          weight: e.weight,
        },
      });
    }
    for (const l of data.loops) {
      els.push({
        data: {
          id: `loop_${l.id}`,
          source: l.id,
          target: l.id,
          weight: l.count,
          loop: true,
        },
      });
    }
    return els;
  }, [data]);

  // Initialize / re-initialize Cytoscape when elements change.
  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 4,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#3b82f6",
            "background-opacity": 0.85,
            "border-color": "#1e3a8a",
            "border-width": 1,
            label: "data(label)",
            color: "#0f172a",
            "font-size": 9,
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 4,
            "text-wrap": "ellipsis",
            "text-max-width": "120px",
            width: "mapData(size, 0, 30, 14, 56)",
            height: "mapData(size, 0, 30, 14, 56)",
          },
        },
        {
          selector: "node:selected",
          style: { "border-color": "#dc2626", "border-width": 3 },
        },
        {
          selector: "edge",
          style: {
            width: "mapData(weight, 1, 8, 1, 5)",
            "line-color": "#94a3b8",
            "line-opacity": 0.55,
            "curve-style": "bezier",
            "control-point-step-size": 30,
            "target-arrow-shape": "triangle",
            "target-arrow-color": "#94a3b8",
            "arrow-scale": 0.9,
            label: "data(weight)",
            "font-size": 8,
            "text-background-color": "#fff",
            "text-background-opacity": 0.85,
            "text-background-padding": "1px",
            color: "#475569",
          },
        },
        {
          selector: "edge[weight = 1]",
          style: { label: "" }, // no label when there's only one parallel arrow
        },
        {
          selector: "edge[?loop]",
          style: {
            "curve-style": "bezier",
            "loop-direction": "-90deg",
            "loop-sweep": "45deg",
            "control-point-step-size": 25,
            "line-color": "#a855f7",
            "target-arrow-color": "#a855f7",
            "line-style": "dashed",
            label: "↻×data(weight)",
            "font-size": 9,
            color: "#7e22ce",
          },
        },
      ],
      layout: LAYOUTS[layout],
    });
    cyRef.current = cy;

    cy.on("mouseover", "node", (evt) => setHover(evt.target.id()));
    cy.on("mouseout", "node", () => setHover(null));

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, layout]);

  // Re-run layout when the user picks a different one (without rebuilding cy).
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.layout(LAYOUTS[layout]).run();
    }
  }, [layout]);

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
  const hovered = hover ? data.nodes.find((n) => n.id === hover) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Layout:</span>
        {(Object.keys(LAYOUTS) as LayoutKind[]).map((l) => (
          <Button
            key={l}
            size="sm"
            variant={layout === l ? "default" : "outline"}
            onClick={() => setLayout(l)}
            className="h-7 text-xs"
          >
            {l}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {data.n_shown} / {data.n_total_polygons} nodos
          {data.loops.length > 0 && ` · ${data.loops.length} loops`}
          {truncated && " (truncado por densidad)"}
        </span>
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className="rounded-md border bg-white"
      />

      {hovered && (
        <div className={cn("rounded-md border bg-card px-3 py-2 text-xs")}>
          <div className="font-semibold">{hovered.label}</div>
          <div className="text-muted-foreground">
            {hovered.year ? `${hovered.year} · ` : ""}
            {hovered.n_refs} referencias
            {hovered.journal ? ` · ${hovered.journal}` : ""}
          </div>
          {hovered.authors.length > 0 && (
            <div className="mt-1 truncate text-muted-foreground">
              {hovered.authors.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
