import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getMe } from "../api/auth";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      try {
        const user = await getMe();
        if (!mounted) return;
        localStorage.setItem("user", JSON.stringify(user));
        setStatus("ok");
      } catch {
        if (!mounted) return;
        localStorage.removeItem("user");
        setStatus("unauthorized");
      }
    };
    verify();
    return () => {
      mounted = false;
    };
  }, []);

  if (status === "checking") {
    return null;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
