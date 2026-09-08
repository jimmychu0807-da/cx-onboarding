# CRUD of parties and templates

- party
- packages/dars
- smart contract

## Synchronizers - Read

GET /v2/state/connected-synchronizers

example result:

```
global-domain::1220b442845c2ddc85178a5b7f6c5035f873fa6c0a9c7e9cc0981122d6247e504c2a
```

## Port config for localnet

APP_USER_UI_PORT=${APP_USER_UI_PORT:-2000}
APP_PROVIDER_UI_PORT=${APP_PROVIDER_UI_PORT:-3000}
SV_UI_PORT=${SV_UI_PORT:-4000}
SWAGGER_UI_PORT=${SWAGGER_UI_PORT:-9090}

## Party

### Party - Read

GET /v2/parties

app_provider_localnet-localparty-1::12203209f68a8fd748c937d9ff1acdf46a7b0396c8c8f8efff1137633cbc5b65292b

### Party - Create

POST /v2/parties

request body:

```json
{
  "partyIdHint": "alice",
  "synchronizerId": "global-domain::1220b442845c2ddc85178a5b7f6c5035f873fa6c0a9c7e9cc0981122d6247e504c2a",
  "userId": "ledger-api-user"
}
```

- userId must exist before the above request

response:

```
"party": "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
```

### Party - Update

PATCH /v2/parties/{:partyId}

example:
- /v2/parties/alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614

request body example:

```json
{
	"partyDetails": {
  	"party": "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614",
  	"localMetadata": {
  		"annotations": {
  			"userName": "jimmychu0807"
  		}
  	}
	},
	"updateMask": {
		"paths": [
			"local_metadata.annotations"
		]
	}
}
```

### Party - Delete

// not sure if you can ever delete a party once allocated

## User

### User - list

GET /v2/users

### User - create

POST /v2/users

sample request body

```json
{
  "user": {
    "id": "alice",
    "primaryParty": "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614",
    "isDeactivated": false,
    "metadata": {
      "resourceVersion": "",
      "annotations": {}
    },
    "identityProviderId": "",
    "primaryPartyAuthentication": true
  },
  "rights": [
    {
      "kind": {
        "CanActAs": {
          "value": {
            "party": "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
          }
        }
      }
    }
  ]
}
```

### User - patch

PATCH /v2/users/:user-id

update user metadata. Note that user to party access right mapping is a configuration per participant node.

### Current authenticated user

GET /v2/authenticated-user

## User Right Mgmt

### Current User Right

GET /v2/users/{:user-id}/rights

notice: `user-id` doesn't have the fingerprint attached at the end.

ledger-api-user

### Grant right to a user

POST /v2/users/:user-id/rights

```json
{
	"userId": "ledger-api-user",
	"rights": [
		{
			"kind": {
				"CanActAs": {
					"value": {
						"party": "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
					}
				}
			}
		},
		{
			"kind": {
				"CanReadAsAnyParty": {
					"value": {}
				}
			}
		}
	]
}
```

### Revoke user right

PATCH /v2/users/{:user-id}/rights

## Packages / DARs

### package - list

GET /v2/packages

Return a list of uploaded packageIds

example:
"de2cc2f90eb523414ff54e899951dadd8789a4c07e0f71f6d6c9eaf57d412a54",
"590736e6f7bc01492007ecb27f3fe75995c19fbd3d41b384aada69619fd4f76c",
"ee33fb70918e7aaa3d3fc44d64a399fb2bf5bcefc54201b1690ecd448551ba88",

### package - list (with more info)

POST /v2/package-vetting/list

request body:
```
{
  "packageMetadataFilter": {
    "packageNamePrefixes": [
      "assignment-templates"
    ]
  },
  "topologyStateFilter": {
    "participantIds": [
    	"participant::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
    ]
  }
}
```

packageId: 96b5d54504ab50ab40e1088826add5fe0f30e02bf15cee39c24002749765df25

listing which participant node vetted what packages on which synchronizer

There is no way to view if a DAR is uploaded or not. The listing is on package level.

The uploaded dar package is automatically vetted.

### DAR - upload

POST /v2/dars

The response body is just `{}` when succeeded.

### DAR - vet

### DAR - unvet

## Smart Contracts

### Create a smart contract

POST /v2/commands/submit-and-wait-for-transaction

request body:

```json
{
  "commands": {
    "commands": [
      {
        "CreateCommand": {
          "templateId": "#assignment-templates:ProposeAcceptPattern:TradeProposal",
          "createArguments": {
          	"proposer": "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614",
          	"counterparty": "app_user_localnet-localparty-1::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614",
          	"asset": "Bitcoin",
          	"price": "78010.5"
          }
        }
      }
    ],
    "commandId": "create-trade-proposal-alice-test001",
    "actAs": [
      "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
    ]
  }
}
```

Note:
- **price** even in decimal value, should be quoted in text form.
- Using `TRANSACTION_SHAPE_UNSPECIFIED` - will trigger a `MISSING_FIELD` error.
- the `transactionFormat` object is optional

Key Result:
- "updateId": "12203909ec231d13560ea4003b52b2c4d018c4a5e4d20b3e85da1209202d6b45d888"
- "offset": 1737
- "contractId": "006d566eb998f523e45d33c6cd3fdde209b569fa1970d4a28e5617c5dcb2e831e5ca121220050e70227dcd0d4ae4b9a7f959cc1fd4f42723d110dee43cc6e33591421aba83"

### Look up a contract from its contract ID

POST /v2/contracts/contract-by-id

