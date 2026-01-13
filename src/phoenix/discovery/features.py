"""Feature extraction from traces for clustering."""

import json
import logging
import re
from collections import Counter
from typing import Optional

import numpy as np
import pandas as pd
from openai import OpenAI

from .models import TraceFeatures

logger = logging.getLogger(__name__)

# Embedding cache to avoid re-embedding same text
_embedding_cache: dict[str, np.ndarray] = {}


def embed_text(
    text: str,
    model: str = "text-embedding-3-small",
    client: Optional[OpenAI] = None,
) -> np.ndarray:
    """Get embedding for text using OpenAI."""
    # Check cache
    cache_key = f"{model}:{text[:500]}"
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    if client is None:
        client = OpenAI()

    # Truncate very long text
    text = text[:8000] if len(text) > 8000 else text

    try:
        response = client.embeddings.create(
            model=model,
            input=text,
        )
        embedding = np.array(response.data[0].embedding)
        _embedding_cache[cache_key] = embedding
        return embedding
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        # Return zero vector on failure
        return np.zeros(1536)  # text-embedding-3-small dimension


def compute_tool_ngrams(tool_sequence: list[str], n: int = 2) -> dict[str, int]:
    """Extract n-gram features from tool sequence."""
    ngrams: dict[str, int] = {}

    # Unigrams (tool counts)
    for tool in tool_sequence:
        ngrams[tool] = ngrams.get(tool, 0) + 1

    # Bigrams (transitions)
    if n >= 2 and len(tool_sequence) >= 2:
        for i in range(len(tool_sequence) - 1):
            bigram = f"{tool_sequence[i]}->{tool_sequence[i + 1]}"
            ngrams[bigram] = ngrams.get(bigram, 0) + 1

    return ngrams


