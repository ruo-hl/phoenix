import { Suspense, useCallback, useTransition } from "react";
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
  padding: var(--ac-global-dimension-size-200);
  overflow-y: auto;
`;

const gridCSS = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ac-global-dimension-size-200);

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const clusterCardCSS = css`
  padding: var(--ac-global-dimension-size-100);
  border-radius: var(--ac-global-rounding-medium);
  background-color: var(--ac-global-color-grey-100);
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background-color: var(--ac-global-color-grey-200);
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
      <Flex direction="column" gap="size-100">
        <Flex justifyContent="space-between" alignItems="center">
          <Heading level={4}>Cluster {cluster.clusterIndex}</Heading>
          <Text color={badnessPercent > 30 ? "danger" : "default"}>
            {badnessPercent}% bad
          </Text>
        </Flex>
        <div css={badnessBarCSS}>
          <div
            css={badnessFillCSS}
            style={{ width: `${badnessPercent}%` }}
          />
        </div>
        <Text size="S" color="text-700">
          {cluster.size} traces
        </Text>
        {cluster.dominantIntent && (
          <Text size="S">Intent: {cluster.dominantIntent}</Text>
        )}
        {cluster.dominantModel && (
          <Text size="S">Model: {cluster.dominantModel}</Text>
        )}
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
      padding="size-100"
      borderBottomWidth="thin"
      borderBottomColor="grey-300"
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Flex direction="column" gap="size-50">
          <Text weight="bold">{slice.attributeString}</Text>
          <Text size="S" color="text-700">
            {slice.size} traces, {Math.round(slice.badnessRate * 100)}% bad
          </Text>
        </Flex>
        <Flex direction="column" alignItems="end">
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
    { fetchPolicy: "store-and-network" }
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
      });
    });
  }, [commitMutation, projectId]);

  const discoveryRun = data.project?.latestDiscoveryRun;

  return (
    <div css={containerCSS}>
      <Flex direction="column" gap="size-200">
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex direction="column" gap="size-50">
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
            <Flex
              direction="column"
              alignItems="center"
              justifyContent="center"
              gap="size-200"
              UNSAFE_style={{ padding: "48px 48px 64px 48px" }}
            >
              <Text color="text-700">
                Run discovery to analyze your traces and find failure patterns.
              </Text>
              <Button variant="primary" onPress={handleRunDiscovery}>
                Run Discovery
              </Button>
            </Flex>
          </Card>
        ) : (
          <div css={gridCSS}>
            {/* Clusters Section */}
            <Card title="Top Clusters" subTitle="Clusters with highest badness rates">
              <Flex direction="column" gap="size-100">
                {discoveryRun.clusters.slice(0, 5).map((cluster) => (
                  <ClusterCard key={cluster.id} cluster={cluster} />
                ))}
                {discoveryRun.clusters.length === 0 && (
                  <Text color="text-700">No clusters found</Text>
                )}
              </Flex>
            </Card>

            {/* Slices Section */}
            <Card title="Top Slices" subTitle="Attribute combinations with elevated badness">
              <Flex direction="column">
                {discoveryRun.topSlices.slice(0, 10).map((slice) => (
                  <SliceRow key={slice.id} slice={slice} />
                ))}
                {discoveryRun.topSlices.length === 0 && (
                  <Text color="text-700">No significant slices found</Text>
                )}
              </Flex>
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
