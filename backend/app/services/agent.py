"""Claude agent with tool calling and SSE streaming.

Exposes `stream_chat()` — an async generator that yields SSE events
(`event: ... \\ndata: ...`) so the FastAPI router can pipe them straight
to the client. Tool execution happens in the agent loop and is broadcast
to the frontend so the UI can show "calling get_top_papers_by_delta..."
indicators.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

from anthropic import Anthropic

from .. import config
from . import brauer, registry, scienti

SYSTEM_PROMPT = """Eres un agente experto en álgebras de configuración de Brauer aplicadas a redes de citación. Analizas la obra de matemáticos prominentes y la producción científica colombiana (Scienti/Minciencias).

## Datos disponibles
{authors_info}

## Datos Scienti (Minciencias - Colombia)
Grupos de investigación (GrupLAC) e investigadores (CvLAC) con sus líneas, áreas, publicaciones y coautorías.

## Invariantes (usa notación de texto, NO LaTeX)
- **delta_B**: factor de impacto, masa total de influencia ponderada
- **H(B)**: entropía de Brauer (Shannon de los pesos)
- **rho(B) = H(B) / log2(n)**: ratio de entropía normalizado entre 0 y 1
- **dim Lambda_M**, **dim Z(Lambda_M)**: dimensiones del álgebra y del centro
- **val(m)**: valencia de m (cuántos polígonos lo contienen)
- **omega(m) = mu(m) * val(m)**: peso de m
- **vértice univalente**: val(m) = 1 (referencia especializada)

## Reglas de formato (CRÍTICO — el render falla si las violas)
Tu respuesta se renderiza como Markdown (GFM). Reglas innegociables:

**NO uses LaTeX** (`$...$` ni `\\delta_B`). El render NO soporta LaTeX
y produce símbolos rotos. Usa Unicode plano:
- `δ_B`, `H(B)`, `ρ(B)`, `dim Λ_M`, `Γ₀`, `Γ₁`, `ω(m)`, `μ(m)`
- O escribe los nombres como texto: `**delta_B**`, `**H(B)**`.

**SEPARA con líneas en blanco** — el error más común que produce
artefactos visuales (palabras cortadas, tablas concatenadas con
prosa, negritas pegadas) es escribir bloques sin separación. Sigue
esta plantilla mental:

```
## Encabezado

Párrafo introductorio breve.

| Col A | Col B |
|-------|-------|
| dato  | dato  |

Párrafo de interpretación.
```

Hay UNA línea en blanco entre cada bloque (encabezado, párrafo, tabla,
lista). Nunca pegues una tabla a un párrafo, ni dos negritas juntas
sin espacio.

**Tablas**:
- La fila separadora `|---|---|` es obligatoria, con la MISMA cantidad
  de columnas que el encabezado.
- No mezcles celdas con prosa fuera de la tabla en la misma línea.
- Una tabla por bloque, cerrada por línea en blanco antes de seguir.

**Listas**:
- Una línea por ítem, empezando con `- ` o `1. `.
- Nunca uses `|` como separador de ítems.

**Énfasis**:
- `**negrita**` para términos clave, sin pegar al texto vecino.
  Mal: `Reiten**8.12 bits**` → Bien: `Reiten: **8.12 bits**`.

**Brevedad**: 1-3 párrafos cortos + UNA tabla/lista. No prosa larga.

**Idioma**: el mismo que la pregunta.

**Datos**: SIEMPRE llama herramientas antes de dar números. No
inventes valores. Interpreta brevemente (alto/bajo, qué significa).

## Ejemplo de respuesta bien formateada

## Análisis de Brauer — Ringel

**δ_B = 4226** · **H(B) = 10.65 bits** · **ρ(B) = 0.98** · **dim Λ_M = 10851**

| Métrica | Valor |
|---------|-------|
| Papers (Γ₁) | 162 |
| Referencias (Γ₀) | 1820 |
| Univalentes | 1423 (78%) |
| Loops | 1423 |

