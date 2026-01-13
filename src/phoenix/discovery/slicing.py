"""Slice ranking to find attribute combinations with high badness."""

import logging
from collections import defaultdict
from itertools import combinations
from typing import Optional

import numpy as np
from scipy import stats

from .models import BadnessScore, Slice, TraceFeatures

logger = logging.getLogger(__name__)

# Default attributes to slice on
DEFAULT_SLICE_ATTRIBUTES = ["intent", "route", "model", "provider"]


def rank_slices(
    features: list[TraceFeatures],
    badness_scores: dict[str, BadnessScore],
    slice_attributes: Optional[list[str]] = None,
    min_slice_size: int = 10,
    max_slice_depth: int = 2,
    significance_threshold: float = 0.05,
) -> list[Slice]:
    """
    Find attribute combinations that correlate with bad outcomes.

    Args:
        features: List of extracted trace features
        badness_scores: Dict of trace_id -> BadnessScore
        slice_attributes: Attributes to slice on (default: intent, route, model, prompt_version)
        min_slice_size: Minimum traces in a slice to consider
        max_slice_depth: Maximum attributes to combine (1 = single attr, 2 = pairs)
        significance_threshold: p-value threshold for significance

    Returns:
        List of Slice objects sorted by lift (descending)
    """
    slice_attributes = slice_attributes or DEFAULT_SLICE_ATTRIBUTES

    # Compute baseline badness rate
    all_badness = [badness_scores[f.trace_id].score for f in features if f.trace_id in badness_scores]
    if not all_badness:
        return []

    baseline_rate = sum(1 for b in all_badness if b > 0.5) / len(all_badness)

    # If baseline is 0, we can't compute lift
    if baseline_rate == 0:
        baseline_rate = 0.001  # Small epsilon

    slices = []

    # Generate slices for each depth level
    for depth in range(1, max_slice_depth + 1):
        for attr_combo in combinations(slice_attributes, depth):
            # Group traces by attribute combination
            groups = _group_by_attributes(features, attr_combo)

            # Evaluate each group
            for key, trace_ids in groups.items():
                if len(trace_ids) < min_slice_size:
                    continue

                # Compute slice badness
                slice_badness = [
                    badness_scores[tid].score
                    for tid in trace_ids
                    if tid in badness_scores
                ]
                if not slice_badness:
                    continue

                slice_bad_count = sum(1 for b in slice_badness if b > 0.5)
                slice_badness_rate = slice_bad_count / len(slice_badness)

                # Compute lift
                lift = slice_badness_rate / baseline_rate

                # Compute statistical significance
                p_value = _compute_significance(
                    slice_bad_count,
                    len(slice_badness),
                    sum(1 for b in all_badness if b > 0.5),
                    len(all_badness),
                )

                # Build attribute dict
                attributes = dict(zip(attr_combo, key))

                slices.append(Slice(
                    attributes=attributes,
                    trace_ids=trace_ids,
                    size=len(trace_ids),
                    badness_rate=slice_badness_rate,
                    baseline_rate=baseline_rate,
                    lift=lift,
                    p_value=p_value,
                ))

    # Filter by significance and sort by lift
    significant_slices = [s for s in slices if s.p_value < significance_threshold]

    # If no significant slices, return top by lift anyway
    if not significant_slices:
        significant_slices = slices

    significant_slices.sort(key=lambda s: s.lift, reverse=True)

    return significant_slices


def _group_by_attributes(
    features: list[TraceFeatures],
    attributes: tuple[str, ...],
) -> dict[tuple[str, ...], list[str]]:
    """Group trace IDs by attribute values."""
    groups: dict[tuple[str, ...], list[str]] = defaultdict(list)

    for f in features:
        key = tuple(getattr(f, attr, "unknown") for attr in attributes)
        groups[key].append(f.trace_id)

    return dict(groups)


def _compute_significance(
    slice_bad: int,
    slice_total: int,
    pop_bad: int,
    pop_total: int,
) -> float:
    """
    Compute statistical significance using chi-squared test.

    Tests whether the slice badness rate differs from population rate.
    """
    if slice_total == 0 or pop_total == 0:
        return 1.0

    # Build contingency table
    # [[slice_bad, slice_good], [rest_bad, rest_good]]
    slice_good = slice_total - slice_bad
    rest_bad = pop_bad - slice_bad
    rest_good = (pop_total - slice_total) - rest_bad

    # Ensure non-negative values
    if rest_bad < 0 or rest_good < 0:
        return 1.0

    contingency = np.array([
        [slice_bad, slice_good],
        [rest_bad, rest_good],
    ])

    # Chi-squared test
    try:
        _, p_value, _, _ = stats.chi2_contingency(contingency)
        return float(p_value)
    except ValueError:
        # Can happen with degenerate tables
        return 1.0


def get_top_slices(
    slices: list[Slice],
    n: int = 10,
    min_lift: float = 1.0,
) -> list[Slice]:
    """Get top N slices with lift above threshold."""
    filtered = [s for s in slices if s.lift >= min_lift]
    return filtered[:n]
