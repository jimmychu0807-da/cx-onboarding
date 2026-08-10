# 260810: Canton Coin Transfer

When transferring canton coin on localnet. One way is using the propose-accept pattern. The sender party propose to send the amount, and then the receiver party choose to accept the payment.

Another way is that the receiver preapprove to accept payment, and then the sender could directly send a payment and the amount transferred to the receiver balance.

## Normal Transfer Initiated

The full create and exercise event is [here](./update-tracing/transfer-initiated.json)

1. Splice.Api.Token.TransferInstructionV1:TransferFactory contract with 
   - choice: **TransferFactory_Transfer** exercised, with params
   	 - sender
   	 - receiver
   	 - amount

2. Splice.Amulet:Amulet, archive the contract, this is the prev balance of the sender

3. Splice.Amulet:LockedAmulet, an amount of 100 is locked from the sender.

4. Splice.Amulet:Amulet is created, with the remaining amount for the sender created.

5. ExternalPartyConfigState:ExternalPartyConfigState
   - choice: EventLog_HoldingsChange
   - with the sender leg recorded

6. An AmuletTransferInstruction:AmuletTransferInstruction is created
   - contract ID: **00e12349f09a916b329cb41b7bbf44e81033d01a25b70787251e90965e3799539eca1212205f117a0f2c7160aecb9b53aa67d0dbfdff9418e06ebc04768b978d17e39ea7a8**
	 - for the receiver to accept the instruction

## Transfer Preapproval

For a preapproval, the following contract and exercise choices are involved.

The full create and exercise events can be seen at: [`update-tracing/transfer-preapproval.json`](./update-tracing/transfer-preapproval.json)

1. PreapprovalProposal created 
	- a PreapprovalProposal contract is created with payload:
		- provider: receiver if self-signed
		- receiver: the receiver addr
		- DSO party ID
	- actingParty: the calling party

2. a TransferPreapprovalProposal contract choice exercised:
	- TransferPreapprovalProposal_Accept
	- inputAmulet: "0079ed022a9405cf378b19e..."
	- the calling party

3. A AmuletRules contract choice exercised:
	- AmuletRules_CreateTransferPreapproval

4. Create a Splice.AmuletRules:TransferPreapproval contract
	- the transfer preapproval is valid for 90 days

## Transfer after Transfer Preapproval

Now when a sender transfer token to the sender with preapproval, the following flow happens.

The full create and execise events can be seen at: [`update-tracing/preapproved-transfer.json`](./update-tracing/preapproved-transfer.json)

1. Sender triggers the contract/exercise: splice-amulet:Splice.ExternalPartyAmuletRules:ExternalPartyAmuletRules with exercise choice: **TransferFactory_Transfer**
	 - this comes from **TransferInstructionV1:TransferFactory**
	 - it specifies the sender, receiver, and amount transfer, with "payment"
	 - The ExternalPartyAmuletRules implements the Api.Token.TransferInstructionV1.TransferFactory

2. On the TransferPreapproval created above (00308d88c411f987a75475e8cbd6917fd7dbfda9a4ab8ccd56d82379d0b663a0caca121220f3949d9f7f04d463cf119d4d0d456ea594d247842b6a9456d16d2a7c336cb613)
	 - sender exercise choice **TransferPreapproval_SendV2** (non-consuming)

3. An Amulet contract is archived - containing the old balance of the sender

4. A new amulet contract is created, that is the receiver balance

5. An amulet contract is created - containing the new balance of the sender

6. A contract of Splice.ExternalPartyConfigState:ExternalPartyConfigState with choice:
   - "EventLog_HoldingsChange", notifying receiver balance change
   - the receiving leg
   - acting party: the DSO super validator

7. A contract of Splice.ExternalPartyConfigState:ExternalPartyConfigState with choice:
   - "EventLog_HoldingsChange", notifying sender balance change
   - the sending leg
   - acting party: the DSO super validator
