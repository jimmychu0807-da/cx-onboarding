# Smart Contract Upgrade (SCU) and Migration Upgrade Tool (MUT)

Curated notes from [Canton Network Docs](https://docs.canton.network/) and [Daml SDK upgrade docs](https://docs.daml.com/upgrade/upgrade.html) (as of 2026-08-31).

**Scope of this note:** how Canton lets Daml packages evolve in place (SCU), and how to migrate contracts when SCU is not enough (explicit `Upgrade` choices + MUT / upgrade runner).

## SCU vs MUT (mental model)

| | **SCU** | **MUT / explicit migration** |
| --- | --- | --- |
| What it is | Ledger feature: multiple versions of the *same* package name coexist; payloads are upgraded/downgraded at runtime | Process + (Enterprise) tool: archive old contracts and create new ones |
| When to use | Additive, backward-compatible changes (optional fields, new choices, choice-body bug fixes) | Breaking changes (rename/remove fields, change types, new required data, new template identity) |
| Existing contracts | Stay as-is; new code can fetch/exercise them | Must be converted; the ledger does **not** auto-migrate |
| Downtime | Designed for zero downtime | May incur workflow downtime until ACS is converted |
| Consent | Compatibility rules + package vetting | Signatories must authorize the archive+create (usually via a consuming `Upgrade` choice) |

**MUT is not named on docs.canton.network.** Canton pages talk about an “upgrade runner” / “backend automation.” The public write-up of the Enterprise **migration / upgrade tool** is on [docs.daml.com](https://docs.daml.com/upgrade/automation.html).

---

## Selected pages

| # | Page | Angle |
| --- | --- | --- |
| 1 | [Smart Contract Upgrades Overview](https://docs.canton.network/appdev/modules/m6-overview) | Why SCU exists; async rollout + sync switch-over |
| 2 | [Upgrade Compatibility](https://docs.canton.network/appdev/modules/m6-upgrade-compatibility) | Allowed vs breaking changes; compiler enforcement |
| 3 | [Smart Contract Upgrade (SCU) deep dive](https://docs.canton.network/appdev/deep-dives/smart-contract-upgrade) | Stack-wide rules, `upgrades:` field, package preference |
| 4 | [Package Selection](https://docs.canton.network/appdev/modules/m6-package-selection) | Which version runs when v1 and v2 coexist |
| 5 | [Upgrade Deployment](https://docs.canton.network/appdev/modules/m6-deployment) | DAR rollout, explicit migration, rollback |
| 6 | [Automating the Upgrade Process](https://docs.daml.com/upgrade/automation.html) | MUT: Enterprise tool + Script/Trigger pattern |

Also useful: [Upgrade Limitations](https://docs.canton.network/appdev/modules/m6-limitations), [Smart Contract Upgrades in Production](https://docs.canton.network/appdev/modules/m7-smart-contract-upgrades), [Smart Contract Upgrading Reference](https://docs.canton.network/appdev/deep-dives/smart-contract-upgrading-reference), [Upgrading Daml Applications](https://docs.daml.com/upgrade/upgrade.html), [Writing Your First Upgrade](https://docs.canton.network/appdev/modules/m6-writing-first-upgrade), [Testing Upgrades](https://docs.canton.network/appdev/modules/m6-testing-upgrades).

---

## 1. Smart Contract Upgrades Overview

[docs.canton.network/appdev/modules/m6-overview](https://docs.canton.network/appdev/modules/m6-overview)

Canton contracts are immutable and hosted across many organizations’ validators. You cannot run a SQL-style schema migration and you cannot force every org to upgrade on the same day. **SCU** solves that by letting multiple versions of a package (same `name`, higher `version` in `daml.yaml`) sit on the ledger at once, with rules for cross-version interaction.

**Recommended rollout** is two phases:

1. **Asynchronous rollout** — app provider ships v2 backends/frontends that still speak v1. Users upload, audit, and vet independently. Mixed-version deployments are expected.
2. **Synchronous switch-over** — a published date; everyone uploads v2 (if not already), then vets it so v2 becomes the active workflow. Later, v1 can be unvetted.

**When to use SCU vs new templates**

- Use **SCU** for optional fields, new choices, and “existing contracts must keep working without a rewrite.”
- Use **new templates** (and then migrate) when the change is incompatible (removed fields, type changes) or the workflow is logically a different product.

Zero-downtime is the design goal: old contracts do not need to be migrated before v2 is live, as long as they remain readable/exercisable under SCU rules.

---

## 2. Upgrade Compatibility

[docs.canton.network/appdev/modules/m6-upgrade-compatibility](https://docs.canton.network/appdev/modules/m6-upgrade-compatibility)

The compiler enforces SCU at `dpm build` via the `upgrades:` field pointing at the previous DAR. A breaking v2 is rejected at compile time, not discovered in production.

**Allowed (backward-compatible)**

| Change | Notes |
| --- | --- |
| Add `Optional` fields | On templates, choice args, and record choice return types. Old contracts read as `None`. |
| Add variant/enum constructors | New constructors fail if older code sees them (same as non-`None` optional fields). |
| Add choices | Available on existing v1 contracts only after **all stakeholder validators** have uploaded and vetted v2. |
| Change choice body / controller / observers | Bug-fix path. Do not *remove* a choice — deprecate with `abort "Deprecated."`. |
| Change signatories / observers / `ensure` | Code may change, but **recomputed metadata for existing contracts must match** what was stored. `ensure` is re-evaluated on fetch/exercise and must still be `True`. |
| Add templates, interface instances | Interfaces themselves are frozen — keep interface defs in a standalone package. |

**Forbidden (compiler rejects)**

- Remove fields, choices, templates, variant constructors, or interface instances
- Change an existing field’s type
- Change interface definitions

**Breaking-change escape hatch:** new templates + a consuming `Upgrade` choice on the old ones (archive old, create new). That is the MUT path, not SCU.

**Backend rule:** query by **symbolic package name**, not package ID:

```text
#package-name:module-name:template-id
```

That matches every version of the template. Codegens fill missing `Optional` fields with `None`.

---

## 3. Smart Contract Upgrade (SCU) deep dive

[docs.canton.network/appdev/deep-dives/smart-contract-upgrade](https://docs.canton.network/appdev/deep-dives/smart-contract-upgrade)

This is the full technical page. Highlights:

**Checks happen three times:** compile (`upgrades:` in `daml.yaml`), DAR upload (participant validates against packages already stored), and runtime (upgrade/downgrade of payloads).

**Additive only.** New template/record fields must be `Optional` and appended. Variants/enums may only add constructors. You cannot rename, reorder, or delete fields; you cannot move templates between modules; you cannot upgrade interface or exception definitions.

**Package identity.** Packages are addressed by **package name** (the `name:` in `daml.yaml`) as well as package ID. Same name + distinct versions form an upgrade line. Java/TS codegen and PQS prefer package-name queries; PQS `active()` returns all versions unless you filter `package_id`.

**Who knows about SCU?** Only the **participant**. Synchronizers only care that the protocol version is high enough. Ledger API submissions can auto up/downgrade when you submit by package-name. Streaming queries can fetch by package-name.

**Where upgrade/downgrade happens**

- **Command submission** — Canton picks a target package (default: latest known to all informees, overridable via `package_id_selection_preference`) and transforms payloads.
- **Inside a choice** — `fetch` / `exercise` transform the *contract* to the version compiled into the DAR. Choice arguments/results inside that body are **not** further up/downgraded.
- **Clients** (Script, Java/TS codegen) — ledger events are in the *creation* version; clients upgrade/downgrade to the version they were built against.

**Package preference & vetting.** All informee participants must have vetted both the create package and the target package. If a lower version is preferred, the client must list it in `package_id_selection_preference`. Highest version per name should stay vetted. Packages cannot be deleted — only unvetted; a mistaken optional field is stuck in every future version.

**Vetting note from the module pages:** a v1 contract can still be used/upgraded to v2 after v1 is unvetted, as long as v2 is vetted. Unvet v1 only after the ACS you care about has been migrated or naturally archived.

---

## 4. Package Selection

[docs.canton.network/appdev/modules/m6-package-selection](https://docs.canton.network/appdev/modules/m6-package-selection)

The runtime does **not** automatically prefer the newest version. It uses the version **your code was compiled against**.

| Action | Which version runs |
| --- | --- |
| Create | The package your backend imports |
| Fetch | Your code’s version; SCU fills/drops `Optional` fields |
| Exercise | **v2 choice body on a v1 contract** if your code is v2 — this is how choice bug-fixes land on old contracts |

**Cross-version fetch**

- v2 code + v1 contract → new optionals become `None`
- v1 code + v2 contract with all new fields `None` → succeeds (unknown fields ignored)
- v1 code + v2 contract with any new field `Some _` → **fails** (prevents data loss)

The ledger never rewrites a v1 contract into a v2 contract. If you need a populated new field, you archive+create (normal business flow or an explicit `Upgrade` choice).

Use `#package-name:Module:Template` in Ledger API filters so one query sees every version. Hardcoded package IDs force a backend change on every DAR upload.

---

## 5. Upgrade Deployment

[docs.canton.network/appdev/modules/m6-deployment](https://docs.canton.network/appdev/modules/m6-deployment)

This is the Canton page that covers **MUT-style work**: getting DARs onto every relevant validator, then migrating ACS when SCU is not enough.

**Sequence**

1. Upload v2 to your validator (non-destructive; v1 stays).
2. Distribute the DAR to counterparties.
3. Point backends at v2 while still able to speak v1.
4. **If needed:** run migration automation that exercises `Upgrade` choices.
5. Publish a switch-over date; all parties vet v2.
6. Optionally unvet v1 once no v1 contracts remain.

Uncoordinated v2 submissions fail (`FAILED_PRECONDITION` / missing package) if a stakeholder has not uploaded/vetted v2. Explicit disclosure of a v2 contract also fails if the *submitter’s* participant lacks v2.

**How contracts leave v1 (not only MUT)**

- Natural lifecycle end (loan repaid, etc.)
- Organic rewrite: archive+recreate as part of normal updates, creating v2
- **Explicit upgrade** — “ideally by an **upgrade runner**”

Preferred: keep versioning in Daml. Off-ledger ACS/PQS (or other systems) is only needed when v2 cannot be derived from v1 on-ledger.

**Explicit migration recipe (breaking changes)**

1. Consuming `Upgrade` choice on v1: archive old, create new template.
2. Pass defaults / reference data as choice arguments.
3. Backend automation walks the ACS and exercises `Upgrade` on each contract.

**Rollback**

- Compatible upgrade, no v2 creates yet → **unvet v2**.
- v2 already created contracts with populated new fields → cannot read them with v1. **Roll forward:** a newer DAR + `Downgrade` choice that sets new fields back to `None`, then ACS automation.
- Safer split: (1) add unused optional fields, (2) separately change choice bodies to use them — step 2 can be unvetted.

Promote LocalNet → DevNet → TestNet (full switch-over rehearsal) → MainNet.

---

## 6. Automating the Upgrade Process (MUT)

[docs.daml.com/upgrade/automation.html](https://docs.daml.com/upgrade/automation.html)

Companion conceptual page: [Upgrading Daml Applications](https://docs.daml.com/upgrade/upgrade.html).

**Why this exists.** SCU cannot express “this is a different template / required field / renamed column.” Daml also refuses a silent operator-side schema change: signatories agreed to a *specific* template. So a breaking upgrade is itself a Daml workflow: propose-accept, then archive v1 and create v2.

**The public pattern (carbon-certificate example)**

1. Keep v1 and v2 as **separate packages**. A third `*-upgrade` package `data-depends` on both DARs so it can mention both template IDs.
2. **Propose-accept:** issuer creates `Upgrade*Proposal`; owner accepts → `Upgrade*Agreement` (both signatories).
3. **Nonconsuming `Upgrade` choice** on the agreement: fetch the old contract, assert issuer/owner, archive it, create the new template (with defaults such as `"unknown"`).
4. Automation: a one-shot **Daml Script** creates proposals per owner; a long-running **Trigger** (or modern backend job) exercises `Upgrade` as agreements appear. Mark in-flight contract IDs pending so the job is not re-entrant.

**The Enterprise tool (MUT).** The same page states there is a **production-grade, optimized migration tool** that requires a **Daml Enterprise license**, documented in a PDF for developers and ops. It is designed to:

- Tolerate a **stale ACS view** (partial migrations already happened)
- Generate boilerplate for unchanged templates
- Prefer **idempotent** operations
- Handle **very large ACS** sizes
- Handle **rejected commands** — typically by archiving the old contract in the **same transaction** as the replacement create, so you never duplicate replacements

Access: Digital Asset account manager or `support@digitalasset.com`. Canton docs describe the same job as “upgrade runner” / “backend automation” without naming MUT.

---

## Practical takeaways

1. **Stay inside SCU** when you can: optional fields at the end, new choices, choice-body fixes. Point `upgrades:` at the previous DAR and treat `dpm build` as the compatibility gate.
2. **Query by package name**, not package ID. Exercise v2 code against v1 contracts to ship bug-fixes without ACS conversion.
3. **Do not unvet v1** until the ACS you care about is gone (migrated or naturally archived). Packages are never deleted.
4. **Breaking changes are a product workflow**, not a DB migration: `Upgrade` choice + stakeholder consent + ACS walker.
5. **Rollback is unvet or roll-forward**, never “delete the DAR.” Split “add unused fields” from “start using those fields.”
6. **MUT** is the Enterprise ACS walker for (4); without it, you build the same loop with Script, triggers, or your own backend + PQS.

### Production checklist (from Module 7)

- [ ] `dpm build` / `dpm test` + SCU compatibility vs the production DAR
- [ ] Tested on DevNet/TestNet with realistic ACS size
- [ ] Counterparties have the DAR and an agreed rollout window
- [ ] Rollback written down (unvet vs downgrade choice)
- [ ] PQS (or equivalent) watching `package_id` distribution and command error rates
- [ ] Explicit migration plan if any contracts cannot live as v1 under v2 code
