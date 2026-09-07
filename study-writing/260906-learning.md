# Smart Contract Upgrade and Mugration Upgrade Tool

In Canton network, there is an automatic smart contract upgrade mechanism. For example, say we have the following smart contract.

```daml
module Carbon where

template CarbonCert
  with
    issuer : Party
    owner : Party
    carbon_metric_tons : Int
  where
    signatory issuer, owner
```

Now, we want to upgrade the smart contract by adding a new data field, `expired` of `Date`. To use the automatic smart contract upgrade, we use an Optional field instead of the plain Date time field, i.e. 

```daml
module Carbon where

template CarbonCert
  with
    issuer : Party
    owner : Party
    carbon_metric_tons : Int
    expired: Optional(Date)
  where
    signatory issuer, owner
```

Now after the new version of the smart contract has been compiled into DAR and upload to the participant node. When you retrieve the same contract, your contract is automatically upgraded with the new `expired` field added with value set to **null**.

(Automatic) Smart Contract Upgrade (SCU) works in the following conditions:

- appending optional data field
- modifying the logic of a choice
- adding a new choice


but it won't work in the following conditions:

- removing a data field
- reodering a model data fields
- adding a non-optional data field
- removing a choice
- changing the interface (input parameters) of a choice

## Migration Upgrade Tool (MUT)

In the case when you need to perform an upgrade that isn't supported by SCU, Canton team has also built the necessary migration tool so you can upgrade the the contract. 

It is called Migration Upgrade Tool. Users would need to have the [jFrog Artifactory](https://digitalasset.jfrog.io/) with `daml-upgrade` access to download the tool.

For an overview, in this migration process, you can fully specify the upgrade logic from each old template to the new template. Then the upgrade admin specify a party as `upgrade-coordinator` to initiate the upgrade. Then the `upgrade-coordinator` will create upgrade proposals for each of the signatory parties (`upgrader`) in the involved upgrade contracts. All `upgrader`s will then accept the proposals. Afterwards, execute the actual `upgrade` (another ledger call), and finally performing the cleanup on the ledger.

The [Migration Upgrade Playbook](https://github.com/jimmychu0807-da/mut-upgrade/blob/main/assets/Migration%20Upgrade%20Playbook.pdf) also comes with the tool. Here I will briefly go over the flow of using the tool. For the detail operational step-by-step guide, please refer to the playbook mentioned above.

1. Upgrade admin needs to have both the DARs of the old version contracts and new version contracts.
2. Then run the MUT `codegen` command to generate an upgrade project, something as follows:

   ```
   java -jar migration-upgrade-codegen.jar generate \
     --old <path-to-old-dar> \
     --new <path-to-new-dar> \
     --output-directory <path-to-output> \
     --upgrade-version <ver>
   ```

3. Once the `codegen` command has completed, inspect the generated upgrade directory. There are two key sub-directories inside the upgrade project.
   
   - `daml/Generated` - it is the code on contract upgrade that could automatically run for the upgrade process.
   - `daml/Upgrade` - it is the code on contract upgrade that need further developer adjustment, i.e. setting the default value or adding custom logic on the contract migration.

4. Once the upgrade project have been fine-tuned, compile the upgrade project itself into a DAR.

5. Now, upload three dars to the participant node. Then the upgrade admin could initiate the upgrade process by sending a on-ledger request with the `upgrade-coordinator` party. Again, for details of the rest of upgrade process (it is a six-step process), please refer to the Migration Upgrade Handbook.

## Reference

