Refer to the [CX engineering technical onboarding](./cx-engin-tech-onboarding.pdf) document.

# Daml Development

## Hands-on: Write your first daml application (build and run with dpm sandbox)

My first application is Ledger Programming Lab 1: [Customer Loyalty Program](https://github.com/jimmychu0807-da/daml-course/blob/main/02-ledger-programming/daml/Lab1.daml), with [test script](https://github.com/jimmychu0807-da/daml-course/blob/main/02-ledger-programming/daml/TestLab1.daml).

Build the daml template with:

```sh
dpm build
```

Most of the time, the vscode `Script Result` is clicked to see a simulated result.

To run it with sandbox, run in one console:

```sh
dpm sandbox -v --debug --dar .daml/dist/ledger-programming-0.0.1.dar
```

Using both the `-v --debug` flags are helpful to see what's going on in the sandbox. The sandbox command spins up a participant `sandbox`, a sequencer `local`, and a mediator `mediator1`.

Open another terminal and run the test script against the sandbox env:

```sh
dpm script --ledger-host localhost --ledger-port 6865 --dar .daml/dist/ledger-programming-0.0.1.dar --script-name TestLab1:testSubmitAndAcceptCLPApplication
```

Beware the script-name is in **moduleName**:**scriptName** format.

## How can you inspect the contents of a DAR? What’s inside?

`dpm inspect-dar <dar-file>`

## Hands-on - Test your first daml application with daml script

Running the daml script inside VS Code (I'm using Cursor IDE)

![ss-01](./assets/ss01.png)

Running with sandbox, run with `-v --debug` flags, each transaction has **7 phases**.

![ss-02](./assets/ss02.png)

## Theory - what are signatories and observers?

**Signatories** are ones that need to approve in order to create the contract.

**Observers** are ones who have read access to the contract content.

## Hands-on - Implement and test the [propose-accept pattern](https://docs.canton.network/appdev/modules/m2-multi-party-workflows#the-propose-accept-pattern)

- [`ProposeAcceptPattern.daml`](./templates/daml/ProposeAcceptPattern.daml)
- [`TestProposeAcceptPattern.daml`](./templates/daml/TestProposeAcceptPattern.daml)

## Theory - Consider also [the delegation pattern](https://docs.canton.network/appdev/modules/m2-multi-party-workflows#delegation-patterns). How does it compare to the propose-accept pattern? In which scenarios would you use each pattern?

Propose-accept is used when there is when two parties need to be signatory and is submitting commands asynchronously.

Delegation is used when you are granting a right to another party so they can act on behalf of you i.e. on governance voting. You can also withdraw the granted right afterwards.

But usually I would like such pattern should restrict some actions, or setting the scope of action that delegates can apply to the asset on behalf of the owner.

## Hands-on - Launch [localnet](https://docs.canton.network/appdev/modules/m5-localnet-development)

This is essentially setting up [cn-quickstart](https://github.com/digital-asset/cn-quickstart) project to run locally, and then running `make start`.

Or, run the localnet with localnet-recipes: <https://github.com/DACH-NY/localnet-recipes> with `make start`.

## Hands-on - Deploy your daml project to localnet

Launch the canton console with `make console` using the included docker config.

You could also connect it directly with:

```sh
dpm canton-console --port 2901 --admin-api-port 2902
```
This will just connect the console to the participant node `app-user`.

To connect to `app-provider` use `--port 3901 --admin-api-port 3902`.

The reason using `make console` you see the nice node reference of `app-user`, `app-provider`, `app-mediator`, `sv`, etc is due to the remote console config at: https://github.com/canton-network/splice/blob/15e00f3/cluster/compose/localnet/conf/console/app.conf.

Also note that the release of splice node is at: https://github.com/digital-asset/decentralized-canton-sync

Then you can upload the dar into `app-user` (connects with 2xxx ports) and `app-provider` (connects with 3xxx ports) with:

```
`app-user`.dars.upload("./assignment/templates/.daml/dist/assignment-templates-0.0.1.dar")
```

## Hands-on - Execute a daml transaction between two nodes - app user and app-provider

I followed [the forum post](https://forum.canton.network/t/multi-participant-daml-scripts/7039) and generated the [participant-config.json](https://github.com/jimmychu0807-da/daml-course/blob/main/assignment/multi-participant/participant-config.json) for localnet.

The access_token is generated using `jwt-cli` command based on how [the docker entrypoint initialization](https://github.com/canton-network/splice/blob/main/cluster/compose/localnet/docker/console/entrypoint.sh#L15-L19).

Then there is [the daml script](https://github.com/jimmychu0807-da/daml-course/blob/main/assignment/multi-participant/daml/TestProposeAcceptPattern.daml) that test a propose accept pattern with user creation and submitting to different localnet participant nodes.

There is a neat [Helpers.daml](https://github.com/jimmychu0807-da/daml-course/blob/main/assignment/multi-participant/daml/Helpers.daml) that is written by [Wallace](https://github.com/wallacekelly-da/daml-public-demos/blob/daml-script-participant-config/daml/Helpers.daml) for retrieving and allocating party in a remote participant node and submitting command and polling for completion.

## Theory - What issues arise when scaling a daml project to multiple nodes? How could those issues be mitigated when building a real-world Daml project?

During testing with localnet, I just stop and start the localnet to upload the dar file with the same name and version to multiple participants during the development iteration.

In real-world Daml project, when the testnet is deployed across multiple orgs, they cannot be stop and start at one's will, so one have to increment the dar version during the test iteration so the project code can be accepted.

Also, currently I have hard-coded the ledger user jwt tokens in the participant-config file. In real-world, one would need to query an IAM server to get the necessary user credential to query and submit commands to the testnet.

# Canton Transaction Basics. Focus: Learn about Canton Transaction Processing and How it Implements Privacy

## Theory - review our documentation on [API user rights](https://docs.digitalasset.com/build/3.4/sdlc-howtos/applications/secure/authorization.html#access-tokens-and-rights)

It use OAuth 2.0 and the access token is issued in the form of jwt.

Encoding signature:

```
{
  "alg": "RS256",
  "typ": "JWT"
}
```
Audience-based tokens

```
{
   "aud": "https://daml.com/jwt/aud/participant/someParticipantId",
   "sub": "someUserId",
   "iss": "someIdpId",
   "exp": 1300819380
}
```
The `aud` and `sub` fields are the required fields. The rest are optional.

## Theory - how does Daml break down a transaction into nodes? What are transaction views? Why does the Daml engine break transactions into sub-transactions?

A transaction consists of one or more action node, speicifically on:

- **create**: creating a template. It will has no more subsequent actions.
- **consuming exercise option**: exercising a choice on a template, which could cause more action. Archive the contract.
- **non-consuming exercise option**: exercising a choice on a template, but doesn't archive the contract.
- **fetch**: fetching a contract. It will has no more subsequent actions.

So a transaction could form a tree of action node based on the consequences of the root action. An example is shown below, showing the [**ProposeSimpleDvP::AcceptAndSettle**](./templates/daml/LedgerModel.daml) choice.

![action-tree](./assets/action-node.svg)

These actions (the transaction) are perform atomically on the Canton ledger, they either executed successfully altogether or not, there is no partial execution of these action nodes.

Transaction views are also known as transaction projections. They are a subset of the action nodes (sub-tree) which are entitled to be seen by a particular party in a participant node. For a party to be able to see the action, they need to be an informee of the action.

- For **contract** creation: signatory and contract observer are the informees.
- For **consuming** exercise choice: signatory, contract observer, choice controller, choice observer are the informees.
- For **non-consuming** exercise choice: signatory, choice controller, choice observer are the informees.
- For **fetching** action: signatory, choice controller are the informees.

Daml engine breaks them into sub-transaction / transaction projections so these projections are then encrypted and eventually sent to the corresponding participant node to validate. In details, the following happen:

1. The submitting participant node forms all the needed transaction projections (tp), encrypt them, and send them to the sequencer.
2. The sequencer sends these tp to the corresponding participant nodes that host the informee parties.
3. These participant nodes run the daml model logic and validate the result. The results are sent back to the sequencer.
4. The sequencer forward these results to the mediator to get a final verdict on whether the transaction is valid or not.
5. The verdict, either a **commit** or **reject** depends on whether the tx is deemed valid, is then return back to the sequencer and get broadcast back to the informee participant nodes.

## Hands on - contrive a couple of daml choice definitions that generate different numbers of transaction views, but at the application level achieve the same goal

For example we want to create a DvP trade that can be audited. There are two approaches.

1. Add the **auditor** party in the DvP trade template. So the auditor can observe the lifecycle and data of the contract.
2. Create an AuditTrail contract derived from the DvP trade. When the trade is executed, create such an audit trail contract.

The first way is implemented as follows.

```daml
template AuditableTradeV1
  with
    party1: Party
    party2: Party
    auditor: Party
    asset1: ContractId SimpleAsset
    asset2: ContractId SimpleAsset
  where
    signatory party1, party2
    observer auditor

    choice Settle: (ContractId SimpleAsset, ContractId SimpleAsset)
      with
        actor: Party
      controller actor
      do
        assert (actor == party1 || actor == party2)
        transferredAsset1 <- exercise asset1 Transfer with newOwner = party2
        transferredAsset2 <- exercise asset2 Transfer with newOwner = party1
        return (transferredAsset1, transferredAsset2)
```

The second way is implemented as follows.

```daml
template AuditableTradeV2
  with
    party1: Party
    party2: Party
    asset1: ContractId SimpleAsset
    asset2: ContractId SimpleAsset
    auditor: Party
  where
    signatory party1, party2

    choice SettleWithAuditTrail: (ContractId SimpleAsset, ContractId SimpleAsset)
      with
        actor: Party
      controller actor
      do
        assert (actor == party1 || actor == party2)

        asset1Info <- fetch asset1
        asset2Info <- fetch asset2

        transferredAsset1 <- exercise asset1 Transfer with newOwner = party2
        transferredAsset2 <- exercise asset2 Transfer with newOwner = party1

        create AuditTradeTrail with
          asset1 = asset1Info
          asset2 = asset2Info
          ..

        return (transferredAsset1, transferredAsset2)

template AuditTradeTrail
  with
    party1: Party
    party2: Party
    asset1: SimpleAsset
    asset2: SimpleAsset
    auditor: Party
  where
    signatory party1, party2
    observer auditor
```

The first way is more direct and less complex in the transaction view generation.

The second way is more complex but offer more flexibility. For instance we can anonymize certain information or add extra notes when before generating an AuditTradeTrail.

The full code and a daml script can be seen in [`AuditableTrade.daml`](templates/daml/AuditableTrade.daml)

## Theory - learn how to infer the authorizers and informees of a transaction (and subtransaction)

As shown in the table below:

![action-informee](./assets/action-informee.png) ([src](https://docs.canton.network/overview/reference/ledger-model-detailed#informee))

For each type of action (create, consuming ex, non-consuming ex, fetch), we can see the corresponding informees from the above table.

In term of authorizers, the key realization is the authorization scope. In particular, when exercising a choice, one is authorized, in addition as the choice controller party, also as the signatory party.

That's why the propose-accept pattern (shown below) works.

```daml
template TradeProposal
  with
    proposer: Party
    counterparty: Party
    asset: Text
    price: Decimal

  where
    signatory proposer
    observer counterparty

    choice Accept: ContractId Trade
      controller counterparty
      do
        create Trade with
          buyer = counterparty
          seller = proposer
          ..

template Trade
  with
    buyer: Party
    seller: Party
    asset: Text
    price: Decimal
  where
    signatory buyer, seller
```

Say Alice creates a **TradeProposal** contract with Bob as counterparty. When Bob exercises the `Accept` choice in the contract (the only one signing the tx), he is in the authorization scope of the signatory Alice. That's why he could create the Trade contract that require both the seller (Alice) and buyer (Bob) to be the signatories.

Without this authorization scope, we would need both Alice and Bob to submit a transaction together to create a **Trade** contract.

## Theory - learn about [Canton transaction processing](https://docs.daml.com/canton/architecture/overview.html)

![transaction processing](./assets/canton-tx-processing.svg)

There are two kind of nodes in a sync domain - sequencer and mediator.

Sequencer received the encrypted views of transactions and order them. Afterward the sequencer will distribute these encrypted views to the corresponding informee participant nodes for validation.

For each participant node operator, the node will decrypt data and validate the sub-transactions and send back a confirmation to the sequencer.

The mediator will collect all the confirmations from the informee participant nodes and reach a verdict if a transaction is valid or not. The verdict will pass back to the sequencer which send the result back to the informee particiant nodes.

# Focus: Off-ledger automations and trigger patterns

The following use the localnet setup.

`<token>` is [generated here](https://github.com/canton-network/splice/blob/main/cluster/compose/localnet/docker/console/entrypoint.sh#L15-L19) and is as follow during the exercise.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCIsInN1YiI6ImxlZGdlci1hcGktdXNlciJ9.A0VZW69lWWNVsjZmDDpVvr1iQ_dJLga3f-K2bicdtsc
```

## Upload a dar

**POST /v2/dars**

Reading the dar file in raw binary format and put it in the request body.

```ts
const options = {
  method: 'POST',
  headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/octet-stream'},
  body: JSON.stringify('<string>')
};

fetch('https://api.example.com/v2/dars', options)
```

ref: https://docs.canton.network/reference/json-api-reference/post-v2dars

## List dars

**GET /v2/packages**

ref: https://docs.canton.network/reference/json-api-reference/get-v2packages

## Allocate a party

**POST /v2/parties**

Include the following in the request body

```ts
  body: JSON.stringify({
    partyIdHint: '<string>',
    localMetadata: {resourceVersion: '<string>', annotations: {}},
    identityProviderId: '<string>',
    synchronizerId: '<string>',
    userId: '<string>'
  })
```

ref: https://docs.canton.network/reference/json-api-reference/post-v2parties

## Allocate an external party

**POST /v2/parties/external/allocate**

ref: https://docs.canton.network/reference/json-api-reference/post-v2partiesexternalallocate

## Grant rights from a user to a party

1. During creating the party above, specify the `userId` in the body.

   https://docs.canton.network/reference/json-api-reference/post-v2parties#body-user-id

2. Using the endpoint:

   **POST /v2/users/:user-id/rights**

   Inside the body:

   ```ts
    body: JSON.stringify({
      userId: '<string>',
      rights: [{kind: {CanActAs: {value: {party: '<string>'}}}}]
    })
   ```
   https://docs.canton.network/reference/json-api-reference/post-v2users:user-idrights

## Create a contract

1. **/v2/commands/submit-and-wait-for-transaction**

   Send the `CreateCommand` inside the request body.

   ```ts
   body: JSON.stringify({
     commands: {
      commands: [
        {
          CreateCommand: {
            templateId: '<string>',
            createArguments: '<unknown>',
          }
        }
       ],
       commandId: '<string>',
       actAs: ['<string>'],
       userId: '<string>',
     }
   })
   ```

   This one will wait for its result and return the transaction.

2. There are also:
   - **POST /v2/commands/submit-and-wait**, and
   - **POST /v2/commands/async/submit**

Questions:

- what is the difference between [`async/submit`](https://docs.canton.network/reference/json-api-reference/post-v2commandsasyncsubmit) and [`async/submit-reassignment`](https://docs.canton.network/reference/json-api-reference/post-v2commandsasyncsubmit-reassignment)?

## Exercise a choice

Same as above, but inside the request body, use the `ExerciseCommand`.

```ts
body: JSON.stringify({
  commands: {
    commands: [
      {
        ExerciseCommand: {
          templateId: '<string>',
          contractId: '<string>',
          choice: '<string>',
          choiceArguments: '<unknown>',
        }
      }
    ],
    commandId: '<string>',
    actAs: ['<string>'],
    userId: '<string>',
  }
})
```

## Check on the status of a submitted command by command ID

Not sure. On the [`async/submit` page](https://docs.canton.network/reference/json-api-reference/post-v2commandsasyncsubmit), it mentions the triple (user_id, act_as, command_id) constitutes the change ID for the intended ledger change, where act_as is interpreted as a set of party names.

The change ID can be used for matching the intended ledger changes with all their completions. So do we use the command ID to form the change ID triplet and use it to look up the command status?

## Explore a transaction by update ID

**POST /v2/updates/update-by-id**

The request body

```ts
const requestBody = JSON.stringify({
  updateId: '<string>',
  updateFormat: {
    includeReassignments: {
      filtersByParty: {},
      filtersForAnyParty: {cumulative: [{identifierFilter: {Empty: {}}}]},
      verbose: true
    },
    includeTopologyEvents: {includeParticipantAuthorizationEvents: {parties: ['<string>']}}
  }
})
```

https://docs.canton.network/reference/json-api-reference/post-v2updatesupdate-by-id

Notice that this is a POST and not a GET request. It probably cause the FETCH action to be recorded.

## Explore a transaction by offset

**POST /v2/updates/update-by-offset**

Body

```ts
const requestBody = JSON.stringify({
  "offset": <absolute-offset>
});
```

https://docs.canton.network/reference/json-api-reference/post-v2updatesupdate-by-offset

Question:

- what offset is it? What is the base?

## List active contracts

**POST /v2/state/active-contracts**

Body

```ts
const body = JSON.stringify({
  activeAtOffset: 123,
  filter: {
    filtersByParty: {},
    filtersForAnyParty: {cumulative: [{identifierFilter: {Empty: {}}}]}
  },
  verbose: true,
  eventFormat: {
    filtersByParty: {},
    filtersForAnyParty: {cumulative: [{identifierFilter: {Empty: {}}}]},
    verbose: true
  },
  streamContinuationToken: '<string>'
})
```

https://docs.canton.network/reference/json-api-reference/post-v2stateactive-contracts

## Check a contract’s contents and type by contract ID

**POST /v2/contracts/contract-by-id**

Body:

```ts
const options = {
  body: JSON.stringify({
    contractId: '<string>',
    queryingParties: ['<string>']
  })
};
```

https://docs.canton.network/reference/json-api-reference/post-v2contractscontract-by-id

## Check if a contract is archived by ID

Not sure, maybe **POST /v2/contracts/contract-by-id**, and check for the contract status?

## Get the participant node’s latest offset, and last pruned offset

For latest offset

**GET /v2/state/ledger-end**

https://docs.canton.network/reference/json-api-reference/get-v2stateledger-end

For last pruned offset

**GET /v2/state/latest-pruned-offsets**

https://docs.canton.network/reference/json-api-reference/get-v2statelatest-pruned-offsets

## Theory - what value does PQS offer over using the ledger API directly?

It is a postres database with helper functions such as:

- `active(<fqn template name>)` - this cmd retrieves all the active contract set of the template name.

- `lookup_contract(<contract_id>)` - this cmd looks up the info of a particular contract

- `lookup_exercises(<contract_id>)` - this cmd looks up all exercise choices toward a contract

So you can do complex relational query toward the database. As the query is operated by the DBMS, it also doesn't use the machine resources of the validator node.

- You can also `prune` the transaction data in the PQS, keeping tx data starting from a certain offset.

- There is also a `reset` action allowing you to remove all tx data after a certain offset.

## Theory - what APIs does PQS provide for “freezing” the ledger offset during queries? What is the use case/benefit of such APIs?

Using `set_oldest(offset)` and `set_latest(offset)` to set the upper and lower bound (range) of the ledger offset. Use `validate_offset_exists(offset)` to validate if the PQS has seen the particular offset.

## Theory - research error handling. Which errors are likely to be transient errors? Which ones are likely to depend on the application design?

src: https://docs.canton.network/appdev/reference/error-codes

In each error, it includes the error category.

Category 1-3: they are likely transient errors.

- Category 1 (unavailable)
- Category 2 (aborted)
- Category 3 (deadline exceeded)

Category 6-7: they are on authentication & permission related errors.

Category 8: Invalid JWT user token.

Category 9 - 12 are related to state-dependent and likely depend on the application design.

# Focus: Canton Coin, Token Stardard V1, Token Standard V2

## Hand-on: Set up transfer preapproval on localnet. How does transfer preapproval change the transfer workflow?

Transfer in high-level is a two-transaciton process.

The first tx is the "sent" side:

- the sender create a transfer instruction, lock his own balance (called Amulet) in Canton space, and have his own free balance updated. Some event logs are also created.

The second tx is on the receiver side:

- He accepts the transfer instruction (**AmuletTransferInstruction**) created by the sender. Then unlock the locked amulet. A new amulet contract is created to reflect the receiver new balance. Along the way, some event log choices (**EventLog_HoldingsChange**) are being exercised.


With the preapproval made, this become a single transaction.

The receiver will have a **TransferPreapproval** contract created. The sender will exercise the choice **TransferFactory_Transfer** from ExternalPartyAmuletRules, and then call **TransferPreapproval_SendV2** of the receiver TransferPreapproval contract.

Then, a few amulet contracts are created and archived to reflect the latest balance of the sender and receiver, as well as a few **EventLog_HoldingsChange** choices exercised.

## Theory - What ledger commands establish the transfer preapproval? What automations are involved? What Daml design pattern is used here?

The splice-wallet:Splice.Wallet.TransferPreapproval: TransferPreapprovalProposal contract should be first created by the provider, and then the receiver executes the **TransferPreapprovalProposal_Accept** choice.

The src of the daml code is [seen here](https://github.com/canton-network/splice/blob/main/daml/splice-wallet/daml/Splice/Wallet/TransferPreapproval.daml).

This is the typical propose-accept pattern.

## Theory - the token standard APIs for metadata, holdings, and transfers. What API call(s) are required to perform a token standard transfer of Canton Coin?

the Token Standard API for metadata:

Requests sent to the super validator node - global synchronizer

Use `GET /registry/metadata/v1/info` to get the DSO party ID.

Use `GET /registry/metadata/v1/instruments` to get all instruments managed by this admin.

In localnet, send the request to `http://scan.localhost:4000` server following the above endpoints, which is handled by the Scan App of the super validator node.


### To get user holdings

There are 3 ways to do that:

#### 1. Querying Ledger API

Call 1 - get the current ledger offset:

GET /v2/state/ledger-end

```sh
curl "${PARTICIPANT_URL}/v2/state/ledger-end" \
  -H "Authorization: Bearer ${JWT}"
```

Call 2 - query the contract for the party ID

POST /v2/state/active-contracts

with the following body

```json
{
  "activeAtOffset": "<ledger-offset>",
  "filter": {
    "filtersByParty": {
      "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2": {
        "cumulative": [{
          "identifierFilter": {
            "InterfaceFilter": {
              "value": {
                "interfaceId": "#splice-api-token-holding-v2:Splice.Api.Token.HoldingV2:Holding",
                "includeInterfaceView": true,
                "includeCreatedEventBlob": true
              }
            }
          }
        }]
      }
    }
  }
}
```

#### 2. Scan API

- hitting the super validator 
- For Scan API, you don't need the authorization bearer token.

In localnet, to get someone holding, call the following:

POST /api/scan/v1/holdings/summary

With the following body:

```json
{
  "migration_id": 0,
  "record_time": "2026-08-21T08:21:00Z",
  "record_time_match": "at_or_before",
  "owner_party_ids": [
    "sv::12208f1ff1f4b32818fe4009163d3d915f5ca6d1950bb22910054988878f99284b03",
    "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2"
  ]
}
```

- `migration_id` starts at 0 and indicates the protocol upgrade.
- In localnet, it is mostly 0, there is no protocol upgrade.

Return value:

```json
{
  "record_time": "2026-08-22T06:00:00Z",
  "migration_id": 0,
  "summaries": [
    {
      "party_id": "sv::12208f1ff1f4b32818fe4009163d3d915f5ca6d1950bb22910054988878f99284b03",
      "total_unlocked_coin": "88021304.0791680000",
      "total_locked_coin": "0.0000000000",
      "total_coin_holdings": "88021304.0791680000"
    },
    {
      "party_id": "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2",
      "total_unlocked_coin": "88680.1600000000",
      "total_locked_coin": "0.0000000000",
      "total_coin_holdings": "88680.1600000000"
    }
  ]
}
```

- It is not getting the latest value, seems, or it is a cached value, not the current holding value, as indicated in the returned "recorded_time".

#### 3. Validator Wallet API

The request is sent to:

GET http://wallet.localhost:2000/api/validator/v0/wallet/balance

This is forwarded to the splice container validator **localhost:2903**.

It doesn't take any request body, and use JWT to recognize which user the sender is checking against. It is not the ledger-api-user jwt token but need to construct another JWT for the particular user that you check.

To construct the JWT, user the following params:

header:
```json
{"alg": "HS256", "typ": "JWT"}
```

payload:
```json
{
  "sub": "app-user",
  "aud": "https://canton.network.global",
  "iat": 1787459944,
  "exp": 1787463544
}
```

then sign with secret `unsafe`.

We get JWT token:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhcHAtdXNlciIsImF1ZCI6Imh0dHBzOi8vY2FudG9uLm5ldHdvcmsuZ2xvYmFsIiwiaWF0IjoxNzg3NDU5OTQ0LCJleHAiOjE3ODc0NjM1NDR9.OjOOxgI5bhcIeQdehQo0NHFQH7owlH5TT9GbxPFaz2Y
```

Notice in JWT, the first two segments are encoded, not encrypted. The third segment signature is the proof of you are whom you claim.

Some other endpoints:

GET /v0/wallet/user-status - to get user status

GET /v0/wallet/amulets - list UTXO

### To perform a transfer using token standard API

What API call(s) are required to perform a token standard transfer of Canton Coin?

Step 0: Get the admin ID:

GET http://scan.localhost:4000/registry/metadata/v1/info

adminId = DSO::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b

Step 1: Find out the input UTXO balance from the sender to use

POST http://json-ledger-api.localhost:2000/v2/state/active-contracts
Auth: app-user JWT

with request body:
```json
{
  "activeAtOffset": 7122,
  "filter": {
    "filtersByParty": {
      "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2": {
        "cumulative": [{
          "identifierFilter": {
            "InterfaceFilter": {
              "value": {
                "interfaceId": "#splice-api-token-holding-v2:Splice.Api.Token.HoldingV2:Holding",
                "includeInterfaceView": true,
                "includeCreatedEventBlob": true
              }
            }
          }
        }]
      }
    }
  }
}
```

The contract ID: `00438a419301f1b52fdea18324dd84a5eb4ac1f515cf86a75a2d7382079aab34a1ca1212200618e0e580c38d63d213a12eea3e6dcdda05beafee86a46bef93f68de85013c9`

Step 2: Registry: transfer factory (offer context)

POST http://scan.localhost:4000/registry/transfer-instruction/v2/transfer-factory

This request is sending to a registry component. This is to get the factory and choice context for initiating a transfer workflow.

request body:

```json
{
  "choiceArguments": {
    // https://github.com/canton-network/splice/blob/8bc2e0756dd6a8da3fa3de75239021934d210801/token-standard/splice-api-token-transfer-instruction-v2/daml/Splice/Api/Token/TransferInstructionV2.daml#L232
    "transfer": {
      "sender": {
        "owner": "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2",
        "provider": null,
        "id": ""
      },
      "receiver": {
        "owner": "sv::12208f1ff1f4b32818fe4009163d3d915f5ca6d1950bb22910054988878f99284b03",
        "provider": null,
        "id": ""
      },
      "amount": "107.0",
      "instrumentId": {
        "admin": "DSO::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
        "id": "Amulet"
      },
      "requestedAt": "2026-08-23T06:15:38Z",
      "executeBefore": "2026-08-24T06:15:48Z",
      "inputHoldingCids": [
        "00438a419301f1b52fdea18324dd84a5eb4ac1f515cf86a75a2d7382079aab34a1ca1212200618e0e580c38d63d213a12eea3e6dcdda05beafee86a46bef93f68de85013c9"
      ],
      "meta": {
        "values": {
          "splice.lfdecentralizedtrust.org/reason": "localnet TS v2 offer 107 AMT"
        }
      }
    },
    "actors": [
      "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2"
    ],
    "extraArgs": {
      "context": { "values": {} },
      "meta": { "values": {} }
    }
  },
  "excludeDebugFields": true
}
```

Response:

```json
{
  "factoryId": "004807579b29503dae16537ca7bf60a6a5ed5969adf04a0cb24229cad209f9fc20ca12122005916634b793eae07c7ebe43b9c672a381c4dc998122a7519a790e6e524e6ef5",
  "transferKind": "offer",
  "choiceContext": {
    "choiceContextData": {
      "values": {
        "open-round": {
          "tag": "AV_ContractId",
          "value": "00a75697b9aecac7468e4b3748f0f8a55db3dae4cb0c88c0e6d5a2820012895cfbca121220f86ef1ead30fb6785268165585cbd74674cfcb211c05d2ed1fa631532ed23137"
        },
        "external-party-config-state": {
          "tag": "AV_ContractId",
          "value": "00df1b2b02b6aa5f6064f20363ffd2d2ebc4da6a51dd39d7245fde6401c294331eca121220d9f8dd35f89109142788c4c0dd405cf4d8452789444aa9aa528efd1a3338f113"
        },
        "amulet-rules": {
          "tag": "AV_ContractId",
          "value": "00c602c3bfc6fb2f720fdbfc5be5851eafeebb908d23be2c9f446afa3f0a637c74ca1212200fecdd17a23305935cf40f70aaa12b872d1dc370ba496cbc1e6aa456c2ac51b7"
        }
      }
    },
    "disclosedContracts": [
      {
        "templateId": "fb10433a48c24f30076a7aee03a3e314b7ab02fe9a22e2069e3af92d2b6ac88a:Splice.AmuletRules:AmuletRules",
        "contractId": "00c602c3bfc6fb2f720fdbfc5be5851eafeebb908d23be2c9f446afa3f0a637c74ca1212200fecdd17a23305935cf40f70aaa12b872d1dc370ba496cbc1e6aa456c2ac51b7",
        "createdEventBlob": "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",
        "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
        "debugPackageName": null,
        "debugPayload": null,
        "debugCreatedAt": null
      },
      {
        "templateId": "fb10433a48c24f30076a7aee03a3e314b7ab02fe9a22e2069e3af92d2b6ac88a:Splice.Round:OpenMiningRound",
        "contractId": "00a75697b9aecac7468e4b3748f0f8a55db3dae4cb0c88c0e6d5a2820012895cfbca121220f86ef1ead30fb6785268165585cbd74674cfcb211c05d2ed1fa631532ed23137",
        "createdEventBlob": "CgMyLjESlQYKRQCnVpe5rsrHRo5LN0jw+KVds9rkywyIwObVooIAEolc+8oSEiD4bvHq0w+2eFJoFlWFy9dGdM/LIRwF0u0fpjFTLtIxNxINc3BsaWNlLWFtdWxldBpiCkBmYjEwNDMzYTQ4YzI0ZjMwMDc2YTdhZWUwM2EzZTMxNGI3YWIwMmZlOWEyMmUyMDY5ZTNhZjkyZDJiNmFjODhhEgZTcGxpY2USBVJvdW5kGg9PcGVuTWluaW5nUm91bmQi2ANq1QMKTQpLOklEU086OjEyMjA2ZGVjODE3NGM2ZTI0NmVkODJiMDYwNjFlYTlkMmY4ZjE3ZDBkYzA3MjRhZTJhNTAzNGI2YzRmNjRjOTRkMDdiCgsKCWoHCgUKAximBAoQCg4yDDAuMDA1MDAwMDAwMAoLCgkpUpLkJrFZBgAKCwoJKVIea26xWQYACg8KDWoLCgkKBxiAyKGszQkKkgEKjwFqjAEKFgoUahIKEAoOMgwwLjAwMDAwMDAwMDAKFgoUahIKEAoOMgwwLjAwMDAxOTAyNTkKHAoaahgKEAoOMgwwLjAwMDAwMDAwMDAKBAoCWgAKFgoUahIKEAoOMgwwLjAwMDAwMDAwMDAKEAoOMgwxLjAwMDAwMDAwMDAKBQoDGMgBCgUKAxjIAQoECgIYZAqUAQqRAWqOAQoaChgyFjQwMDAwMDAwMDAwLjAwMDAwMDAwMDAKEAoOMgwwLjA1MDAwMDAwMDAKEAoOMgwwLjE1MDAwMDAwMDAKEAoOMgwwLjIwMDAwMDAwMDAKEgoQMg4xMDAuMDAwMDAwMDAwMAoQCg4yDDAuNjAwMDAwMDAwMAoUChJSEAoOMgwyLjg1MDAwMDAwMDAKDgoMagoKCAoGGICYmrwEKklEU086OjEyMjA2ZGVjODE3NGM2ZTI0NmVkODJiMDYwNjFlYTlkMmY4ZjE3ZDBkYzA3MjRhZTJhNTAzNGI2YzRmNjRjOTRkMDdiOVJMIQOxWQYAQioKJgokCAESIMa91qG+9TPnnyJw4oGPK6J2Z/kc8Y5GmxFoyOx7GgbOEB4=",
        "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
        "debugPackageName": null,
        "debugPayload": null,
        "debugCreatedAt": null
      },
      {
        "templateId": "fb10433a48c24f30076a7aee03a3e314b7ab02fe9a22e2069e3af92d2b6ac88a:Splice.ExternalPartyConfigState:ExternalPartyConfigState",
        "contractId": "00df1b2b02b6aa5f6064f20363ffd2d2ebc4da6a51dd39d7245fde6401c294331eca121220d9f8dd35f89109142788c4c0dd405cf4d8452789444aa9aa528efd1a3338f113",
        "createdEventBlob": "CgMyLjESiQQKRQDfGysCtqpfYGTyA2P/0tLrxNpqUd051yRf3mQBwpQzHsoSEiDZ+N01+JEJFCeIxMDdQFz02EUniURKqapSjv0aMzjxExINc3BsaWNlLWFtdWxldBp+CkBmYjEwNDMzYTQ4YzI0ZjMwMDc2YTdhZWUwM2EzZTMxNGI3YWIwMmZlOWEyMmUyMDY5ZTNhZjkyZDJiNmFjODhhEgZTcGxpY2USGEV4dGVybmFsUGFydHlDb25maWdTdGF0ZRoYRXh0ZXJuYWxQYXJ0eUNvbmZpZ1N0YXRlIrABaq0BCk0KSzpJRFNPOjoxMjIwNmRlYzgxNzRjNmUyNDZlZDgyYjA2MDYxZWE5ZDJmOGYxN2QwZGMwNzI0YWUyYTUwMzRiNmM0ZjY0Yzk0ZDA3YgoLCglqBwoFCgMYmgMKEAoOMgwwLjAwNTAwMDAwMDAKMAouaiwKFgoUahIKEAoOMgwwLjAwMDAxOTAyNTkKBQoDGMgBCgUKAxjIAQoECgIYZAoLCgkpBzngv8pZBgAqSURTTzo6MTIyMDZkZWM4MTc0YzZlMjQ2ZWQ4MmIwNjA2MWVhOWQyZjhmMTdkMGRjMDcyNGFlMmE1MDM0YjZjNGY2NGM5NGQwN2I5B3kxhKJZBgBCKgomCiQIARIg0ZXKuhuH93eOkAN1nWXBC6SYthOHK2FmETgZl7alC/sQHg==",
        "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
        "debugPackageName": null,
        "debugPayload": null,
        "debugCreatedAt": null
      },
      {
        "templateId": "fb10433a48c24f30076a7aee03a3e314b7ab02fe9a22e2069e3af92d2b6ac88a:Splice.ExternalPartyAmuletRules:ExternalPartyAmuletRules",
        "contractId": "004807579b29503dae16537ca7bf60a6a5ed5969adf04a0cb24229cad209f9fc20ca12122005916634b793eae07c7ebe43b9c672a381c4dc998122a7519a790e6e524e6ef5",
        "createdEventBlob": "CgMyLjESqQMKRQBIB1ebKVA9rhZTfKe/YKal7VlprfBKDLJCKcrSCfn8IMoSEiAFkWY0t5Pq4Hx+vkO5xnKjgcTcmYEip1GaeQ5uUk5u9RINc3BsaWNlLWFtdWxldBp+CkBmYjEwNDMzYTQ4YzI0ZjMwMDc2YTdhZWUwM2EzZTMxNGI3YWIwMmZlOWEyMmUyMDY5ZTNhZjkyZDJiNmFjODhhEgZTcGxpY2USGEV4dGVybmFsUGFydHlBbXVsZXRSdWxlcxoYRXh0ZXJuYWxQYXJ0eUFtdWxldFJ1bGVzIlFqTwpNCks6SURTTzo6MTIyMDZkZWM4MTc0YzZlMjQ2ZWQ4MmIwNjA2MWVhOWQyZjhmMTdkMGRjMDcyNGFlMmE1MDM0YjZjNGY2NGM5NGQwN2IqSURTTzo6MTIyMDZkZWM4MTc0YzZlMjQ2ZWQ4MmIwNjA2MWVhOWQyZjhmMTdkMGRjMDcyNGFlMmE1MDM0YjZjNGY2NGM5NGQwN2I5501G+3hZBgBCKgomCiQIARIgF83CP9JTdQaa3r4X9l9BUBDPLTDBSuJA3TfxabaERUEQHg==",
        "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
        "debugPackageName": null,
        "debugPayload": null,
        "debugCreatedAt": null
      }
    ]
  }
}
```

Step 3 - Sender: exercise TransferFactory_Transfer

POST http://json-ledger-api.localhost:2000/v2/commands/submit-and-wait-for-transaction

Auth: app-user JWT

request body

```json
{
  "commands": {
    "commandId": "ts-v2-offer-107-7b9d290b",
    "userId": "app-user",
    "actAs": [
      "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2"
    ],
    "readAs": [
      "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2"
    ],
    "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
    "disclosedContracts": [
      {
        "templateId": "<from registry>",
        "contractId": "<from registry>",
        "createdEventBlob": "<from registry>",
        "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b"
      }
    ],
    "commands": [{
      "ExerciseCommand": {
        "templateId": "#splice-api-token-transfer-instruction-v2:Splice.Api.Token.TransferInstructionV2:TransferFactory",
        "contractId": "004807579b29503dae16537ca7bf60a6a5ed5969adf04a0cb24229cad209f9fc20ca12122005916634b793eae07c7ebe43b9c672a381c4dc998122a7519a790e6e524e6ef5",
        "choice": "TransferFactory_Transfer",
        "choiceArgument": {
          "transfer": { "...same as step 2..." },
          "actors": [
            "app_user_localnet-localparty-1::122076f7623d7b1f6789059d1e10f96831b3b1bdc2614ec1337b92a00cea9bc288e2"
          ],
          "extraArgs": {
            "context": { "...choiceContextData from registry..." },
            "meta": { "values": {} }
          }
        }
      }
    }]
  }
}
```

TransferInstruction CID:
`00cb9f8243226dff0e408553453693f5b62dd6568895616a66debf327809c2f3ebca1212207ea9acb5f18e4f63b7cc630acbf3a362b503b3476648ff15ede3c7eaae10c74e`

Step 4 - Registry: accept choice context

POST http://scan.localhost:4000/registry/transfer-instruction/v2/00cb9f8243226dff0e408553453693f5b62dd6568895616a66debf327809c2f3ebca1212207ea9acb5f18e4f63b7cc630acbf3a362b503b3476648ff15ede3c7eaae10c74e/choice-contexts/accept

You need to get the choice context from the registry first before accepting

request body:

```json
{ "meta": {}, "excludeDebugFields": true }
```


Response: choiceContextData (includes expire-lock: true, open-round, amulet-rules, …) + disclosed contracts including the LockedAmulet.

Step 5 - Receiver: exercise TransferInstruction_Accept

POST http://canton.localhost:4000/v2/commands/submit-and-wait-for-transaction
Auth: sv JWT

request body

```json
{
  "commands": {
    "commandId": "ts-v2-accept-107-cbd47cda",
    "userId": "sv",
    "actAs": [
      "sv::12208f1ff1f4b32818fe4009163d3d915f5ca6d1950bb22910054988878f99284b03"
    ],
    "readAs": [
      "sv::12208f1ff1f4b32818fe4009163d3d915f5ca6d1950bb22910054988878f99284b03"
    ],
    "synchronizerId": "global-domain::12206dec8174c6e246ed82b06061ea9d2f8f17d0dc0724ae2a5034b6c4f64c94d07b",
    "disclosedContracts": [ /* from step 4 — keep createdEventBlob */ ],
    "commands": [{
      "ExerciseCommand": {
        "templateId": "#splice-api-token-transfer-instruction-v2:Splice.Api.Token.TransferInstructionV2:TransferInstruction",
        "contractId": "00cb9f8243226dff0e408553453693f5b62dd6568895616a66debf327809c2f3ebca1212207ea9acb5f18e4f63b7cc630acbf3a362b503b3476648ff15ede3c7eaae10c74e",
        "choice": "TransferInstruction_Accept",
        "choiceArgument": {
          "actors": [
            "sv::12208f1ff1f4b32818fe4009163d3d915f5ca6d1950bb22910054988878f99284b03"
          ],
          "extraArgs": {
            "context": { /* choiceContextData from step 4 */ },
            "meta": { "values": {} }
          }
        }
      }
    }]
  }
```

## Theory - More generally, what role do the token standard APIs play in token standard transfer? Why can’t everything just be done through the ledger API?

The 5-step flow, reframed

| Step | API | What it does |
|------|-----|--------------|
| 1 | Ledger API | Read sender holdings (input UTXOs) |
| 2 | **Registry API** | Resolve factory + choice context |
| 3 | Ledger API | Sender exercises `TransferFactory_Transfer` |
| 4 | **Registry API** | Resolve accept context |
| 5 | Ledger API | Receiver exercises `TransferInstruction_Accept` |

Steps 2 and 4 are registry; 1, 3, and 5 are ledger. The **on-ledger state changes** happen only in steps 3 and 5.

### What role do Token Standard APIs play?

They are the **off-ledger companion** to the on-ledger Daml interfaces (`TransferFactory`, `TransferInstruction`, `Holding`, etc.).

Rough split:

| Token Standard API | Role |
|--------------------|------|
| **Metadata** (`/registry/metadata/v1/...`) | Which instrument, admin party, supported API versions |
| **Holdings** (Scan summary or Ledger ACS) | Portfolio view |
| **Transfer Instruction** (`/registry/transfer-instruction/v2/...`) | How to *initiate* and *advance* a transfer for this registry |

The registry API answers implementation-specific questions a generic wallet cannot hardcode:

- Which `factoryId` to use right now?
- `offer` vs `direct` vs `self`?
- Which contracts must be **disclosed** (`AmuletRules`, `OpenMiningRound`, `LockedAmulet`, …)?
- What goes in `extraArgs.context` (`open-round`, `amulet-rules`, `expire-lock`, …)?

That is **registry logic**, not ledger logic.

### Why query the registry API specifically?

1. Factory discovery
   `TransferFactory` is a long-lived registry contract. Wallets should not scan the whole ledger or maintain hardcoded CIDs. The registry returns the current `factoryId`.

2. Dynamic choice context
   Context depends on **live ledger state** (current mining round, rules contract, locked amulet for accept). The registry reads that state and returns fresh `choiceContextData` + `disclosedContracts`.

3. Cross-participant visibility (explicit disclosure)
   Sender and receiver often sit on **different participant nodes** (`json-ledger-api.localhost:2000` vs `canton.localhost:4000`). Contracts like `AmuletRules` may not be visible to the submitting party’s node until disclosed. The registry packages the blobs the submitter must attach.

   Without step 2’s disclosed contracts, step 3 would fail with missing-contract / visibility errors.

4. Workflow routing
   `transferKind: "offer"` vs `"direct"` tells the wallet whether a second accept step is needed. That depends on receiver preapproval — registry logic, not something the raw ledger API exposes cleanly.

5. Interoperability
   Same wallet flow for Canton Coin, a DA Registry token, or another CIP-56/112 implementation: metadata + transfer-instruction endpoints; implementation details stay in the registry.

### Mental model

```
┌─────────────────┐     "How do I transfer?"      ┌──────────────────┐
│  Wallet / App   │ ─────────────────────────────►│  Registry API    │
│                 │◄───────────────────────────── │  (off-ledger)    │
└────────┬────────┘   factoryId, context, blobs   └──────────────────┘
         │
         │  "Execute this command"
         ▼
┌─────────────────┐
│  Ledger API     │  ← only place that mutates on-ledger state
│  (participant)  │
└─────────────────┘
```

- **Registry** = translator / orchestrator (read-heavy, no auth on Scan in localnet)
- **Ledger** = authoritative execution layer (auth required, creates/archives contracts)

Step 2 does **not** create the factory; it **looks up** an existing one and prepares the exercise. Step 3 is where the sender actually acts on-ledger.

# Focus: External Party Hosting

## Hands-On - allocate an external party on localnet

Refer to the script here:
https://github.com/digital-asset/canton/blob/main/community/app/src/pack/examples/08-interactive-submission/external_party_onboarding.sh

1. Get the synchronizerId
   
   ```sh
   GET http://json-ledger-api.localhost:2000/v2/state/connected-synchronizers
   ```

   The synchronizerId: "global-domain::1220bd72c869107de2bfb4e0fa1c80a280935497e1992c7b58a0888152576161edab"

2. Generate a public/private key

3. Send a generate topology requests

   ```sh
   POST http://json-ledger-api.localhost:2000/v2/parties/external/generate-topology
   ```

   ```json
    {
      "synchronizer" : "global-domain::1220bd72c869107de2bfb4e0fa1c80a280935497e1992c7b58a0888152576161edab",
      "partyHint" : "jimmychu0807",
      "publicKey" : {
        "format" : "CRYPTO_KEY_FORMAT_DER_X509_SUBJECT_PUBLIC_KEY_INFO",
        "keyData": "MCowBQYDK2VwAyEA3AB+vSMlgXW4HPdc0ZyLBauZTbXf8JRYDU+L4Q4+2Rk=",
        "keySpec" : "SIGNING_KEY_SPEC_EC_CURVE25519"
      },
      "otherConfirmingParticipantUids" : []
    }
   ```
   
   Return
   ```json
   {
    "partyId": "jimmychu0807::1220676c8aac018d37ec757ef601f395444e4ce4a46d11f76ed0c1c53c971f8fe1d3",
    "publicKeyFingerprint": "1220676c8aac018d37ec757ef601f395444e4ce4a46d11f76ed0c1c53c971f8fe1d3",
    "topologyTransactions": [
        "CvQBCAEQARrtAUrqAQpSamltbXljaHUwODA3OjoxMjIwNjc2YzhhYWMwMThkMzdlYzc1N2VmNjAxZjM5NTQ0NGU0Y2U0YTQ2ZDExZjc2ZWQwYzFjNTNjOTcxZjhmZTFkMxABGlUKUXBhcnRpY2lwYW50OjoxMjIwNDk1NTgxNTAzM2FmZDE3YmViMGVkZDFjZjA4ZTBmMjNlYzYzZTZhZjcwNTQ5YzE5Y2UxZjA2NTJlNDQyNzNjZBACMjsKNxAEGiwwKjAFBgMrZXADIQDcAH69IyWBdbgc91zRnIsFq5lNtd/wlFgNT4vhDj7ZGSoDAQUEMAEQARAe"
    ],
    "multiHash": "EiAG3WRs7xUBjABh7QjR1P0lq1Su1eg0DS7JiLUME7gT8g=="
   }
   ```

4. Sign the multi-hash using the private key
  
   signature: lSxpJzoN743ffjGftfA6Rougzk4epwN2MKB2R3q3BzKamMUDU3hyOJGZA4pxvdIM5u/ncE/u9ZZdP1z/hWJ0Cw==

5. Submitting onboarding tx

   ```sh
   POST http://json-ledger-api.localhost:2000/v2/parties/external/allocate
   ```

   json
   ```json
    {
      "synchronizer" : "global-domain::1220bd72c869107de2bfb4e0fa1c80a280935497e1992c7b58a0888152576161edab",
      "onboardingTransactions": [
        { 
          "transaction": "CvQBCAEQARrtAUrqAQpSamltbXljaHUwODA3OjoxMjIwNjc2YzhhYWMwMThkMzdlYzc1N2VmNjAxZjM5NTQ0NGU0Y2U0YTQ2ZDExZjc2ZWQwYzFjNTNjOTcxZjhmZTFkMxABGlUKUXBhcnRpY2lwYW50OjoxMjIwNDk1NTgxNTAzM2FmZDE3YmViMGVkZDFjZjA4ZTBmMjNlYzYzZTZhZjcwNTQ5YzE5Y2UxZjA2NTJlNDQyNzNjZBACMjsKNxAEGiwwKjAFBgMrZXADIQDcAH69IyWBdbgc91zRnIsFq5lNtd/wlFgNT4vhDj7ZGSoDAQUEMAEQARAe"
        }
      ],
      "multiHashSignatures": [{
         "format" : "SIGNATURE_FORMAT_CONCAT",
         "signature": "lSxpJzoN743ffjGftfA6Rougzk4epwN2MKB2R3q3BzKamMUDU3hyOJGZA4pxvdIM5u/ncE/u9ZZdP1z/hWJ0Cw==",
         "signedBy" : "1220676c8aac018d37ec757ef601f395444e4ce4a46d11f76ed0c1c53c971f8fe1d3",
         "signingAlgorithmSpec" : "SIGNING_ALGORITHM_SPEC_ED25519"
      }]
    }
   ```

   return

   ```json
   {
     "partyId": "jimmychu0807::1220676c8aac018d37ec757ef601f395444e4ce4a46d11f76ed0c1c53c971f8fe1d3"
   }
   ```

## Theory - what rights does a ledger API user need to submit a command on behalf of an external party?

canExecuteAs

## Hands-On - submit an externally-signed transaction

major ref:
- https://docs.canton.network/appdev/deep-dives/external-signing-transactions

The key steps

1. Prepare the transaction, converting from a ledger command to a prepared_transaction obj and transaction hash using gRPC endpoint **com.daml.ledger.api.v2.interactive.InteractiveSubmissionService/PrepareSubmission**.

   For JSON api: [`POST /v2/interactive-submission/prepare`](https://docs.canton.network/reference/json-api-reference/post-v2interactive-submissionprepare)

2. Sign the prepared_transaction_hash with your private key. This become the signature.

3. Submit the prepared transaction with your signature to gRPC endpoint **com.daml.ledger.api.v2.interactive.InteractiveSubmissionService/ExecuteSubmission**.

   The submission retrieves an empty json object `{}`.

   For JSON api: [`POST /v2/interactive-submission/execute`](https://docs.canton.network/reference/json-api-reference/post-v2interactive-submissionexecute)

4. To observe the the update, first get the completion stream using gRPC endpoint **com.daml.ledger.api.v2.CommandCompletionService/CompletionStream**

5. From the completion stream, get the updateID **com.daml.ledger.api.v2.UpdateService/GetUpdateById**.

   Refer to external-signing/interactive-submission directory.

## Hands-On - allocate an external party hosted on multiple nodes.

If you are allocating an multiple nodes, then 

1. On the generate topology request (`POST /v2/parties/external/generate-topology`), your requst body

   ```json
    {
      "synchronizer" : "global-domain::1220bd72c869107de2bfb4e0fa1c80a280935497e1992c7b58a0888152576161edab",
      "partyHint" : "jimmychu0807",
      "publicKey" : {
        "format" : "CRYPTO_KEY_FORMAT_DER_X509_SUBJECT_PUBLIC_KEY_INFO",
        "keyData": "MCowBQYDK2VwAyEA3AB+vSMlgXW4HPdc0ZyLBauZTbXf8JRYDU+L4Q4+2Rk=",
        "keySpec" : "SIGNING_KEY_SPEC_EC_CURVE25519"
      },
      "otherConfirmingParticipantUids" : ["another-participant-id1", ...]
    }
   ```

2. And submit the external allocate request (`POST /v2/parties/external/allocate`) to all the participant node JSON api.


# Focus: Wallet SDK, wallet gateway

# Focus: Registry app and dAppified registry UI

# Focus: External party allocation - different permissions + confirmation thresholds
