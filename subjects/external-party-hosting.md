# External Party Hosting on Canton Network

Curated notes from [Canton Network Docs](https://docs.canton.network/) (as of 2026-08-26). Focus: what external parties are, how they are hosted on validators/participants, multi-hosting, onboarding, and related ops.

## Selected pages (7)

| # | Page | Why it matters |
| --- | --- | --- |
| 1 | [Local and External Parties](https://docs.canton.network/overview/reference/external-party) | Core model: SPN/CPN/OPN, local vs external, trust |
| 2 | [External Signing](https://docs.canton.network/appdev/deep-dives/external-signing) | Hosting relationship overview and permission levels |
| 3 | [Multi-Hosting and Resilience](https://docs.canton.network/appdev/deep-dives/multi-hosting) | HA, thresholds, multi-host setup for new parties |
| 4 | [External Signing: Party Onboarding](https://docs.canton.network/appdev/deep-dives/external-signing-onboarding) | Ledger API generate → sign → allocate flow |
| 5 | [Onboard External Parties in Quickstart](https://docs.canton.network/appdev/quickstart/external-parties) | End-to-end LocalNet / validator API walkthrough |
| 6 | [Party Management](https://docs.canton.network/global-synchronizer/production-operations/party-management) | Replication / adding hosts after the party exists |
| 7 | [Creating an External Party](https://docs.canton.network/sdks-tools/sdks/wallet-sdk/guides/creating-an-external-party) | Wallet SDK path to create and host |

Related (not summarized in depth here): [External Signing: Submitting Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-transactions), [External Signing: Topology Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-topology), JSON/gRPC `generate-topology` / `allocate` / interactive submission APIs.

---

## Cross-cutting summary

**External party** = submission key holder with **no** Submitting Participant Node (SPN), own namespace key, and **at least one** Confirming Participant Node (CPN). Hosting is expressed by a `PartyToParticipant` topology mapping: which validators host the party, at which permission (Confirmation / Observation — never Submission for external parties), and confirmation threshold.

**Hosting vs signing:** Validators store ledger state and confirm; the party alone signs topology changes and Daml transaction hashes. Submission uses prepare → inspect/sign → execute (interactive submission). Any connected participant can prepare/execute; confirmations come from hosting CPNs.

**Multi-hosting:** Include extra confirming UIDs (and optional threshold) at onboard time, or later via party replication. All hosting validators must authorize the mapping; for external parties the **party namespace key** must also sign. Prefer multi-hosting **before** the party is a stakeholder; after that use offline ACS replication.

---

## Page summaries

### 1. Local and External Parties

**URL:** https://docs.canton.network/overview/reference/external-party

**Summary:** Explains how parties attach to participant nodes via hosting relationships and permissions:

- **SPN (Submission):** Can unilaterally authorize Daml submissions for the party (defines a *local* party).
- **CPN (Confirmation):** Confirms valid transactions; threshold of CPNs must agree. Tradeoff: higher threshold → more security, less availability.
- **OPN (Observation):** Read/record path only.

A **submission key holder** controls its own signing keys (and optional multi-key threshold) in `PartyToParticipant`. **Local parties** share a namespace with an SPN and entrust that node with keys. **External parties** have zero SPNs, their own namespace, and sign every submission; they still need ≥1 CPN for confirmation and state.

**Submission flow (external):** Preparing Participant Node (PPN) interprets commands → party inspects/validates/signs the hash → Executing Participant Node (EPN) forwards to the synchronizer → CPNs validate the external signature and confirm. Read path: query CPNs/OPNs (cross-check for BFT).

**Limitations called out:** External submissions currently support single root node and single submitting party; completions/dedup are tied to the EPN used.

**Trust model (short):** Do not trust PPN (always recompute hash); do not fully trust EPN for completions; trust fewer than threshold CPNs. Multi-CPN + threshold > 1 mitigates malicious confirmer risk. Multi-hosting for external parties requires the party’s namespace key on topology updates (including hosting maps).

---

### 2. External Signing

**URL:** https://docs.canton.network/appdev/deep-dives/external-signing

**Summary:** Tutorial hub framing parties as logical actors whose state is hosted on chosen validators. Identities are `name::keyFingerprint`; topology transactions (signed by affected parties/validators) define who hosts whom and with which keys.

**Hosting setups:**

| Setup | Authorizing key | Validator permission |
| --- | --- | --- |
| Internal (local) party | Validator key; user auth via JWT | **Submission** |
| External party | User-held private key | **Confirmation** or **Observation** only |

**Multi-hosted parties:** Host on several validators with a confirmation threshold so no single validator must be fully trusted. Required topology for a usable party: party name + signing key(s), hosting validators + permissions + threshold, and any namespace delegations. Hosting choices dominate security/availability; party replication across nodes is an ops procedure (covered elsewhere), not this section.

Transaction path for external keys: prepare on a validator → sign transaction hash → submit signed payload → observe via hosting validators. Submission need not go through a hosting node.

---

### 3. Multi-Hosting and Resilience

**URL:** https://docs.canton.network/appdev/deep-dives/multi-hosting

**Summary:** Why and how to host one party on multiple validators (HA, geo redundancy, migration, malicious-operator resistance). Topology `PartyToParticipant` carries permissions and threshold. For **external** parties, submission runs on any host with **Confirmation**; the synchronizer fans out views so all hosts stay consistent.

**Permissions:** Submission (local only) / Confirmation / Observation (read replicas, audit, migration staging).

**New external parties:** Pass `otherConfirmingParticipantUids` (+ optional `confirmationThreshold`) into generate-topology; upload signed allocate payloads to **each** hosting validator’s Ledger API. Incomplete auth → proposal; signatures merge until fully authorized. (Adding hosts to **existing** parties = [party replication](https://docs.canton.network/global-synchronizer/production-operations/party-management#simple-party-replication); external party must sign the mapping.)

Also covers Canton Console propose/authorize for internal multi-host, PQS/data resilience, cost (more confirmers → more traffic), and when to prefer backups vs multi-host vs observation nodes.

---

### 4. External Signing: Party Onboarding

**URL:** https://docs.canton.network/appdev/deep-dives/external-signing-onboarding

**Summary:** Hands-on Ledger API onboarding via `examples/08-interactive-submission/external_party_onboarding.sh`:

1. Resolve synchronizer id (`/v2/state/connected-synchronizers`).
2. Generate Ed25519 key (OpenSSL; not production-safe as shown).
3. `POST /v2/parties/external/generate-topology` with synchronizer, party hint, public key, optional `otherConfirmingParticipantUids` / threshold.
4. Sign returned **multi-hash** (or each tx) with the party key.
5. `POST /v2/parties/external/allocate` with onboarding txs + signatures.

Convenience generate is fine if the node is trusted; otherwise inspect/rebuild txs and recompute hashes before signing. Repeat allocate per synchronizer as needed.

**Multi-hosted variant:** `--multi-hosted` fills `otherConfirmingParticipantUids` and submits allocate to the second participant. Console example shows propose → `list_hosting_proposals` → `authorize` for internal parties (illustrates the same proposal merge model).

---

### 5. Onboard External Parties in Quickstart

**URL:** https://docs.canton.network/appdev/quickstart/external-parties

**Summary:** Same concepts against CN Quickstart LocalNet (validator + shared-secret JWT). Motivations: party-controlled keys, regulatory-friendly auth, independence from operator-held submission keys.

Flow:

1. Admin JWT → validator `.../external-party/topology/generate` with party hint + hex public key.
2. Response: `party_id` + three topology txs (root namespace, party-to-participant with Confirmation, party-to-key) and per-tx hashes.
3. Sign each hash; `.../topology/submit`.
4. Verify via Ledger API parties / topology list (async; may need short retry).

**Using the party:** InteractiveSubmissionService prepare → sign hash (prefer client-side recompute in prod) → execute. Completions via `CompletionStream`; use `GetUpdates` by offset (not `GetUpdateById`) because external parties auth by signature, not ledger user `can_read_as`.

---

### 6. Party Management

**URL:** https://docs.canton.network/global-synchronizer/production-operations/party-management

**Summary:** Ops guide for local allocate/enable, then **multi-host / replication**. Points external onboarding to the external-party tutorial.

**Party replication** = add another host on the **same** synchronizer (source → target). Prefer **simple** replication **before** any Daml activity; otherwise **offline** ACS export/import. Replication ≠ migration (offboarding source is not supported yet).

**Authorization:** Party and new host both consent via party-to-participant topology. **External parties** must sign hosting updates with the namespace key (`update_external_party_hosting`-style helper). For non-topology “source” actions, use an existing confirming participant.

**External vs local multi-host:** Locals start single-hosted then amend mapping; externals can declare multi-host **at creation**. When adding a host later, external permission must be Confirmation or Observation (not Submission). Threshold for externals is typically set at onboard; simultaneous threshold change during simple replication is described mainly for local parties.

Offline path: mutual consent with onboarding flag → export ACS from source → disconnect target → import → clear onboarding flag (strict ordering; coordinate pruning).

---

### 7. Creating an External Party (Wallet SDK)

**URL:** https://docs.canton.network/sdks-tools/sdks/wallet-sdk/guides/creating-an-external-party

**Summary:** Application-level wrapper around the same topology generate/sign/allocate pattern. Typical flow: `SDK.create` → `sdk.keys.generate()` → `sdk.party.external.create(publicKey, { partyHint }).sign(privateKey).execute()`. Also shows splitting `topology()` / external `signTransactionHash(multiHash)` / `execute(signature)` for custody-style signing. Party id fingerprint must match key fingerprint. Points to the deep-dive onboarding tutorial for lower-level Python/script detail.

---

## Suggested reading order

1. **Local and External Parties** — vocabulary and trust.
2. **External Signing** — how hosting + permissions fit together.
3. **Multi-Hosting and Resilience** — when/how to multi-host.
4. **External Signing: Party Onboarding** *or* **Quickstart** — implement onboard.
5. **Party Management** — add hosts later / ACS replication.
6. **Wallet SDK Creating an External Party** — if building on the TS SDK.

## Further reading

- [External Signing: Submitting Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-transactions) — prepare/execute after hosting is in place
- [External Signing: Topology Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-topology) — generic topology beyond convenience APIs
- [POST /v2/parties/external/generate-topology](https://docs.canton.network/reference/json-api-reference/post-v2partiesexternalgenerate-topology) — API schema
- Docs index: https://docs.canton.network/llms.txt
