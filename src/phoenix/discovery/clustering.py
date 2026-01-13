"""Clustering traces into behavioral groups."""

import logging
from collections import Counter
from typing import Optional

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from .models import BadnessScore, ClusterResult, TraceFeatures
from .features import build_feature_matrix

logger = logging.getLogger(__name__)


def cluster_traces(
    features: list[TraceFeatures],
    badness_scores: dict[str, BadnessScore],
    method: str = "hdbscan",
    min_cluster_size: int = 10,
    n_clusters: Optional[int] = None,
) -> list[ClusterResult]:
    """
    Cluster traces based on feature similarity.

    Args:
        features: List of extracted trace features
        badness_scores: Dict of trace_id -> BadnessScore
        method: Clustering method ("hdbscan" or "kmeans")
        min_cluster_size: Minimum traces per cluster (for HDBSCAN)
        n_clusters: Number of clusters (for KMeans, auto-estimated if None)

    Returns:
        List of ClusterResult objects
    """
    if len(features) < min_cluster_size:
        logger.warning(f"Too few traces ({len(features)}) for clustering")
        return []

    # Build feature matrix
    X = build_feature_matrix(features, include_embedding=True)

    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Cluster
    if method == "hdbscan":
        labels = _cluster_hdbscan(X_scaled, min_cluster_size)
    else:
        if n_clusters is None:
            n_clusters = _estimate_k(X_scaled, max_k=min(10, len(features) // 5))
        labels = _cluster_kmeans(X_scaled, n_clusters)

    # Build cluster results
    return _build_cluster_results(features, badness_scores, labels, X_scaled)


def _cluster_hdbscan(X: np.ndarray, min_cluster_size: int) -> np.ndarray:
    """Cluster using HDBSCAN."""
    try:
        from sklearn.cluster import HDBSCAN

        clusterer = HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=5,
            metric="euclidean",
        )
        return clusterer.fit_predict(X)
    except ImportError:
        logger.warning("HDBSCAN not available, falling back to KMeans")
        k = _estimate_k(X)
        return _cluster_kmeans(X, k)


def _cluster_kmeans(X: np.ndarray, n_clusters: int) -> np.ndarray:
    """Cluster using KMeans."""
    clusterer = KMeans(
        n_clusters=n_clusters,
        random_state=42,
        n_init=10,
    )
    return clusterer.fit_predict(X)


def _estimate_k(X: np.ndarray, max_k: int = 10) -> int:
    """Estimate optimal k using elbow method."""
    if len(X) < max_k:
        return max(2, len(X) // 3)

    inertias = []
    K_range = range(2, min(max_k + 1, len(X)))

    for k in K_range:
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=5)
        kmeans.fit(X)
        inertias.append(kmeans.inertia_)

    # Find elbow using second derivative
    if len(inertias) < 3:
        return 3

    # Simple elbow detection
    diffs = np.diff(inertias)
    second_diffs = np.diff(diffs)

    if len(second_diffs) > 0:
        elbow_idx = np.argmax(second_diffs) + 2
        return min(elbow_idx, max_k)

    return max_k // 2


def _build_cluster_results(
    features: list[TraceFeatures],
    badness_scores: dict[str, BadnessScore],
    labels: np.ndarray,
    X_scaled: np.ndarray,
) -> list[ClusterResult]:
    """Build ClusterResult objects from clustering output."""
    clusters = []
    unique_labels = set(labels)

    for cluster_id in unique_labels:
        # Skip noise cluster (-1 in HDBSCAN)
        if cluster_id == -1:
            continue

        # Get traces in this cluster
        mask = labels == cluster_id
        cluster_features = [f for f, m in zip(features, mask) if m]
        cluster_trace_ids = [f.trace_id for f in cluster_features]

        if len(cluster_trace_ids) == 0:
            continue

        # Compute badness stats
        cluster_badness = [
            badness_scores[tid].score
            for tid in cluster_trace_ids
            if tid in badness_scores
        ]
        if cluster_badness:
            avg_badness = sum(cluster_badness) / len(cluster_badness)
            badness_rate = sum(1 for b in cluster_badness if b > 0.5) / len(cluster_badness)
        else:
            avg_badness = 0.5
            badness_rate = 0.0

        # Find dominant attributes
        dominant_intent = _mode([f.intent for f in cluster_features])
        dominant_route = _mode([f.route for f in cluster_features])
        dominant_model = _mode([f.model for f in cluster_features])

        # Select representative traces (closest to centroid)
        cluster_X = X_scaled[mask]
        centroid = cluster_X.mean(axis=0)
        example_traces = _select_representatives(
            cluster_features, cluster_X, centroid, n=5
        )

        clusters.append(ClusterResult(
            cluster_id=int(cluster_id),
            trace_ids=cluster_trace_ids,
            size=len(cluster_trace_ids),
            badness_rate=badness_rate,
            avg_badness=avg_badness,
            dominant_intent=dominant_intent,
            dominant_route=dominant_route,
            dominant_model=dominant_model,
            example_trace_ids=example_traces,
            centroid=centroid,
        ))

    # Sort by badness rate descending
    clusters.sort(key=lambda c: c.badness_rate, reverse=True)

    return clusters


def _select_representatives(
    features: list[TraceFeatures],
    X: np.ndarray,
    centroid: np.ndarray,
    n: int = 5,
) -> list[str]:
    """Select n traces closest to cluster centroid."""
    if len(features) <= n:
        return [f.trace_id for f in features]

    # Compute distances to centroid
    distances = np.linalg.norm(X - centroid, axis=1)
    closest_indices = np.argsort(distances)[:n]

    return [features[i].trace_id for i in closest_indices]


def _mode(values: list[str]) -> str:
    """Return most common value."""
    if not values:
        return "unknown"
    counter = Counter(values)
    return counter.most_common(1)[0][0]
