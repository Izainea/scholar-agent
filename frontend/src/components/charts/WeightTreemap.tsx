import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import type { WeightData } from "@/lib/api-types";

interface Props {
  data?: WeightData;
  loading?: boolean;
  height?: number;
}

const UNIVALENT = "#a855f7";
const MULTIVALENT = "#3b82f6";

interface TreeNode {
  name: string;
  size: number;
  className?: "univalent" | "multivalent";
  meta?: WeightData["items"][number];
  children?: TreeNode[];
  // Recharts' Treemap expects an index signature on its data type.
  [key: string]: unknown;
}

export function WeightTreemap({ data, loading, height = 520 }: Props) {
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

  // Recharts Treemap is hierarchical. Group items by univalent / multivalent
  // and append a synthetic "Others" bucket aggregating the long tail.
  const univ: TreeNode[] = [];
  const mult: TreeNode[] = [];
  for (const it of data.items) {
    const node: TreeNode = {
      name: it.title || it.ref_id,
      size: it.omega,
      className: it.class,
      meta: it,
    };
    (it.class === "univalent" ? univ : mult).push(node);
  }
  if (data.rest.count > 0) {
    univ.push({
      name: `Otras (${data.rest.count} refs)`,
      size: data.rest.omega_sum,
      className: "univalent",
    });
  }

  const treeData: TreeNode[] = [
    { name: "univalentes", size: 0, children: univ },
    { name: "multivalentes", size: 0, children: mult },
  ];

  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">
        δ_B = {data.delta_B} · H(B) = {data.entropy_H_B} bits · top{" "}
        {data.items.length} pesos mostrados
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <Treemap
          data={treeData}
          dataKey="size"
          // recharts' Treemap typing is loose; cast inline.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={(props: any) => <CustomCell {...props} />}
          isAnimationActive={false}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TreeNode;
              if (!p.meta) {
                return (
                  <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                    <div className="font-semibold">{p.name}</div>
                  </div>
                );
              }
              const it = p.meta;
              return (
                <div className="max-w-sm rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                  <div className="font-semibold">{it.title || it.ref_id}</div>
                  <div className="text-muted-foreground">
                    val={it.valency} · μ={it.mu} · ω={it.omega} ({(100 * it.p_m).toFixed(1)}%)
                  </div>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

interface CellProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  className?: "univalent" | "multivalent";
  depth: number;
}

function CustomCell({ x, y, width, height, name, className, depth }: CellProps) {
  if (depth === 0) return null;
  const fill = className === "univalent" ? UNIVALENT : MULTIVALENT;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1} fillOpacity={0.85} />
      {width > 50 && height > 18 && (
        <text
          x={x + 4}
          y={y + 14}
          fill="#fff"
          fontSize={10}
          style={{ pointerEvents: "none" }}
        >
          {name.length > Math.floor(width / 6) ? name.slice(0, Math.floor(width / 6)) + "…" : name}
        </text>
      )}
    </g>
  );
}
