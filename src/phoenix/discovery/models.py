"""Data models for issue discovery."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import numpy as np


@dataclass
class TraceFeatures:
    """Feature representation of a trace for clustering."""

    trace_id: str

    # Text content
    input_text: str
    output_text: str

    # Embedding (set after extraction)
    text_embedding: Optional[np.ndarray] = None

    # Tool sequence features
    tool_sequence: list[str] = field(default_factory=list)
    tool_ngrams: dict[str, int] = field(default_factory=dict)
    tool_success_rate: float = 1.0
    unique_tools_used: int = 0

    # Scalar metrics
    total_latency_ms: float = 0.0
    llm_latency_ms: float = 0.0
    tool_latency_ms: float = 0.0
    total_tokens: int = 0
    llm_calls: int = 0
    tool_calls: int = 0
    retry_count: int = 0
    error_count: int = 0

    # Categorical attributes (for slicing)
    intent: str = "unknown"
    route: str = "unknown"
    model: str = "unknown"
    provider: str = "unknown"
    prompt_version: str = "unknown"

    # Eval scores (if available)
    quality_score: Optional[float] = None
    grounding_score: Optional[float] = None


@dataclass
class BadnessScore:
    """Aggregated badness score from multiple signals."""

    trace_id: str
    score: float  # 0.0 (good) to 1.0 (bad)
    signals: dict[str, float] = field(default_factory=dict)

    @property
    def is_bad(self) -> bool:
        """Whether this trace is considered bad (score > 0.5)."""
        return self.score > 0.5


@dataclass
class ClusterResult:
    """Result of clustering a group of traces."""

    cluster_id: int
    trace_ids: list[str]
    size: int
    badness_rate: float = 0.0
    avg_badness: float = 0.0

    # Dominant attributes
    dominant_intent: str = "unknown"
    dominant_route: str = "unknown"
    dominant_model: str = "unknown"

    # Representative traces
    example_trace_ids: list[str] = field(default_factory=list)

    # Cluster centroid (for similarity)
    centroid: Optional[np.ndarray] = None

    @property
    def is_problematic(self) -> bool:
        """Whether this cluster has high badness rate."""
        return self.badness_rate > 0.3


@dataclass
class Slice:
    """A segment of traces defined by attribute values."""

    attributes: dict[str, str]
    trace_ids: list[str]
    size: int
    badness_rate: float
    baseline_rate: float
    lift: float  # badness_rate / baseline_rate
    p_value: float = 1.0  # Statistical significance

    @property
    def is_significant(self) -> bool:
        """Whether this slice is statistically significant."""
        return self.p_value < 0.05

    @property
    def attribute_str(self) -> str:
        """String representation of attributes."""
        return ", ".join(f"{k}={v}" for k, v in self.attributes.items())


@dataclass
class DiscoveryReport:
    """Full output of the discovery pipeline."""

    project: str
    time_range: tuple[datetime, datetime]
    total_traces: int
    baseline_badness: float

    clusters: list[ClusterResult]
    top_slices: list[Slice]

    generated_at: datetime = field(default_factory=datetime.utcnow)

    # Summary stats
    num_bad_traces: int = 0
    num_clusters: int = 0
    num_significant_slices: int = 0

    def __post_init__(self):
        self.num_clusters = len(self.clusters)
        self.num_significant_slices = len([s for s in self.top_slices if s.is_significant])

    @property
    def worst_cluster(self) -> Optional[ClusterResult]:
        """Get the cluster with highest badness rate."""
        if not self.clusters:
            return None
        return max(self.clusters, key=lambda c: c.badness_rate)

    @property
    def worst_slice(self) -> Optional[Slice]:
        """Get the slice with highest lift."""
        if not self.top_slices:
            return None
        return max(self.top_slices, key=lambda s: s.lift)

    def summary(self) -> str:
        """Return a human-readable summary."""
        lines = [
            f"Discovery Report for {self.project}",
            f"Time range: {self.time_range[0]} to {self.time_range[1]}",
            f"Total traces: {self.total_traces}",
            f"Baseline badness: {self.baseline_badness:.1%}",
            f"Clusters found: {self.num_clusters}",
            f"Significant slices: {self.num_significant_slices}",
        ]

        if self.worst_cluster:
            lines.append(
                f"Worst cluster: #{self.worst_cluster.cluster_id} "
                f"({self.worst_cluster.badness_rate:.1%} bad, {self.worst_cluster.size} traces)"
            )

        if self.worst_slice:
            lines.append(
                f"Worst slice: {self.worst_slice.attribute_str} "
                f"(lift={self.worst_slice.lift:.2f}x)"
            )

        return "\n".join(lines)
