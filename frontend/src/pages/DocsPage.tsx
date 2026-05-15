import { Link } from "react-router-dom";
import {
  BookMarked,
  GitCompareArrows,
  Network,
  ExternalLink,
  Code2,
  Package,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

/**
 * Static documentation page. Replaces the previous chat module: the
 * dashboard now showcases the three visual tools (Brauer, Compare,
 * Scienti) and the algebra behind them, without depending on a live
 * LLM rendering pipeline.
 */
export function DocsPage() {
  return (
    <div className="w-full mx-auto max-w-5xl space-y-8 px-6 py-8">
      <Header />
      <QuickStart />
      <FeaturesGrid />
      <ConceptsBlock />
      <BrauerInvariantsBlock />
      <ScientiBlock />
      <TechStackBlock />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">Scholar Agent</h1>
      <p className="text-base text-muted-foreground">
        Dashboard de análisis de redes de citación matemáticas mediante
        configuraciones de Brauer y autómatas de impacto sobre quivers.
      </p>
      <p className="text-sm text-muted-foreground">
        Material de soporte para el workshop CIARP 2026 —
        <em> Quiver Representations for Graph Analysis</em>.
      </p>
    </header>
  );
}

function QuickStart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inicio rápido</CardTitle>
        <CardDescription>
          Tres caminos para explorar el material, según lo que quieras hacer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Step
          n={1}
          title="Explora un autor"
          body={
            <>
              Selecciona uno de los nueve matemáticos preprocesados desde la
              barra lateral o abre directamente <Code>/brauer/ringel</Code> para
              ver el quiver, la entropía y los rankings de papers de Ringel.
            </>
          }
        />
        <Step
          n={2}
          title="Compara dos autores"
          body={
            <>
              Marca el botón <Code>cmp</Code> al lado de dos o más autores en
              la barra lateral, abre <Code>/compare</Code> y verás el radar de
              invariantes y las referencias compartidas.
            </>
          }
        />
        <Step
          n={3}
          title="Mira Scienti (Minciencias)"
          body={
            <>
              En <Code>/scienti</Code> encontrarás el grafo de coautoría y los
              grupos de investigación del ecosistema colombiano (muestra
              sintética de 146 CvLAC + 30 GrupLAC).
            </>
          }
        />
      </CardContent>
    </Card>
  );
}

