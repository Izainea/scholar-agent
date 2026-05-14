import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadarComparison } from "@/components/charts/RadarComparison";
import { useAuthors, useCompare, useRadarData } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import type { BrauerSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";

function isSummary(v: unknown): v is BrauerSummary {
  return !!v && typeof v === "object" && !("error" in v);
}

export function ComparePage() {
  const { data: authors = [] } = useAuthors();
  const { compareKeys, toggleCompareKey, clearCompare } = useAppStore();

  const radar = useRadarData(compareKeys);
  const cmp = useCompare(compareKeys);

  const rows = useMemo(() => {
    if (!cmp.data) return [];
    return Object.entries(cmp.data.authors)
      .filter(([, v]) => isSummary(v))
      .map(([k, v]) => ({ key: k, ...(v as BrauerSummary) }));
  }, [cmp.data]);

  return (
    <div className="container space-y-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Comparar autores</h1>
          <p className="text-sm text-muted-foreground">
            Selecciona dos o más autores para comparar invariantes y referencias compartidas.
          </p>
        </div>
        {compareKeys.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            Limpiar selección
          </Button>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selección actual</CardTitle>
          <CardDescription>{compareKeys.length} autor(es) en la comparación</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {authors.map((a) => {
              const active = compareKeys.includes(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => toggleCompareKey(a.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  {a.display_name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {compareKeys.length < 2 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Necesitas al menos 2 autores seleccionados.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Radar de invariantes</CardTitle>
              <CardDescription>Métricas normalizadas a [0, 1]</CardDescription>
            </CardHeader>
            <CardContent>
              <RadarComparison data={radar.data} loading={radar.isLoading} height={480} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabla comparativa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Autor</th>
                      <th className="text-right">Papers</th>
                      <th className="text-right">Refs</th>
                      <th className="text-right">δ_B</th>
                      <th className="text-right">δ_B^univ</th>
                      <th className="text-right">δ_B^core</th>
                      <th className="text-right">H(B)</th>
                      <th className="text-right">ρ(B)</th>
                      <th className="text-right">dim Λ</th>
                      <th className="text-right">loops</th>
                      <th className="text-right">% univ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-t">
                        <td className="py-1.5 font-medium">{r.display_name}</td>
                        <td className="text-right font-mono">{r.n_papers}</td>
                        <td className="text-right font-mono">{r.n_references}</td>
                        <td className="text-right font-mono">{r.delta_B}</td>
                        <td className="text-right font-mono">{r.delta_B_univ}</td>
                        <td className="text-right font-mono">{r.delta_B_core}</td>
                        <td className="text-right font-mono">{r.entropy_H_B}</td>
                        <td className="text-right font-mono">{r.entropy_ratio}</td>
                        <td className="text-right font-mono">{r.dimension}</td>
                        <td className="text-right font-mono">{r.n_loops}</td>
                        <td className="text-right font-mono">
                          {Math.round((100 * r.n_univalent) / Math.max(r.n_references, 1))}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referencias compartidas ({cmp.data?.n_shared ?? 0})</CardTitle>
              <CardDescription>Top 20 por suma de valencias</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Año</th>
                    <th>Título</th>
                    {compareKeys.map((k) => (
                      <th key={k} className="text-right">val ({k})</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cmp.data?.shared_references ?? []).slice(0, 20).map((r) => (
                    <tr key={r.ref_id} className="border-t">
                      <td className="py-1.5 text-muted-foreground">{(r.year as number) ?? "—"}</td>
                      <td className="max-w-md truncate" title={r.title}>{r.title || r.ref_id}</td>
                      {compareKeys.map((k) => (
                        <td key={k} className="text-right font-mono">
                          {(r[`valency_${k}`] as number) ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {(!cmp.data?.shared_references || cmp.data.shared_references.length === 0) && (
                    <tr>
                      <td colSpan={2 + compareKeys.length} className="py-6 text-center text-muted-foreground">
                        Sin referencias compartidas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
