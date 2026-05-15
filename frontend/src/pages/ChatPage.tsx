import { useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import * as mdKatexNs from "@vscode/markdown-it-katex";
import { Loader2, Send, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthors } from "@/lib/hooks";
import { streamChat } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output_preview?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  tools?: ToolCall[];
  pending?: boolean;
}

const QUICK_PROMPTS = [
  "Dame un resumen del análisis de Brauer de Ringel",
  "¿Cuáles son los 5 papers más influyentes de Schroll?",
  "Compara la entropía de Brauer de Auslander vs. Reiten",
  "¿Qué referencias comparten Green y Schroll?",
  "Resumen de Scienti: cuántos investigadores y grupos hay",
];

export function ChatPage() {
  const { data: authors = [] } = useAuthors();
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setMessages((m) => [
      ...m,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", tools: [], pending: true },
    ]);
    setInput("");
    setStreaming(true);

    try {
      for await (const ev of streamChat(trimmed, history)) {
        if (ev.event === "delta") {
          const chunk = typeof ev.data === "string" ? ev.data : JSON.stringify(ev.data);
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + chunk };
            }
            return copy;
          });
        } else if (ev.event === "replace") {
          // Backend sent a sanitised version of the streamed text.
          // Use it as the canonical content so ReactMarkdown parses cleanly.
          const finalText = typeof ev.data === "string" ? ev.data : "";
          if (finalText) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: finalText };
              }
              return copy;
            });
          }
        } else if (ev.event === "tool") {
          const { name, input } = ev.data as { name: string; input: Record<string, unknown> };
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = {
                ...last,
                tools: [...(last.tools ?? []), { name, input }],
              };
            }
            return copy;
          });
        } else if (ev.event === "result") {
          const { name, output_preview } = ev.data as { name: string; output_preview: string };
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              const tools = [...(last.tools ?? [])];
              const idx = tools.findIndex((t) => t.name === name && !t.output_preview);
              if (idx >= 0) tools[idx] = { ...tools[idx], output_preview };
              copy[copy.length - 1] = { ...last, tools };
            }
            return copy;
          });
        } else if (ev.event === "final") {
          const data = ev.data as { history?: unknown[] };
          if (data?.history) setHistory(data.history);
        } else if (ev.event === "error") {
          const data = ev.data as { message?: string };
          toast.error(data?.message ?? "Error en el agente");
        }
      }
    } catch (e) {
      toast.error(`Stream interrumpido: ${(e as Error).message}`);
    } finally {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, pending: false };
        }
        return copy;
      });
      setStreaming(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setHistory([]);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold">Chat</h1>
          <p className="text-xs text-muted-foreground">
            Pregúntale a Claude sobre la obra de los autores · {authors.length} datasets disponibles
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} disabled={messages.length === 0}>
          Nueva conversación
        </Button>
      </header>

      {messages.length === 0 && (
        <div className="container max-w-3xl space-y-4 py-10">
          <h2 className="text-lg font-medium">Algunos puntos de partida</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-md border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="container max-w-3xl space-y-4 py-6">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t bg-background px-6 py-3"
      >
        <div className="container max-w-3xl flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta…"
            disabled={streaming}
            autoFocus
          />
          <Button type="submit" disabled={!input.trim() || streaming}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Lazy-initialised markdown-it instance with KaTeX support. We use
// markdown-it (the engine Typora and many web editors use) instead of
// react-markdown because it is far more permissive with malformed
// input — it does its best to render whatever it sees instead of
// failing silently.
// Unwrap whatever shape the bundler produced (CJS default export,
// ESM namespace, etc.) until we hit something callable.
function _resolveKatexPlugin(): unknown {
  let cur: unknown = mdKatexNs as unknown;
  for (let i = 0; i < 4; i++) {
    if (typeof cur === "function") return cur;
    if (cur && typeof cur === "object" && "default" in cur) {
      cur = (cur as { default: unknown }).default;
    } else {
      break;
    }
  }
  return cur;
}

function createRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false, // never trust HTML in LLM output
    linkify: true,
    breaks: false, // GFM-style line breaks make narrow tables worse
    typographer: true,
  });
  const katexPlugin = _resolveKatexPlugin();
  if (typeof katexPlugin === "function") {
    try {
      // markdown-it.use signature: use(plugin, ...args)
      md.use(katexPlugin as never, { throwOnError: false, errorColor: "#cc0000" });
    } catch (e) {
      // If the plugin still throws (mismatched API), log and continue
      // without LaTeX. The chat keeps working, just without rendered formulas.
      // eslint-disable-next-line no-console
      console.warn("KaTeX plugin failed to load:", e);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn("KaTeX plugin did not resolve to a callable; skipping.");
  }
  return md;
}

function MessageBubble({ message }: { message: Message }) {
  const md = useMemo(createRenderer, []);
  const rendered = useMemo(() => {
    if (message.pending || !message.content) return "";
    try {
      return md.render(message.content);
    } catch {
      // markdown-it almost never throws, but if it does, fall back
      // to escaped plain text rather than losing the message.
      const safe = message.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre>${safe}</pre>`;
    }
  }, [md, message.content, message.pending]);

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      {message.tools && message.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.tools.map((t, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                t.output_preview
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-700 animate-pulse",
              )}
              title={JSON.stringify(t.input)}
            >
              <Wrench className="h-3 w-3" />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <Card
        className={cn(
          "max-w-3xl",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-card",
        )}
      >
        <CardContent
          className={cn(
            "px-4 py-3",
            // Tight prose tuned for chat bubbles. Reuses @tailwindcss/typography.
            !message.pending && message.role === "assistant" && [
              "prose prose-sm max-w-none",
              "prose-headings:mt-3 prose-headings:mb-1 prose-headings:font-semibold",
              "prose-p:my-2 prose-li:my-0.5",
              "prose-table:my-2 prose-table:text-xs",
              "prose-th:bg-muted prose-th:px-2 prose-th:py-1 prose-th:text-left",
              "prose-td:px-2 prose-td:py-1 prose-td:align-top",
              "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
              "prose-hr:my-3",
            ],
          )}
        >
          {message.content === "" && message.pending ? (
            <div className="flex items-center gap-2 text-xs opacity-70">
              <Loader2 className="h-3 w-3 animate-spin" />
              Pensando…
            </div>
          ) : message.pending ? (
            // While the stream is open we show plain text only. Markdown
            // is parsed once, after the stream closes — that way an
            // half-written table doesn't render as garbage mid-flight.
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
              <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-current opacity-60" />
            </div>
          ) : (
            <div
              className="text-sm leading-relaxed"
              // markdown-it sanitises HTML by default (we pass html:false);
              // the rendered string is therefore safe to inject.
              dangerouslySetInnerHTML={{
                __html: rendered || "<em>(sin respuesta)</em>",
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
