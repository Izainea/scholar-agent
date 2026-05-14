import axios from "axios";
import type {
  Author,
  BrauerSummary,
  CompareResult,
  CoauthorshipGraph,
  CoauthorshipSummary,
  EntropyDecomposition,
  GroupsSummary,
  Health,
  JobStatus,
  OpenAlexHit,
  PaperRow,
  PolygonContributionsData,
  QuiverData,
  RadarData,
  ReferenceRow,
  RegisterAuthorPayload,
  ScientiBrauer,
  ScientiOverview,
  ValencyData,
  WeightData,
} from "./api-types";

// `VITE_API_BASE` is baked at build time. Defaults to /api so vite dev's
// proxy and nginx in production both work without further configuration.
const baseURL = import.meta.env.VITE_API_BASE ?? "/api";

export const api = axios.create({
  baseURL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// ── Endpoints ────────────────────────────────────────────

export const fetchHealth = () => api.get<Health>("/health").then((r) => r.data);

export const fetchAuthors = () => api.get<Author[]>("/authors").then((r) => r.data);

export const fetchRegistry = () =>
  api.get<Record<string, RegisterAuthorPayload>>("/authors/registry").then((r) => r.data);

export const registerAuthor = (payload: RegisterAuthorPayload) =>
  api.post<JobStatus>("/authors/registry", payload).then((r) => r.data);

export const removeAuthor = (key: string) =>
  api.delete<{ removed: string }>(`/authors/registry/${key}`).then((r) => r.data);

export const fetchJobStatus = (key: string) =>
  api.get<JobStatus>(`/authors/jobs/${key}`).then((r) => r.data);

export const searchOpenAlex = (q: string, limit = 5) =>
  api.get<OpenAlexHit[]>(`/authors/openalex/search`, { params: { q, limit } }).then((r) => r.data);

// ── Brauer ───────────────────────────────────────────────

export const fetchSummary = (key: string) =>
  api.get<BrauerSummary>(`/brauer/${key}/summary`).then((r) => r.data);

export const fetchTopPapers = (key: string, n = 5) =>
  api.get<PaperRow[]>(`/brauer/${key}/top-papers`, { params: { n } }).then((r) => r.data);

export const fetchTopReferences = (key: string, n = 10) =>
  api.get<ReferenceRow[]>(`/brauer/${key}/top-references`, { params: { n } }).then((r) => r.data);

export const fetchEntropy = (key: string) =>
  api.get<EntropyDecomposition>(`/brauer/${key}/entropy`).then((r) => r.data);

export const fetchCompare = (keys: string[]) =>
  api
    .get<CompareResult>(`/brauer/compare`, {
      params: { keys },
      paramsSerializer: { indexes: null },
    })
    .then((r) => r.data);

export const fetchQuiverData = (key: string, maxNodes = 200) =>
  api.get<QuiverData>(`/brauer/${key}/quiver`, { params: { max_nodes: maxNodes } }).then((r) => r.data);

export const fetchValencyData = (key: string) =>
  api.get<ValencyData>(`/brauer/${key}/valency`).then((r) => r.data);

export const fetchPolygonContributions = (key: string) =>
  api.get<PolygonContributionsData>(`/brauer/${key}/polygon-contributions`).then((r) => r.data);

export const fetchWeightData = (key: string, topN = 40) =>
  api.get<WeightData>(`/brauer/${key}/weights`, { params: { top_n: topN } }).then((r) => r.data);

export const fetchRadarData = (keys: string[]) =>
  api
    .get<RadarData>(`/brauer/radar`, {
      params: { keys },
      paramsSerializer: { indexes: null },
    })
    .then((r) => r.data);

// ── Scienti ──────────────────────────────────────────────

export const fetchScientiOverview = (cvlacLimit = 200, gruplacLimit = 100) =>
  api
    .get<ScientiOverview>("/scienti/overview", {
      params: { cvlac_limit: cvlacLimit, gruplac_limit: gruplacLimit },
    })
    .then((r) => r.data);

export const fetchCoauthorshipSummary = (limit = 200, minArticles = 1) =>
  api
    .get<CoauthorshipSummary>("/scienti/coauthorship/summary", {
      params: { limit, min_articles: minArticles },
    })
    .then((r) => r.data);

export const fetchCoauthorshipGraph = (limit = 80, minArticles = 2, maxNodes = 60) =>
  api
    .get<CoauthorshipGraph>("/scienti/coauthorship/graph", {
      params: { limit, min_articles: minArticles, max_nodes: maxNodes },
    })
    .then((r) => r.data);

export const fetchGroupsSummary = (limit = 100) =>
  api
    .get<GroupsSummary>("/scienti/groups/summary", { params: { limit } })
    .then((r) => r.data);

export const fetchScientiBrauer = (limit = 80, minAuthors = 2) =>
  api
    .get<ScientiBrauer>("/scienti/brauer", { params: { limit, min_authors: minAuthors } })
    .then((r) => r.data);

// ── Chat (SSE) ───────────────────────────────────────────

export type ChatEventName = "meta" | "delta" | "tool" | "result" | "final" | "error" | "done";

export interface ChatEvent {
  event: ChatEventName;
  data: unknown;
}

/**
 * Stream a chat completion from POST /agent/chat.
 *
 * Uses fetch + ReadableStream to consume Server-Sent Events directly
 * — EventSource doesn't support POST bodies. The async generator yields
 * one ChatEvent per server-side event (meta, delta, tool, result, final,
 * error, done).
 */
export async function* streamChat(message: string, history: unknown[] = []): AsyncGenerator<ChatEvent> {
  const response = await fetch(`${baseURL}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line.
    let separatorIdx;
    while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, separatorIdx);
      buffer = buffer.slice(separatorIdx + 2);

      const lines = rawEvent.split("\n");
      let event: ChatEventName = "delta";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event: ")) event = line.slice(7).trim() as ChatEventName;
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      const dataStr = dataLines.join("\n");
      let data: unknown = dataStr;
      try {
        data = JSON.parse(dataStr);
      } catch {
        // Plain text payload (e.g. delta text or done sentinel)
      }
      yield { event, data };
      if (event === "done") return;
    }
  }
}
