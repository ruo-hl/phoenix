"""GraphQL types for trace discovery (clustering and slice analysis)."""

from datetime import datetime
from typing import Optional

import strawberry
from strawberry import ID
from strawberry.scalars import JSON


@strawberry.type
class TraceCluster:
    """A cluster of similar traces discovered during analysis."""

    id: ID = strawberry.field(description="Unique identifier for the cluster")
    cluster_index: int = strawberry.field(description="Index of the cluster (0-based)")
    size: int = strawberry.field(description="Number of traces in this cluster")
    badness_rate: float = strawberry.field(
        description="Proportion of traces in this cluster with badness > 0.5"
    )
    avg_badness: float = strawberry.field(
        description="Average badness score of traces in this cluster"
    )
    dominant_intent: Optional[str] = strawberry.field(
        description="Most common intent classification in this cluster"
    )
    dominant_route: Optional[str] = strawberry.field(
        description="Most common route/workflow in this cluster"
    )
    dominant_model: Optional[str] = strawberry.field(
        description="Most common LLM model used in this cluster"
    )
    example_trace_ids: list[str] = strawberry.field(
        description="Representative trace IDs for drilldown"
    )

    @strawberry.field(description="Whether this cluster is problematic (badness_rate > 0.3)")
    def is_problematic(self) -> bool:
        return self.badness_rate > 0.3


@strawberry.type
class TraceSlice:
    """A slice (attribute combination) with elevated badness rate."""

    id: ID = strawberry.field(description="Unique identifier for the slice")
    attributes: JSON = strawberry.field(
        description="Attribute values defining this slice, e.g. {intent: 'research', model: 'gpt-4o'}"
    )
    size: int = strawberry.field(description="Number of traces matching this slice")
    badness_rate: float = strawberry.field(
        description="Proportion of bad traces in this slice"
    )
    baseline_rate: float = strawberry.field(
        description="Overall badness rate for comparison"
    )
    lift: float = strawberry.field(
        description="Ratio of slice badness to baseline (>1 means worse than average)"
    )
    p_value: float = strawberry.field(
        description="Statistical significance of the lift"
    )
    sample_trace_ids: Optional[list[str]] = strawberry.field(
        description="Sample trace IDs from this slice"
    )

    @strawberry.field(description="Whether this slice is statistically significant (p < 0.05)")
    def is_significant(self) -> bool:
        return self.p_value < 0.05

    @strawberry.field(description="Human-readable attribute string")
    def attribute_string(self) -> str:
        if isinstance(self.attributes, dict):
            return ", ".join(f"{k}={v}" for k, v in self.attributes.items())
        return str(self.attributes)


@strawberry.type
class TraceDiscoveryRun:
    """A discovery run analyzing traces for a project."""

    id: ID = strawberry.field(description="Unique identifier for the run")
    started_at: datetime = strawberry.field(description="When the discovery run started")
    completed_at: Optional[datetime] = strawberry.field(
        description="When the discovery run completed (null if still running)"
    )
    status: str = strawberry.field(
        description="Status of the run: 'running', 'completed', or 'failed'"
    )
    total_traces: Optional[int] = strawberry.field(
        description="Total number of traces analyzed"
    )
    baseline_badness: Optional[float] = strawberry.field(
        description="Overall badness rate across all traces"
    )
    error_message: Optional[str] = strawberry.field(
        description="Error message if the run failed"
    )
    clusters: list[TraceCluster] = strawberry.field(
        description="Discovered clusters, sorted by badness rate descending"
    )
    top_slices: list[TraceSlice] = strawberry.field(
        description="Top slices by lift, filtered for significance"
    )

    @strawberry.field(description="Number of clusters discovered")
    def num_clusters(self) -> int:
        return len(self.clusters)

    @strawberry.field(description="Number of significant slices")
    def num_significant_slices(self) -> int:
        return len([s for s in self.top_slices if s.p_value < 0.05])
