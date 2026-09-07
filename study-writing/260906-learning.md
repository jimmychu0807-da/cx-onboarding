# Smart Contract Upgrade and Mugration Upgrade Tool

last update: 2026 Sep 6th

Canton network has an automatic smart contract upgrade mechanism. For example, say we have the following smart contract.

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

Now we want to upgrade the smart contract by adding a new data field `expired` of `Text`. To use the automatic smart contract upgrade, add an Optional field instead of the plain Text field. For example, as follows: 

```daml
module Carbon where

template CarbonCert
  with
    issuer : Party
    owner : Party
    carbon_metric_tons : Int
    expired: Optional(Text)
  where
    signatory issuer, owner
```

Now after the new version of the smart contract has been compiled into DAR and uploaded to the participant node, when retrieving the same contract, the contract is automatically upgraded with the new `expired` field added with the value set to **null**.

(Automatic) Smart Contract Upgrade (SCU) works in the following conditions:

- appending optional data field
- modifying the logic of a choice
- adding a new choice

It won't work in the following conditions:

- removing a data field
- reodering model data fields
- adding a non-optional data field
- removing a choice
- changing the interface (input parameters) of a choice

## Migration Upgrade Tool (MUT)

In the case it is necessary to perform an upgrade that isn't supported by SCU, Canton team has also built Migration Upgrade Tool (MUT) to manual upgrade the contracts. Users would need to have the [jFrog Artifactory](https://digitalasset.jfrog.io/) with `daml-upgrade` access to download the tool.

For an overview, in the migration process, one can fully customize the logic of how old templates are upgraded to the new templates. Then the upgrade admin will specify a party as upgrade-coordinator to initiate the upgrade. The upgrade-coordinator will create upgrade proposals for each of the signatory parties (aka upgraders) in the involved upgrade contracts. All upgraders will then accept the proposals (a set of transactions). Afterwards, make an on-ledger call to exercise the **Upgrade** choice from with upgrader. Finally, two cleanup steps are executed to remove all temporary upgrade artifacts on the ledger.

The manual [Migration Upgrade Playbook](https://github.com/jimmychu0807-da/mut-upgrade/blob/main/assets/Migration%20Upgrade%20Playbook.pdf) also comes with the tool. Here I will briefly go over the flow of the usage. For the detail step-by-step operations, please refer to the playbook.

1. Upgrade admin needs to have both the DARs of the old version contracts and new version contracts.

2. Then run the MUT `codegen` command to generate an upgrade project, i.e:

   ```
   java -jar migration-upgrade-codegen.jar generate \
     --old <path-to-old-dar> \
     --new <path-to-new-dar> \
     --output-directory <path-to-output> \
     --upgrade-version <ver>
   ```

3. Once the `codegen` command has completed, inspect the generated upgrade directory. There are two key sub-directories inside the upgrade project.
   
   - `daml/Generated` - this is the contract upgrade code that could automatically run for the upgrade process.
   - `daml/Upgrade` - this is the contract upgrade code that need further developer adjustment, i.e. setting the default value or adding custom logics on the contract migration.

4. Once the upgrade project has been fine-tuned, compile the upgrade project itself into a DAR.

5. Now, upload three dars to the participant node. Then the upgrade admin could initiate the upgrade process by sending a on-ledger request with the `upgrade-coordinator` party. Again, for details of the rest of upgrade process (it is a six-step process), please refer to the Migration Upgrade Handbook.

In any case, I hope both smart contract upgrade routes would have met your need when it come at times for you to upgrade your Canton smart contract logics.

## Reference

Smart Contract Upgrade

- [App Development - Module 6 Smart Contract Upgrades](https://docs.canton.network/appdev/modules/m6-overview) (whole section)
- [App Development - Deep Dives: Smart Contract Upgrade (SCU)](https://docs.canton.network/appdev/deep-dives/smart-contract-upgrade)

Migration Upgrade Tool

- Migration Upgrade Playbook (download from the [jFrog Artifactory](https://digitalasset.jfrog.io/))
