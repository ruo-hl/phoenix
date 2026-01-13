"""Discovery pipeline orchestration."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd

from .badness import BadnessWeights, compute_badness_batch
from .clustering import cluster_traces
from .features import (
    add_embeddings,
    extract_features_from_spans,
    get_unique_trace_ids,
)
from .models import DiscoveryReport
from .slicing import rank_slices

logger = logging.getLogger(__name__)


class InsufficientDataError(Exception):
    """Raised when there's not enough data for analysis."""

    pass


@dataclass
class DiscoveryConfig:
    """Configuration for discovery pipeline."""

    # Clustering
    cluster_method: str = "hdbscan"
    min_cluster_size: int = 10
    n_clusters: Optional[int] = None

    # Slicing
    slice_attributes: list[str] = field(
        default_factory=lambda: ["intent", "route", "model", "prompt_version"]
    )
    min_slice_size: int = 10
    max_slice_depth: int = 2
    significance_threshold: float = 0.05

    # Badness weights
    badness_weights: BadnessWeights = field(default_factory=BadnessWeights)

    # Embedding
    embedding_model: str = "text-embedding-3-small"
    skip_embeddings: bool = False  # Set True to skip embeddings if no API key

    # Pipeline
    min_traces: int = 50
    max_traces: int = 10000


class IssueDiscoveryPipeline:
    """
    Pipeline for unsupervised issue discovery.

    Fetches traces from Phoenix, extracts features, clusters them,
    and identifies problematic slices.
    """

    def __init__(
        self,
        config: Optional[DiscoveryConfig] = None,
    ):
        self.config = config or DiscoveryConfig()
        self._phoenix_client = None

    @property
    def phoenix_client(self):
        """Lazy-load Phoenix client."""
        if self._phoenix_client is None:
            from phoenix.client import Client as PhoenixClient

            self._phoenix_client = PhoenixClient()
        return self._phoenix_client

    def run(
        self,
        project: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        days_back: int = 7,
    ) -> DiscoveryReport:
        """
        Run the full discovery pipeline.

        Args:
            project: Phoenix project name
            start_time: Start of time range (default: days_back ago)
            end_time: End of time range (default: now)
            days_back: Days to look back if start_time not specified

        Returns:
            DiscoveryReport with clusters and slices
        """
        # Set time range
        if end_time is None:
            end_time = datetime.now(timezone.utc)
        if start_time is None:
            start_time = end_time - timedelta(days=days_back)

        logger.info(f"Running discovery for {project} from {start_time} to {end_time}")

        # 1. Fetch spans from Phoenix
        spans_df = self._fetch_spans(project)

        if len(spans_df) == 0:
            raise InsufficientDataError(f"No spans found for project {project}")

        # 2. Get unique trace IDs
        trace_ids = get_unique_trace_ids(spans_df)
        logger.info(f"Found {len(trace_ids)} unique traces")

        if len(trace_ids) < self.config.min_traces:
            raise InsufficientDataError(
                f"Need at least {self.config.min_traces} traces, found {len(trace_ids)}"
            )

        # Limit traces
        if len(trace_ids) > self.config.max_traces:
            trace_ids = trace_ids[: self.config.max_traces]

        # 3. Fetch annotations (eval results)
        annotations_df = self._fetch_annotations(project)

        # 4. Extract features for each trace
        logger.info("Extracting features...")
        features = []
        for trace_id in trace_ids:
            f = extract_features_from_spans(spans_df, trace_id, annotations_df)
            if f is not None:
                features.append(f)

        logger.info(f"Extracted features for {len(features)} traces")

        if len(features) < self.config.min_traces:
            raise InsufficientDataError(
                f"Need at least {self.config.min_traces} valid features, got {len(features)}"
            )

        # 5. Add embeddings (optional - requires OpenAI API key)
        if not self.config.skip_embeddings:
            try:
                import os
                if os.environ.get("OPENAI_API_KEY"):
                    logger.info("Computing embeddings...")
                    add_embeddings(features, embedding_model=self.config.embedding_model)
                else:
                    logger.warning("OPENAI_API_KEY not set, skipping embeddings")
            except Exception as e:
                logger.warning(f"Failed to compute embeddings: {e}, continuing without them")
        else:
            logger.info("Skipping embeddings (disabled in config)")

        # 6. Compute badness scores
        logger.info("Computing badness scores...")
        badness_scores = compute_badness_batch(features, weights=self.config.badness_weights)

        # 7. Cluster traces
        logger.info("Clustering traces...")
        clusters = cluster_traces(
            features,
            badness_scores,
            method=self.config.cluster_method,
            min_cluster_size=self.config.min_cluster_size,
            n_clusters=self.config.n_clusters,
        )
        logger.info(f"Found {len(clusters)} clusters")

        # 8. Rank slices
        logger.info("Ranking slices...")
        slices = rank_slices(
            features,
            badness_scores,
            slice_attributes=self.config.slice_attributes,
            min_slice_size=self.config.min_slice_size,
            max_slice_depth=self.config.max_slice_depth,
            significance_threshold=self.config.significance_threshold,
        )
        logger.info(f"Found {len(slices)} slices")

        # 9. Build report
        baseline_badness = sum(bs.score for bs in badness_scores.values()) / len(badness_scores)
        num_bad = sum(1 for bs in badness_scores.values() if bs.is_bad)

        report = DiscoveryReport(
            project=project,
            time_range=(start_time, end_time),
            total_traces=len(features),
            baseline_badness=baseline_badness,
            clusters=clusters,
            top_slices=slices[:20],
            num_bad_traces=num_bad,
        )

        logger.info(f"Discovery complete: {report.num_clusters} clusters, {report.num_significant_slices} significant slices")

        return report

    def _fetch_spans(self, project: str) -> pd.DataFrame:
        """Fetch spans from Phoenix."""
        try:
            return self.phoenix_client.spans.get_spans_dataframe(
                project_name=project,
                limit=self.config.max_traces * 10,  # Fetch more spans than traces
            )
        except Exception as e:
            logger.error(f"Failed to fetch spans: {e}")
            return pd.DataFrame()

    def _fetch_annotations(self, project: str) -> Optional[pd.DataFrame]:
        """Fetch annotations (eval results) from Phoenix."""
        try:
            return self.phoenix_client.spans.get_span_annotations_dataframe(
                project_name=project,
            )
        except Exception as e:
            logger.warning(f"Failed to fetch annotations: {e}")
            return None


def run_discovery(
    project: str,
    days_back: int = 7,
    config: Optional[DiscoveryConfig] = None,
) -> DiscoveryReport:
    """
    Convenience function to run discovery pipeline.

    Args:
        project: Phoenix project name
        days_back: Number of days to analyze
        config: Optional pipeline configuration

    Returns:
        DiscoveryReport with clusters and top slices
    """
    pipeline = IssueDiscoveryPipeline(config=config)
    return pipeline.run(project, days_back=days_back)
