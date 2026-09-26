import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NoteAltOutlinedIcon from "@mui/icons-material/NoteAltOutlined";
import PersonSearchOutlinedIcon from "@mui/icons-material/PersonSearchOutlined";
import PlaylistAddCheckCircleOutlinedIcon from "@mui/icons-material/PlaylistAddCheckCircleOutlined";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import { Alert, AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, TextField, Toolbar, Typography } from "@mui/material";
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigationClick = (event, targetPath) => {
    if (hasUnsavedChanges && window.location.pathname !== targetPath) {
      event.preventDefault();
      setPendingNavigation(targetPath);
      return;
    }
    setMobileOpen(false);
  };

  const stayOnCurrentPage = () => {
    setPendingNavigation(null);
  };

  const continueWithoutSaving = () => {
    const targetPath = pendingNavigation;
    setHasUnsavedChanges(false);
    setPendingNavigation(null);
    setMobileOpen(false);
    if (targetPath) navigate(targetPath);
  };

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

  const visibleNavItems = navItems.filter(
    (item) => item.visible && isSidebarItemVisibleForUser(user, item.key)
  );

  const drawerContent = (
    <>
      <Toolbar />

      <Box
        sx={{
          px: 2,
          pt: { xs: 1.5, md: 2 },
          pb: 1,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Box
          component="img"
          src="/photo/شعار الإدارة.png"
          alt="شعار الإدارة"
          sx={{
            height: { xs: 170, md: 220 },
            width: { xs: 170, md: 220 },
            maxWidth: "100%",
            objectFit: "contain",
          }}
        />
      </Box>

      <Box sx={{ px: 2, py: 1 }}>
        <Typography
          variant="subtitle2"
          color="primary.contrastText"
          sx={{ px: 1, py: 0.5, opacity: 0.9 }}
        >
          القائمة الرئيسية
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "primary.main", opacity: 0.45 }} />

      <List
        sx={{
          px: 1.5,
          py: 1.25,
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
        }}
      >
        {visibleNavItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.to === "/app"}
            onClick={(event) => handleNavigationClick(event, item.to)}
            sx={{
              borderRadius: 2,
              py: 0.85,
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
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: 14 }}
            />
          </ListItemButton>
        ))}
      </List>

      <Box
        sx={{
          display: { xs: "block", md: "none" },
          mt: "auto",
          px: 2,
          pb: 2,
        }}
      >
        <Divider sx={{ mb: 1.5, borderColor: "primary.main", opacity: 0.45 }} />

        <Typography
          variant="body2"
          sx={{ mb: 1.5, opacity: 0.9, lineHeight: 1.6 }}
        >
          {fullName}
          <br />
          {departmentName}
        </Typography>

        <Stack spacing={1}>
          <Button
            variant="outlined"
            color="inherit"
            fullWidth
            onClick={() => {
              setMobileOpen(false);
              setPasswordDialogOpen(true);
            }}
          >
            تغيير كلمة السر
          </Button>

          <Button
            variant="outlined"
            color="inherit"
            fullWidth
            onClick={logout}
          >
            تسجيل خروج
          </Button>
        </Stack>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => ({
            xs: theme.zIndex.modal + 1,
            md: theme.zIndex.drawer + 1,
          }),
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            gap: 1,
            position: "relative",
          }}
        >
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen((open) => !open)}
            sx={{ display: { xs: "inline-flex", md: "none" } }}
            aria-label="فتح القائمة"
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              flexGrow: { xs: 1, md: 0 },
              fontWeight: 700,
              textAlign: "center",
              fontSize: { xs: "0.95rem", sm: "1.05rem", md: "1.25rem" },
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              px: { xs: 0.5, md: 2 },
              position: { xs: "static", md: "absolute" },
              left: { md: "50%" },
              transform: { md: "translateX(-50%)" },
            }}
          >
            النظام الشامل لتوزيع حصيلة التنفيذ
          </Typography>

          <Typography
            variant="subtitle2"
            sx={{
              display: { xs: "none", md: "block" },
              position: "absolute",
              right: 16,
              fontWeight: 700,
              maxWidth: "36%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {`مرحباً بك (${fullName} - ${departmentName})`}
          </Typography>

          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              position: "absolute",
              left: 16,
              gap: 1,
              alignItems: "center",
            }}
          >
            <Typography variant="body2">
              {dayjs().format("YYYY/MM/DD")}
            </Typography>

            <Button
              color="inherit"
              size="small"
              onClick={() => setPasswordDialogOpen(true)}
            >
              تغيير كلمة السر
            </Button>

            <Button color="inherit" size="small" onClick={logout}>
              تسجيل خروج
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
        }}
      >
        <Drawer
          variant="temporary"
          anchor="right"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: { xs: "86vw", sm: 300 },
              maxWidth: 320,
              boxSizing: "border-box",
              borderLeft: 0,
              bgcolor: "primary.dark",
              color: "primary.contrastText",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          anchor="right"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderLeft: 0,
              bgcolor: "primary.dark",
              color: "primary.contrastText",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: { xs: 7, md: 8 },
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
            px: { xs: 1.25, sm: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
          }}
        >
          <Outlet context={{ setHasUnsavedChanges }} />
        </Box>
      </Box>

      <Dialog
        open={Boolean(pendingNavigation)}
        onClose={stayOnCurrentPage}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>القسمة لم تُحفظ</DialogTitle>
        <DialogContent>
          <Typography>
            لم يتم حفظ القسمة الحالية. إذا غادرت هذه الصفحة ستفقد البيانات المدخلة. هل تريد المتابعة دون حفظ؟
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={stayOnCurrentPage}>
            البقاء في الصفحة
          </Button>
          <Button color="error" variant="contained" onClick={continueWithoutSaving}>
            المتابعة دون حفظ
          </Button>
        </DialogActions>
      </Dialog>

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
