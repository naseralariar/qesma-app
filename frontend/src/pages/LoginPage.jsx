import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../api/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await login(form.username, form.password);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/app");
    } catch {
      setError("بيانات الدخول غير صحيحة أو الحساب مقفل مؤقتاً");
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f5f7",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/palce.jpg')",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />
      <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(255,255,255,0.5)" }} />

      <Box
        component="img"
        src="/photo/شعار الإدارة.png"
        alt="شعار الإدارة"
        sx={{
          position: "fixed",
          top: { xs: 1, md: 10},
          left: { xs: 5, md: 5 },
          width: { xs: 288, sm: 384, md: 480 },
          height: "auto",
          zIndex: 1,
          objectFit: "contain",
        }}
      />

      <Paper sx={{ position: "relative", zIndex: 1, width: 700, height: 400, p: 4, bgcolor: "rgba(255,255,255,0.92)" }}>
        <Typography textAlign="center" variant="h4" sx={{ mb: 2 }}>
          النظام الشامل لتوزيع حصيلة التنفيذ
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <form onSubmit={submit}>
          <Stack spacing={6} sx={{ mt: 2 }}>
            <TextField fullWidth label="اسم المستخدم" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            <TextField
              fullWidth
              label="كلمة المرور"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Button type="submit" variant="contained" size="large" fullWidth>
              دخول
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
