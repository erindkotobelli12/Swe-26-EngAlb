/**
 * The automatic skill check-off rule. Pure and deterministic — no AI.
 *
 *   An employee's requirement is ticked off ("Already has this skill") when the employee has a CONFIRMED skill record
 *   for the requirement's skill at the required level or higher. A matching CLAIMED (self-declared) skill only makes
 *   it "Possibly covered" until a Technical Lead confirms the skill. Rejected skills never count.
 *
 * It applies to SKILL requirements and to KT_ACTIVITY requirements that name a skill.
 */
export const SKILL_LEVELS = ["BASIC", "INTERMEDIATE", "ADVANCED"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export const LEVEL_RANK: Record<string, number> = { BASIC: 1, INTERMEDIATE: 2, ADVANCED: 3 };

export type SkillRecord = { id: string; skillId: string; level: string; status: string };
export type RequirementRule = { type: string; skillId: string | null; requiredLevel: string | null };
export type CheckoffResult = { kind: "SATISFIED"; recordId: string } | { kind: "POSSIBLY"; recordId: string } | { kind: "NONE" };

export const meetsLevel = (level: string, required: string | null) => (LEVEL_RANK[level] ?? 0) >= (required ? LEVEL_RANK[required] ?? 99 : 1);

export function evaluateCheckoff(req: RequirementRule, skills: SkillRecord[]): CheckoffResult {
  if (!req.skillId || (req.type !== "SKILL" && req.type !== "KT_ACTIVITY")) return { kind: "NONE" };
  const matching = skills.filter((s) => s.skillId === req.skillId && meetsLevel(s.level, req.requiredLevel));
  const confirmed = matching.find((s) => s.status === "CONFIRMED");
  if (confirmed) return { kind: "SATISFIED", recordId: confirmed.id };
  const claimed = matching.find((s) => s.status === "CLAIMED");
  return claimed ? { kind: "POSSIBLY", recordId: claimed.id } : { kind: "NONE" };
}
