## 260810: Canton coin transfer

When transferring canton coin on localnet. One way is using the propose-accept pattern. The sender party propose to send the amount, and then the receiver party choose to accept the payment.

Another way is that the receiver preapprove to accept payment, and then the sender could directly send a payment and the amount transferred to the receiver balance.

For a preapproval, the following contract and exercise choices are involved.

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

The full create and exercise events can be seen at: [`./canton-token/transfer-preapproval.json`](./canton-token/transfer-preapproval.json)

Now when a sender transfer token to 
