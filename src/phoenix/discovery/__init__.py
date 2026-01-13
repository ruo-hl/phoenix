"""
Unsupervised Issue Discovery for AI Agents.

This module provides automated discovery of failure patterns in agent traces
through clustering and slice analysis.

Basic usage:
    from obs.discovery import run_discovery

    # Analyze last 7 days of traces
    report = run_discovery("my-project", days_back=7)

    print(f"Found {len(report.clusters)} clusters")
    print(f"Worst slice: {report.worst_slice.attribute_str} (lift={report.worst_slice.lift:.2f}x)")

    # Get summary
    print(report.summary())

Advanced usage:
    from obs.discovery import IssueDiscoveryPipeline, DiscoveryConfig

    config = DiscoveryConfig(
        cluster_method="kmeans",
        n_clusters=5,
        min_slice_size=20,
    )

    pipeline = IssueDiscoveryPipeline(config=config)
    report = pipeline.run("my-project", days_back=30)

    # Inspect clusters
    for cluster in report.clusters[:5]:
        print(f"Cluster {cluster.cluster_id}: {cluster.badness_rate:.1%} bad ({cluster.size} traces)")

    # Inspect slices
    for slice in report.top_slices[:5]:
        print(f"{slice.attribute_str}: {slice.lift:.2f}x lift (p={slice.p_value:.3f})")
"""

from .models import (
    BadnessScore,
    ClusterResult,
    DiscoveryReport,
    Slice,
    TraceFeatures,
)
from .pipeline import (
    DiscoveryConfig,
    InsufficientDataError,
    IssueDiscoveryPipeline,
    run_discovery,
)
from .badness import BadnessWeights

__all__ = [
    # Main API
    "run_discovery",
    "IssueDiscoveryPipeline",
    "DiscoveryConfig",
    # Models
    "DiscoveryReport",
    "ClusterResult",
    "Slice",
    "TraceFeatures",
    "BadnessScore",
    "BadnessWeights",
    # Exceptions
    "InsufficientDataError",
]
