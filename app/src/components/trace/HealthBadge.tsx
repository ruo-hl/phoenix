import { css } from "@emotion/react";

import { Flex, Text, Tooltip, TooltipTrigger } from "@phoenix/components";
import {
  getHealthColor,
  getHealthStatus,
  HealthStatus,
} from "@phoenix/hooks/useWorkflowHealth";

export interface HealthBadgeProps {
  /**
   * Health score between 0 and 1
   */
  score: number;
  /**
   * Size variant
   */
  size?: "S" | "M" | "L";
  /**
   * Whether to show the percentage value
   */
  showValue?: boolean;
}

const sizeStyles = {
  S: { fontSize: "12px", padding: "2px 6px", minWidth: "36px" },
  M: { fontSize: "14px", padding: "4px 8px", minWidth: "44px" },
  L: { fontSize: "16px", padding: "6px 10px", minWidth: "52px" },
};

const statusLabels: Record<HealthStatus, string> = {
  healthy: "Healthy workflow",
  warning: "Workflow issues detected",
  critical: "Critical workflow problems",
};

/**
 * Badge component that displays a workflow health score with color coding.
 *
 * - Green (80-100%): Healthy
 * - Yellow (50-79%): Warning
 * - Red (0-49%): Critical
 */
export function HealthBadge({
  score,
  size = "M",
  showValue = true,
}: HealthBadgeProps) {
  const status = getHealthStatus(score);
  const color = getHealthColor(status);
  const percentage = Math.round(score * 100);
  const styles = sizeStyles[size];

  return (
    <TooltipTrigger delay={300}>
      <div
        css={css`
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background-color: ${color}20;
          border: 1px solid ${color};
          border-radius: 4px;
          padding: ${styles.padding};
          min-width: ${styles.minWidth};
          cursor: default;
        `}
      >
        <Flex direction="row" gap="size-50" alignItems="center">
          <div
            css={css`
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background-color: ${color};
            `}
          />
          {showValue && (
            <Text
              size={size === "S" ? "XS" : size === "M" ? "S" : "M"}
              color={color}
              weight="heavy"
            >
              {percentage}%
            </Text>
          )}
        </Flex>
      </div>
      <Tooltip placement="top">
        {statusLabels[status]} ({percentage}%)
      </Tooltip>
    </TooltipTrigger>
  );
}

/**
 * Simplified health indicator dot without percentage.
 */
export function HealthIndicator({ score }: { score: number }) {
  const status = getHealthStatus(score);
  const color = getHealthColor(status);

  return (
    <TooltipTrigger delay={300}>
      <div
        css={css`
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: ${color};
          cursor: default;
        `}
      />
      <Tooltip placement="top">
        {statusLabels[status]} ({Math.round(score * 100)}%)
      </Tooltip>
    </TooltipTrigger>
  );
}
