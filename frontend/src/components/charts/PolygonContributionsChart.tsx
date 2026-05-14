import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PolygonContributionsData } from "@/lib/api-types";

interface Props {
  data?: PolygonContributionsData;
  loading?: boolean;
  height?: number;
  topN?: number;
}

export function PolygonContributionsChart({ data, loading, height = 460, topN = 30 }: Props) {
  if (loading || !data) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-dashed bg-muted/40 text-sm text-muted-foreground"
      >
        Cargando…
      </div>
    );
  }
  const rows = data.rows.slice(0, topN);
  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">
        Mostrando top {rows.length} de {data.rows.length} polígonos · δ_B total ={" "}
        {data.delta_B_total}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis
            type="category"
            dataKey="title"
            width={200}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickFormatter={(v: string) => (v.length > 30 ? v.slice(0, 30) + "…" : v)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PolygonContributionsData["rows"][number];
              return (
                <div className="max-w-md rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-muted-foreground">{p.year ?? "—"}</div>
                  <div>δ contrib: <strong>{p.delta_contribution}</strong></div>
                  <div className="text-muted-foreground">
                    {p.n_refs} refs ({p.n_univalent_refs} univalentes)
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="delta_contribution" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
