# Agent and component specifications

## Evidence Extraction Agent
Uses the configured local Ollama model to transform unstructured evidence into Zod-validated claims. It may only propose claims and must verify excerpts against original source content. Embedded instructions are untrusted. No employee facts are overwritten from model output.

## Gap Detection Engine
Deterministic gap analysis over database records. Stable IDs are `CASE-{employee}-{finding type}`. It detects missing project or manager, stale updates, Eva contradictions, Leo access gaps, Lina unanswered requests and Owen missing review dates.

## Readiness Assessment Engine
Deterministic business rules calculate assessed status and separate risk flags. Independent readiness requires usable required access, complete required KT scope, approved technical validation and no unresolved material contradiction.

## Action Recommendation Agent
Uses the configured local Ollama model to convert unresolved findings into proposed actions with valid evidence IDs. Recommendations are proposals and require human approval; no deterministic/mock AI fallback is used. Missing model configuration and invalid model output are returned as explicit errors.

## Contextual assistant
Uses a live local Ollama chat completion with case, access, finding, evidence, and knowledge records loaded from Prisma. The provider accepts only loopback URLs, so employee data is not sent to an external API. It may cite only evidence IDs in the query context. The API validates the response schema and rejects unknown evidence IDs. When Ollama or the model is unavailable, the UI shows an error rather than generating a scripted answer.
