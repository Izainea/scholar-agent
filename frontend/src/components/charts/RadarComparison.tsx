import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RadarData } from "@/lib/api-types";

interface Props {
  data?: RadarData;
  loading?: boolean;
  height?: number;
}

const PALETTE = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function RadarComparison({ data, loading, height = 480 }: Props) {
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
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data.radar} outerRadius="75%">
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis angle={30} domain={[0, 1]} tick={{ fontSize: 10 }} />
        {data.authors.map((a, i) => (
          <Radar
            key={a.key}
            name={a.display_name}
            dataKey={a.key}
            stroke={PALETTE[i % PALETTE.length]}
            fill={PALETTE[i % PALETTE.length]}
            fillOpacity={0.2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}
