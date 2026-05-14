// Type definitions for the FastAPI backend payloads.
// Mirror what scholar_agent_app/backend/app exposes.

export interface Health {
  status: string;
  anthropic_configured: boolean;
  scienti_data_available: boolean;
  data_dir: string;
  auth_enabled?: boolean;
}

export interface Author {
  key: string;
  openalex_id: string;
  display_name: string;
  area: string;
  n_papers: number;
  n_references: number;
}

export interface RegisterAuthorPayload {
  key: string;
  openalex_id: string;
  display_name: string;
  area?: string;
}

export interface JobStatus {
  author_key: string;
  status: "queued" | "collecting" | "done" | "error" | "unknown" | string;
  error?: string | null;
}

export interface OpenAlexHit {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  institution: string;
  top_concept?: string;
}

export interface ReferenceRow {
  ref_id: string;
  title: string;
  authors: string[];
  year: number | null;
  valency: number;
  weight?: number;
  mu?: number;
  omega?: number;
  weight_pct?: number;
}

export interface PaperRow {
  paper_id: string;
  title: string;
  year: number | null;
  n_references: number;
  delta_contribution: number;
}

export interface BrauerSummary {
  author_key: string;
  display_name: string;
  area: string;
  n_papers: number;
  n_references: number;
  dimension: number;
  center_dimension: number;
  n_loops: number;
  delta_B: number;
  delta_B_univ: number;
  delta_B_core: number;
  entropy_H_B: number;
  entropy_max: number;
  entropy_ratio: number;
  n_univalent: number;
  n_multivalent: number;
  top_references: ReferenceRow[];
}

export interface SharedReference {
  ref_id: string;
  title: string;
  authors: string[];
  year: number | null;
  // Per-author valency keys are dynamic: `valency_<author_key>`
  [k: string]: unknown;
}

export interface CompareResult {
  authors: Record<string, BrauerSummary | { error: string }>;
  shared_references: SharedReference[];
  n_shared: number;
}

export interface EntropyContribution {
  ref_id: string;
  title: string;
  valency: number;
  omega: number;
  p_m: number;
  entropy_contribution: number;
}

export interface EntropyDecomposition {
  author_key: string;
  total_entropy: number;
  top_contributors: EntropyContribution[];
  bottom_contributors: EntropyContribution[];
}

// ── Scienti ─────────────────────────────────────────────

export interface ScientiOverview {
  available: boolean;
  reason?: string;
  n_cvlac?: number;
  n_gruplac?: number;
  data_dir?: string;
  sample_cvlac_keys?: string[];
  sample_gruplac_keys?: string[];
}

export interface CoauthorshipSummary {
  available: boolean;
  n_authors?: number;
  n_edges?: number;
  limit?: number;
  min_articles?: number;
  top_authors?: { name: string; articulos: number; cod_rh: string | null }[];
}

export interface CoauthorshipGraph {
  available: boolean;
  n_total_authors?: number;
  n_total_edges?: number;
  nodes: { id: string; label: string; size: number }[];
  edges: { source: string; target: string }[];
}

export interface GroupRow {
  id: string;
  nombre: string;
  lider: string;
  clasificacion: string;
  departamento: string;
  n_integrantes: number;
}

export interface GroupsSummary {
  available: boolean;
  n_groups?: number;
  n_researchers?: number;
  n_memberships?: number;
  top_groups?: GroupRow[];
}

export interface ScientiBrauer {
  available: boolean;
  n_polygons?: number;
  n_vertices?: number;
  delta_B?: number;
  entropy_H_B?: number;
  n_loops?: number;
  dimension?: number;
}

// ── Brauer raw data (Cytoscape + Recharts) ──

export interface QuiverNode {
  id: string;
  label: string;
  year: number | null;
  size: number;
  n_refs: number;
  authors: string[];
  journal: string;
}

export interface QuiverEdge {
  id: string;
  source: string;
  target: string;
  weight: number; // # of parallel arrows
}

export interface QuiverLoop {
  id: string; // node id
  count: number;
}

export interface QuiverData {
  nodes: QuiverNode[];
  edges: QuiverEdge[];
  loops: QuiverLoop[];
  n_total_polygons: number;
  n_shown: number;
  n_total_edges: number;
}

export interface ValencyBin {
  valency: number;
  count: number;
  examples: string[];
}

export interface ValencyData {
  histogram: ValencyBin[];
  n_total: number;
  n_univalent: number;
  max_valency: number;
}

export interface PolygonContribution {
  polygon_id: string;
  title: string;
  year: number | null;
  n_refs: number;
  n_univalent_refs: number;
  delta_contribution: number;
}

export interface PolygonContributionsData {
  rows: PolygonContribution[];
  delta_B_total: number;
}

export interface WeightItem {
  ref_id: string;
  title: string;
  year: number | null;
  valency: number;
  mu: number;
  omega: number;
  p_m: number;
  class: "univalent" | "multivalent";
}

export interface WeightData {
  delta_B: number;
  entropy_H_B: number;
  items: WeightItem[];
  rest: { count: number; omega_sum: number };
}

export interface RadarRow {
  metric: string;
  // Per-author normalised value, keyed by author_key.
  [authorKey: string]: string | number;
}

export interface RadarData {
  metrics: { key: string; label: string }[];
  authors: { key: string; display_name: string }[];
  radar: RadarRow[];
}
