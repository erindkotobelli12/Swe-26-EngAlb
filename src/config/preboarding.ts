/**
 * Default pre-boarding checklist. The first, fifth, sixth and seventh items are the starter-pack §6 checklist items
 * that belong before day one (start date and movement type, owners identified, required applications identified,
 * access requests submitted); the others are common pre-boarding practice and are labelled as such in
 * docs/ASSUMPTIONS.md. HR owns HR admin and welcome; the Line Manager owns equipment, contacts and access requests.
 * Due dates are targets relative to the start date (days before it), never invented facts.
 */
export type PreboardingTemplateItem = {
  key: string;
  title: string;
  category: "HR_ADMIN" | "EQUIPMENT" | "ACCESS_REQUEST" | "WELCOME" | "CONTACTS";
  ownerRole: "HR" | "LINE_MANAGER";
  daysBeforeStart: number;
  fromStarterPack: boolean;
};

export const PREBOARDING_TEMPLATE: PreboardingTemplateItem[] = [
  { key: "start-date", title: "Start date and movement type confirmed", category: "HR_ADMIN", ownerRole: "HR", daysBeforeStart: 10, fromStarterPack: true },
  { key: "paperwork", title: "Contract and HR paperwork complete", category: "HR_ADMIN", ownerRole: "HR", daysBeforeStart: 7, fromStarterPack: false },
  { key: "welcome", title: "Welcome message and first-day agenda sent", category: "WELCOME", ownerRole: "HR", daysBeforeStart: 2, fromStarterPack: false },
  { key: "equipment", title: "Laptop and equipment ready", category: "EQUIPMENT", ownerRole: "LINE_MANAGER", daysBeforeStart: 3, fromStarterPack: false },
  { key: "contacts", title: "Line Manager, Technical Lead and KT owner identified", category: "CONTACTS", ownerRole: "LINE_MANAGER", daysBeforeStart: 7, fromStarterPack: true },
  { key: "apps", title: "Required applications identified", category: "ACCESS_REQUEST", ownerRole: "LINE_MANAGER", daysBeforeStart: 7, fromStarterPack: true },
  { key: "access-requests", title: "Access requests submitted", category: "ACCESS_REQUEST", ownerRole: "LINE_MANAGER", daysBeforeStart: 5, fromStarterPack: true },
];

export const PREBOARDING_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED", "NOT_APPLICABLE"] as const;
export type PreboardingStatus = (typeof PREBOARDING_STATUSES)[number];
export const isClosedItem = (s: string) => s === "DONE" || s === "NOT_APPLICABLE";
