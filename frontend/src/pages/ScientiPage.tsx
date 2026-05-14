import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CoauthorshipGraph } from "@/components/graphs/CoauthorshipGraph";
import {
  useCoauthorshipGraph,
  useCoauthorshipSummary,
  useGroupsSummary,
  useScientiBrauer,
  useScientiOverview,
} from "@/lib/hooks";

export function ScientiPage() {
  const { data: overview } = useScientiOverview();
  const { data: coauth } = useCoauthorshipSummary(300, 1);
  const coauthGraph = useCoauthorshipGraph(150, 2, 80);
  const { data: groups } = useGroupsSummary(150);
  const { data: bra } = useScientiBrauer(120, 2);

  if (overview && !overview.available) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Scienti</CardTitle>
            <CardDescription>{overview.reason ?? "Datos no disponibles."}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              El backend no encuentra el directorio <code>scraper_scienti/data</code>. Asegúrate de
              haber ejecutado el scraper o de montar la carpeta en el contenedor.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Scienti — Minciencias</h1>
        <p className="text-sm text-muted-foreground">
          Datos descargados desde CvLAC (investigadores) y GrupLAC (grupos de investigación).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard title="CvLAC cargados" value={overview?.n_cvlac ?? "—"} hint="Investigadores" />
        <KpiCard title="GrupLAC cargados" value={overview?.n_gruplac ?? "—"} hint="Grupos" />
        <KpiCard title="Coautorías" value={coauth?.n_edges ?? "—"} hint={`${coauth?.n_authors ?? "—"} autores`} />
        <KpiCard title="Memberships" value={groups?.n_memberships ?? "—"} hint={`${groups?.n_researchers ?? "—"} investigadores`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top coautores</CardTitle>
            <CardDescription>Por número de artículos detectados en sus CvLAC</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {(coauth?.top_authors ?? []).slice(0, 12).map((a) => (
                <li key={a.name} className="flex items-center justify-between py-2">
                  <span className="truncate font-mono text-xs">{a.name}</span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {a.articulos}
                  </span>
                </li>
              ))}
              {(coauth?.top_authors ?? []).length === 0 && (
                <li className="py-2 text-muted-foreground">Cargando…</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top grupos</CardTitle>
            <CardDescription>Por número de integrantes registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {(groups?.top_groups ?? []).slice(0, 12).map((g) => (
                <li key={g.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{g.lider || g.nombre}</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {g.n_integrantes}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.clasificacion ? `${g.clasificacion} · ` : ""}{g.departamento}
                  </div>
                </li>
              ))}
              {(groups?.top_groups ?? []).length === 0 && (
                <li className="py-2 text-muted-foreground">Cargando…</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grafo de coautoría</CardTitle>
          <CardDescription>
            Top {coauthGraph.data?.nodes?.length ?? 0} autores por número de artículos · layout
            por fuerzas (cose-bilkent)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CoauthorshipGraph
            data={coauthGraph.data}
            loading={coauthGraph.isLoading}
            height={520}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Brauer (Scienti)</CardTitle>
          <CardDescription>
            Polígonos = artículos, vértices = coautores, orientación cronológica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-6">
            <Stat label="|Γ₀|" value={bra?.n_vertices ?? "—"} />
            <Stat label="|Γ₁|" value={bra?.n_polygons ?? "—"} />
            <Stat label="δ_B" value={bra?.delta_B ?? "—"} />
            <Stat label="H(B)" value={bra?.entropy_H_B ?? "—"} />
            <Stat label="Loops" value={bra?.n_loops ?? "—"} />
            <Stat label="dim Λ" value={bra?.dimension ?? "—"} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl font-mono">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}
