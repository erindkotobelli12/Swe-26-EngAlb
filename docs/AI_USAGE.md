# Purposeful and responsible AI use

## Where the LLM adds value, and why

| Use | Why an LLM | Agent |
|---|---|---|
| Semantic contradiction detection | Rules can see that two sources set different values. They cannot see that "Eva is working independently" conflicts with "can handle standard requests with occasional support", or that "everything looks complete" conflicts with "two complex scenarios still need to be covered". | Detective |
| Root-cause hypotheses and recommended owner roles | Needs reading across emails and tracker fields. The output is explicitly hypothesis-labelled. | Detective |
| Claim extraction from free text | New emails arrive as prose. Mapping them to `access.<app>.status` or `kt.<activity>.stage` is language understanding. | Extraction |
| Dependency suggestions | "Practical ticket handling needs Helix" is implied by prose, not stated in a field. | Dependency Suggestion |
| Drafting follow-ups | Consolidating 3–5 items into one polite, personalised message. | Follow-Up Drafting |
| Narratives | The briefing and the simulator explanation make deterministic facts readable. | Briefing, Simulator Explanation |
| Q&A | Free-form questions over the case records. | Assistant |

## Where we deliberately use rules instead

Rules handle everything that decides or counts:

- readiness gates and the assessed level;
- the "provisioned ≠ usable" rule;
- stale and unanswered thresholds;
- dependency propagation, the minimal prerequisite set and recommended order;
- reliability categories;
- severity;
- follow-up routing, escalation and priority scores;
- permissions;
- briefing fact selection;
- dashboard KPIs.

These must be explainable, repeatable and testable. An LLM is none of those reliably. **No LLM confidence percentages** are produced or shown. Priority and reliability are transparent scores and categories with their reasons.

## How traceability is enforced

1. **Known IDs only.** Every cited `evidenceId` must belong to the case (or its project). The assistant rejects the whole answer if any ID is unknown. The other agents drop or downgrade the statement.
2. **Verbatim excerpts.** `verifyExcerpt` (`src/ai/verify.ts`) normalises whitespace, curly quotes and dashes, and ignores one trailing period. It then requires the excerpt (≥ 6 characters) to be a substring of the stored source.
   - Paraphrases such as "Eva appears independent" fail.
   - Unverifiable facts become **assumptions** labelled "Unverifiable: …".
   - AI findings with no verified fact are dropped.
3. **Refs for every briefing statement.** Each must reference a finding, evidence or action that is in the deterministic selection, otherwise it is rejected and counted.
4. **Schema validation twice.** Ollama receives the JSON Schema (structured outputs), and Zod validates the result again.
5. **Proposals, not writes.**
   - AI findings are PROPOSED.
   - AI edges are PROPOSED.
   - AI claims are PENDING.
   - AI drafts are DRAFT.
   - AI reviews are stored separately (`aiAnalysis`) and never change a rule finding.
   - No AI module can import validation, the field mapper, recompute or server actions (enforced by a test).

## What happens when the model fails

| Failure | Behaviour |
|---|---|
| Ollama not running or model missing | `AIRun.status = UNAVAILABLE`. The UI shows the message (e.g. "Run: ollama pull …") with **Retry**. |
| Timeout (`AI_TIMEOUT_MS`, default 180 s) | `TIMEOUT`, same UI. |
| Invalid JSON or schema mismatch | `INVALID_OUTPUT`, same UI. Nothing is stored except the AIRun log. |
| Unknown evidence ID (assistant) | Answer discarded, HTTP 502, "please retry". |

In every case the deterministic results still render:

- rule findings, gates, map and simulator diff;
- template follow-up drafts;
- deterministic briefing statements;
- manual claims.

Nothing is faked: there is no scripted fallback answer. Unit tests use a test double for the `AIProvider` interface (`setAIProviderForTests`). The application never does.

## Prompt-injection safety

Evidence is untrusted data:

- It is wrapped in labelled blocks.
- The shared system guard tells the model to ignore instructions inside sources.
- Outputs are constrained by schema, enums and the verification steps above.

Even a successful injection could at most produce a *proposal* that a human must approve.
