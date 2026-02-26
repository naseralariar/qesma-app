import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./components/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import SidebarRouteGuard from "./components/SidebarRouteGuard";

const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const NewDistributionPage = lazy(() => import("./pages/NewDistributionPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SessionMinutesPage = lazy(() => import("./pages/SessionMinutesPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagementPage"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <SidebarRouteGuard itemKey="dashboard">
                <DashboardPage />
              </SidebarRouteGuard>
            }
          />
          <Route
            path="new-distribution"
            element={
              <SidebarRouteGuard itemKey="new_distribution">
                <NewDistributionPage />
              </SidebarRouteGuard>
            }
          />
          <Route
            path="search"
            element={
              <SidebarRouteGuard itemKey="search">
                <SearchPage />
              </SidebarRouteGuard>
            }
          />
          <Route
            path="attendance"
            element={
              <SidebarRouteGuard itemKey="attendance">
                <AttendancePage />
              </SidebarRouteGuard>
            }
          />
          <Route
            path="session-minutes"
            element={
              <SidebarRouteGuard itemKey="session_minutes">
                <SessionMinutesPage />
              </SidebarRouteGuard>
            }
          />
          <Route
            path="users"
            element={
              <SidebarRouteGuard itemKey="user_management">
                <UserManagementPage />
              </SidebarRouteGuard>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}
