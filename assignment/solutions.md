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

Another endpoint:

GET /v0/wallet/user-status - to get user status

GET /v0/wallet/amulets - list UTXO

### To perform a transfer using token standard API

What API call(s) are required to perform a token standard transfer of Canton Coin?


## Theory - More generally, what role do the token standard APIs play in token standard transfer? Why can’t everything just be done through the ledger API?

## Hands-On - perform a token-standard transfer of Canton Coin using the token standard and ledger APIs.

# Focus: Wallet SDK, wallet gateway

# Focus: Registry app and dAppified registry UI

# Focus: External party allocation - different permissions + confirmation thresholds
