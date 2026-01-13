import { useState } from "react";
import { css } from "@emotion/react";

import { Alert } from "@phoenix/components/alert";
import { Button, Flex, Text, View } from "@phoenix/components";
import {
  Anomaly,
  getHealthStatus,
  WorkflowAnalysis,
} from "@phoenix/hooks/useWorkflowHealth";

import { HealthBadge } from "./HealthBadge";

export interface AnomalyBannerProps {
  /**
   * Workflow analysis data
   */
  analysis: WorkflowAnalysis;
  /**
   * Callback when "View Workflow" button is clicked
   */
  onViewWorkflow?: () => void;
  /**
   * Whether the banner can be dismissed
   */
  dismissable?: boolean;
}

const severityOrder: Record<Anomaly["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const severityColors: Record<Anomaly["severity"], string> = {
  critical: "var(--ac-global-color-danger)",
  high: "var(--ac-global-color-danger)",
  medium: "var(--ac-global-color-warning)",
  low: "var(--ac-global-color-grey-500)",
};

/**
 * Banner component that displays workflow anomalies when health score is below threshold.
 * Only shown when health_score < 0.8 (not healthy).
 */
export function AnomalyBanner({
  analysis,
  onViewWorkflow,
  dismissable = true,
}: AnomalyBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const status = getHealthStatus(analysis.health_score);

  // Don't show banner for healthy workflows or if dismissed
  if (status === "healthy" || isDismissed) {
    return null;
  }

  // Sort anomalies by severity
  const sortedAnomalies = [...analysis.anomalies].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const variant = status === "critical" ? "danger" : "warning";

  return (
    <Alert
      variant={variant}
      title={
        <Flex direction="row" gap="size-100" alignItems="center">
          <span>Workflow Issues Detected</span>
          <HealthBadge score={analysis.health_score} size="S" />
        </Flex>
      }
      dismissable={dismissable}
      onDismissClick={() => setIsDismissed(true)}
      extra={
        onViewWorkflow && (
          <Button
            variant="default"
            size="S"
            onPress={onViewWorkflow}
            css={css`
              margin-left: auto;
            `}
          >
            View Workflow
          </Button>
        )
      }
    >
      <View paddingTop="size-50">
        <ul
          css={css`
            margin: 0;
            padding-left: var(--ac-global-dimension-size-200);
            list-style: disc;
          `}
        >
          {sortedAnomalies.slice(0, 3).map((anomaly, index) => (
            <li key={index}>
              <Flex direction="row" gap="size-50" alignItems="baseline">
                <Text size="S" color="inherit">
                  {anomaly.description}
                </Text>
                <SeverityTag severity={anomaly.severity} />
              </Flex>
            </li>
          ))}
          {sortedAnomalies.length > 3 && (
            <li>
              <Text size="S" color="inherit">
                +{sortedAnomalies.length - 3} more issues
              </Text>
            </li>
          )}
        </ul>
      </View>
    </Alert>
  );
}

function SeverityTag({ severity }: { severity: Anomaly["severity"] }) {
  const color = severityColors[severity];

  return (
    <span
      css={css`
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 3px;
        background-color: ${color}20;
        color: ${color};
        text-transform: uppercase;
        font-weight: 600;
      `}
    >
      {severity}
    </span>
  );
}

/**
 * Compact anomaly indicator for use in table cells.
 * Shows an icon and count of anomalies.
 */
export function AnomalyIndicator({
  anomalyCount,
  healthScore,
}: {
  anomalyCount: number;
  healthScore: number;
}) {
  if (anomalyCount === 0) {
    return null;
  }

  const status = getHealthStatus(healthScore);
  const color =
    status === "critical"
      ? "var(--ac-global-color-danger)"
      : "var(--ac-global-color-warning)";

  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <span
        css={css`
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 8px;
          background-color: ${color}20;
          color: ${color};
          font-weight: 600;
        `}
      >
        {anomalyCount} {anomalyCount === 1 ? "issue" : "issues"}
      </span>
    </Flex>
  );
}
