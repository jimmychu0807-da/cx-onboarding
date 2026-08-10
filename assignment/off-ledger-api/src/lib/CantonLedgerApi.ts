import { readFile } from "node:fs/promises";

import { VERBOSE } from "../config";

const mapping = {
  getPackages: {
    method: "GET",
    endpoint: "/v2/packages",
  },
  getPackagesWithVettedInfo: {
    method: "POST",
    endpoint: "/v2/package-vetting/list",
    opts: {
      pageSize: 100,
    },
  },
  uploadPackage: {
    method: "POST",
    endpoint: "/v2/dars",
  },
  getParties: {
    method: "GET",
    endpoint: "/v2/parties",
  },
  getParticipantId: {
    method: "GET",
    endpoint: "/v2/parties/participant-id",
  },
  allocateParty: {
    method: "POST",
    endpoint: "/v2/parties",
  },
  getUpdates: {
    method: "POST",
    endpoint: "/v2/updates",
  },
  getUpdateById: {
    method: "POST",
    endpoint: "/v2/updates/update-by-id",
  },
  getLedgerEnd: {
    method: "GET",
    endpoint: "/v2/state/ledger-end",
  },
  getUserRights: {
    method: "GET",
    endpoint: "/v2/users/:user-id/rights",
  },
  setUserRights: {
    method: "POST",
    endpoint: "/v2/users/:user-id/rights",
  },
  getAuthenticatedUser: {
    method: "GET",
    endpoint: "/v2/authenticated-user",
  },
  submitAndWaitForTx: {
    method: "POST",
    endpoint: "/v2/commands/submit-and-wait-for-transaction",
  },
};

const TIMEOUT = 6000;

type CantonLedgerApiOpts = {
  useHttps: boolean;
  accessToken?: string;
};

type CantonLedgerApiGetUpdatesOpts = {
  offset: number;
  partyId: string;
  templateId: string;
};

export type CantonLedgerApiUpdateResult = {
  update:
    | {
        OffsetCheckpoint: {
          value: {
            offset: number;
          };
        };
      }
    | {
        Transaction: {
          value: {
            offset: number;
            events: [CantonLedgerApiCreatedEvent];
          };
        };
      };
};

export type CantonLedgerApiCreatedEvent = {
  CreatedEvent: {
    contractId: string;
    templateId: string;
  };
};

export class CantonLedgerApi {
  server: string;
  opts: CantonLedgerApiOpts;

  constructor(server: string, opts: CantonLedgerApiOpts) {
    this.server = server;
    this.opts = opts;
  }

  get remoteEndpoint(): string {
    return `${this.httpScheme()}://${this.server}`;
  }

  public async getPackages() {
    const { method, endpoint } = mapping.getPackages;
    const fullEndpoint = `${this.httpScheme()}://${this.server}${endpoint}`;

    const response = await fetch(fullEndpoint, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async getPackagesWithVettedInfo(
    packageNamePrefix?: string,
    participantId?: string,
  ) {
    const { method, endpoint, opts } = mapping.getPackagesWithVettedInfo;
    const fullEndpoint = `${this.httpScheme()}://${this.server}${endpoint}`;

    const response = await fetch(fullEndpoint, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      // note: you need to specify a body for the request to work
      body: JSON.stringify({
        packageMetadataFilter: packageNamePrefix
          ? { packageNamePrefixes: [packageNamePrefix] }
          : undefined,
        topologyStateFilter: participantId
          ? { participantIds: [participantId] }
          : undefined,
        ...opts,
      }),
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });

    return await response.json();
  }

  public async getParties() {
    const { method, endpoint } = mapping.getParties;
    const fullEndpoint = `${this.httpScheme()}://${this.server}${endpoint}`;

    const response = await fetch(fullEndpoint, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async getParticipantId() {
    const { method, endpoint } = mapping.getParticipantId;
    const fullEndpoint = `${this.httpScheme()}://${this.server}${endpoint}`;

    const response = await fetch(fullEndpoint, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async uploadPackage(filePath: string) {
    const fileContent = await readFile(filePath); // Buffer

    const { method, endpoint } = mapping.uploadPackage;
    const fullEndpoint = new URL(this.getFullEndpoint(endpoint));
    fullEndpoint.searchParams.set("vetAllPackages", "true");

    console.log(
      `Uploading a package of ${fileContent.length} bytes to ${this.server}`,
    );
    const response = await fetch(fullEndpoint, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: fileContent,
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });

    return response.ok;
  }

  public async allocateParty(partyIdHint: string, userId?: string) {
    const { method, endpoint } = mapping.allocateParty;
    const response = await fetch(this.getFullEndpoint(endpoint), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: JSON.stringify({
        partyIdHint,
        userId, // note: this value is omitted if undefined
      }),
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async getLedgerEnd() {
    const { method, endpoint } = mapping.getLedgerEnd;
    const response = await fetch(this.getFullEndpoint(endpoint), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async getUpdateById(updateId: string) {
    const { method, endpoint } = mapping.getUpdateById;
    const response = await fetch(this.getFullEndpoint(endpoint), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: JSON.stringify({
        updateId,
        updateFormat: {
          includeTransactions: {
            eventFormat: {
              filtersForAnyParty: {},
              verbose: true,
            },
            transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
          },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async getUserRights(userId: string) {
    const { method, endpoint } = mapping.getUserRights;
    const endpointFilled = endpoint.replace(":user-id", userId);
    const response = await fetch(this.getFullEndpoint(endpointFilled), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return await response.json();
  }

  public async setUserRights(userId: string, rightsObj: unknown) {
    const { method, endpoint } = mapping.setUserRights;
    const endpointFilled = endpoint.replace(":user-id", userId);
    const body = JSON.stringify(rightsObj).replace(":user-id", userId);

    const response = await fetch(this.getFullEndpoint(endpointFilled), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });

    if (response.ok) {
      console.log("result:", await response.json());
    } else {
      console.log("error:", response);
    }
  }

  public async getAuthenticatedUser() {
    const { method, endpoint } = mapping.getAuthenticatedUser;

    const response = await fetch(this.getFullEndpoint(endpoint), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });

    return await response.json();
  }

  public async submitCmds(cmdsObj: unknown) {
    const { method, endpoint } = mapping.submitAndWaitForTx;
    const response = await fetch(this.getFullEndpoint(endpoint), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmdsObj),
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });

    if (response.ok) {
      console.log("result:", await response.json());
    } else {
      console.log("error:", response);
    }
  }

  public async getUpdates(
    opts: CantonLedgerApiGetUpdatesOpts,
  ): Promise<CantonLedgerApiUpdateResult[]> {
    const { method, endpoint } = mapping.getUpdates;

    const { offset, partyId, templateId } = opts;

    const response = await fetch(this.getFullEndpoint(endpoint), {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        beginExclusive: offset,
        filter: {
          filtersByParty: {
            [partyId]: {
              cumulative: [
                {
                  identifierFilter: {
                    TemplateFilter: {
                      value: {
                        templateId,
                        includeCreatedEventBlob: true,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT),
      verbose: VERBOSE,
    });
    return (await response.json()) as CantonLedgerApiUpdateResult[];
  }

  private httpScheme(): string {
    return this.opts.useHttps ? "https" : "http";
  }

  private getFullEndpoint(endpoint: string): string {
    return `${this.httpScheme()}://${this.server}${endpoint}`;
  }
}
