export const dashboardSections = [
  "overview",
  "cbom",
  "discoveries",
  "asset",
  "scan",
  "team",
  "roles",
] as const;

export type DashboardSection = (typeof dashboardSections)[number];

export function isDashboardSection(value: string): value is DashboardSection {
  return dashboardSections.includes(value as DashboardSection);
}
