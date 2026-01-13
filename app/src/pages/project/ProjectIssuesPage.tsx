import { Suspense, useCallback, useState, useTransition } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { useParams } from "react-router";
import { css } from "@emotion/react";

import {
  Button,
  Card,
  Flex,
  Heading,
  ProgressCircle,
  Text,
  View,
} from "@phoenix/components";
import { Loading } from "@phoenix/components/loading";

import { ProjectIssuesPageMutation } from "./__generated__/ProjectIssuesPageMutation.graphql";
import { ProjectIssuesPageQuery } from "./__generated__/ProjectIssuesPageQuery.graphql";

const containerCSS = css`
  padding: var(--ac-global-dimension-size-400);
  overflow-y: auto;
`;

const gridCSS = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ac-global-dimension-size-400);

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const clusterCardCSS = css`
  padding: var(--ac-global-dimension-size-250);
  border-radius: var(--ac-global-rounding-medium);
  background-color: var(--ac-global-color-grey-75);
  border: 1px solid var(--ac-global-color-grey-200);
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background-color: var(--ac-global-color-grey-100);
    border-color: var(--ac-global-color-grey-300);
  }
`;

const badnessBarCSS = css`
  height: 8px;
  border-radius: 4px;
  background-color: var(--ac-global-color-grey-300);
  overflow: hidden;
`;

const badnessFillCSS = css`
  height: 100%;
  background-color: var(--ac-global-color-danger);
  transition: width 0.3s ease;
`;

const cardContentCSS = css`
  padding: var(--ac-global-dimension-size-300);
  padding-top: var(--ac-global-dimension-size-200);
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
`;

const emptyCardContentCSS = css`
  padding: var(--ac-global-dimension-size-600) var(--ac-global-dimension-size-400);
`;

const emptyStateCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 150px;
  color: var(--ac-global-text-color-700);
