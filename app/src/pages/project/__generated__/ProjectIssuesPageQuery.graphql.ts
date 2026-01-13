/**
 * @generated SignedSource<<3fbe97ac862973cdb7d3a6262d161648>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectIssuesPageQuery$variables = {
  id: string;
};
export type ProjectIssuesPageQuery$data = {
  readonly project: {
    readonly id?: string;
    readonly latestDiscoveryRun?: {
      readonly baselineBadness: number | null;
      readonly clusters: ReadonlyArray<{
        readonly avgBadness: number;
        readonly badnessRate: number;
        readonly clusterIndex: number;
        readonly dominantIntent: string | null;
        readonly dominantModel: string | null;
        readonly dominantRoute: string | null;
        readonly exampleTraceIds: ReadonlyArray<string>;
        readonly id: string;
        readonly size: number;
      }>;
      readonly completedAt: string | null;
      readonly id: string;
      readonly numClusters: number;
      readonly numSignificantSlices: number;
      readonly status: string;
      readonly topSlices: ReadonlyArray<{
        readonly attributeString: string;
        readonly attributes: any;
        readonly badnessRate: number;
        readonly id: string;
        readonly lift: number;
        readonly pValue: number;
        readonly size: number;
      }>;
      readonly totalTraces: number | null;
    } | null;
    readonly name?: string;
  };
};
export type ProjectIssuesPageQuery = {
  response: ProjectIssuesPageQuery$data;
  variables: ProjectIssuesPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "size",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "badnessRate",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "concreteType": "TraceDiscoveryRun",
  "kind": "LinkedField",
  "name": "latestDiscoveryRun",
  "plural": false,
  "selections": [
    (v2/*: any*/),
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
      "name": "completedAt",
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
      "kind": "ScalarField",
      "name": "numClusters",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "numSignificantSlices",
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
        (v2/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "clusterIndex",
          "storageKey": null
        },
        (v4/*: any*/),
        (v5/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "avgBadness",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dominantIntent",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dominantRoute",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "dominantModel",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "exampleTraceIds",
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
        (v2/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "attributes",
          "storageKey": null
        },
        (v4/*: any*/),
        (v5/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "lift",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "pValue",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "attributeString",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectIssuesPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v6/*: any*/)
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectIssuesPageQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v6/*: any*/)
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6e6f943c86649166e8dcb6f5480a1f3f",
    "id": null,
    "metadata": {},
    "name": "ProjectIssuesPageQuery",
    "operationKind": "query",
    "text": "query ProjectIssuesPageQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      id\n      name\n      latestDiscoveryRun {\n        id\n        status\n        completedAt\n        totalTraces\n        baselineBadness\n        numClusters\n        numSignificantSlices\n        clusters {\n          id\n          clusterIndex\n          size\n          badnessRate\n          avgBadness\n          dominantIntent\n          dominantRoute\n          dominantModel\n          exampleTraceIds\n        }\n        topSlices {\n          id\n          attributes\n          size\n          badnessRate\n          lift\n          pValue\n          attributeString\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "66982b343f62cbd8325e80ef0621ea2b";

export default node;
