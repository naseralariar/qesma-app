import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import PlaylistAddCheckCircleOutlinedIcon from "@mui/icons-material/PlaylistAddCheckCircleOutlined";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import { Alert, AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Stack, TextField, Toolbar, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { changePassword, logout as logoutApi } from "../api/auth";
import { isSidebarItemVisibleForUser } from "../constants/sidebarItems";

const drawerWidth = 280;

export default function MainLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "الاسم غير متوفر";
  const departmentName = user.department_name || "إدارة غير محددة";
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // تجاهل الخطأ وإكمال الخروج المحلي
    }
    localStorage.clear();
    navigate("/login");
  };

  const submitChangePassword = async () => {
    try {
      setPasswordError("");
      setPasswordMessage("");
      if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
        setPasswordError("جميع الحقول إلزامية");
        return;
      }
      if (passwordForm.new_password.length < 8) {
        setPasswordError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
        return;
      }
      if (passwordForm.new_password !== passwordForm.confirm_password) {
        setPasswordError("تأكيد كلمة المرور غير مطابق");
        return;
      }
      await changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordMessage("تم تغيير كلمة المرور بنجاح، يرجى تسجيل الدخول مرة أخرى");
      setTimeout(() => {
        logout();
      }, 1200);
    } catch {
      setPasswordError("تعذر تغيير كلمة المرور، تحقق من كلمة المرور الحالية");
    }
  };

  const navItems = [
    { key: "dashboard", label: "الصفحة الرئيسية", to: "/app", icon: <HomeOutlinedIcon />, visible: true },
    { key: "new_distribution", label: "إدخال قسمة جديدة", to: "/app/new-distribution", icon: <PostAddOutlinedIcon />, visible: true },
    { key: "search", label: "البحث عن قسمة", to: "/app/search", icon: <PersonSearchOutlinedIcon />, visible: true },
    { key: "attendance", label: "إنشاء تباليغ بالحضور", to: "/app/attendance", icon: <PlaylistAddCheckCircleOutlinedIcon />, visible: true },
    { key: "session_minutes", label: "تحرير محضر جلسة بالتوزيع", to: "/app/session-minutes", icon: <NoteAltOutlinedIcon />, visible: true },
    { key: "user_management", label: "لوحة تحكم المستخدمين والصلاحيات", to: "/app/users", icon: <ManageAccountsOutlinedIcon />, visible: true },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <Box sx={{ position: "absolute", left: 16, display: "flex", gap: 2, alignItems: "center" }}>
            <Typography>{dayjs().format("YYYY/MM/DD")}</Typography>
            <Button color="inherit" onClick={() => setPasswordDialogOpen(true)}>تغيير كلمة السر</Button>
            <Button color="inherit" onClick={logout}>
              تسجيل خروج
            </Button>
          </Box>

          <Typography
            variant="h6"
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            النظام الشامل لتوزيع حصيلة التنفيذ
          </Typography>

          <Typography
            variant="subtitle1"
            sx={{
              position: "absolute",
              right: 16,
              fontWeight: 700,
              textAlign: "right",
              maxWidth: "36%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {`مرحباً بك (${fullName} - ${departmentName})`}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            borderLeft: 0,
            bgcolor: "primary.dark",
            color: "primary.contrastText",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, pt: 2, pb: 1, display: "flex", justifyContent: "center" }}>
          <Box
            component="img"
            src="/photo/شعار الإدارة.png"
            alt="شعار الإدارة"
            sx={{ height: 352, width: 352, objectFit: "contain" }}
          />
        </Box>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="primary.contrastText" sx={{ px: 1, py: 1, opacity: 0.9 }}>
            القائمة الرئيسية
          </Typography>
        </Box>
        <Divider sx={{ borderColor: "primary.main", opacity: 0.45 }} />
        <List sx={{ px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
          {navItems
            .filter((item) => item.visible && isSidebarItemVisibleForUser(user, item.key))
            .map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                end={item.to === "/app"}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  px: 1.25,
                  color: "primary.contrastText",
                  "&:hover": {
                    bgcolor: "primary.main",
                  },
                  "&.active": {
                    bgcolor: "primary.main",
                    fontWeight: 700,
                  },
                  "& .MuiListItemIcon-root": {
                    minWidth: 34,
                    color: "inherit",
                  },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: 8,
          mr: 0,
          position: "relative",
          minHeight: "calc(100vh - 64px)",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.86), rgba(255,255,255,0.86)), url('/palce.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Box
          sx={{
            minHeight: "100%",
            width: "100%",
            ml: "auto",
            mr: 0,
            px: { xs:2, md: 4 },
            py: 3,
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>تغيير كلمة السر</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            {passwordMessage && <Alert severity="success">{passwordMessage}</Alert>}
            <TextField
              type="password"
              label="كلمة المرور الحالية"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
            />
            <TextField
              type="password"
              label="كلمة المرور الجديدة"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
            />
            <TextField
              type="password"
              label="تأكيد كلمة المرور الجديدة"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={submitChangePassword}>حفظ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
