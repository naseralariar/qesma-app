import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createUser, deleteUser, listDepartments, listUsers, updateUser } from "../api/users";
import { ATTENDANCE_LOCATIONS } from "../constants/attendanceLocations";
import {
  SIDEBAR_ITEMS,
  defaultHiddenSidebarItemsByRole,
  getFirstAllowedSidebarPathForUser,
  getHiddenSidebarItemsForUser,
  isSidebarItemVisibleForUser,
  SIDEBAR_ROUTE_CONFIG,
} from "../constants/sidebarItems";

const ROLE_OPTIONS = [
  { value: "admin", label: "مدير النظام" },
  { value: "manager", label: "مدير إدارة" },
  { value: "officer", label: "موظف تنفيذ" },
  { value: "viewer", label: "مشاهد" },
];

const emptyForm = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  department: "",
  role: "viewer",
  is_active: true,
};

const roleDefaultCanEdit = (role) => ["admin", "manager", "officer"].includes(role);
const roleDefaultCanDelete = (role) => ["admin", "manager"].includes(role);

export default function UserManagementPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
  const canManageUsers = ["admin", "manager", "officer"].includes(currentUser.role);

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [permissionsForm, setPermissionsForm] = useState({
    can_edit_distribution: false,
    can_delete_distribution: false,
    can_search_outside_department: false,
    attendance_allow_all_locations: true,
    attendance_allowed_locations: [],
    sidebar_hidden_items: [],
  });

  const loadData = async () => {
    try {
      const [usersData, departmentsData] = await Promise.all([listUsers(), listDepartments()]);
      setUsers(usersData || []);
      setDepartments(departmentsData || []);
    } catch {
      setError("تعذر تحميل بيانات المستخدمين أو الإدارات");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitCreate = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.username || !form.password || !form.department) {
      setError("اسم المستخدم وكلمة المرور والإدارة حقول إلزامية");
      return;
    }

    try {
      await createUser({
        username: form.username,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        department: Number(form.department),
        role: form.role,
        is_active: form.is_active,
      });
      setForm(emptyForm);
      setMessage("تم إنشاء المستخدم بنجاح");
      await loadData();
    } catch {
      setError("تعذر إنشاء المستخدم، تحقق من صحة البيانات");
    }
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setEditForm({
      username: user.username || "",
      password: "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      department: user.department || "",
      role: user.role || "viewer",
      is_active: !!user.is_active,
    });
    setEditDialogOpen(true);
  };

  const submitEdit = async () => {
    if (!editingUser) return;

    try {
      const payload = {
        username: editForm.username,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        department: Number(editForm.department),
        role: editForm.role,
        is_active: editForm.is_active,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }

      await updateUser(editingUser.id, payload);
      setMessage("تم تحديث بيانات المستخدم");
      setEditDialogOpen(false);
      setEditingUser(null);
      await loadData();
    } catch {
      setError("تعذر تحديث المستخدم");
    }
  };

  const removeUser = async (user) => {
    if (!window.confirm(`هل تريد حذف المستخدم ${user.username}؟`)) {
      return;
    }
    try {
      await deleteUser(user.id);
      setMessage("تم حذف المستخدم");
      await loadData();
    } catch {
      setError("تعذر حذف المستخدم");
    }
  };

  const openPermissionsDialog = (user) => {
    const canEdit =
      user.can_edit_distribution === null || user.can_edit_distribution === undefined
        ? roleDefaultCanEdit(user.role)
        : !!user.can_edit_distribution;
    const canDelete =
      user.can_delete_distribution === null || user.can_delete_distribution === undefined
        ? roleDefaultCanDelete(user.role)
        : !!user.can_delete_distribution;

    setPermissionsUser(user);
    setPermissionsForm({
      can_edit_distribution: canEdit,
      can_delete_distribution: canDelete,
      can_search_outside_department: !!user.can_search_outside_department,
      attendance_allow_all_locations: user.attendance_allow_all_locations !== false,
      attendance_allowed_locations: user.attendance_allowed_locations || [],
      sidebar_hidden_items: user.sidebar_hidden_items || defaultHiddenSidebarItemsByRole(user.role),
    });
    setPermissionsDialogOpen(true);
  };

  const submitPermissions = async () => {
    if (!permissionsUser) return;
    if (!permissionsForm.attendance_allow_all_locations && permissionsForm.attendance_allowed_locations.length === 0) {
      setError("عند اختيار بعض مواقع التبليغ يجب تحديد موقع واحد على الأقل");
      return;
    }

    try {
      setError("");
      setMessage("");
      const updated = await updateUser(permissionsUser.id, {
        can_edit_distribution: permissionsForm.can_edit_distribution,
        can_delete_distribution: permissionsForm.can_delete_distribution,
        can_search_outside_department: permissionsForm.can_search_outside_department,
        attendance_allow_all_locations: permissionsForm.attendance_allow_all_locations,
        attendance_allowed_locations: permissionsForm.attendance_allow_all_locations
          ? []
          : permissionsForm.attendance_allowed_locations,
        sidebar_hidden_items: permissionsForm.sidebar_hidden_items,
      });

      if (currentUser.id === updated.id) {
        localStorage.setItem("user", JSON.stringify(updated));

        const currentPath = window.location.pathname;
        const currentRoute = SIDEBAR_ROUTE_CONFIG.find((route) => route.path === currentPath);

        if (currentRoute) {
          const updatedUser = {
            ...currentUser,
            ...updated,
            sidebar_hidden_items: getHiddenSidebarItemsForUser(updated),
          };
          if (!isSidebarItemVisibleForUser(updatedUser, currentRoute.key)) {
            navigate(getFirstAllowedSidebarPathForUser(updatedUser), { replace: true });
          }
        }
      }

      setPermissionsDialogOpen(false);
      setPermissionsUser(null);
      setMessage("تم تحديث الصلاحيات");
      await loadData();
    } catch {
      setError("تعذر تحديث الصلاحيات");
    }
  };

  if (!canManageUsers) {
    return <Alert severity="warning">ليست لديك صلاحية إدارة المستخدمين</Alert>;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        لوحة تحكم المستخدمين والصلاحيات
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            إنشاء مستخدم جديد
          </Typography>
          <Box component="form" onSubmit={submitCreate}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="اسم المستخدم"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="كلمة المرور"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth required>
                  <InputLabel id="create-department-label">الإدارة</InputLabel>
                  <Select
                    labelId="create-department-label"
                    label="الإدارة"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  >
                    {departments.map((department) => (
                      <MenuItem key={department.id} value={department.id}>
                        {department.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="الاسم الأول"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="اسم العائلة"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="البريد الإلكتروني"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="create-role-label">الدور</InputLabel>
                  <Select
                    labelId="create-role-label"
                    label="الدور"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
                  <Typography>مفعل</Typography>
                  <Switch checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Button type="submit" variant="contained" fullWidth sx={{ height: "100%" }}>
                  إنشاء مستخدم
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>اسم المستخدم</TableCell>
              <TableCell>الاسم</TableCell>
              <TableCell>الإدارة</TableCell>
              <TableCell>الدور</TableCell>
              <TableCell>الحالة</TableCell>
              <TableCell align="center">إجراءات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.username}</TableCell>
                <TableCell>{`${user.first_name || ""} ${user.last_name || ""}`.trim() || "-"}</TableCell>
                <TableCell>{user.department_name || "-"}</TableCell>
                <TableCell>{ROLE_OPTIONS.find((r) => r.value === user.role)?.label || user.role}</TableCell>
                <TableCell>
                  <Chip size="small" color={user.is_active ? "success" : "default"} label={user.is_active ? "مفعل" : "غير مفعل"} />
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Button size="small" variant="outlined" onClick={() => openPermissionsDialog(user)}>
                      صلاحيات
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => openEditDialog(user)}>
                      تعديل
                    </Button>
                    <Button size="small" color="error" variant="outlined" onClick={() => removeUser(user)}>
                      حذف
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>تعديل المستخدم</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="اسم المستخدم"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="password"
                label="كلمة مرور جديدة (اختياري)"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="edit-department-label">الإدارة</InputLabel>
                <Select
                  labelId="edit-department-label"
                  label="الإدارة"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                >
                  {departments.map((department) => (
                    <MenuItem key={department.id} value={department.id}>
                      {department.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="الاسم الأول"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="اسم العائلة"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="البريد الإلكتروني"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth>
                <InputLabel id="edit-role-label">الدور</InputLabel>
                <Select
                  labelId="edit-role-label"
                  label="الدور"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
                <Typography>مفعل</Typography>
                <Switch checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={submitEdit}>
            حفظ التعديلات
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={permissionsDialogOpen} onClose={() => setPermissionsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إدارة صلاحيات المستخدم {permissionsUser?.username ? `(${permissionsUser.username})` : ""}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={permissionsForm.can_edit_distribution}
                  onChange={(e) =>
                    setPermissionsForm({
                      ...permissionsForm,
                      can_edit_distribution: e.target.checked,
                    })
                  }
                />
              }
              label="إمكانية تعديل القسمة"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={permissionsForm.can_delete_distribution}
                  onChange={(e) =>
                    setPermissionsForm({
                      ...permissionsForm,
                      can_delete_distribution: e.target.checked,
                    })
                  }
                />
              }
              label="إمكانية حذف القسمة"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={permissionsForm.can_search_outside_department}
                  onChange={(e) =>
                    setPermissionsForm({
                      ...permissionsForm,
                      can_search_outside_department: e.target.checked,
                    })
                  }
                />
              }
              label="إمكانية البحث خارج الإدارة"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={permissionsForm.attendance_allow_all_locations}
                  onChange={(e) =>
                    setPermissionsForm({
                      ...permissionsForm,
                      attendance_allow_all_locations: e.target.checked,
                    })
                  }
                />
              }
              label="صلاحية كل مواقع التبليغ"
            />

            <FormControl fullWidth disabled={permissionsForm.attendance_allow_all_locations}>
              <InputLabel id="attendance-locations-label">مواقع التبليغ المسموح بها</InputLabel>
              <Select
                labelId="attendance-locations-label"
                multiple
                label="مواقع التبليغ المسموح بها"
                value={permissionsForm.attendance_allowed_locations}
                onChange={(e) => setPermissionsForm({ ...permissionsForm, attendance_allowed_locations: e.target.value })}
                renderValue={(selected) => selected.join("، ")}
              >
                {ATTENDANCE_LOCATIONS.map((location) => (
                  <MenuItem key={location} value={location}>
                    <Checkbox checked={permissionsForm.attendance_allowed_locations.includes(location)} />
                    <ListItemText primary={location} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="sidebar-hidden-items-label">العناصر المخفية من القائمة الجانبية</InputLabel>
              <Select
                labelId="sidebar-hidden-items-label"
                multiple
                label="العناصر المخفية من القائمة الجانبية"
                value={permissionsForm.sidebar_hidden_items}
                onChange={(e) => setPermissionsForm({ ...permissionsForm, sidebar_hidden_items: e.target.value })}
                renderValue={(selected) =>
                  selected
                    .map((key) => SIDEBAR_ITEMS.find((item) => item.key === key)?.label || key)
                    .join("، ")
                }
              >
                {SIDEBAR_ITEMS.map((item) => (
                  <MenuItem key={item.key} value={item.key}>
                    <Checkbox checked={permissionsForm.sidebar_hidden_items.includes(item.key)} />
                    <ListItemText primary={item.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionsDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={submitPermissions}>
            حفظ الصلاحيات
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
