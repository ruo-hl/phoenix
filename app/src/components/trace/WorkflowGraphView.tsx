import { useMemo, useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  Flex,
  Heading,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/dialog";
import {
  Anomaly,
  GraphEdge,
  GraphNode,
  WorkflowAnalysis,
} from "@phoenix/hooks/useWorkflowHealth";

import { AnomalyIndicator } from "./AnomalyBanner";
import { HealthBadge } from "./HealthBadge";

export interface WorkflowGraphViewProps {
  analysis: WorkflowAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

const nodeTypeColors: Record<string, string> = {
  plan: "#22c55e", // green
  reason: "#3b82f6", // blue
  decision: "#8b5cf6", // purple
  tool_call: "#f97316", // orange
  tool_result: "#eab308", // yellow
  action: "#ef4444", // red
  verify: "#06b6d4", // cyan
  evaluate: "#6b7280", // gray
  unknown: "#9ca3af", // light gray
};

const nodeTypeLabels: Record<string, string> = {
  plan: "Plan",
  reason: "Reason",
  decision: "Decision",
  tool_call: "Tool Call",
  tool_result: "Tool Result",
  action: "Action",
  verify: "Verify",
  evaluate: "Evaluate",
  unknown: "Unknown",
};

/**
 * Modal view that displays the workflow DAG visualization.
 */
export function WorkflowGraphView({
  analysis,
  isOpen,
  onClose,
}: WorkflowGraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const graph = analysis.graph;

  if (!graph) {
    return null;
  }

  // Build node positions using a simple layered layout
  const { nodePositions, canvasHeight } = useMemo(() => {
    if (!graph) return { nodePositions: new Map(), canvasHeight: 400 };

    const positions = new Map<string, { x: number; y: number }>();
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    // Build adjacency for topological sort
    const children = new Map<string, string[]>();
    const parents = new Map<string, string[]>();

    for (const edge of graph.edges) {
      if (!children.has(edge.source)) children.set(edge.source, []);
      children.get(edge.source)!.push(edge.target);
      if (!parents.has(edge.target)) parents.set(edge.target, []);
      parents.get(edge.target)!.push(edge.source);
    }

    // Find roots (nodes with no parents)
    const roots = graph.nodes.filter(
      (n) => !parents.has(n.id) || parents.get(n.id)!.length === 0
    );

    // BFS to assign layers
    const layers = new Map<string, number>();
    const queue = roots.map((r) => ({ id: r.id, layer: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, layer } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      layers.set(id, Math.max(layers.get(id) ?? 0, layer));

      const childIds = children.get(id) ?? [];
      for (const childId of childIds) {
        queue.push({ id: childId, layer: layer + 1 });
      }
    }

    // Group nodes by layer
    const layerGroups = new Map<number, string[]>();
    for (const [id, layer] of layers) {
      if (!layerGroups.has(layer)) layerGroups.set(layer, []);
      layerGroups.get(layer)!.push(id);
    }

    // Calculate positions
    const nodeWidth = 160;
    const nodeHeight = 60;
    const horizontalGap = 40;
    const verticalGap = 80;
    const padding = 40;

    let maxY = 0;

    for (const [layer, nodeIds] of layerGroups) {
      const y = padding + layer * (nodeHeight + verticalGap);
      const totalWidth =
        nodeIds.length * nodeWidth + (nodeIds.length - 1) * horizontalGap;
      const startX = padding + (600 - totalWidth) / 2;

      nodeIds.forEach((id, index) => {
        const x = startX + index * (nodeWidth + horizontalGap);
        positions.set(id, { x, y });
        maxY = Math.max(maxY, y + nodeHeight);
      });
    }

    return {
      nodePositions: positions,
      canvasHeight: maxY + padding,
    };
  }, [graph]);

  // Get anomalies affecting a specific node
  const getNodeAnomalies = (nodeId: string): Anomaly[] => {
    return analysis.anomalies.filter((a) => a.affected_spans.includes(nodeId));
  };

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal size="L">
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" alignItems="center">
                  <DialogTitle>Workflow Analysis</DialogTitle>
                  <HealthBadge score={analysis.health_score} size="S" />
                  <AnomalyIndicator
                    anomalyCount={analysis.anomaly_count}
                    healthScore={analysis.health_score}
                  />
                </Flex>
                <DialogCloseButton close={close} />
              </DialogHeader>

              <Flex
                direction="row"
                gap="size-200"
                css={css`
                  height: 500px;
                  overflow: hidden;
                `}
              >
                {/* Graph canvas */}
                <View
                  flex="1 1 auto"
                  overflow="auto"
                  backgroundColor="grey-100"
                  borderRadius="medium"
                >
                  <svg
                    width="100%"
                    height={canvasHeight}
                    css={css`
                      min-width: 600px;
                    `}
                  >
                    {/* Draw edges */}
                    {graph.edges.map((edge, index) => {
                      const source = nodePositions.get(edge.source);
                      const target = nodePositions.get(edge.target);
                      if (!source || !target) return null;

                      const x1 = source.x + 80;
                      const y1 = source.y + 60;
                      const x2 = target.x + 80;
                      const y2 = target.y;

                      const isRetry = edge.type === "retry";

                      return (
                        <g key={index}>
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={
                              isRetry
                                ? "var(--ac-global-color-warning)"
                                : "var(--ac-global-color-grey-400)"
                            }
                            strokeWidth={isRetry ? 2 : 1}
                            strokeDasharray={isRetry ? "5,5" : undefined}
                            markerEnd="url(#arrowhead)"
                          />
                        </g>
                      );
                    })}

                    {/* Arrow marker */}
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="7"
                        refX="9"
                        refY="3.5"
                        orient="auto"
                      >
                        <polygon
                          points="0 0, 10 3.5, 0 7"
                          fill="var(--ac-global-color-grey-400)"
                        />
                      </marker>
                    </defs>

                    {/* Draw nodes */}
                    {graph.nodes.map((node) => {
                      const pos = nodePositions.get(node.id);
                      if (!pos) return null;

                      const color =
                        nodeTypeColors[node.type] || nodeTypeColors.unknown;
                      const anomalies = getNodeAnomalies(node.id);
                      const hasAnomalies = anomalies.length > 0;
                      const isSelected = selectedNode?.id === node.id;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${pos.x}, ${pos.y})`}
                          onClick={() => setSelectedNode(node)}
                          css={css`
                            cursor: pointer;
                          `}
                        >
                          <rect
                            width={160}
                            height={60}
                            rx={6}
                            fill="var(--ac-global-background-color-dark)"
                            stroke={isSelected ? color : `${color}80`}
                            strokeWidth={isSelected ? 3 : 2}
                            css={
                              hasAnomalies
                                ? css`
                                    stroke-dasharray: 4 2;
                                    animation: pulse 1.5s infinite;
                                    @keyframes pulse {
                                      0%,
                                      100% {
                                        stroke-opacity: 1;
                                      }
                                      50% {
                                        stroke-opacity: 0.5;
                                      }
                                    }
                                  `
                                : undefined
                            }
                          />
                          {/* Type indicator */}
                          <rect
                            width={6}
                            height={60}
                            rx={3}
                            fill={color}
                          />
                          {/* Node label */}
                          <text
                            x={80}
                            y={25}
                            textAnchor="middle"
                            fill="var(--ac-global-text-color-900)"
                            fontSize={11}
                            fontWeight={600}
                          >
                            {nodeTypeLabels[node.type] || node.type}
                          </text>
                          <text
                            x={80}
                            y={42}
                            textAnchor="middle"
                            fill="var(--ac-global-text-color-700)"
                            fontSize={10}
                          >
                            {node.name.length > 18
                              ? node.name.slice(0, 15) + "..."
                              : node.name}
                          </text>
                          {/* Anomaly indicator */}
                          {hasAnomalies && (
                            <circle
                              cx={150}
                              cy={10}
                              r={8}
                              fill="var(--ac-global-color-danger)"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </View>

                {/* Details panel */}
                <View
                  width="size-3000"
                  padding="size-200"
                  backgroundColor="grey-50"
                  borderRadius="medium"
                  overflow="auto"
                >
                  {selectedNode ? (
                    <NodeDetails
                      node={selectedNode}
                      anomalies={getNodeAnomalies(selectedNode.id)}
                    />
                  ) : (
                    <AnomalySummary anomalies={analysis.anomalies} />
                  )}
                </View>
              </Flex>

              {/* Sequence view */}
              <View paddingTop="size-200">
                <SequenceView nodes={graph.nodes} edges={graph.edges} />
              </View>
            </DialogContent>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function NodeDetails({
  node,
  anomalies,
}: {
  node: GraphNode;
  anomalies: Anomaly[];
}) {
  const color = nodeTypeColors[node.type] || nodeTypeColors.unknown;

  return (
    <Flex direction="column" gap="size-100">
      <Flex direction="row" gap="size-100" alignItems="center">
        <div
          css={css`
            width: 12px;
            height: 12px;
            border-radius: 3px;
            background-color: ${color};
          `}
        />
        <Heading level={4}>{nodeTypeLabels[node.type] || node.type}</Heading>
      </Flex>

      <Text size="S" color="text-700">
        {node.name}
      </Text>

      <Text size="XS" color="text-500">
        Status: {node.status}
      </Text>

      {anomalies.length > 0 && (
        <View paddingTop="size-100">
          <Text size="S" weight="heavy" color="danger">
            Issues Detected
          </Text>
          <ul
            css={css`
              margin: 0;
              padding-left: var(--ac-global-dimension-size-200);
              font-size: 12px;
            `}
          >
            {anomalies.map((a, i) => (
              <li key={i}>
                <Text size="XS">{a.description}</Text>
              </li>
            ))}
          </ul>
        </View>
      )}
    </Flex>
  );
}

function AnomalySummary({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) {
    return (
      <Flex
        direction="column"
        gap="size-100"
        alignItems="center"
        justifyContent="center"
        height="100%"
      >
        <Icon svg={<Icons.CheckCircleOutline />} color="success" />
        <Text size="S" color="text-700">
          No workflow issues detected
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={4}>Anomalies</Heading>
      <ul
        css={css`
          margin: 0;
          padding-left: var(--ac-global-dimension-size-200);
        `}
      >
        {anomalies.map((a, i) => (
          <li key={i}>
            <Text size="S" weight="heavy">
              {a.detector}
            </Text>
            <Text size="XS" color="text-700">
              {a.description}
            </Text>
          </li>
        ))}
      </ul>
    </Flex>
  );
}

function SequenceView({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  // Sort nodes by start_time to show sequence
  const sortedNodes = [...nodes].sort((a, b) => a.start_time - b.start_time);

  return (
    <View
      padding="size-100"
      backgroundColor="grey-100"
      borderRadius="small"
      overflow="auto"
    >
      <Flex direction="row" gap="size-50" wrap="wrap" alignItems="center">
        <Text size="XS" color="text-500">
          Sequence:
        </Text>
        {sortedNodes.map((node, index) => {
          const color = nodeTypeColors[node.type] || nodeTypeColors.unknown;
          return (
            <Flex key={node.id} direction="row" gap="size-50" alignItems="center">
              <span
                css={css`
                  font-size: 11px;
                  padding: 2px 6px;
                  border-radius: 4px;
                  background-color: ${color}20;
                  border: 1px solid ${color};
                  color: ${color};
                `}
              >
                {nodeTypeLabels[node.type] || node.type}
              </span>
              {index < sortedNodes.length - 1 && (
                <Icon
                  svg={<Icons.ArrowForwardOutline />}
                  color="grey-500"
                  css={css`
                    font-size: 12px;
                  `}
                />
              )}
            </Flex>
          );
        })}
      </Flex>
    </View>
  );
}
