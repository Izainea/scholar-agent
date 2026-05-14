import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAuthors,
  fetchCoauthorshipGraph,
  fetchCoauthorshipSummary,
  fetchCompare,
  fetchEntropy,
  fetchGroupsSummary,
  fetchHealth,
  fetchJobStatus,
  fetchPolygonContributions,
  fetchQuiverData,
  fetchRadarData,
  fetchScientiBrauer,
  fetchScientiOverview,
  fetchSummary,
  fetchTopPapers,
  fetchTopReferences,
  fetchValencyData,
  fetchWeightData,
  registerAuthor,
  removeAuthor,
  searchOpenAlex,
} from "./api";
import type { RegisterAuthorPayload } from "./api-types";

// ── Health & registry ────────────────────────────────────

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: fetchHealth, staleTime: 30_000 });

export const useAuthors = () =>
  useQuery({ queryKey: ["authors"], queryFn: fetchAuthors, staleTime: 60_000 });

export const useRegisterAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterAuthorPayload) => registerAuthor(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authors"] }),
  });
};

export const useRemoveAuthor = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => removeAuthor(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["authors"] }),
  });
};

export const useJobStatus = (key: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ["job", key],
    queryFn: () => fetchJobStatus(key!),
    enabled: !!key && enabled,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      // Poll while collecting; stop when done/error/unknown.
      if (status === "queued" || status === "collecting") return 2_000;
      return false;
    },
  });

export const useOpenAlexSearch = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: ["openalex", q],
    queryFn: () => searchOpenAlex(q),
    enabled: enabled && q.length >= 2,
    staleTime: 120_000,
  });

// ── Brauer ───────────────────────────────────────────────

export const useSummary = (key: string | null) =>
  useQuery({
    queryKey: ["summary", key],
    queryFn: () => fetchSummary(key!),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const useTopPapers = (key: string | null, n = 10) =>
  useQuery({
    queryKey: ["top-papers", key, n],
    queryFn: () => fetchTopPapers(key!, n),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const useTopReferences = (key: string | null, n = 15) =>
  useQuery({
    queryKey: ["top-refs", key, n],
    queryFn: () => fetchTopReferences(key!, n),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const useEntropy = (key: string | null) =>
  useQuery({
    queryKey: ["entropy", key],
    queryFn: () => fetchEntropy(key!),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const useQuiverData = (key: string | null, maxNodes = 200) =>
  useQuery({
    queryKey: ["quiver-data", key, maxNodes],
    queryFn: () => fetchQuiverData(key!, maxNodes),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const useValencyData = (key: string | null) =>
  useQuery({
    queryKey: ["valency-data", key],
    queryFn: () => fetchValencyData(key!),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const usePolygonContributions = (key: string | null) =>
  useQuery({
    queryKey: ["polygon-contributions", key],
    queryFn: () => fetchPolygonContributions(key!),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

export const useWeightData = (key: string | null, topN = 40) =>
  useQuery({
    queryKey: ["weight-data", key, topN],
    queryFn: () => fetchWeightData(key!, topN),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });

// ── Compare ──────────────────────────────────────────────

export const useCompare = (keys: string[]) =>
  useQuery({
    queryKey: ["compare", ...keys].sort(),
    queryFn: () => fetchCompare(keys),
    enabled: keys.length >= 2,
    staleTime: 5 * 60_000,
  });

export const useRadarData = (keys: string[]) =>
  useQuery({
    queryKey: ["radar", ...keys].sort(),
    queryFn: () => fetchRadarData(keys),
    enabled: keys.length >= 2,
    staleTime: 5 * 60_000,
  });

// ── Scienti ──────────────────────────────────────────────

export const useScientiOverview = () =>
  useQuery({
    queryKey: ["scienti-overview"],
    queryFn: () => fetchScientiOverview(),
    staleTime: 5 * 60_000,
  });

export const useCoauthorshipSummary = (limit = 200, minArticles = 1) =>
  useQuery({
    queryKey: ["scienti-coauth-summary", limit, minArticles],
    queryFn: () => fetchCoauthorshipSummary(limit, minArticles),
    staleTime: 5 * 60_000,
  });

export const useCoauthorshipGraph = (limit = 80, minArticles = 2, maxNodes = 60) =>
  useQuery({
    queryKey: ["scienti-coauth-graph", limit, minArticles, maxNodes],
    queryFn: () => fetchCoauthorshipGraph(limit, minArticles, maxNodes),
    staleTime: 5 * 60_000,
  });

export const useGroupsSummary = (limit = 100) =>
  useQuery({
    queryKey: ["scienti-groups", limit],
    queryFn: () => fetchGroupsSummary(limit),
    staleTime: 5 * 60_000,
  });

export const useScientiBrauer = (limit = 80, minAuthors = 2) =>
  useQuery({
    queryKey: ["scienti-brauer", limit, minAuthors],
    queryFn: () => fetchScientiBrauer(limit, minAuthors),
    staleTime: 5 * 60_000,
  });
