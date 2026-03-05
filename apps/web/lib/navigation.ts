export type AppRole = "admin" | "user";

export type AppNavigationKey = "catalog" | "runs" | "admin";

export type AppNavigationItem = Readonly<{
  key: AppNavigationKey;
  label: string;
  href: `/${AppNavigationKey}`;
  visibleTo: readonly AppRole[];
}>;

export const APP_NAVIGATION_ITEMS: readonly AppNavigationItem[] = [
  {
    key: "catalog",
    label: "Catalog",
    href: "/catalog",
    visibleTo: ["user", "admin"]
  },
  {
    key: "runs",
    label: "Runs",
    href: "/runs",
    visibleTo: ["user", "admin"]
  },
  {
    key: "admin",
    label: "Admin",
    href: "/admin",
    visibleTo: ["admin"]
  }
] as const;

export function isNavItemVisibleToRole(item: AppNavigationItem, role: AppRole): boolean {
  return item.visibleTo.includes(role);
}

export function getNavigationForRole(role: AppRole): AppNavigationItem[] {
  return APP_NAVIGATION_ITEMS.filter((item) => isNavItemVisibleToRole(item, role));
}
