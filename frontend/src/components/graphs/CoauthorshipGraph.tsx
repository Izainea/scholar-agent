import { useEffect, useMemo, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import type { CoauthorshipGraph as Graph } from "@/lib/api-types";

cytoscape.use(coseBilkent);

interface Props {
  data?: Graph;
  loading?: boolean;
  height?: number | string;
}

export function CoauthorshipGraph({ data, loading, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const elements = useMemo<ElementDefinition[]>(() => {
    if (!data) return [];
    const els: ElementDefinition[] = [];
    for (const n of data.nodes) {
      els.push({ data: { id: n.id, label: n.label, size: n.size } });
    }
    for (let i = 0; i < data.edges.length; i++) {
      const e = data.edges[i];
      els.push({
        data: { id: `e_${i}`, source: e.source, target: e.target },
      });
    }
    return els;
  }, [data]);

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
            "background-color": "#10b981",
            "background-opacity": 0.85,
            "border-color": "#065f46",
            "border-width": 1,
            label: "data(label)",
            color: "#0f172a",
            "font-size": 7,
            "text-valign": "bottom",
            "text-halign": "center",
            "text-margin-y": 3,
            "text-wrap": "ellipsis",
            "text-max-width": "100px",
            width: "mapData(size, 1, 50, 10, 44)",
            height: "mapData(size, 1, 50, 10, 44)",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#94a3b8",
            "line-opacity": 0.4,
            "curve-style": "haystack",
          },
        },
      ],
      layout: {
        name: "cose-bilkent",
        animate: false,
        nodeRepulsion: 6000,
        idealEdgeLength: 70,
        edgeElasticity: 0.45,
        gravity: 0.35,
        numIter: 2500,
        tile: true,
        padding: 30,
      } as cytoscape.LayoutOptions,
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements]);

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
      <div className="flex items-center text-xs text-muted-foreground">
        <span>
          {data.nodes.length} nodos · {data.edges.length} aristas
        </span>
        {data.n_total_authors !== undefined && (
          <span className="ml-2">
            (de {data.n_total_authors} autores totales)
          </span>
        )}
      </div>
      <div ref={containerRef} style={{ height }} className="rounded-md border bg-white" />
    </div>
  );
}
