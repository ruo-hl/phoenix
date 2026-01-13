"""add trace discovery tables

Revision ID: f1a2b3c4d5e6
Revises: 8a3764fe7f1a
Create Date: 2025-01-13 12:00:00.000000

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "8a3764fe7f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Discovery runs table
    op.create_table(
        "trace_discovery_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "started_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "completed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="running",
        ),
        sa.Column("config", JSON_, nullable=True),
        sa.Column("summary", JSON_, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("total_traces", sa.Integer, nullable=True),
        sa.Column("baseline_badness", sa.Float, nullable=True),
    )
    op.create_index(
        "ix_trace_discovery_runs_project_completed",
        "trace_discovery_runs",
        ["project_id", "completed_at"],
    )

    # Clusters table
    op.create_table(
        "trace_clusters",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "run_id",
            sa.Integer,
            sa.ForeignKey("trace_discovery_runs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("cluster_index", sa.Integer, nullable=False),
        sa.Column("size", sa.Integer, nullable=False),
        sa.Column("badness_rate", sa.Float, nullable=False),
        sa.Column("avg_badness", sa.Float, nullable=False),
        sa.Column("dominant_intent", sa.String(100), nullable=True),
        sa.Column("dominant_route", sa.String(255), nullable=True),
        sa.Column("dominant_model", sa.String(100), nullable=True),
        sa.Column("example_trace_ids", JSON_, nullable=True),
        sa.UniqueConstraint("run_id", "cluster_index", name="uq_trace_clusters_run_index"),
    )

    # Slices table
    op.create_table(
        "trace_slices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "run_id",
            sa.Integer,
            sa.ForeignKey("trace_discovery_runs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("attributes", JSON_, nullable=False),
        sa.Column("size", sa.Integer, nullable=False),
        sa.Column("badness_rate", sa.Float, nullable=False),
        sa.Column("baseline_rate", sa.Float, nullable=False),
        sa.Column("lift", sa.Float, nullable=False),
        sa.Column("p_value", sa.Float, nullable=False),
        sa.Column("sample_trace_ids", JSON_, nullable=True),
    )
    op.create_index(
        "ix_trace_slices_run_lift",
        "trace_slices",
        ["run_id", "lift"],
    )


def downgrade() -> None:
    op.drop_index("ix_trace_slices_run_lift")
    op.drop_table("trace_slices")
    op.drop_table("trace_clusters")
    op.drop_index("ix_trace_discovery_runs_project_completed")
    op.drop_table("trace_discovery_runs")
