# Issue Discovery Algorithm

This document explains how the trace clustering and slice analysis algorithms work.

## Overview

Issue Discovery automatically identifies failure patterns in your traces through two complementary approaches:

1. **Clustering**: Groups similar traces together to find behavioral patterns
2. **Slicing**: Finds attribute combinations that correlate with failures

## How Badness is Computed

Each trace gets a "badness score" from 0.0 (good) to 1.0 (bad) based on multiple signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Quality Eval | 0.30 | LLM-as-judge quality score (if available) |
| Grounding Eval | 0.20 | Factual accuracy score (if available) |
| Tool Errors | 0.25 | Percentage of tool calls that failed |
| Latency | 0.15 | Normalized latency (p95 = 1.0) |
| Error Count | 0.10 | Number of error spans in trace |

A trace is considered "bad" if its badness score > 0.5.

## Clustering Algorithm

### Feature Extraction

For each trace, we extract:

1. **Tool Sequence Features**
   - Which tools were called and in what order
   - Tool call n-grams (unigrams + bigrams)
   - Example: `["search", "search->summarize", "summarize"]`

2. **Scalar Metrics**
   - Total latency (ms)
   - LLM latency vs tool latency
   - Token count
   - Number of LLM calls
   - Number of tool calls
   - Error count

3. **Optional: Text Embeddings**
   - Input/output text embedded via OpenAI `text-embedding-3-small`
   - Disabled by default (requires API key)

### HDBSCAN Clustering

We use [HDBSCAN](https://hdbscan.readthedocs.io/) (Hierarchical Density-Based Spatial Clustering):

```
Parameters:
  min_cluster_size: 10 (minimum traces to form a cluster)
  metric: euclidean
```

**Why HDBSCAN?**
- Automatically determines the number of clusters
- Handles noise (outlier traces don't force bad clusters)
- Works well with varying cluster densities

### Cluster Metrics

For each cluster, we compute:

- **Size**: Number of traces in cluster
- **Badness Rate**: Percentage of traces with badness > 0.5
- **Avg Badness**: Mean badness score
- **Dominant Intent**: Most common intent attribute
- **Dominant Model**: Most common LLM model used
- **Example Traces**: 5 representative trace IDs

Clusters are sorted by badness rate (highest first).

## Slice Analysis

Slicing finds attribute combinations that have elevated failure rates.

### Attributes Used

By default, we slice on:
- `intent`: Root span name or custom attribute
- `route`: Task ID or inferred from span patterns
- `model`: LLM model name (e.g., "gpt-4", "claude-3")
- `provider`: LLM provider (e.g., "openai", "anthropic")

### Lift Calculation

For each attribute combination (slice), we calculate **lift**:

```
lift = slice_badness_rate / baseline_badness_rate
```

- `lift = 1.0`: Same failure rate as baseline
- `lift = 1.5`: 50% more failures than baseline
- `lift = 2.0`: 2x the baseline failure rate

### Statistical Significance

We use the chi-squared test to determine if a slice's elevated badness is statistically significant:

```python
# Contingency table:
#              Bad    Good
# In Slice     a      b
# Not In Slice c      d

chi2, p_value = chi2_contingency([[a,b], [c,d]])
```

A slice is considered significant if `p_value < 0.05`.

### Slice Depth

We consider:
- Single attributes: `model=gpt-4`
- Attribute pairs: `model=gpt-4, intent=search`

Deeper combinations (3+ attributes) are skipped to avoid combinatorial explosion.

### Example Output

```
Top Slices:
1. model=gpt-4, provider=openai
   200 traces, 35% bad, lift=1.75x, p=0.001

2. intent=research_task
   150 traces, 28% bad, lift=1.40x, p=0.023
```

This tells you that traces using GPT-4 with OpenAI have 75% more failures than baseline.

## Pipeline Flow

```
1. Fetch Spans from Phoenix
        ↓
2. Extract Features per Trace
   - Tool sequences
   - Scalar metrics
   - Categorical attributes
        ↓
3. Compute Badness Scores
   - Aggregate eval scores
   - Count errors/failures
        ↓
4. Cluster Traces (HDBSCAN)
   - Group similar behaviors
   - Identify failure clusters
        ↓
5. Rank Slices
   - Test each attribute combo
   - Calculate lift + significance
        ↓
6. Return DiscoveryReport
   - Top clusters by badness
   - Top slices by lift
```

## Configuration

```python
from phoenix.discovery import IssueDiscoveryPipeline, DiscoveryConfig

config = DiscoveryConfig(
    # Clustering
    cluster_method="hdbscan",  # or "kmeans"
    min_cluster_size=10,

    # Slicing
    slice_attributes=["intent", "route", "model", "provider"],
    min_slice_size=10,
    max_slice_depth=2,
    significance_threshold=0.05,

    # Badness weights
    badness_weights=BadnessWeights(
        quality_eval=0.30,
        grounding_eval=0.20,
        tool_errors=0.25,
        latency=0.15,
        error_count=0.10,
    ),

    # Embeddings (optional)
    skip_embeddings=True,  # Set False if you have OPENAI_API_KEY
    embedding_model="text-embedding-3-small",

    # Pipeline limits
    min_traces=50,
    max_traces=10000,
)

pipeline = IssueDiscoveryPipeline(config=config)
report = pipeline.run("my-project", days_back=7)
```

## Interpreting Results

### High-Badness Clusters

A cluster with high badness (>50%) represents a pattern of failures. Look at:
- **Dominant Intent**: What task was being attempted?
- **Dominant Model**: Is a specific model failing?
- **Example Traces**: Inspect these in Phoenix UI

### High-Lift Slices

A slice with high lift (>1.5x) means that combination of attributes has elevated failures:
- `lift=2.0`: Twice as likely to fail as average
- Check if the attributes are actionable (can you change the model? route?)

### No Significant Slices

If `num_significant_slices=0`, failures may be:
- Random (no pattern)
- Correlated with attributes not being tracked
- Too few failures to detect pattern (baseline already low)

## Limitations

1. **Requires sufficient data**: Need 50+ traces minimum
2. **Categorical attributes only**: Continuous values not sliced
3. **No causal inference**: Correlation != causation
4. **Batch analysis**: Not real-time, designed for periodic runs