def extract_features_from_spans(
    spans_df: pd.DataFrame,
    trace_id: str,
    annotations_df: Optional[pd.DataFrame] = None,
) -> Optional[TraceFeatures]:
    """Extract features from Phoenix spans DataFrame for a single trace."""

    # Filter to this trace
    trace_spans = spans_df[spans_df["context.trace_id"] == trace_id]

    if len(trace_spans) == 0:
        return None

    # Find root span (usually the first/parent span)
    root_spans = trace_spans[trace_spans["parent_id"].isna()]
    if len(root_spans) == 0:
        root_span = trace_spans.iloc[0]
    else:
        root_span = root_spans.iloc[0]

    # Extract input/output
    input_text = str(root_span.get("attributes.input.value", ""))
    output_text = str(root_span.get("attributes.output.value", ""))

    # If no input/output on root, try to find from LLM spans
    if not input_text:
        input_text = str(root_span.get("attributes.llm.input_messages", ""))
    if not output_text:
        output_text = str(root_span.get("attributes.llm.output_messages", ""))

    # Identify tool spans and LLM spans
    tool_spans = trace_spans[
        (trace_spans["span_kind"] == "TOOL")
        | (trace_spans["name"].str.contains("tool", case=False, na=False))
    ]
    llm_spans = trace_spans[
        (trace_spans["span_kind"] == "LLM")
        | (trace_spans["name"].str.contains("llm|openai|anthropic|chat", case=False, na=False))
    ]

    # Extract tool sequence
    if len(tool_spans) > 0:
        tool_spans_sorted = tool_spans.sort_values("start_time")
        tool_sequence = tool_spans_sorted["name"].tolist()
    else:
        tool_sequence = []

    # Compute tool success rate (ERROR = failure, OK/UNSET = success)
    if len(tool_spans) > 0:
        error_tools = tool_spans[tool_spans["status_code"] == "ERROR"]
        tool_success_rate = 1.0 - (len(error_tools) / len(tool_spans))
    else:
        tool_success_rate = 1.0

    # Compute latencies
    total_latency = 0.0
    if "latency_ms" in trace_spans.columns:
        total_latency = float(root_span.get("latency_ms", 0) or 0)
    elif "end_time" in trace_spans.columns and "start_time" in trace_spans.columns:
        try:
            start = pd.to_datetime(root_span["start_time"])
            end = pd.to_datetime(root_span["end_time"])
            total_latency = (end - start).total_seconds() * 1000
        except Exception:
            pass

    llm_latency = 0.0
    if len(llm_spans) > 0 and "latency_ms" in llm_spans.columns:
        llm_latency = float(llm_spans["latency_ms"].sum())

    tool_latency = 0.0
    if len(tool_spans) > 0 and "latency_ms" in tool_spans.columns:
        tool_latency = float(tool_spans["latency_ms"].sum())

    # Count tokens
    total_tokens = 0
    if "attributes.llm.token_count.total" in trace_spans.columns:
        total_tokens = int(trace_spans["attributes.llm.token_count.total"].sum())

    # Count errors
    error_spans = trace_spans[trace_spans["status_code"] == "ERROR"]
    error_count = len(error_spans)

    # Extract categorical attributes from available span data

    # Intent: try crew_inputs (for CrewAI), then custom attribute, then span name
    intent = ""

    # Try crew_inputs first (CrewAI specific)
    crew_inputs = root_span.get("attributes.crew_inputs", "")
    if crew_inputs and str(crew_inputs) != "nan":
        try:
            inputs = json.loads(str(crew_inputs)) if isinstance(crew_inputs, str) else crew_inputs
            # Extract question or first meaningful value
            if isinstance(inputs, dict):
                intent = inputs.get("question", inputs.get("topic", inputs.get("task", "")))
                if intent:
                    # Truncate long intents
                    intent = str(intent)[:50] + "..." if len(str(intent)) > 50 else str(intent)
        except (json.JSONDecodeError, TypeError):
            pass

    # Try input.value if no crew_inputs
    if not intent:
        input_val = root_span.get("attributes.input.value", "")
        if input_val and str(input_val) != "nan":
            intent = str(input_val)[:50] + "..." if len(str(input_val)) > 50 else str(input_val)

    # Fall back to custom attribute or span name (skip UUID-based names)
    if not intent:
        intent = str(root_span.get("attributes.obs.intent", ""))
    if not intent or intent == "nan":
        span_name = str(root_span.get("name", "unknown"))
        # Skip UUID-based names like Crew_<uuid>.kickoff
        if not re.search(r'[a-f0-9]{8}-[a-f0-9]{4}', span_name):
            intent = span_name
        else:
            intent = "crew_execution"

    # Route: use agent name, task name, or tool pattern
    route = str(root_span.get("attributes.obs.route", ""))
    if not route or route == "nan":
        # Look for agent execution spans
        agent_spans = trace_spans[trace_spans["name"].str.contains(r"\._execute", case=False, na=False, regex=True)]
        if len(agent_spans) > 0:
            # Extract agent name from "AgentName._execute_core"
            agent_name = agent_spans.iloc[0]["name"]
            route = agent_name.split("._")[0] if "._" in agent_name else agent_name
        else:
            # Try tool name as route
            if len(tool_spans) > 0:
                tool_names = tool_spans["name"].unique()
                route = f"tools:{','.join(str(t) for t in tool_names[:3])}"
            else:
                route = str(root_span.get("span_kind", "unknown"))

    # Model: get from any span with model_name attribute
    model = "unknown"
    if "attributes.llm.model_name" in trace_spans.columns:
        model_vals = trace_spans["attributes.llm.model_name"].dropna()
        if len(model_vals) > 0:
            model = str(model_vals.iloc[0])

    # Provider: get from any span with provider attribute
    provider = "unknown"
    if "attributes.llm.provider" in trace_spans.columns:
        provider_vals = trace_spans["attributes.llm.provider"].dropna()
        if len(provider_vals) > 0:
            provider = str(provider_vals.iloc[0])

    # Prompt version: use model name as proxy
    prompt_version = model if model != "unknown" else "unknown"

    # Get eval scores from annotations if available
    quality_score = None
    grounding_score = None
    if annotations_df is not None and len(annotations_df) > 0:
        trace_annotations = annotations_df[
            annotations_df["span_id"].isin(trace_spans["context.span_id"])
        ]
        if len(trace_annotations) > 0:
            quality_rows = trace_annotations[
                trace_annotations["name"].str.contains("quality", case=False, na=False)
            ]
            if len(quality_rows) > 0:
                quality_score = float(quality_rows.iloc[0].get("score", 0.5))

            grounding_rows = trace_annotations[
                trace_annotations["name"].str.contains("grounding", case=False, na=False)
            ]
            if len(grounding_rows) > 0:
                grounding_score = float(grounding_rows.iloc[0].get("score", 0.5))

    # Clean up provider value
    if not provider or provider == "nan":
        provider = "unknown"

    return TraceFeatures(
        trace_id=trace_id,
        input_text=input_text,
        output_text=output_text,
        tool_sequence=tool_sequence,
        tool_ngrams=compute_tool_ngrams(tool_sequence),
        tool_success_rate=tool_success_rate,
        unique_tools_used=len(set(tool_sequence)),
        total_latency_ms=total_latency,
        llm_latency_ms=llm_latency,
        tool_latency_ms=tool_latency,
        total_tokens=total_tokens,
        llm_calls=len(llm_spans),
        tool_calls=len(tool_spans),
        error_count=error_count,
        intent=intent,
        route=route,
        model=model,
        provider=provider,
        prompt_version=prompt_version,
        quality_score=quality_score,
        grounding_score=grounding_score,
    )