function FeaturesGrid() {
  const items = [
    {
      to: "/brauer",
      icon: BookMarked,
      title: "Brauer",
      summary:
        "Análisis algebraico de la obra de un matemático: quiver Q_M, valencias, contribuciones por polígono, treemap de pesos, descomposición de entropía y rankings.",
      bullets: [
        "Quiver Q_M con multi-aristas y loops",
        "Histograma de valencias (univalentes vs multivalentes)",
        "Treemap del peso ω(m) = μ(m) · val(m)",
        "Ranking de papers por contribución a δ_B",
        "Ranking de referencias por valencia",
      ],
    },
    {
      to: "/compare",
      icon: GitCompareArrows,
      title: "Comparar",
      summary:
        "Comparación lado a lado de invariantes Brauer entre dos o más autores: radar normalizado, tabla, referencias compartidas con valencia por autor.",
      bullets: [
        "Radar con 6 dimensiones normalizadas a [0, 1]",
        "Tabla con 11 columnas (papers, refs, δ_B, dim Λ, loops, % univ)",
        "Lista de referencias en común y su peso en cada obra",
      ],
    },
    {
      to: "/scienti",
      icon: Network,
      title: "Scienti",
      summary:
        "Vista del ecosistema científico colombiano: CvLAC (investigadores) + GrupLAC (grupos). Análisis Brauer sobre la red completa.",
      bullets: [
        "KPIs de la muestra",
        "Top coautores por número de artículos",
        "Top grupos por número de integrantes",
        "Grafo de coautoría (cose-bilkent layout)",
        "Configuración de Brauer del corpus completo",
      ],
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Módulos del dashboard</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((it) => (
          <Card key={it.to} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2">
                <it.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{it.title}</CardTitle>
              </div>
              <CardDescription>{it.summary}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {it.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-primary">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to={it.to}>
                    Abrir {it.title}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ConceptsBlock() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conceptos básicos</CardTitle>
        <CardDescription>
          Glosario corto para interpretar lo que verás en el dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Concept
          name="Quiver Q = (Q₀, Q₁, s, t)"
          body="Grafo dirigido con flechas múltiples permitidas. Q₀ es el conjunto de vértices, Q₁ el de flechas, y s/t indican origen y destino de cada flecha."
        />
        <Concept
          name="Configuración de Brauer Γ = (Γ₀, Γ₁, μ, O)"
          body="Conjunto Γ₀ de vértices, colección Γ₁ de polígonos (multiconjuntos sobre Γ₀), multiplicidad μ y orientación O. En una red de citación: vértices = referencias, polígonos = papers, μ = MNTI, O = orden cronológico."
        />
        <Concept
          name="Álgebra Λ_M = kQ_M / I_M"
          body="Álgebra de configuración de Brauer construida a partir del quiver Q_M y un ideal admisible I_M. Las dimensiones del álgebra y de su centro son invariantes algebraicos de la red original."
        />
        <Concept
          name="Autómata de Impacto sobre Quivers (AIQ)"
          body="El mismo quiver visto como sustrato dinámico: vértices con estados S/I/R, transiciones que propagan influencia. Las órbitas y el estado estacionario reflejan cómo se difunde el impacto."
        />
      </CardContent>
    </Card>
  );
}

function BrauerInvariantsBlock() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invariantes que verás en el dashboard</CardTitle>
        <CardDescription>
          Significado, fórmula y rango típico para cada cifra que aparece en
          las páginas Brauer y Compare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <InvariantRow
          symbol="|Γ₀|"
          name="Cardinal del conjunto de referencias"
          desc="Número de referencias distintas citadas a lo largo de la obra."
          example="Ringel: 1820"
        />
        <InvariantRow
          symbol="|Γ₁|"
          name="Cardinal del conjunto de polígonos"
          desc="Número de papers preprocesados del autor."
          example="Ringel: 162"
        />
        <InvariantRow
          symbol="δ_B"
          name="Factor de impacto de Brauer"
          desc="Suma de pesos sobre todas las referencias. δ_B = Σ μ(m) · val(m)."
          example="Ringel: 4226"
        />
        <InvariantRow
          symbol="δ_B^univ"
          name="Contribución univalente"
          desc="Aporte de las referencias citadas una sola vez (val(m) = 1). δ_B^univ = 2 · |C_M|."
          example="Ringel: 2846"
        />
        <InvariantRow
          symbol="δ_B^core"
          name="Contribución multivalente"
          desc="Aporte de las referencias citadas en dos o más papers. Es la columna vertebral del autor."
          example="Ringel: 1380"
        />
        <InvariantRow
          symbol="H(B)"
          name="Entropía de Brauer"
          desc="Entropía de Shannon sobre la distribución de pesos. H(B) = -Σ p_m · log₂ p_m, con p_m = μ(m)·val(m) / δ_B."
          example="Ringel: 10.65 bits"
        />
        <InvariantRow
          symbol="ρ(B)"
          name="Ratio de entropía"
          desc="H(B) normalizada por su máximo teórico. ρ ≈ 1 → distribución uniforme; ρ ≪ 1 → concentración en pocas referencias (efecto Mateo)."
          example="Ringel: 0.98"
        />
        <InvariantRow
          symbol="dim Λ_M"
          name="Dimensión del álgebra"
          desc="Dimensión sobre el cuerpo k del álgebra Λ_M = kQ_M / I_M. Crece con la complejidad estructural del corpus."
          example="Ringel: 10851"
        />
        <InvariantRow
          symbol="dim Z(Λ_M)"
          name="Dimensión del centro"
          desc="Dimensión del centro del álgebra. Mide la simetría algebraica del corpus."
          example="Ringel: 1586"
        />
        <InvariantRow
          symbol="Loops"
          name="Número de loops"
          desc="Aristas de Q_M con mismo origen y destino. Aparecen cuando una referencia tiene multiplicidad μ(m) · val(m) > 1."
          example="Ringel: 1423"
        />
        <InvariantRow
          symbol="val(m)"
          name="Valencia de m"
          desc="Número de polígonos (papers) que contienen la referencia m. Mide qué tan recurrente es."
          example="—"
        />
        <InvariantRow
          symbol="μ(m)"
          name="Multiplicidad MNTI"
          desc="μ(m) = 2 si val(m) = 1 (referencia única), μ(m) = 1 si val(m) ≥ 2 (referencia compartida)."
          example="—"
        />
        <InvariantRow
          symbol="ω(m)"
          name="Peso de m"
          desc="ω(m) = μ(m) · val(m). Es la cantidad que aporta cada referencia a δ_B."
          example="—"
        />
      </CardContent>
    </Card>
  );
}

function ScientiBlock() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos Scienti / Minciencias</CardTitle>
        <CardDescription>
          La componente más distintiva del workshop: aplicar el mismo
          formalismo al ecosistema científico colombiano.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          El backend lee dos colecciones de JSON producidos por un scraper
          propio de Scienti (Minciencias):
        </p>
        <ul className="space-y-1 pl-4 text-muted-foreground">
          <li>
            <strong>CvLAC</strong> — currículos de investigadores
            (nombre, formación, líneas de investigación, publicaciones,
            coautorías).
          </li>
          <li>
            <strong>GrupLAC</strong> — grupos de investigación (líder,
            clasificación A1/A/B/C, integrantes, áreas).
          </li>
        </ul>
        <p>
          En el demo se publica una muestra <strong>sintética</strong> (146
          CvLAC + 30 GrupLAC) generada con un seed fijo, manteniendo el
          esquema exacto de Scienti pero sin datos personales reales. En
          una instalación local o con volumen montado, la app procesa el
          <em> scrape</em> completo (50 387 CvLAC + 3 479 GrupLAC).
        </p>
        <p>
          Los endpoints <Code>/scienti/coauthorship/graph</Code> y
          <Code>/scienti/groups/summary</Code> alimentan, respectivamente,
          el grafo de coautoría (Cytoscape, layout cose-bilkent) y el
          ranking de grupos por número de integrantes. La pestaña Scienti
          también muestra un análisis Brauer hecho sobre el corpus
          completo: los artículos juegan el rol de polígonos y los
          coautores el rol de vértices.
        </p>
      </CardContent>
    </Card>
  );
}

