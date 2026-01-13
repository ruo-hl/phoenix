"""Discovery service for trace clustering and slice analysis."""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry import ID

from phoenix.db.models import (
    Project,
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

# Thread pool for running sync discovery in async context
_executor = ThreadPoolExecutor(max_workers=2)


def _model_to_gql_cluster(model: TraceClusterModel) -> TraceCluster:
    """Convert DB model to GraphQL type."""
    example_ids = model.example_trace_ids or []
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

    clusters_query = (
        select(TraceClusterModel)
        .where(TraceClusterModel.run_id == run.id)
        .order_by(TraceClusterModel.badness_rate.desc())
    )
    clusters_result = await db.execute(clusters_query)
    clusters = list(clusters_result.scalars().all())

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
        clusters_query = (
            select(TraceClusterModel)
            .where(TraceClusterModel.run_id == run.id)
            .order_by(TraceClusterModel.badness_rate.desc())
        )
        clusters_result = await db.execute(clusters_query)
        clusters = list(clusters_result.scalars().all())

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


def _run_discovery_sync(project_name: str, days_back: int):
    """Run discovery synchronously (called from thread pool)."""
    from phoenix.discovery import IssueDiscoveryPipeline, DiscoveryConfig

    config = DiscoveryConfig(
        min_traces=10,
        max_traces=5000,
        skip_embeddings=True,
    )
    pipeline = IssueDiscoveryPipeline(config=config)
    return pipeline.run(project_name, days_back=days_back)


async def run_trace_discovery(
    db: AsyncSession,
    project_id: int,
    days_back: int = 7,
) -> TraceDiscoveryRun:
    """
    Run trace discovery for a project.
    """
    # Create run record
    run = TraceDiscoveryRunModel(
        project_id=project_id,
        started_at=datetime.now(timezone.utc),
        status="running",
    )
    db.add(run)
    await db.flush()
    run_id = run.id

    try:
        # Get project name
        project_query = select(Project).where(Project.id == project_id)
        project_result = await db.execute(project_query)
        project = project_result.scalar_one()
        project_name = project.name

        # Run discovery in thread pool to avoid blocking async loop
        loop = asyncio.get_event_loop()
        report = await loop.run_in_executor(
            _executor,
            _run_discovery_sync,
            project_name,
            days_back,
        )

        # Store clusters
        for i, cluster in enumerate(report.clusters):
            cluster_model = TraceClusterModel(
                run_id=run_id,
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
                run_id=run_id,
                attributes=slice_result.attributes,
                size=slice_result.size,
                badness_rate=slice_result.badness_rate,
                baseline_rate=slice_result.baseline_rate,
                lift=slice_result.lift,
                p_value=slice_result.p_value,
                sample_trace_ids=[{"id": tid} for tid in slice_result.trace_ids[:10]],
            )
            db.add(slice_model)

        # Update run
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        run.total_traces = report.total_traces
        run.baseline_badness = report.baseline_badness

        await db.commit()
        return await get_latest_discovery_run(db, project_id)  # type: ignore

    except Exception as e:
        logger.error(f"Discovery failed: {e}")
        run.status = "failed"
        run.completed_at = datetime.now(timezone.utc)
        run.error_message = str(e)
        await db.commit()
        return _model_to_gql_run(run, [], [])
