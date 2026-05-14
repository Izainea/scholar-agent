import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuiverGraph } from "@/components/graphs/QuiverGraph";
import { ValencyHistogram } from "@/components/charts/ValencyHistogram";
import { PolygonContributionsChart } from "@/components/charts/PolygonContributionsChart";
import { WeightTreemap } from "@/components/charts/WeightTreemap";
import { useAppStore } from "@/lib/store";
import {
  useAuthors,
  useEntropy,
  usePolygonContributions,
  useQuiverData,
  useSummary,
  useTopPapers,
  useTopReferences,
  useValencyData,
  useWeightData,
} from "@/lib/hooks";

export function BrauerPage() {
  const { authorKey } = useParams();
  const navigate = useNavigate();
  const { data: authors } = useAuthors();
  const { selectedKey, setSelectedKey } = useAppStore();

  const firstAuthorKey = authors?.[0]?.key;
  useEffect(() => {
    if (authorKey) setSelectedKey(authorKey);
    else if (selectedKey) navigate(`/brauer/${selectedKey}`, { replace: true });
    else if (firstAuthorKey) navigate(`/brauer/${firstAuthorKey}`, { replace: true });
  }, [authorKey, selectedKey, firstAuthorKey, setSelectedKey, navigate]);

  const key = authorKey ?? null;

  const { data: summary, isLoading: loadingSum } = useSummary(key);
  const { data: papers } = useTopPapers(key, 10);
  const { data: refs } = useTopReferences(key, 15);
  const { data: entropy } = useEntropy(key);

  const quiver = useQuiverData(key, 200);
  const valency = useValencyData(key);
  const polygons = usePolygonContributions(key);
  const weights = useWeightData(key, 40);

  if (!key) {
    return (
      <div className="container py-12 text-center text-sm text-muted-foreground">
        Selecciona un autor desde la barra lateral.
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">{summary?.display_name ?? key}</h1>
        <p className="text-sm text-muted-foreground">{summary?.area}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="|Γ₀|" value={summary?.n_references ?? "—"} loading={loadingSum} />
        <Stat label="|Γ₁|" value={summary?.n_papers ?? "—"} loading={loadingSum} />
        <Stat label="δ_B" value={summary?.delta_B ?? "—"} loading={loadingSum} />
        <Stat label="H(B)" value={summary?.entropy_H_B ?? "—"} loading={loadingSum} />
        <Stat label="ρ(B)" value={summary?.entropy_ratio ?? "—"} loading={loadingSum} />
        <Stat label="dim Λ" value={summary?.dimension ?? "—"} loading={loadingSum} />
        <Stat label="δ_B^univ" value={summary?.delta_B_univ ?? "—"} loading={loadingSum} />
        <Stat label="δ_B^core" value={summary?.delta_B_core ?? "—"} loading={loadingSum} />
        <Stat label="dim Z" value={summary?.center_dimension ?? "—"} loading={loadingSum} />
        <Stat label="loops" value={summary?.n_loops ?? "—"} loading={loadingSum} />
        <Stat
          label="univ %"
          value={
            summary
              ? `${Math.round((100 * summary.n_univalent) / Math.max(summary.n_references, 1))}%`
              : "—"
          }
          loading={loadingSum}
        />
        <Stat label="multiv" value={summary?.n_multivalent ?? "—"} loading={loadingSum} />
      </div>

      <Tabs defaultValue="quiver">
        <TabsList>
          <TabsTrigger value="quiver">Quiver Q_M</TabsTrigger>
          <TabsTrigger value="valency">Valencias</TabsTrigger>
          <TabsTrigger value="polygons">Polígonos</TabsTrigger>
          <TabsTrigger value="weights">Pesos</TabsTrigger>
          <TabsTrigger value="entropy">Entropía</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
        </TabsList>

        <TabsContent value="quiver">
          <QuiverGraph data={quiver.data} loading={quiver.isLoading} height={620} />
        </TabsContent>
        <TabsContent value="valency">
          <ValencyHistogram data={valency.data} loading={valency.isLoading} height={400} />
        </TabsContent>
        <TabsContent value="polygons">
          <PolygonContributionsChart
            data={polygons.data}
            loading={polygons.isLoading}
            height={520}
          />
        </TabsContent>
        <TabsContent value="weights">
          <WeightTreemap data={weights.data} loading={weights.isLoading} height={520} />
        </TabsContent>

        <TabsContent value="entropy">
          <Card>
            <CardHeader>
              <CardTitle>Descomposición de H(B)</CardTitle>
              <CardDescription>
                Top 15 referencias por contribución entrópica. Total H(B) ={" "}
                {entropy?.total_entropy ?? "—"} bits.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">#</th>
                    <th>Título</th>
                    <th className="text-right">val</th>
                    <th className="text-right">ω</th>
                    <th className="text-right">p_m</th>
                    <th className="text-right">contrib H</th>
                  </tr>
                </thead>
                <tbody>
                  {(entropy?.top_contributors ?? []).map((c, i) => (
                    <tr key={c.ref_id} className="border-t">
                      <td className="py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="max-w-md truncate">{c.title || c.ref_id}</td>
                      <td className="text-right font-mono">{c.valency}</td>
                      <td className="text-right font-mono">{c.omega}</td>
                      <td className="text-right font-mono">{c.p_m.toFixed(4)}</td>
                      <td className="text-right font-mono">{c.entropy_contribution.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rankings">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top papers (δ_B)</CardTitle>
                <CardDescription>Papers ordenados por contribución a δ_B</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1 text-sm">
                  {(papers ?? []).map((p) => (
                    <li key={p.paper_id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate" title={p.title}>
                        <span className="text-muted-foreground">{p.year ?? "—"}</span>{" "}
                        {p.title || p.paper_id}
                      </span>
                      <span className="shrink-0 font-mono text-xs">δ={p.delta_contribution}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top referencias (val)</CardTitle>
                <CardDescription>Más citadas a lo largo de la obra</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1 text-sm">
                  {(refs ?? []).map((r) => (
                    <li key={r.ref_id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate" title={r.title}>
                        <span className="text-muted-foreground">{r.year ?? "—"}</span>{" "}
                        {r.title || r.ref_id}
                      </span>
                      <span className="shrink-0 font-mono text-xs">
                        val={r.valency} · {r.weight_pct}%
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono text-lg ${loading ? "opacity-40" : ""}`}>{value}</div>
    </div>
  );
}
