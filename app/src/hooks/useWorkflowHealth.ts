import { useCallback, useEffect, useState } from "react";

/**
 * OBS Agent API URL - defaults to localhost:8080
 */
const OBS_AGENT_URL =
  import.meta.env.VITE_OBS_AGENT_URL || "http://localhost:8080";

export interface TraceHealth {
  trace_id: string;
  health_score: number;
}

export interface Anomaly {
  detector: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  evidence: Record<string, unknown>;
  affected_spans?: string[];
}

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  status: string;
  start_time: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "parent_child" | "temporal" | "retry";
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface WorkflowAnalysis {
  trace_id: string;
  health_score: number;
  anomaly_count: number;
  anomalies: Anomaly[];
  graph_stats: {
    node_count: number;
    edge_count: number;
    max_depth: number;
    tool_calls: number;
    has_verification: boolean;
  };
  graph?: WorkflowGraph;
}

export interface HealthSummary {
  project_name: string;
  hours_analyzed: number;
  trace_count: number;
  avg_health_score: number | null;
  min_health_score: number | null;
  max_health_score: number | null;
  unhealthy_count: number;
  critical_count: number;
  anomaly_distribution: Record<string, number>;
}

export type HealthStatus = "healthy" | "warning" | "critical";

export function getHealthStatus(score: number): HealthStatus {
  if (score >= 0.8) return "healthy";
  if (score >= 0.5) return "warning";
  return "critical";
}

export function getHealthColor(status: HealthStatus): string {
  switch (status) {
    case "healthy":
      return "var(--ac-global-color-green-700)";
    case "warning":
      return "var(--ac-global-color-yellow-700)";
    case "critical":
      return "var(--ac-global-color-danger)";
  }
}

interface UseTracesHealthOptions {
  projectName: string;
  hours?: number;
  limit?: number;
  enabled?: boolean;
}

interface UseTracesHealthReturn {
  healthScores: Map<string, number>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch health scores for multiple traces in a project.
 * Returns a Map for O(1) lookup by trace_id.
 */
export function useTracesHealth(
  options: UseTracesHealthOptions
): UseTracesHealthReturn {
  const { projectName, hours = 1, limit = 100, enabled = true } = options;
  const [healthScores, setHealthScores] = useState<Map<string, number>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!enabled || !projectName) {
      console.log("[useTracesHealth] Skipped: enabled=", enabled, "projectName=", projectName);
      return;
    }

    setIsLoading(true);
    setError(null);

    const url = `${OBS_AGENT_URL}/api/traces/${encodeURIComponent(projectName)}/health?hours=${hours}&limit=${limit}`;
    console.log("[useTracesHealth] Fetching:", url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: TraceHealth[] = await response.json();
      console.log("[useTracesHealth] Got", data.length, "results for project:", projectName);
      const scoreMap = new Map<string, number>();
      for (const item of data) {
        scoreMap.set(item.trace_id, item.health_score);
      }
      setHealthScores(scoreMap);
    } catch (err) {
      console.error("[useTracesHealth] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch health");
    } finally {
      setIsLoading(false);
    }
  }, [projectName, hours, limit, enabled]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return {
    healthScores,
    isLoading,
    error,
    refetch: fetchHealth,
  };
}

interface UseTraceWorkflowOptions {
  projectName: string;
  traceId: string;
  includeGraph?: boolean;
  enabled?: boolean;
}

interface UseTraceWorkflowReturn {
  analysis: WorkflowAnalysis | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch full workflow analysis for a single trace.
 * Includes anomaly details and optionally the graph structure.
 */
export function useTraceWorkflow(
  options: UseTraceWorkflowOptions
): UseTraceWorkflowReturn {
  const { projectName, traceId, includeGraph = true, enabled = true } = options;
  const [analysis, setAnalysis] = useState<WorkflowAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflow = useCallback(async () => {
    if (!enabled || !projectName || !traceId) return;

    setIsLoading(true);
    setError(null);

    const url = `${OBS_AGENT_URL}/api/traces/${encodeURIComponent(projectName)}/${encodeURIComponent(traceId)}/workflow?include_graph=${includeGraph}`;
    console.log("[useTraceWorkflow] Fetching:", url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: WorkflowAnalysis = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch workflow"
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectName, traceId, includeGraph, enabled]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  return {
    analysis,
    isLoading,
    error,
    refetch: fetchWorkflow,
  };
}

interface UseHealthSummaryOptions {
  projectName: string;
  hours?: number;
  enabled?: boolean;
}

interface UseHealthSummaryReturn {
  summary: HealthSummary | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch health summary for a project.
 */
export function useHealthSummary(
  options: UseHealthSummaryOptions
): UseHealthSummaryReturn {
  const { projectName, hours = 1, enabled = true } = options;
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled || !projectName) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${OBS_AGENT_URL}/api/traces/${encodeURIComponent(projectName)}/health/summary?hours=${hours}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: HealthSummary = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch summary");
    } finally {
      setIsLoading(false);
    }
  }, [projectName, hours, enabled]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    isLoading,
    error,
    refetch: fetchSummary,
  };
}
