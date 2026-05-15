import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookMarked,
  BookOpen,
  GitCompareArrows,
  LogOut,
  Network,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuthors, useHealth, useRemoveAuthor } from "@/lib/hooks";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { clearBasicAuth } from "@/lib/api";
import { AddAuthorDialog } from "@/components/AddAuthorDialog";

const NAV_LINKS = [
  { to: "/docs", label: "Inicio", icon: BookOpen },
  { to: "/brauer", label: "Brauer", icon: BookMarked },
  { to: "/compare", label: "Comparar", icon: GitCompareArrows },
  { to: "/scienti", label: "Scienti", icon: Network },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: authors = [] } = useAuthors();
  const { data: health } = useHealth();
  const remove = useRemoveAuthor();
  const { selectedKey, setSelectedKey, compareKeys, toggleCompareKey } = useAppStore();
  const [showAdd, setShowAdd] = useState(false);

  const handleRemove = async (key: string) => {
    if (!window.confirm(`¿Borrar el dataset de ${key} del registro?`)) return;
    try {
      await remove.mutateAsync(key);
      toast.success(`Autor ${key} eliminado`);
      if (selectedKey === key) setSelectedKey(null);
    } catch (e) {
      toast.error(`Error al eliminar: ${(e as Error).message}`);
    }
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Scholar Agent</div>
          <div className="text-xs text-muted-foreground">Brauer · Scienti · Claude</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2">
        {NAV_LINKS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Author list */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Autores</span>
        <Button size="sm" variant="ghost" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <ul className="flex flex-col gap-1 pb-4">
          {authors.map((a) => {
            const isSelected = selectedKey === a.key;
            const isInCompare = compareKeys.includes(a.key);
            return (
              <li
                key={a.key}
                className={cn(
                  "group rounded-md border px-2 py-2 text-sm transition-colors",
                  isSelected ? "border-primary/50 bg-primary/5" : "border-transparent",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      setSelectedKey(a.key);
                      navigate(`/brauer/${a.key}`);
                    }}
                  >
                    <div className="truncate font-medium">{a.display_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.n_papers} papers · {a.n_references} refs
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      title="Toggle comparison"
                      onClick={() => toggleCompareKey(a.key)}
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px]",
                        isInCompare
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-muted-foreground",
                      )}
                    >
                      cmp
                    </button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => handleRemove(a.key)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {authors.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">
              No hay autores. Click + para añadir uno.
            </li>
          )}
        </ul>
      </ScrollArea>

      {/* Footer status */}
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
        <div className="flex items-center justify-between">
          <span>Anthropic</span>
          <span className={health?.anthropic_configured ? "text-green-600" : "text-amber-600"}>
            {health?.anthropic_configured ? "configurada" : "sin clave"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Scienti data</span>
          <span className={health?.scienti_data_available ? "text-green-600" : "text-amber-600"}>
            {health?.scienti_data_available ? "disponible" : "ausente"}
          </span>
        </div>
        {health?.auth_enabled && (
          <button
            type="button"
            onClick={() => {
              clearBasicAuth();
              window.dispatchEvent(new CustomEvent("scholar-agent:auth-required"));
            }}
            className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-input bg-background px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
          >
            <LogOut className="h-3 w-3" />
            Cerrar sesión
          </button>
        )}
      </div>

      <AddAuthorDialog open={showAdd} onOpenChange={setShowAdd} />
    </aside>
  );
}