request body:
```json
{
  "contractId": "006d566eb998f523e45d33c6cd3fdde209b569fa1970d4a28e5617c5dcb2e831e5ca121220050e70227dcd0d4ae4b9a7f959cc1fd4f42723d110dee43cc6e33591421aba83",
  "queryingParties": []
}
```

Note:
- The offset value is wrong. But the rest of the info looks correct.

### Look up a contract from update ID (Tx ID)

POST /v2/updates/update-by-id

request body:
```json
{
  "updateId": "12203909ec231d13560ea4003b52b2c4d018c4a5e4d20b3e85da1209202d6b45d888",
  "updateFormat": {
    "includeTransactions": {
      "eventFormat": {
        "filtersForAnyParty": {},
        "verbose": true
      },
      "transactionShape": "TRANSACTION_SHAPE_LEDGER_EFFECTS"
    }
  }
}
```

Note:
- if you don't have the `updateFormat` object, or just an empty object, it won't retrieve any content at all.

### Look up a contract from update offset

POST /v2/updates/update-by-offset

offset: 1737

request body:

```json
{
  "offset": 1737,
  "updateFormat": {
    "includeTransactions": {
      "eventFormat": {
        "filtersForAnyParty": {},
        "verbose": true
      },
      "transactionShape": "TRANSACTION_SHAPE_LEDGER_EFFECTS"
    }
  }
}
```

Note, for transactionShape, don't use **TRANSACTION_SHAPE_UNSPECIFIED**.

Use either **TRANSACTION_SHAPE_ACS_DELTA** for stakeholder
- CreatedEvent
- ArchivedEvent

or **TRANSACTION_SHAPE_LEDGER_EFFECTS** for (witnesses/informees)
- CreatedEvent
- ExercisedEvent

### Look up contract at current ACS

- expensive, last resort

- party: alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614
- creation offset: 1737

POST /v2/state/active-contracts

request body:

```json
{
	"filtersByParty": {
		"alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614": {
			"cumulative": []
		}
	},
  "eventFormat": {
    "filtersByParty": {
  		"alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614": {
	  		"cumulative": []
		  }
    }
  },
	"activeAtOffset": 1740
}
```

### Exercise a choice

- contractId: 006d566eb998f523e45d33c6cd3fdde209b569fa1970d4a28e5617c5dcb2e831e5ca121220050e70227dcd0d4ae4b9a7f959cc1fd4f42723d110dee43cc6e33591421aba83
- offset: 1737

```json
{
  "commands": {
    "commands": [
      {
        "ExerciseCommand": {
          "templateId": "#assignment-templates:ProposeAcceptPattern:TradeProposal",
          "contractId": "006d566eb998f523e45d33c6cd3fdde209b569fa1970d4a28e5617c5dcb2e831e5ca121220050e70227dcd0d4ae4b9a7f959cc1fd4f42723d110dee43cc6e33591421aba83",
          "choice": "Accept",
          "choiceArgument": {}
        }
      }
    ],
    "commandId": "exercise-trade-proposal-app-user-test001",
    "actAs": [
      "app_user_localnet-localparty-1::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
    ]
  }
}
```

key result:
- "updateId": "1220ae5ed7ff02f134875364bfc534c5d5ef9e97b5988edf5381567fd6933e3a3a12"
- "offset": 2013
- two events
	- ArchivedEvent
		contractId: "006d566eb998f523e45d33c6cd3fdde209b569fa1970d4a28e5617c5dcb2e831e5ca121220050e70227dcd0d4ae4b9a7f959cc1fd4f42723d110dee43cc6e33591421aba83"
	- CreatedEvent
		contractId: "00055bdddee815a833babb781988dca77feccb60bf6ba4e03d30854887dc6b2110ca12122086e7b8d9a329139e4c896d5cc5e45c49b0b7b77c55628a60601ca11c7ca6a360"

### Archive a contract

POST /v2/commands/submit-and-wait-for-transaction

request body:
```json
{
  "commands": {
    "commands": [
      {
        "ExerciseCommand": {
          "templateId": "#assignment-templates:ProposeAcceptPattern:Trade",
          "contractId": "00055bdddee815a833babb781988dca77feccb60bf6ba4e03d30854887dc6b2110ca12122086e7b8d9a329139e4c896d5cc5e45c49b0b7b77c55628a60601ca11c7ca6a360",
          "choice": "Archive",
          "choiceArgument": {}
        }
      }
    ],
    "commandId": "exercise-trade-proposal-app-user-test002",
    "actAs": [
      "alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614",
      "app_user_localnet-localparty-1::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614"
    ]
  }
}
```

Notes:
- `Archive` choice is always available in a daml template.
- since the template has two signatory parties, you need two actAs parties


execution notes:
- contract archived at offset 2033

### Lookup the lifecycle of a contract

POST /v2/events/events-by-contract-id

This includes if you want to look up the last archival action of a contract. Could query both an active or archived contract.

request body:
```json
{
  "contractId": "00055bdddee815a833babb781988dca77feccb60bf6ba4e03d30854887dc6b2110ca12122086e7b8d9a329139e4c896d5cc5e45c49b0b7b77c55628a60601ca11c7ca6a360",
  "eventFormat": {
    "filtersByParty": {
  		"alice::1220cd09acde76cd5da0e68462eedeb55ee945f2e48215698d300ee5c68a0764e614": {
	  		"cumulative": []
		  }
    },
    "verbose": true
  }
}
```

You need to have the right for the party and is sending the query to the right participant nodes.