**Interpretación:** ρ ≈ 1 indica una distribución muy uniforme de pesos — Ringel cita de manera diversa, sin concentración en pocas referencias clave. Los 1423 univalentes confirman amplitud temática.
"""


def _build_authors_info() -> str:
    available = brauer.list_available()
    if not available:
        return "(No hay datasets preprocesados disponibles)"
    return "\n".join(
        f"- **{a['display_name']}** (`{a['key']}`): {a.get('area', '')} — {a['n_papers']} papers, {a['n_references']} refs"
        for a in available
    )


def _build_tools() -> list[dict]:
    keys = list(registry.all().keys())
    return [
        {
            "name": "get_brauer_summary",
            "description": "Full Brauer analysis for a mathematician (delta_B, H(B), dimensions, top references).",
            "input_schema": {
                "type": "object",
                "properties": {"author_key": {"type": "string", "enum": keys}},
                "required": ["author_key"],
            },
        },
        {
            "name": "get_top_papers_by_delta",
            "description": "Most influential papers by an author, ranked by delta_B contribution.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "author_key": {"type": "string", "enum": keys},
                    "n": {"type": "integer", "default": 5},
                },
                "required": ["author_key"],
            },
        },
        {
            "name": "get_top_references_by_valency",
            "description": "Most cited references across an author's work, ranked by valency.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "author_key": {"type": "string", "enum": keys},
                    "n": {"type": "integer", "default": 10},
                },
                "required": ["author_key"],
            },
        },
        {
            "name": "compare_authors",
            "description": "Compare Brauer invariants between two or more mathematicians.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "author_keys": {
                        "type": "array",
                        "items": {"type": "string", "enum": keys},
                        "minItems": 2,
                    },
                },
                "required": ["author_keys"],
            },
        },
        {
            "name": "get_shared_references",
            "description": "References shared between authors with per-author valency.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "author_keys": {
                        "type": "array",
                        "items": {"type": "string", "enum": keys},
                        "minItems": 2,
                    },
                },
                "required": ["author_keys"],
            },
        },
        {
            "name": "get_entropy_decomposition",
            "description": "Which references contribute most to H(B).",
            "input_schema": {
                "type": "object",
                "properties": {"author_key": {"type": "string", "enum": keys}},
                "required": ["author_key"],
            },
        },
        {
            "name": "search_references",
            "description": "Fuzzy search over an author's reference titles and authors.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "author_key": {"type": "string", "enum": keys},
                    "query": {"type": "string"},
                },
                "required": ["author_key", "query"],
            },
        },
        {
            "name": "scienti_coauthorship_summary",
            "description": "Summary of the Scienti coauthorship quiver — number of researchers, edges, top coauthors.",
            "input_schema": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 200}},
            },
        },
        {
            "name": "scienti_groups_summary",
            "description": "Summary of Scienti research groups (GrupLAC) — counts and top by membership.",
            "input_schema": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 100}},
            },
        },
    ]


def _execute_tool(name: str, args: dict) -> str:
    try:
        if name == "get_brauer_summary":
            result: Any = brauer.summary(args["author_key"])
        elif name == "get_top_papers_by_delta":
            result = brauer.top_papers_by_delta(args["author_key"], args.get("n", 5))
        elif name == "get_top_references_by_valency":
            result = brauer.top_references_by_valency(args["author_key"], args.get("n", 10))
        elif name == "compare_authors":
            result = brauer.compare(args["author_keys"])
        elif name == "get_shared_references":
            result = brauer.shared_references(args["author_keys"])
        elif name == "get_entropy_decomposition":
            result = brauer.entropy_decomposition(args["author_key"])
        elif name == "search_references":
            result = brauer.search_references(args["author_key"], args["query"])
        elif name == "scienti_coauthorship_summary":
            result = scienti.coauthorship_summary(args.get("limit", 200))
        elif name == "scienti_groups_summary":
            result = scienti.groups_summary(args.get("limit", 100))
        else:
            result = {"error": f"Unknown tool: {name}"}
    except Exception as e:
        result = {"error": str(e)}
    return json.dumps(result, ensure_ascii=False, default=str)


def _client() -> Anthropic:
    if not config.ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY no configurada")
    return Anthropic(api_key=config.ANTHROPIC_API_KEY)


def _sse(event: str, data: Any) -> str:
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


async def stream_chat(
    user_query: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Run the agent loop and yield SSE-formatted strings.

    Events emitted:
      - `meta`     once at start (history length, etc.)
      - `tool`     each time the model invokes a tool
      - `result`   when a tool returns
      - `delta`    streamed text chunks from Claude
      - `final`    full conversation_history at the end (so the client can persist it)
      - `error`    on any failure
      - `done`     terminal sentinel
    """
    history = list(history or [])
    system = SYSTEM_PROMPT.format(authors_info=_build_authors_info())
    tools = _build_tools()

    history.append({"role": "user", "content": user_query})
    yield _sse("meta", {"history_len": len(history)})

    try:
        client = _client()
    except RuntimeError as e:
        yield _sse("error", {"message": str(e)})
        yield _sse("done", "")
        return

    loop = asyncio.get_event_loop()

    for _round in range(5):
        # Stream the assistant's turn so the user sees text as it arrives.
        try:
            full_text_parts: list[str] = []
            tool_uses: list[dict] = []

            def _do_stream():
                with client.messages.stream(
                    model=config.CLAUDE_MODEL,
                    max_tokens=4096,
                    system=system,
                    tools=tools,
                    messages=history,
                ) as stream:
                    for chunk in stream.text_stream:
                        full_text_parts.append(chunk)
                        # We can't yield from a sync function — collect chunks and
                        # the outer coroutine will replay them after the call.
                    final = stream.get_final_message()
                    return final

            # Push a heartbeat then run the (blocking) stream in a thread
            yield _sse("meta", {"round": _round + 1})
            final_message = await loop.run_in_executor(None, _do_stream)

            # Replay collected text deltas
            for chunk in full_text_parts:
                yield _sse("delta", chunk)

            # Inspect tool uses
            tool_uses = [b for b in final_message.content if b.type == "tool_use"]

            if not tool_uses:
                history.append({
                    "role": "assistant",
                    "content": [b.model_dump() for b in final_message.content],
                })
                yield _sse("final", {"history": history})
                yield _sse("done", "")
                return

            # Execute tools and continue the loop
            history.append({
                "role": "assistant",
                "content": [b.model_dump() for b in final_message.content],
            })
            tool_results = []
            for tu in tool_uses:
                yield _sse("tool", {"name": tu.name, "input": tu.input})
                result_str = _execute_tool(tu.name, tu.input)
                yield _sse("result", {"name": tu.name, "output_preview": result_str[:280]})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": result_str,
                })
            history.append({"role": "user", "content": tool_results})

        except Exception as e:
            yield _sse("error", {"message": str(e)})
            yield _sse("done", "")
            return

    yield _sse("error", {"message": "El agente excedió el límite de iteraciones."})
    yield _sse("final", {"history": history})
    yield _sse("done", "")
