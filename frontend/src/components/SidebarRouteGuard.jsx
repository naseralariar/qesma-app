import { Navigate } from "react-router-dom";

import { getFirstAllowedSidebarPathForUser, isSidebarItemVisibleForUser } from "../constants/sidebarItems";

export default function SidebarRouteGuard({ itemKey, children }) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!isSidebarItemVisibleForUser(user, itemKey)) {
    return <Navigate to={getFirstAllowedSidebarPathForUser(user)} replace />;
  }

  return children;
}