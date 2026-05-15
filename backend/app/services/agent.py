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

## Formato de la respuesta

Tu respuesta se renderiza con Markdown (GFM) + KaTeX para LaTeX inline.
Tienes a disposición:

- **Encabezados** (`##`, `###`)
- **Listas** (`- item` con un item por línea)
- **Tablas Markdown** con la fila separadora `|---|---|` obligatoria
- **Negritas** con `**texto**`
- **LaTeX inline** con `$...$`: `$\\delta_B$`, `$H(\\mathcal{B})$`,
  `$\\rho(\\mathcal{B})$`, `$\\dim \\Lambda_M$`, `$\\Gamma_0$`, `$\\Gamma_1$`,
  `$\\omega(m) = \\mu(m) \\cdot \\mathrm{val}(m)$`

### Reglas de formato (las que evitan que el render se rompa)

1. **Línea en blanco antes y después** de cada bloque (encabezado, lista,
   tabla, párrafo). El parser es estricto con esto — si pegas una tabla
   a un párrafo, no la reconoce y la muestra como prosa con `|`.
2. **No pegues `**bold**` a la siguiente palabra**. Pon un espacio:
   bien `paper de **Auslander** (1971)`; mal `paper de**Auslander**(1971)`.
3. **Una idea por línea** dentro de listas y tablas; no rellenes
   celdas con prosa larga.

### Plantilla recomendada

```
## Resumen — Nombre del autor

Una frase introductoria que enuncie la idea principal.

| Métrica | Valor |
|---------|-------|
| $\\delta_B$ | 4226 |
| $H(\\mathcal{B})$ | 10.65 bits |
| $\\rho(\\mathcal{B})$ | 0.98 |
| $\\dim \\Lambda_M$ | 10851 |
| Papers | 162 |
| Refs | 1820 |
| Univ. | 1423 (78%) |
| Loops | 1423 |

**Interpretación:** una o dos frases sobre qué significan los
números (alto/bajo, concentrado/disperso, comparable a X).
```

### Reglas operacionales

- **Brevedad**: 2-3 párrafos cortos + 1 tabla o lista. Nada de prosa larga.
- **Idioma**: el mismo que la pregunta.
- **Herramientas primero**: llama herramientas antes de citar números.
  Nunca inventes valores.
- **Interpreta los datos**, no los repitas literalmente.

### Ejemplo de respuesta correcta para "Resume Ringel"

## Resumen — Claus Michael Ringel

Ringel muestra una de las obras más voluminosas y diversificadas del
ecosistema: 162 papers citan a 1820 referencias distintas, con una
entropía de Brauer cerca del máximo teórico.

| Métrica | Valor |
|---------|-------|
| $\\delta_B$ | 4226 |
| $H(\\mathcal{B})$ | 10.65 bits |
| $\\rho(\\mathcal{B})$ | 0.98 |
| $\\dim \\Lambda_M$ | 10851 |
| Papers ($\\Gamma_1$) | 162 |
| Refs ($\\Gamma_0$) | 1820 |
| Univalentes | 1423 (78%) |
| Loops | 1423 |

**Interpretación:** $\\rho(\\mathcal{B}) \\approx 1$ indica distribución
de pesos casi uniforme, sin dependencia de pocas fuentes. El 78 % de
referencias univalentes confirma amplitud temática. El núcleo
multivalente (397 referencias) aporta $\\delta_B^{\\text{core}} = 1380$,
concentrado en sus contribuciones fundacionales (species-K, álgebras
mansas, formas cuadráticas integrales).
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


import re as _re


# Match a Markdown table separator row that has at least two pipes
# (e.g. `|---|---|`). Used to detect tables glued to prose.
_TABLE_SEP_RE = _re.compile(r"\|[\s:\-]*\-[\s:\-]*\|(?:[\s:\-]*\-[\s:\-]*\|)+")