function TechStackBlock() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Reproducir todo localmente</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ResourceCard
          icon={Package}
          title="aiq-quivers 1.2.0"
          subtitle="Paquete Python en PyPI"
          href="https://pypi.org/project/aiq-quivers/"
          desc="Implementación completa del marco AIQ: quivers, álgebras de Brauer, autómatas de impacto, integración con Scienti. 201 tests."
        />
        <ResourceCard
          icon={Code2}
          title="scholar-agent"
          subtitle="Repositorio en GitHub"
          href="https://github.com/Izainea/scholar-agent"
          desc="Código fuente del backend (FastAPI) y del frontend (Vite + React) que sirven este dashboard. Incluye docker-compose y configuración Railway."
        />
      </div>

      <Card>
        <CardContent className="space-y-2 px-4 py-3 text-sm">
          <p className="font-medium">Stack técnico</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>Backend: FastAPI + Anthropic SDK + pyalex + aiq-quivers</li>
            <li>Frontend: Vite + React 19 + TypeScript + Tailwind + shadcn/ui</li>
            <li>Visualizaciones: Cytoscape.js (grafos), Recharts (charts)</li>
            <li>Deploy: Docker · docker-compose · Railway</li>
            <li>Auth: HTTP Basic con múltiples usuarios</li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <>
      <Separator />
      <footer className="space-y-2 pb-8 text-xs text-muted-foreground">
        <p>
          Trabajo doctoral de Carlos Isaac Zainea Maya, dirigido por Agustín
          Moreno Cañadas — Universidad Nacional de Colombia.
        </p>
        <p>
          Preparado para el workshop{" "}
          <em>Quiver Representations for Graph Analysis</em>, CIARP 2026 —
          Universidad Iberoamericana, Ciudad de México, 24 de noviembre de 2026.
        </p>
      </footer>
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </div>
      <div className="space-y-0.5">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}

function Concept({ name, body }: { name: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-xs text-primary">{name}</div>
      <p className="mt-0.5 text-muted-foreground">{body}</p>
    </div>
  );
}

function InvariantRow({
  symbol,
  name,
  desc,
  example,
}: {
  symbol: string;
  name: string;
  desc: string;
  example: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b py-2 last:border-b-0 md:grid-cols-[110px_1fr_140px] md:items-start md:gap-3">
      <div className="font-mono text-sm font-semibold text-primary">{symbol}</div>
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="font-mono text-xs text-muted-foreground">{example}</div>
    </div>
  );
}

function ResourceCard({
  icon: Icon,
  title,
  subtitle,
  href,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  href: string;
  desc: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
    </a>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  );
}