`;

function ClusterCard({
  cluster,
}: {
  cluster: {
    id: string;
    clusterIndex: number;
    size: number;
    badnessRate: number;
    avgBadness: number;
    dominantIntent: string | null;
    dominantRoute: string | null;
    dominantModel: string | null;
    exampleTraceIds: readonly string[];
  };
}) {
  const badnessPercent = Math.round(cluster.badnessRate * 100);

  return (
    <div css={clusterCardCSS}>
      <Flex direction="column" gap="size-150">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={4}>Cluster {cluster.clusterIndex}</Heading>
          <Text color={badnessPercent > 30 ? "danger" : "default"} weight="bold">
            {badnessPercent}% bad
          </Text>
        </Flex>
        <div css={badnessBarCSS}>
          <div
            css={badnessFillCSS}
            style={{ width: `${badnessPercent}%` }}
          />
        </div>
        <Flex direction="column" gap="size-50">
          <Text size="S" color="text-700">
            {cluster.size} traces
          </Text>
          {cluster.dominantIntent && cluster.dominantIntent !== "unknown" && (
            <Text size="S">Intent: {cluster.dominantIntent}</Text>
          )}
          {cluster.dominantModel && cluster.dominantModel !== "unknown" && cluster.dominantModel !== "None" && (
            <Text size="S">Model: {cluster.dominantModel}</Text>
          )}
        </Flex>
      </Flex>
    </div>
  );
}

function SliceRow({
  slice,
}: {
  slice: {
    id: string;
    attributes: unknown;
    size: number;
    badnessRate: number;
    lift: number;
    pValue: number;
    attributeString: string;
  };
}) {
  const liftColor = slice.lift > 1.5 ? "danger" : slice.lift > 1.2 ? "notice" : "default";

  return (
    <View
      paddingY="size-200"
      paddingX="size-200"
      borderBottomWidth="thin"
      borderBottomColor="grey-200"
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Flex direction="column" gap="size-75">
          <Text weight="bold">{slice.attributeString}</Text>
          <Text size="S" color="text-700">
            {slice.size} traces, {Math.round(slice.badnessRate * 100)}% bad
          </Text>
        </Flex>
        <Flex direction="column" alignItems="end" gap="size-50">
          <Text color={liftColor} weight="bold">
            {slice.lift.toFixed(2)}x lift
          </Text>
          <Text size="S" color="text-700">
            p={slice.pValue.toFixed(3)}
          </Text>
        </Flex>
      </Flex>
    </View>
  );
}

function IssuesContent({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();
  const [fetchKey, setFetchKey] = useState(0);

  const data = useLazyLoadQuery<ProjectIssuesPageQuery>(
    graphql`
      query ProjectIssuesPageQuery($id: ID!) {
        project: node(id: $id) {
          ... on Project {
            id
            name
            latestDiscoveryRun {
              id
              status
              completedAt
              totalTraces
              baselineBadness
              numClusters
              numSignificantSlices
              clusters {
                id
                clusterIndex
                size
                badnessRate
                avgBadness
                dominantIntent
                dominantRoute
                dominantModel
                exampleTraceIds
              }
              topSlices {
                id
                attributes
                size
                badnessRate
                lift
                pValue
                attributeString
              }
            }
          }
        }
      }
    `,
    { id: projectId },
    { fetchPolicy: "network-only", fetchKey }
  );

  const [commitMutation, isMutating] =
    useMutation<ProjectIssuesPageMutation>(graphql`
      mutation ProjectIssuesPageMutation($input: RunTraceDiscoveryInput!) {
        runTraceDiscovery(input: $input) {
          id
          status
          totalTraces
          baselineBadness
          clusters {
            id
            clusterIndex
            size
            badnessRate
          }
          topSlices {
            id
            attributes
            lift
          }
        }
      }
    `);

  const handleRunDiscovery = useCallback(() => {
    startTransition(() => {
      commitMutation({
        variables: {
          input: {
            projectId: projectId,
            daysBack: 7,
          },
        },
        onCompleted: () => {
          // Refetch the query to show updated results
          setFetchKey((prev) => prev + 1);
        },
      });
    });
  }, [commitMutation, projectId]);

  const discoveryRun = data.project?.latestDiscoveryRun;

  return (
    <div css={containerCSS}>
      <Flex direction="column" gap="size-300">
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex direction="column" gap="size-100">
            <Heading level={2}>Issue Discovery</Heading>
            {discoveryRun && (
              <Text color="text-700">
                Analyzed {discoveryRun.totalTraces} traces |{" "}
                {Math.round((discoveryRun.baselineBadness || 0) * 100)}% baseline
                badness | {discoveryRun.numClusters} clusters |{" "}
                {discoveryRun.numSignificantSlices} significant slices
              </Text>
            )}
          </Flex>
          <Button
            variant="primary"
            onPress={handleRunDiscovery}
            isDisabled={isMutating || isPending}
          >
            {isMutating || isPending ? (
              <>
                <ProgressCircle size="S" isIndeterminate aria-label="Running" />
                Running...
              </>
            ) : (
              "Run Discovery"
            )}
          </Button>
        </Flex>

        {!discoveryRun ? (
          <Card title="No Discovery Results">
            <div css={emptyCardContentCSS}>
              <Flex
                direction="column"
                alignItems="center"
                justifyContent="center"
                gap="size-300"
              >
                <Text color="text-700">
                  Run discovery to analyze your traces and find failure patterns.
                </Text>
                <Button variant="primary" onPress={handleRunDiscovery}>
                  Run Discovery
                </Button>
              </Flex>
            </div>
          </Card>
        ) : (
          <div css={gridCSS}>
            {/* Clusters Section */}
            <Card title="Top Clusters" subTitle="Clusters with highest badness rates">
              <div css={cardContentCSS}>
                {discoveryRun.clusters.length > 0 ? (
                  <Flex direction="column" gap="size-200">
                    {discoveryRun.clusters.slice(0, 5).map((cluster) => (
                      <ClusterCard key={cluster.id} cluster={cluster} />
                    ))}
                  </Flex>
                ) : (
                  <div css={emptyStateCSS}>
                    <Text color="text-700">No clusters found</Text>
                  </div>
                )}
              </div>
            </Card>

            {/* Slices Section */}
            <Card title="Top Slices" subTitle="Attribute combinations with elevated badness">
              <div css={cardContentCSS}>
                {discoveryRun.topSlices.length > 0 ? (
                  <Flex direction="column">
                    {discoveryRun.topSlices.slice(0, 10).map((slice) => (
                      <SliceRow key={slice.id} slice={slice} />
                    ))}
                  </Flex>
                ) : (
                  <div css={emptyStateCSS}>
                    <Text color="text-700">No significant slices found</Text>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </Flex>
    </div>
  );
}

export function ProjectIssuesPage() {
  const { projectId } = useParams();

  if (!projectId) {
    return null;
  }

  return (
    <Suspense fallback={<Loading />}>
      <IssuesContent projectId={projectId} />
    </Suspense>
  );
}