def _sanitize_markdown(text: str) -> str:
    """Make Markdown the LLM emitted survive the GFM parser.

    Claude often writes a table as a single line and forgets to close
    a `**` pair, which makes everything after that point render bold.
    Two fixes:

    1. When we find a separator row (`|---|---|`) on a line that also
       carries header / data cells, rebuild the table:
       - count the columns in the separator
       - re-flow the surrounding `| ... |` content into rows of that
         exact width, each on its own line
       - put a blank line before and after the resulting table.
    2. Drop a trailing unbalanced `**` (odd count → unclosed pair).
    """
    if not text:
        return text

    s = text

    # 1. Detect lines that contain a separator row jammed with cells.
    lines = s.split("\n")
    rebuilt: list[str] = []
    for line in lines:
        sep_match = _TABLE_SEP_RE.search(line)
        if not sep_match:
            rebuilt.append(line)
            continue

        # Count separator columns by counting `|` minus 1.
        sep = sep_match.group(0)
        n_cols = sep.count("|") - 1
        if n_cols < 2:
            rebuilt.append(line)
            continue

        # Tokenise the WHOLE original line by `|`, skipping the separator
        # tokens (they look like `---` after stripping).
        before = line[: sep_match.start()]
        after = line[sep_match.end():]
        # Cells from `before` (header) and `after` (data rows), in order.
        raw_cells: list[str] = []
        for chunk in (before, after):
            # Split on `|`, drop empty strings caused by leading/trailing pipes.
            for cell in chunk.split("|"):
                cell = cell.strip()
                if not cell:
                    continue
                # Skip cells that ARE separator tokens (just dashes).
                if _re.fullmatch(r":?-+:?", cell):
                    continue
                raw_cells.append(cell)

        if len(raw_cells) < n_cols:
            # Not enough cells to even form a header; bail.
            rebuilt.append(line)
            continue

        # Build the table: first n_cols cells = header, the rest split
        # into rows of n_cols cells. Discard a final partial row.
        header = raw_cells[:n_cols]
        rest = raw_cells[n_cols:]
        n_full_rows = len(rest) // n_cols
        body_rows = [rest[i * n_cols : (i + 1) * n_cols] for i in range(n_full_rows)]

        rebuilt.append("")  # blank line before table
        rebuilt.append("| " + " | ".join(header) + " |")
        rebuilt.append("|" + "|".join(["---"] * n_cols) + "|")
        for row in body_rows:
            rebuilt.append("| " + " | ".join(row) + " |")
        rebuilt.append("")  # blank line after table

    s = "\n".join(rebuilt)

    # 2. Drop a trailing unbalanced `**`. An odd count of `**` means one
    # pair is open and would bold the rest of the document.
    if s.count("**") % 2 == 1:
        idx = s.rfind("**")
        s = s[:idx] + s[idx + 2:]

    # Collapse 3+ blank lines into 2.
    s = _re.sub(r"\n{3,}", "\n\n", s)

    return s


def _serialize_block(block: Any) -> dict | None:
    """Convert an Anthropic content block into the *wire* format that
    can be sent back in a follow-up `messages.create` call.

    The SDK's `model_dump()` includes extra fields like `parsed_output`
    that Anthropic rejects with a 400 if echoed back. We only keep the
    fields documented as accepted on input.
    """
    t = getattr(block, "type", None)
    if t == "text":
        text = getattr(block, "text", "")
        if not text:
            return None
        return {"type": "text", "text": text}
    if t == "tool_use":
        return {
            "type": "tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input,
        }
    if t == "thinking":
        # Skip thinking blocks — they cannot be replayed and are not
        # required for the conversation.
        return None
    # Unknown block type: drop it rather than risk a 400.
    return None


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
    # Use plain .replace() (not .format()) so curly braces in the prompt's
    # LaTeX examples (e.g. \\mathcal{B}) aren't interpreted as placeholders.
    system = SYSTEM_PROMPT.replace("{authors_info}", _build_authors_info())
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
                # Sanitise the streamed text and ship the cleaned version
                # so the client can render Markdown without surprises.
                full_text = "".join(full_text_parts)
                cleaned = _sanitize_markdown(full_text)
                if cleaned != full_text:
                    yield _sse("replace", cleaned)
                history.append({
                    "role": "assistant",
                    "content": [
                        b for b in (_serialize_block(c) for c in final_message.content)
                        if b is not None
                    ],
                })
                yield _sse("final", {"history": history})
                yield _sse("done", "")
                return

            # Execute tools and continue the loop
            history.append({
                "role": "assistant",
                "content": [
                    b for b in (_serialize_block(c) for c in final_message.content)
                    if b is not None
                ],
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
