/**
 * Project-role onboarding templates — SIMULATED demo configuration (not part of the starter pack).
 *
 * When a case has a required access item for `application` and no KT activity with this title, recompute
 * proposes the KT activity (status PROPOSED, origin TEMPLATE) plus PROPOSED edges
 * access → KT activity → independent execution. A Technical Lead or PMO confirms or rejects them.
 * Nothing here is ever treated as an actual requirement until a human confirms it.
 */
export type KTTemplate = {
  id: string;
  application: string;
  title: string;
  description: string;
  scopeType: "CORE" | "COMPLEX";
};

export const KT_TEMPLATES: KTTemplate[] = [
  {
    id: "TPL-SERVICE-DESK",
    application: "Helix Service Desk",
    title: "Practical ticket-handling KT",
    description: "Handle real service-desk tickets in Helix: shadow, then supported, then independent handling.",
    scopeType: "CORE",
  },
];

export const TEMPLATE_NOTE = "Proposed by the simulated 'service desk onboarding' template (demo configuration, not starter-pack data). Confirm or reject.";
