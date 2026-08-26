# External Party Hosting on Canton Network

Curated notes from [Canton Network Docs](https://docs.canton.network/) (as of 2026-08-26).

**Scope of this note:** single-validator hosting *and* multi-host / replication, with both **ops** depth (thresholds, ACS replication, PQS) and **app/SDK** depth (interactive submission, Wallet SDK, Quickstart APIs).

## Selected pages

| # | Page | Angle |
| --- | --- | --- |
| 1 | [Local and External Parties](https://docs.canton.network/overview/reference/external-party) | Model, trust, SPN/CPN/OPN |
| 2 | [External Signing](https://docs.canton.network/appdev/deep-dives/external-signing) | Hosting + permissions overview |
| 3 | [Multi-Hosting and Resilience](https://docs.canton.network/appdev/deep-dives/multi-hosting) | Multi-host setup, thresholds, cost |
| 4 | [External Signing: Party Onboarding](https://docs.canton.network/appdev/deep-dives/external-signing-onboarding) | Ledger API generate → sign → allocate |
| 5 | [Onboard External Parties in Quickstart](https://docs.canton.network/appdev/quickstart/external-parties) | LocalNet / validator API + submit |
| 6 | [Party Management](https://docs.canton.network/global-synchronizer/production-operations/party-management) | Simple + offline replication |
| 7 | [Creating an External Party](https://docs.canton.network/sdks-tools/sdks/wallet-sdk/guides/creating-an-external-party) | Wallet SDK create/sign/execute |
| 8 | [External Signing: Submitting Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-transactions) | InteractiveSubmissionService deep dive |
| 9 | [PQS (Participant Query Store)](https://docs.canton.network/sdks-tools/development-tools/pqs) | Query path + HA across hosts |

Also useful: [External Signing: Topology Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-topology), [PQS operate / HA](https://docs.canton.network/sdks-tools/development-tools/pqs/operate), [POST generate-topology](https://docs.canton.network/reference/json-api-reference/post-v2partiesexternalgenerate-topology).

---

## 1. Mental model

**External party** = submission key holder with:

- **No** Submitting Participant Node (SPN)
- Its **own namespace** (key fingerprint in the party id)
- **≥1 Confirming Participant Node (CPN)** for confirmation + ledger state
- Optional Observing Participant Nodes (OPNs) for read replicas / audit / migration staging

Hosting is a signed `PartyToParticipant` topology mapping: hosts, permissions, confirmation threshold, and (for external parties) the party’s protocol signing key(s).

| Role | Permission | Local party | External party |
| --- | --- | --- | --- |
| SPN | Submission | ≥1 required | **0** (forbidden) |
| CPN | Confirmation | optional | **≥1 required** |
| OPN | Observation | optional | optional |

**Who signs what**

| Action | Signer |
| --- | --- |
| Daml command authorization | Party’s external protocol key(s) |
| Topology / hosting changes | Party’s **namespace** key (+ each affected validator) |
| Transaction confirmation | Hosting CPN protocol keys (threshold of them) |

**Nodes on the submit path (external)**

| Node | Job | Trust |
| --- | --- | --- |
| **PPN** (Preparing) | Interpret commands → prepared tx + hash | Untrusted — inspect + recompute hash |
| **EPN** (Executing) | Forward signed tx to synchronizer | Untrusted for completions (can lie about success/fail) |
| **CPN(s)** | Validate external signature + confirm | Trust &lt; threshold faulty |
| **OPN(s)** | Observe / serve reads | Trust for read path only |

PPN and EPN need not be hosting nodes. Completions and command dedup for a given submission are tied to the **EPN used for that submit**.

---

## 2. Single-validator hosting

### When it fits

- Trust the validator operator for confirmation integrity (threshold = 1, one CPN)
- Accept downtime if that validator is offline
- Simplest ops: one host, optional DB backups, one PQS

### Topology at onboard (typical)

Three topology transactions (validator/Quickstart generate APIs):

1. **Root namespace** — party identity under its own key
2. **Party-to-participant** — host with **Confirmation** (not Submission), threshold usually 1
3. **Party-to-key** — protocol signing key for Daml txs (may also be embedded in `PartyToParticipant.party_signing_keys`)

### Ops checklist (single host)

- Keep namespace + protocol keys in custody (HSM / KMS); demos use OpenSSL on disk — not production
- One PQS sidecar on that validator’s stream; app queries that Postgres
- Backups of participant DB (and PQS DB) are the main recovery story
- Adding a second host later is possible but **harder after the party is a stakeholder** (see §3 offline replication)

### App checklist (single host)

- Onboard: generate topology → sign → allocate/submit (Ledger API, validator API, or Wallet SDK)
- Submit: InteractiveSubmissionService `PrepareSubmission` → sign hash → `ExecuteSubmission*`
- Read: Ledger API updates from the CPN, and/or PQS SQL
- External parties auth by **signature**, not ledger-user `can_read_as` — prefer `GetUpdates` by offset over `GetUpdateById` for post-submit inspection

---

## 3. Multi-host hosting & replication

### Why multi-host

From [Multi-Hosting and Resilience](https://docs.canton.network/appdev/deep-dives/multi-hosting):

- High availability / geo redundancy
- Soft validator migration (add new host, later remove old — offboarding/migration final step still limited)
- Organizational split of operational risk
- **Malicious operator resistance** via confirmation threshold &gt; 1

For external parties, any host with **Confirmation** can be used for the prepare/execute path in practice; the synchronizer delivers views to all hosts so ACS stays consistent across CPNs.

### Confirmation threshold

- `threshold = 1` (default if unset): any one CPN can confirm → max availability, weaker integrity
- `threshold = k` with `k` CPNs: need `k` independent confirmations → stronger integrity, more latency/cost; fewer offline CPNs can block progress
- Threshold &gt; 1 is the main mitigation against a single malicious CPN incorrectly approving (including bad external signatures) or vetting a malicious DAR

**Tradeoff (docs):** higher threshold → higher security, lower availability; lower threshold → opposite.

### Permissions when multi-hosting external parties

- Hosts: **Confirmation** and/or **Observation** only
- Observation hosts: query scaling, audit, pre-staging a migration target — no confirm overhead
- Cost: each Confirmation host processes/confirm traffic; bill grows with confirmers and threshold

### Path A — Multi-host **at creation** (preferred for external)

Unlike local parties (usually single-hosted first, then amended), external parties can declare all hosts in one onboard:

```json
{
  "otherConfirmingParticipantUids": ["PAR::participant2::…"],
  "confirmationThreshold": 1
}
```

Then upload the **same** signed allocate/onboarding payload to **each** hosting validator’s Ledger API. Incomplete authorization → topology **proposal**; signatures merge until fully authorized.

Script path: `external_party_onboarding.sh --multi-hosted` (Canton artifact `examples/08-interactive-submission`).

### Path B — Simple party replication (party **not yet** a stakeholder)

From [Party Management](https://docs.canton.network/global-synchronizer/production-operations/party-management):

1. Create party (external onboard or local enable)
2. Vet packages on **target**
3. Authorize hosting update on source **and** target (same `PartyToParticipant` mapping)
4. Only then use the party in Daml

**External-specific:** party must sign hosting updates with its **namespace** key (`update_external_party_hosting`-style helper). Target permission must be Confirmation or Observation. For non-topology “source” ops, use an existing confirming participant of the external party.

**Replication ≠ migration:** migration would also offboard the source; party offboarding is **not currently supported**.

### Path C — Offline ACS replication (party **already** has contracts)

Strict order (summarized):

1. Target: vet packages
2. Source: ensure retention / pause auto-pruning for export window
3. Target: authorize hosting with **onboarding flag** set (`requiresPartyToBeOnboarded` / `HostingParticipant.Onboarding()`)
4. Target: disconnect all synchronizers; disable auto-reconnect
5. Source/party: authorize same hosting + onboarding flag (**external:** namespace-key signed update)
6. Source: `export_party_acs` at activation offset → `.acs.gz`
7. Optionally re-enable source pruning
8. **Backup target** before import
9. Target: `import_party_acs`
10. Target: reconnect synchronizer(s); restore auto-reconnect if needed
11. Target: clear onboarding flag (auto on PV≥35 if party id passed on import; else manual `clear_party_onboarding_flag`)

Expect transient ACS commitment mismatches during onboarding; ignore until settled. ACS export file must be transferred securely if consoles are not co-located. Test in non-prod first — wrong ordering needs painful manual repair.

### Removing a host

Submit a new topology mapping that drops the validator. Contracts remain on remaining hosts. External party namespace key must authorize the change (and/or participant rules for downgrades per `PartyToParticipant` auth rules).

---

## 4. Ops deep dive

### 4.1 Resilience matrix

| Strategy | Compute (submit/confirm) | Data (query ACS) | Complexity |
| --- | --- | --- | --- |
| Single CPN + DB backups | SPOF until restore | SPOF until restore | Lowest |
| Multi-host, threshold 1 | Failover to other CPN | Need PQS failover too | Medium |
| Multi-host, threshold &gt; 1 | Survives malicious single CPN; blocked if too many CPNs down | Same + cross-check reads | Higher |
| + Observation hosts | No confirm help | Extra read replicas | Medium+ |
| Participant HA replicas (shared DB) | Node process HA for **one** logical participant | Separate from multi-host | Infra-heavy |

Multi-hosting addresses **party↔validator** distribution. Participant **process** HA (replicas + shared Postgres, `replication.enabled`) is a different layer ([performance / HA docs](https://docs.canton.network/global-synchronizer/production-operations/performance-optimization)).

### 4.2 PQS and data resilience

[PQS](https://docs.canton.network/sdks-tools/development-tools/pqs) projects a validator’s transaction stream into PostgreSQL for SQL reads (filters, joins, aggregations) without hammering the Ledger API.

**With multi-hosting:**

- Run **one PQS + one Postgres per hosting validator** (do not share one DB across multiple PQS writers — they contend for exclusive write)
- App should hold multiple connection strings, health-check, and fail over
- Offsets may differ slightly across PQS instances; they converge as the synchronizer catches up — design for eventual consistency ([`validate_offset_exists`](https://docs.canton.network/sdks-tools/development-tools/pqs/operate)-style helpers)
- Optional: share **application** tables in the same Postgres as one PQS via a separate Flyway history table (`-table=myapp_version`); only add non-conflicting indexes

Multi-hosting alone does **not** give query HA; pair it with PQS failover.

### 4.3 Trust / operational responsibilities

From the external-party trust model:

- Choose CPNs carefully; use threshold &gt; 1 if you need fault tolerance against malicious confirmers/package vetting
- On prepare: verify ledger effects, preparation time vs synchronizer time, recompute hash (ignore PPN-provided hash unless PPN trusted)
- On execute: do not blindly trust EPN completions; correlate with CPN transaction streams when needed
- Namespace key = party governance — compromise rewrites hosting and identity authority

### 4.4 Current protocol limitations (external)

- Single root node / single-command prepare (API marked repeated for future multi-command)
- Single submitting party per interactive submission
- Completions + dedup scoped to the EPN of that submission

---

## 5. App / SDK deep dive

### 5.1 Onboarding APIs (three surfaces)

| Surface | Generate | Submit signed topology | Notes |
| --- | --- | --- | --- |
| Ledger JSON API | `POST /v2/parties/external/generate-topology` | `POST /v2/parties/external/allocate` | Multi-hash or per-tx signatures; optional other confirming UIDs |
| Validator (Quickstart) | `…/v0/admin/external-party/topology/generate` | `…/topology/submit` | Hex keys; three txs with individual hashes |
| Wallet SDK | `sdk.party.external.create(…)` | `.sign(…).execute()` or `.topology()` + external sign + `.execute(sig)` | Custody-friendly split |

**Trusted vs untrusted generate:** convenience generate is OK if you trust the node; otherwise build/inspect topology txs and recompute hashes before signing ([topology deep dive](https://docs.canton.network/appdev/deep-dives/external-signing-topology)).

Repeat party allocation **per synchronizer** the party should be active on.

### 5.2 Interactive submission lifecycle

Documented in [Submitting Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-transactions) and Quickstart:

```text
PrepareSubmission  →  (inspect + recompute hash + sign)  →  ExecuteSubmission*
```

**Prepare** (`InteractiveSubmissionService/PrepareSubmission`):

- Needs Ledger API user with **read** rights for `act_as` parties (prepare does not execute)
- Returns `prepared_transaction`, `prepared_transaction_hash`, `hashing_scheme_version` (typically **V2**), optional cost estimate
- Optional `max_record_time` / TTL: after expiry, must prepare + sign again
- Optional `verbose_hashing` for debug only

**Sign:**

- Sign the transaction tree hash with Ed25519 (or registered key spec)
- Production: recompute hash client-side (`daml_transaction_hashing_v2.py` in Canton artifact) — do not trust PPN hash
- Multi-key parties: meet the signing-key threshold in `PartyToParticipant` / party-to-key mapping

**Execute:**

- `ExecuteSubmission` — async
- `ExecuteSubmissionAndWait` / `…ForTransaction` — sync convenience; **responses require trusting the participant** (malicious node can flip success/fail)
- Retry with a **new** `submission_id` without re-signing if the prepared tx is still valid
- Observe via `CompletionStream` on the EPN; confirm ledger effects via CPN `GetUpdates` / PQS

JSON equivalents: `POST /v2/interactive-submission/prepare` and `…/execute`.

### 5.3 Wallet SDK pattern

From [Creating an External Party](https://docs.canton.network/sdks-tools/sdks/wallet-sdk/guides/creating-an-external-party):

**Happy path**

```ts
const key = sdk.keys.generate()
await sdk.party.external
  .create(key.publicKey, { partyHint: 'my-wallet-1' })
  .sign(key.privateKey)
  .execute()
```

**Custody / external signer path**

```ts
const creation = sdk.party.external.create(pub, { partyHint })
const unsigned = await creation.topology()
const sig = signTransactionHash(unsigned.multiHash, priv)
await creation.execute(sig)
```

Verify `publicKeyFingerprint` matches `sdk.keys.fingerprint(publicKey)`. Same interactive prepare/sign/execute pattern applies for later Daml commands once hosted.

### 5.4 Quickstart LocalNet specifics

- Shared-secret JWT via `splice-onboarding` `jwt-cli` (`app-user` for admin topology APIs; `ledger-api-user` for Ledger API)
- Validator topology endpoints under `/api/validator/v0/admin/external-party/…`
- Built-in `Canton.Internal.Ping` useful for first interactive submit without deploying a DAR
- Topology submit is async — short retry when listing parties / `ListPartyToParticipant`

---

## 6. Decision guide

```text
Need party-held keys / no SPN?
  └─ Yes → External party
       ├─ Trust one operator, downtime OK?
       │    └─ Single CPN, threshold 1 + backups + one PQS
       ├─ Need HA / geo / no single confirmer?
       │    └─ Multi-host at creation if possible
       │         ├─ Integrity vs malicious confirmer → threshold > 1
       │         └─ Read scale / migration staging → add Observation hosts
       └─ Already live with contracts, need new host?
            └─ Offline ACS replication (strict runbook)
```

**App stack sketch**

1. Custody: hold namespace + protocol keys
2. Onboard via SDK or generate/allocate; multi-host UIDs if known
3. Submit via InteractiveSubmissionService (or SDK wrappers)
4. Read via PQS (primary) + Ledger API streams (control plane / completions)
5. If multi-host: multi-PQS failover + optional cross-check of CPN streams when threshold &gt; 1

---

## 7. Page summaries (short)

### Local and External Parties

Hosting permissions, local vs external definitions, prepare/execute split, trust model, FAQ on keys and multi-host (external namespace not shared with hosts → party must sign hosting maps).

### External Signing

Tutorial index: identities, hosting relationships, Submission vs Confirmation/Observation ⇒ internal vs external, multi-host thresholds, topology proposals, submit path.

### Multi-Hosting and Resilience

Motivations, threshold/permission semantics, Ledger API + Console setup for new parties, pointer to party replication for existing parties, PQS for data HA, cost/consistency/key ops notes.

### External Signing: Party Onboarding

Artifact script: synchronizer discovery, Ed25519, `generate-topology` / `allocate`, multi-hash signing, `--multi-hosted`, Console propose/authorize illustration.

### Quickstart external parties

LocalNet validator topology generate/submit, JWT, three txs, interactive Ping submit, completion/GetUpdates caveats.

### Party Management

Local allocate/enable, simple vs offline replication, external authorization helper, onboarding flag + ACS export/import runbook, no offboarding yet.

### Wallet SDK — Creating an External Party

`create` / `sign` / `execute` and split topology signing for external custody; fingerprint checks; links to deep-dive scripts.

### External Signing: Submitting Transactions

Full InteractiveSubmissionService: Prepare/Execute(+Wait), hashing V2, cost hints, TTL/`max_record_time`, trust warnings on sync execute responses; Ping create + Respond tutorial.

### PQS

Sidecar SQL projection; when to use; LocalNet/standalone/Helm; **HA = one PQS DB per host + app failover**; Flyway coexistence; avoid multi-writer on one store.

---

## Suggested reading order

1. [Local and External Parties](https://docs.canton.network/overview/reference/external-party) — vocabulary + trust  
2. [External Signing](https://docs.canton.network/appdev/deep-dives/external-signing) — hosting setups  
3. **Pick a path:** single-host Quickstart/SDK *or* [Multi-Hosting](https://docs.canton.network/appdev/deep-dives/multi-hosting)  
4. [Party Onboarding](https://docs.canton.network/appdev/deep-dives/external-signing-onboarding) — implement allocate  
5. [Submitting Transactions](https://docs.canton.network/appdev/deep-dives/external-signing-transactions) — implement prepare/sign/execute  
6. [PQS](https://docs.canton.network/sdks-tools/development-tools/pqs) — production read path  
7. [Party Management](https://docs.canton.network/global-synchronizer/production-operations/party-management) — when you must add a host later  

Docs index: https://docs.canton.network/llms.txt
