"""Badness score aggregation from multiple signals."""

from dataclasses import dataclass, field
from typing import Optional

from .models import BadnessScore, TraceFeatures


@dataclass
class BadnessWeights:
    """Configurable weights for badness signals."""

    quality_eval: float = 0.3
    grounding_eval: float = 0.2
    tool_errors: float = 0.2
    latency: float = 0.1
    error_count: float = 0.2

    def to_dict(self) -> dict[str, float]:
        return {
            "quality_eval": self.quality_eval,
            "grounding_eval": self.grounding_eval,
            "tool_errors": self.tool_errors,
            "latency": self.latency,
            "error_count": self.error_count,
        }


DEFAULT_WEIGHTS = BadnessWeights()


def compute_badness(
    features: TraceFeatures,
    p95_latency_ms: float = 30000.0,
    weights: Optional[BadnessWeights] = None,
) -> BadnessScore:
    """
    Compute aggregate badness score from multiple signals.

    Args:
        features: Extracted features for this trace
        p95_latency_ms: P95 latency for normalization
        weights: Signal weights (defaults to DEFAULT_WEIGHTS)

    Returns:
        BadnessScore with aggregate score and signal breakdown
    """
    weights = weights or DEFAULT_WEIGHTS
    signals: dict[str, float] = {}

    # Quality eval signal (invert: low quality = high badness)
    if features.quality_score is not None:
        signals["quality_eval"] = 1.0 - features.quality_score
    else:
        # No eval available - assume neutral
        signals["quality_eval"] = 0.5

    # Grounding eval signal (invert: low grounding = high badness)
    if features.grounding_score is not None:
        signals["grounding_eval"] = 1.0 - features.grounding_score
    else:
        signals["grounding_eval"] = 0.5

    # Tool error signal (inverted tool success rate)
    signals["tool_errors"] = 1.0 - features.tool_success_rate

    # Latency signal (normalized against p95)
    if features.total_latency_ms > 0 and p95_latency_ms > 0:
        signals["latency"] = min(features.total_latency_ms / p95_latency_ms, 1.0)
    else:
        signals["latency"] = 0.0

    # Error count signal (any errors = bad)
    if features.error_count > 0:
        signals["error_count"] = min(features.error_count / 3.0, 1.0)  # Cap at 3 errors
    else:
        signals["error_count"] = 0.0

    # Compute weighted average
    weight_dict = weights.to_dict()
    total_weight = sum(weight_dict.get(k, 0) for k in signals)

    if total_weight > 0:
        score = sum(signals[k] * weight_dict.get(k, 0) for k in signals) / total_weight
    else:
        score = 0.5

    return BadnessScore(
        trace_id=features.trace_id,
        score=score,
        signals=signals,
    )


def compute_badness_batch(
    features_list: list[TraceFeatures],
    weights: Optional[BadnessWeights] = None,
) -> dict[str, BadnessScore]:
    """
    Compute badness scores for a batch of traces.

    Args:
        features_list: List of extracted features
        weights: Signal weights

    Returns:
        Dict mapping trace_id to BadnessScore
    """
    # Compute p95 latency for normalization
    latencies = [f.total_latency_ms for f in features_list if f.total_latency_ms > 0]
    if latencies:
        latencies.sort()
        p95_idx = int(len(latencies) * 0.95)
        p95_latency = latencies[min(p95_idx, len(latencies) - 1)]
    else:
        p95_latency = 30000.0  # Default 30s

    return {
        f.trace_id: compute_badness(f, p95_latency_ms=p95_latency, weights=weights)
        for f in features_list
    }


def get_bad_trace_ids(
    badness_scores: dict[str, BadnessScore],
    threshold: float = 0.5,
) -> list[str]:
    """Get trace IDs with badness above threshold."""
    return [
        trace_id
        for trace_id, score in badness_scores.items()
        if score.score > threshold
    ]
