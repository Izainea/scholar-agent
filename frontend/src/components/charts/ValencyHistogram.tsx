import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ValencyData } from "@/lib/api-types";

interface Props {
  data?: ValencyData;
  loading?: boolean;
  height?: number;
}

const UNIVALENT = "#a855f7";
const MULTIVALENT = "#3b82f6";

export function ValencyHistogram({ data, loading, height = 360 }: Props) {
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

  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">
        Univalentes: {data.n_univalent} / {data.n_total} (
        {Math.round((100 * data.n_univalent) / Math.max(data.n_total, 1))}%) · max
        val={data.max_valency}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data.histogram} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="valency" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ValencyData["histogram"][number];
              return (
                <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <div className="font-semibold">val={p.valency}</div>
                  <div className="text-muted-foreground">{p.count} vértices</div>
                  {p.examples.length > 0 && (
                    <ul className="mt-1 max-w-xs list-disc list-inside text-muted-foreground">
                      {p.examples.map((e, i) => (
                        <li key={i} className="truncate">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            }}
          />
          <Bar dataKey="count">
            {data.histogram.map((d, i) => (
              <Cell key={i} fill={d.valency === 1 ? UNIVALENT : MULTIVALENT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
