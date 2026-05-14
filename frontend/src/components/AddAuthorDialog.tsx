import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJobStatus, useOpenAlexSearch, useRegisterAuthor } from "@/lib/hooks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function deriveKey(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/\s+/)
      .pop() ?? "author"
  ).replace(/[^a-z0-9]/g, "");
}

export function AddAuthorDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  const { data: hits = [], isFetching: searching } = useOpenAlexSearch(submittedQ, !!submittedQ);
  const register = useRegisterAuthor();
  const { data: jobStatus } = useJobStatus(pickedKey, true);

  const reset = () => {
    setQuery("");
    setSubmittedQ("");
    setPickedKey(null);
  };

  const handleSelect = async (hit: (typeof hits)[number]) => {
    const key = deriveKey(hit.display_name);
    try {
      await register.mutateAsync({
        key,
        openalex_id: hit.id,
        display_name: hit.display_name,
        area: hit.institution,
      });
      setPickedKey(key);
      toast.success(`Descargando obra de ${hit.display_name}…`);
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  };

  // When a job completes, auto-close and clean up. Must live inside an
  // effect — running side-effects in the render body causes infinite
  // re-renders (React error #185).
  useEffect(() => {
    if (jobStatus?.status !== "done" || !open) return;
    toast.success(`Dataset listo: ${pickedKey}`);
    const t = setTimeout(() => {
      reset();
      onOpenChange(false);
    }, 800);
    return () => clearTimeout(t);
    // `reset` and `onOpenChange` are stable from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus?.status, open, pickedKey]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Añadir autor</DialogTitle>
          <DialogDescription>
            Busca en OpenAlex y selecciona un autor. La descarga + preprocesamiento corre en
            background; tarda 1-3 min para autores con &gt;100 papers.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmittedQ(query.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ej. Bernhard Keller"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={query.trim().length < 2 || searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </form>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {hits.map((hit) => (
            <div
              key={hit.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{hit.display_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {hit.institution || "—"} · {hit.works_count} works · {hit.cited_by_count} citas
                </div>
                {hit.top_concept && (
                  <div className="truncate text-[10px] uppercase tracking-wide text-primary/80">
                    {hit.top_concept}
                  </div>
                )}
              </div>
              <Button size="sm" onClick={() => handleSelect(hit)} disabled={register.isPending}>
                Añadir
              </Button>
            </div>
          ))}
          {submittedQ && !searching && hits.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </div>

        {pickedKey && jobStatus && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Estado del job <code className="font-mono">{pickedKey}</code>:{" "}
            <span className="font-medium">{jobStatus.status}</span>
            {jobStatus.error && (
              <p className="mt-1 text-xs text-destructive">{jobStatus.error}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
