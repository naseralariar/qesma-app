export const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "الصفحة الرئيسية" },
  { key: "new_distribution", label: "إدخال قسمة جديدة" },
  { key: "search", label: "البحث عن قسمة" },
  { key: "attendance", label: "إنشاء تباليغ بالحضور" },
  { key: "session_minutes", label: "تحرير محضر جلسة بالتوزيع" },
  { key: "user_management", label: "لوحة تحكم المستخدمين والصلاحيات" },
];

export const SIDEBAR_ROUTE_CONFIG = [
  { key: "dashboard", path: "/app" },
  { key: "new_distribution", path: "/app/new-distribution" },
  { key: "search", path: "/app/search" },
  { key: "attendance", path: "/app/attendance" },
  { key: "session_minutes", path: "/app/session-minutes" },
  { key: "user_management", path: "/app/users" },
];

export const defaultHiddenSidebarItemsByRole = (role) => {
  if (role === "admin" || role === "manager") {
    return [];
  }
  return ["dashboard"];
};

export const getHiddenSidebarItemsForUser = (user) =>
  Array.isArray(user?.sidebar_hidden_items)
    ? user.sidebar_hidden_items
    : defaultHiddenSidebarItemsByRole(user?.role);

export const isRoleAllowedForSidebarItem = (role, key) => {
  if (key === "new_distribution") return role !== "viewer";
  if (key === "user_management") return ["admin", "manager", "officer"].includes(role);
  return true;
};

export const isSidebarItemVisibleForUser = (user, key) => {
  const hiddenItems = getHiddenSidebarItemsForUser(user);
  return isRoleAllowedForSidebarItem(user?.role, key) && !hiddenItems.includes(key);
};

export const getFirstAllowedSidebarPathForUser = (user) => {
  const hiddenItems = getHiddenSidebarItemsForUser(user);
  const firstAllowed = SIDEBAR_ROUTE_CONFIG.find(
    (route) => isRoleAllowedForSidebarItem(user?.role, route.key) && !hiddenItems.includes(route.key)
  );
  return firstAllowed?.path || "/app";
};
