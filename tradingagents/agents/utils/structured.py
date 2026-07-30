"""Shared helpers for invoking an agent with structured output and a graceful fallback.

The Portfolio Manager, Trader, and Research Manager all follow the same
canonical pattern:

1. At agent creation, wrap the LLM with ``with_structured_output(Schema)``
   so the model returns a typed Pydantic instance. If the provider does
   not support structured output (rare; mostly older Ollama models), the
   wrap is skipped and the agent uses free-text generation instead.
2. At invocation, run the structured call and render the result back to
   markdown. If the structured call itself fails for any reason
   (malformed JSON from a weak model, transient provider issue), fall
   back to a plain ``llm.invoke`` so the pipeline never blocks.

Centralising the pattern here keeps the agent factories small and ensures
all three agents log the same warnings when fallback fires.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any, TypeVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Schema-only structured output binds exactly one tool (the schema itself), so a
# model that reaches for a search tool emits an unknown tool call and the whole
# structured attempt is discarded for a free-text retry. Agents on this path
# state the constraint explicitly rather than relying on the binding alone
# (#1130).
NO_EXTERNAL_TOOLS = (
    "Use only the evidence provided in this prompt. Do not call external tools "
    "or search the web; if something is missing, say so explicitly."
)


def bind_structured(llm: Any, schema: type[T], agent_name: str) -> Any | None:
    """Return ``llm.with_structured_output(schema)`` or ``None`` if unsupported.

    Logs a warning when the binding fails so the user understands the agent
    will use free-text generation for every call instead of one-shot fallback.
    """
    try:
        return llm.with_structured_output(schema)
    except (NotImplementedError, AttributeError) as exc:
        logger.warning(
            "%s: provider does not support with_structured_output (%s); "
            "falling back to free-text generation",
            agent_name, exc,
        )
        return None


def invoke_structured_or_freetext(
    structured_llm: Any | None,
    plain_llm: Any,
    prompt: Any,
    render: Callable[[T], str],
    agent_name: str,
) -> str:
    """Run the structured call and render to markdown; fall back to free-text on any failure.

    ``prompt`` is whatever the underlying LLM accepts (a string for chat
    invocations, a list of message dicts for chat models that take that
    shape). The same value is forwarded to the free-text path so the
    fallback sees the same input the structured call did.
    """
    if structured_llm is not None:
        try:
            result = structured_llm.invoke(prompt)
            if result is None:
                # A thinking model can answer in plain text instead of calling
                # the tool, leaving the parser with nothing to return. Treat it
                # as a structured miss and fall back, with a clear reason.
                raise ValueError("structured output returned no parsed result")
            return render(result)
        except Exception as exc:
            logger.warning(
                "%s: structured-output invocation failed (%s); retrying once as free text",
                agent_name, exc,
            )

    # ── Fallback: free-text generation ──────────────────────────────
    # Inject an anti-JSON guard instruction so models that produce raw
    # JSON when structured output isn't enforced (DeepSeek, MiniMax, etc.)
    # don't leak code blocks into the user-visible report.
    _FALLBACK_GUARD = (
        "\n\nCRITICAL OUTPUT FORMAT: Write your analysis as a natural-language "
        "report in plain prose with markdown formatting (headings, paragraphs, "
        "tables). DO NOT output JSON, Python dicts, or code fences. If you need "
        "to structure data, use markdown tables and bullet lists. This output "
        "goes directly to end users — raw JSON is a critical bug."
    )

    # Inject the guard into the last user/system message before invoking.
    if isinstance(prompt, list):
        # Mutate a shallow copy so the original is unchanged for logging.
        guarded = list(prompt)
        if guarded and isinstance(guarded[-1], dict) and "content" in guarded[-1]:
            last = dict(guarded[-1])
            last["content"] = str(last["content"]) + _FALLBACK_GUARD
            guarded[-1] = last
        else:
            guarded.append({"role": "user", "content": _FALLBACK_GUARD.strip()})
        prompt = guarded
    elif isinstance(prompt, str):
        prompt = prompt + _FALLBACK_GUARD
    # else: passthrough — can't inject into unknown types, let it fail naturally.

    response = plain_llm.invoke(prompt)
    return response.content
