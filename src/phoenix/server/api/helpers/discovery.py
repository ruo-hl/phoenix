"""Discovery service for trace clustering and slice analysis."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import ID

from phoenix.db.models import (
    Project,
    Span,
    Trace,
    TraceCluster as TraceClusterModel,
    TraceDiscoveryRun as TraceDiscoveryRunModel,
    TraceSlice as TraceSliceModel,
)
from phoenix.server.api.types.TraceDiscovery import (
    TraceCluster,
    TraceDiscoveryRun,
    TraceSlice,
)

logger = logging.getLogger(__name__)


def _model_to_gql_cluster(model: TraceClusterModel) -> TraceCluster:
    """Convert DB model to GraphQL type."""
    example_ids = model.example_trace_ids or []
    # Handle both list of strings and list of dicts
    if example_ids and isinstance(example_ids[0], dict):
        example_ids = [e.get("id", str(e)) for e in example_ids]
    return TraceCluster(
        id=ID(str(model.id)),
        cluster_index=model.cluster_index,
        size=model.size,
        badness_rate=model.badness_rate,
        avg_badness=model.avg_badness,
        dominant_intent=model.dominant_intent,
        dominant_route=model.dominant_route,
        dominant_model=model.dominant_model,
        example_trace_ids=[str(e) for e in example_ids],
    )


def _model_to_gql_slice(model: TraceSliceModel) -> TraceSlice:
    """Convert DB model to GraphQL type."""
    sample_ids = model.sample_trace_ids or []
    if sample_ids and isinstance(sample_ids[0], dict):
        sample_ids = [e.get("id", str(e)) for e in sample_ids]
    return TraceSlice(
        id=ID(str(model.id)),
        attributes=model.attributes,
        size=model.size,
        badness_rate=model.badness_rate,
        baseline_rate=model.baseline_rate,
        lift=model.lift,
        p_value=model.p_value,
        sample_trace_ids=[str(e) for e in sample_ids] if sample_ids else None,
    )


def _model_to_gql_run(
    model: TraceDiscoveryRunModel,
    clusters: list[TraceClusterModel],
    slices: list[TraceSliceModel],
) -> TraceDiscoveryRun:
    """Convert DB model to GraphQL type."""
    return TraceDiscoveryRun(
        id=ID(str(model.id)),
        started_at=model.started_at,
        completed_at=model.completed_at,
        status=model.status,
        total_traces=model.total_traces,
        baseline_badness=model.baseline_badness,
        error_message=model.error_message,
        clusters=[_model_to_gql_cluster(c) for c in clusters],
        top_slices=[_model_to_gql_slice(s) for s in slices],
    )


async def get_latest_discovery_run(
    db: AsyncSession,
    project_id: int,
) -> Optional[TraceDiscoveryRun]:
    """Get the most recent completed discovery run for a project."""
    # Get latest completed run
    run_query = (
        select(TraceDiscoveryRunModel)
        .where(TraceDiscoveryRunModel.project_id == project_id)
        .where(TraceDiscoveryRunModel.status == "completed")
        .order_by(TraceDiscoveryRunModel.completed_at.desc())
        .limit(1)
    )
    result = await db.execute(run_query)
    run = result.scalar_one_or_none()

    if run is None:
        return None

    # Get clusters for this run
    clusters_query = (
        select(TraceClusterModel)
        .where(TraceClusterModel.run_id == run.id)
        .order_by(TraceClusterModel.badness_rate.desc())
    )
    clusters_result = await db.execute(clusters_query)
    clusters = list(clusters_result.scalars().all())

    # Get slices for this run
    slices_query = (
        select(TraceSliceModel)
        .where(TraceSliceModel.run_id == run.id)
        .order_by(TraceSliceModel.lift.desc())
        .limit(20)
    )
    slices_result = await db.execute(slices_query)
    slices = list(slices_result.scalars().all())

    return _model_to_gql_run(run, clusters, slices)


async def get_discovery_runs(
    db: AsyncSession,
    project_id: int,
    limit: int = 10,
) -> list[TraceDiscoveryRun]:
    """Get recent discovery runs for a project."""
    runs_query = (
        select(TraceDiscoveryRunModel)
        .where(TraceDiscoveryRunModel.project_id == project_id)
        .order_by(TraceDiscoveryRunModel.started_at.desc())
        .limit(limit)
    )
    result = await db.execute(runs_query)
    runs = list(result.scalars().all())

    gql_runs = []
    for run in runs:
        # Get clusters
        clusters_query = (
            select(TraceClusterModel)
            .where(TraceClusterModel.run_id == run.id)
            .order_by(TraceClusterModel.badness_rate.desc())
        )
        clusters_result = await db.execute(clusters_query)
        clusters = list(clusters_result.scalars().all())

        # Get slices
        slices_query = (
            select(TraceSliceModel)
            .where(TraceSliceModel.run_id == run.id)
            .order_by(TraceSliceModel.lift.desc())
            .limit(20)
        )
        slices_result = await db.execute(slices_query)
        slices = list(slices_result.scalars().all())

        gql_runs.append(_model_to_gql_run(run, clusters, slices))

    return gql_runs


async def run_trace_discovery(
    db: AsyncSession,
    project_id: int,
    days_back: int = 7,
) -> TraceDiscoveryRun:
    """
    Run trace discovery for a project.

    This fetches traces, runs clustering and slice analysis,
    and stores results in the database.
    """
    # Create run record
    run = TraceDiscoveryRunModel(
        project_id=project_id,
        started_at=datetime.now(timezone.utc),
        status="running",
    )
    db.add(run)
    await db.flush()

    try:
        # Get project name for Phoenix client
        project_query = select(Project).where(Project.id == project_id)
        project_result = await db.execute(project_query)
        project = project_result.scalar_one()

        # Import discovery module (from obs package)
        # This assumes obs is installed in the environment
        try:
            from obs.discovery import IssueDiscoveryPipeline, DiscoveryConfig
            from obs.discovery.models import ClusterResult, Slice

            config = DiscoveryConfig(
                min_traces=20,  # Lower threshold for testing
                max_traces=5000,
            )
            pipeline = IssueDiscoveryPipeline(config=config)
            report = pipeline.run(project.name, days_back=days_back)

            # Store clusters
            for i, cluster in enumerate(report.clusters):
                cluster_model = TraceClusterModel(
                    run_id=run.id,
                    cluster_index=i,
                    size=cluster.size,
                    badness_rate=cluster.badness_rate,
                    avg_badness=cluster.avg_badness,
                    dominant_intent=cluster.dominant_intent,
                    dominant_route=cluster.dominant_route,
                    dominant_model=cluster.dominant_model,
                    example_trace_ids=[{"id": tid} for tid in cluster.example_trace_ids],
                )
                db.add(cluster_model)

            # Store slices
            for slice_result in report.top_slices[:20]:
                slice_model = TraceSliceModel(
                    run_id=run.id,
                    attributes=slice_result.attributes,
                    size=slice_result.size,
                    badness_rate=slice_result.badness_rate,
                    baseline_rate=slice_result.baseline_rate,
                    lift=slice_result.lift,
                    p_value=slice_result.p_value,
                    sample_trace_ids=[{"id": tid} for tid in slice_result.trace_ids[:10]],
                )
                db.add(slice_model)

            # Update run with summary
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            run.total_traces = report.total_traces
            run.baseline_badness = report.baseline_badness

        except ImportError as e:
            logger.warning(f"obs.discovery not available: {e}")
            # Fallback: create mock data for testing
            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            run.total_traces = 0
            run.baseline_badness = 0.0
            run.error_message = "Discovery module not installed"

        await db.commit()

        # Fetch and return the completed run
        return await get_latest_discovery_run(db, project_id)  # type: ignore

    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        run.status = "failed"
        run.completed_at = datetime.now(timezone.utc)
        run.error_message = str(e)
        await db.commit()

        # Return the failed run
        return _model_to_gql_run(run, [], [])
