"""GraphQL mutations for trace discovery."""

import strawberry
from strawberry.relay import GlobalID
from strawberry.types import Info

from phoenix.server.api.auth import IsNotReadOnly
from phoenix.server.api.context import Context
from phoenix.server.api.helpers.discovery import (
    get_discovery_runs,
    get_latest_discovery_run,
    run_trace_discovery,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.TraceDiscovery import TraceDiscoveryRun


@strawberry.input
class RunTraceDiscoveryInput:
    project_id: GlobalID = strawberry.field(description="The project to analyze")
    days_back: int = strawberry.field(
        default=7,
        description="Number of days of trace history to analyze",
    )


@strawberry.type
class DiscoveryMutationMixin:
    @strawberry.mutation(permission_classes=[IsNotReadOnly])  # type: ignore
    async def run_trace_discovery(
        self,
        info: Info[Context, None],
        input: RunTraceDiscoveryInput,
    ) -> TraceDiscoveryRun:
        """
        Trigger a new trace discovery run for a project.

        This analyzes recent traces, clusters them by similarity,
        and identifies attribute combinations that correlate with bad outcomes.
        """
        project_id = from_global_id_with_expected_type(
            global_id=input.project_id,
            expected_type_name="Project",
        )

        async with info.context.db() as session:
            return await run_trace_discovery(
                db=session,
                project_id=project_id,
                days_back=input.days_back,
            )