def add_embeddings(
    features: list[TraceFeatures],
    embedding_model: str = "text-embedding-3-small",
) -> None:
    """Add text embeddings to features in place."""
    client = OpenAI()

    for f in features:
        # Combine input and output for embedding
        text = f"{f.input_text}\n---\n{f.output_text}"
        f.text_embedding = embed_text(text, model=embedding_model, client=client)


def build_feature_matrix(
    features: list[TraceFeatures],
    include_embedding: bool = True,
) -> np.ndarray:
    """Build feature matrix for clustering."""

    matrices = []

    # Embedding features
    if include_embedding:
        embeddings = []
        for f in features:
            if f.text_embedding is not None:
                embeddings.append(f.text_embedding)
            else:
                embeddings.append(np.zeros(1536))
        matrices.append(np.array(embeddings))

    # Scalar features (normalized later)
    scalars = []
    for f in features:
        scalars.append([
            f.total_latency_ms,
            f.llm_latency_ms,
            f.tool_latency_ms,
            float(f.total_tokens),
            float(f.llm_calls),
            float(f.tool_calls),
            f.tool_success_rate,
            float(f.error_count),
            float(f.unique_tools_used),
        ])
    matrices.append(np.array(scalars))

    # Tool ngram features (sparse, top-k)
    all_ngrams: Counter = Counter()
    for f in features:
        all_ngrams.update(f.tool_ngrams.keys())

    # Take top 20 most common ngrams
    top_ngrams = [ng for ng, _ in all_ngrams.most_common(20)]

    if top_ngrams:
        ngram_matrix = []
        for f in features:
            row = [f.tool_ngrams.get(ng, 0) for ng in top_ngrams]
            ngram_matrix.append(row)
        matrices.append(np.array(ngram_matrix))

    # Concatenate all feature groups
    return np.hstack(matrices)


def get_unique_trace_ids(spans_df: pd.DataFrame) -> list[str]:
    """Get unique trace IDs from spans DataFrame."""
    if "context.trace_id" in spans_df.columns:
        return spans_df["context.trace_id"].unique().tolist()
    return []
