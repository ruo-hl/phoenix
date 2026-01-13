/**
 * @generated SignedSource<<329013ea1abcce70a7806fc2b5a5e756>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RunTraceDiscoveryInput = {
  daysBack?: number;
  projectId: string;
};
export type ProjectIssuesPageMutation$variables = {
  input: RunTraceDiscoveryInput;
};
export type ProjectIssuesPageMutation$data = {
  readonly runTraceDiscovery: {
    readonly baselineBadness: number | null;
    readonly clusters: ReadonlyArray<{
      readonly badnessRate: number;
      readonly clusterIndex: number;
      readonly id: string;
      readonly size: number;
    }>;
    readonly id: string;
    readonly status: string;
    readonly topSlices: ReadonlyArray<{
      readonly attributes: any;
      readonly id: string;
      readonly lift: number;
    }>;
    readonly totalTraces: number | null;
  };
};
export type ProjectIssuesPageMutation = {
  response: ProjectIssuesPageMutation$data;
  variables: ProjectIssuesPageMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "TraceDiscoveryRun",
    "kind": "LinkedField",
    "name": "runTraceDiscovery",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "status",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "totalTraces",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "baselineBadness",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "TraceCluster",
        "kind": "LinkedField",
        "name": "clusters",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "clusterIndex",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "size",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "badnessRate",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "TraceSlice",
        "kind": "LinkedField",
        "name": "topSlices",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "attributes",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "lift",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectIssuesPageMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectIssuesPageMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "a1e13a408f3dc5f9a76c77f996be0c23",
    "id": null,
    "metadata": {},
    "name": "ProjectIssuesPageMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectIssuesPageMutation(\n  $input: RunTraceDiscoveryInput!\n) {\n  runTraceDiscovery(input: $input) {\n    id\n    status\n    totalTraces\n    baselineBadness\n    clusters {\n      id\n      clusterIndex\n      size\n      badnessRate\n    }\n    topSlices {\n      id\n      attributes\n      lift\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "785afbbc9d7ce7e620c82d5ae10391b7";

export default node;
