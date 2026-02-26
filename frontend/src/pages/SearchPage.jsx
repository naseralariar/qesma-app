import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import { useEffect, useMemo, useState } from "react";

import {
  calculateDistribution,
  deleteDistribution,
  getDepartments,
  getDistributionById,
  printDistribution,
  searchDistributions,
  updateDebtor,
  updateDistribution,
} from "../api/distributions";
import DatePickerField from "../components/DatePickerField";

const rankOptions = [
  { value: 1, label: "ممتاز" },
  { value: 2, label: "رهن" },
  { value: 3, label: "نفقة" },
  { value: 4, label: "عمالي" },
  { value: 5, label: "حجز قبل البيع" },
  { value: 6, label: "حجز بعد البيع" },
  { value: 7, label: "عادي" },
];
const emptyCreditor = {
  machine_number: "",
  creditor_name: "",
  attachment_date: "",
  attachment_type: "",
  debt_amount: "",
  debt_rank: 1,
  distribution_amount: "0.000",
};
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function SearchPage() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canEdit =
    user.can_edit_distribution === null || user.can_edit_distribution === undefined
      ? ["admin", "manager", "officer"].includes(user.role)
      : !!user.can_edit_distribution;
  const canDelete =
    user.can_delete_distribution === null || user.can_delete_distribution === undefined
      ? ["admin", "manager"].includes(user.role)
      : !!user.can_delete_distribution;
  const canSearchOutsideDepartment = user.role === "admin" || !!user.can_search_outside_department;
  const [filters, setFilters] = useState({
    name: "",
    civil_id: "",
    machine_number: "",
    department: canSearchOutsideDepartment ? "" : user.department || "",
  });
  const [departments, setDepartments] = useState([]);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editModel, setEditModel] = useState(null);
  const [newCreditor, setNewCreditor] = useState(emptyCreditor);

  const hasRows = useMemo(() => rows.length > 0, [rows]);
  const onlyDigits = (value, maxLength) => value.replace(/\D/g, "").slice(0, maxLength);
  const onlyDecimal3 = (value) => {
    const cleaned = value.replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length === 1) return parts[0];
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 3)}`;
  };

  useEffect(() => {
    getDepartments().then((data) => setDepartments(data.results || data || [])).catch(() => setDepartments([]));
  }, []);

  const search = async () => {
    try {
      setError("");
      setMessage("");
      if (!filters.name && !filters.civil_id && !filters.machine_number) {
        setError("أدخل الاسم أو الرقم المدني أو الرقم الآلي للبحث");
        return;
      }
      if (filters.civil_id && !/^\d{12}$/.test(filters.civil_id)) {
        setError("الرقم المدني يجب أن يكون 12 رقم");
        return;
      }
      if (filters.machine_number && !/^\d{9}$/.test(filters.machine_number)) {
        setError("الرقم الآلي يجب أن يكون 9 أرقام");
        return;
      }

      const data = await searchDistributions({
        search: filters.name,
        civil_id: filters.civil_id,
        machine_number: filters.machine_number,
        department: canSearchOutsideDepartment ? filters.department : user.department,
      });
      setRows(data.results || data || []);
    } catch {
      setError("تعذر تنفيذ البحث");
    }
  };

  const doPrint = async (distributionId) => {
    try {
      setError("");
      const blob = await printDistribution(distributionId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setError("تعذر إعادة الطباعة");
    }
  };

  const doDelete = async (distributionId) => {
    const ok = window.confirm("هل أنت متأكد من حذف القسمة؟");
    if (!ok) return;
    try {
      setError("");
      await deleteDistribution(distributionId);
      setRows((prev) => prev.filter((row) => row.id !== distributionId));
      setMessage("تم حذف القسمة بنجاح");
    } catch {
      setError("تعذر حذف القسمة");
    }
  };

  const openEdit = async (distributionId) => {
    try {
      setError("");
      const data = await getDistributionById(distributionId);
      setEditing(data);
      setEditModel({
        id: data.id,
        debtor_id: data.debtor,
        debtor_full_name: data.debtor_data?.full_name || "",
        debtor_civil_id: data.debtor_data?.civil_id || "",
        department: data.department,
        distribution_type: data.distribution_type,
        deposit_or_sale_date: data.deposit_or_sale_date,
        proceed_amount: data.proceed_amount,
        machine_number: data.machine_number,
        distribution_date: data.distribution_date,
        list_type: data.list_type,
        notes: data.notes || "",
        creditors: data.creditors || [],
      });
      setNewCreditor(emptyCreditor);
      setEditOpen(true);
    } catch {
      setError("تعذر جلب بيانات القسمة للتعديل");
    }
  };

  const validateDebtor = () => {
    if (!editModel.debtor_full_name || !editModel.debtor_civil_id) return "بيانات المدين إلزامية";
    if (/\d/.test(editModel.debtor_full_name)) return "اسم المدين لا يقبل أرقام";
    if (!/^\d{12}$/.test(editModel.debtor_civil_id)) return "الرقم المدني يجب أن يكون 12 رقم";
    if (editModel.debtor_full_name.length > 40) return "اسم المدين لا يجب أن يتجاوز 40 حرف";
    return null;
  };

  const validateCreditor = (creditorRow) => {
    if (
      !creditorRow.machine_number ||
      !creditorRow.creditor_name ||
      !creditorRow.attachment_date ||
      !creditorRow.attachment_type ||
      !creditorRow.debt_amount
    ) {
      return "كل حقول الدائن إلزامية";
    }
    if (!/^\d{8}0$/.test(creditorRow.machine_number)) return "الرقم الآلي للدائن يجب أن يكون 9 أرقام وينتهي بصفر";
    if (!/^\d+(\.\d{1,3})?$/.test(String(creditorRow.debt_amount || ""))) {
      return "قيمة المديونية يجب أن تكون رقمًا صحيحًا أو عشريًا حتى 3 منازل";
    }
    if (!isIsoDate(creditorRow.attachment_date)) return "صيغة تاريخ الحجز يجب أن تكون يوم/شهر/سنة";
    return null;
  };

  const addCreditor = () => {
    setError("");
    const err = validateCreditor(newCreditor);
    if (err) return setError(err);

    setEditModel((prev) => ({
      ...prev,
      creditors: [...prev.creditors, { ...newCreditor, debt_rank: Number(newCreditor.debt_rank), distribution_amount: "0.000" }],
    }));
    setNewCreditor(emptyCreditor);
  };

  const updateCreditor = (index, key, value) => {
    setEditModel((prev) => ({
      ...prev,
      creditors: prev.creditors.map((row, i) =>
        i === index ? { ...row, [key]: key === "debt_rank" ? Number(value) : value } : row
      ),
    }));
  };

  const removeCreditor = (index) => {
    const ok = window.confirm("هل أنت متأكد من حذف هذا الدائن؟");
    if (!ok) return;
    setEditModel((prev) => ({
      ...prev,
      creditors: prev.creditors.filter((_, i) => i !== index),
    }));
  };

  const recalculateEdit = async () => {
    try {
      setError("");
      setMessage("");
      if (!editModel.proceed_amount) return setError("أدخل مقدار الحصيلة قبل الحساب");
      if (editModel.creditors.length === 0) return setError("أضف دائنين قبل الحساب");

      for (const creditor of editModel.creditors) {
        const err = validateCreditor(creditor);
        if (err) return setError(err);
      }

      const data = await calculateDistribution({
        proceed_amount: editModel.proceed_amount,
        creditors: editModel.creditors,
      });
      const distributionByIndex = new Map(data.creditors.map((item) => [item.client_index, item.distribution_amount]));
      setEditModel((prev) => ({
        ...prev,
        creditors: prev.creditors.map((row, idx) => ({
          ...row,
          distribution_amount: distributionByIndex.get(idx) || "0.000",
        })),
      }));
      setMessage("تم إعادة حساب القسمة");
    } catch {
      setError("تعذر حساب القسمة، تحقق من البيانات المدخلة");
    }
  };

  const saveEdit = async () => {
    try {
      setError("");
      const debtorErr = validateDebtor();
      if (debtorErr) return setError(debtorErr);
      if (!/^\d+(\.\d{1,3})?$/.test(String(editModel.proceed_amount || ""))) {
        setError("مقدار الحصيلة يجب أن يكون رقمًا صحيحًا أو عشريًا حتى 3 منازل");
        return;
      }
      if (!/^\d{8}0$/.test(String(editModel.machine_number || ""))) {
        setError("الرقم الآلي يجب أن يكون 9 أرقام وينتهي بصفر");
        return;
      }
      if (!isIsoDate(editModel.deposit_or_sale_date) || !isIsoDate(editModel.distribution_date)) {
        setError("صيغة التاريخ يجب أن تكون يوم/شهر/سنة");
        return;
      }
      if (editModel.creditors.length === 0) {
        setError("أضف دائن واحد على الأقل");
        return;
      }
      for (const creditor of editModel.creditors) {
        const err = validateCreditor(creditor);
        if (err) return setError(err);
      }

      await updateDebtor(editModel.debtor_id, {
        full_name: editModel.debtor_full_name,
        civil_id: editModel.debtor_civil_id,
        department: editModel.department,
      });

      const calculated = await calculateDistribution({
        proceed_amount: editModel.proceed_amount,
        creditors: editModel.creditors,
      });
      const distributionByIndex = new Map(calculated.creditors.map((item) => [item.client_index, item.distribution_amount]));
      const payload = {
        debtor: editModel.debtor_id,
        department: editModel.department,
        distribution_type: editModel.distribution_type,
        deposit_or_sale_date: editModel.deposit_or_sale_date,
        proceed_amount: editModel.proceed_amount,
        machine_number: editModel.machine_number,
        distribution_date: editModel.distribution_date,
        list_type: editModel.list_type,
        notes: editModel.notes || "",
        creditors: editModel.creditors.map((row, idx) => ({
          machine_number: row.machine_number,
          creditor_name: row.creditor_name,
          attachment_date: row.attachment_date,
          attachment_type: row.attachment_type,
          debt_amount: row.debt_amount,
          debt_rank: Number(row.debt_rank),
          distribution_amount: distributionByIndex.get(idx) || "0.000",
        })),
      };

      const updated = await updateDistribution(editModel.id, payload);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setMessage("تم تعديل القسمة بنجاح");
      setEditOpen(false);
      setEditing(null);
      setEditModel(null);
      setNewCreditor(emptyCreditor);
    } catch {
      setError("تعذر حفظ التعديلات");
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">البحث والاسترجاع</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <TextField
          fullWidth
          label="اسم المدين"
          value={filters.name}
          onChange={(e) => setFilters({ ...filters, name: e.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          fullWidth
          label="الرقم المدني"
          value={filters.civil_id}
          inputProps={{ maxLength: 12, inputMode: "numeric", pattern: "[0-9]*" }}
          onChange={(e) => setFilters({ ...filters, civil_id: onlyDigits(e.target.value, 12) })}
          sx={{ flex: 1 }}
        />
        <TextField
          fullWidth
          label="الرقم الآلي"
          value={filters.machine_number}
          inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
          onChange={(e) => setFilters({ ...filters, machine_number: onlyDigits(e.target.value, 9) })}
          sx={{ flex: 1 }}
        />
        <TextField
          fullWidth
          select
          label="الإدارة"
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          disabled={!canSearchOutsideDepartment}
          sx={{ flex: 1, minWidth: { xs: "100%", md: 220 } }}
        >
          {canSearchOutsideDepartment && <MenuItem value="">كل الإدارات</MenuItem>}
          {departments.map((dep) => (
            <MenuItem key={dep.id} value={dep.id}>
              {dep.name}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={search} sx={{ width: { xs: "100%", md: "auto" } }}>
          بحث
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>رقم القسمة</TableCell>
              <TableCell>المدين</TableCell>
              <TableCell>الرقم المدني</TableCell>
              <TableCell>الرقم الآلي</TableCell>
              <TableCell>نوع القائمة</TableCell>
              <TableCell>الإدارة</TableCell>
              <TableCell>العمليات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!hasRows && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  لا توجد نتائج
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.serial_number || row.id}</TableCell>
                <TableCell>{row.debtor_data?.full_name || "-"}</TableCell>
                <TableCell>{row.debtor_data?.civil_id || "-"}</TableCell>
                <TableCell>{row.machine_number}</TableCell>
                <TableCell>{row.list_type === "temporary" ? "مؤقتة" : "نهائية"}</TableCell>
                <TableCell>{row.department_data?.name || "-"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {canEdit && (
                      <IconButton color="primary" onClick={() => openEdit(row.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    )}
                    {canDelete && (
                      <IconButton color="error" onClick={() => doDelete(row.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton color="secondary" onClick={() => doPrint(row.id)}>
                      <PrintIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="xl"
        fullWidth
        slotProps={{ paper: { sx: { width: "96vw", maxWidth: "1800px" } } }}
      >
        <DialogTitle>تعديل القسمة #{editing?.serial_number || editing?.id}</DialogTitle>
        <DialogContent>
          {editModel && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="اسم المدين"
                    value={editModel.debtor_full_name}
                    inputProps={{ maxLength: 40 }}
                    onChange={(e) => setEditModel({ ...editModel, debtor_full_name: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="الرقم المدني"
                    value={editModel.debtor_civil_id}
                    inputProps={{ maxLength: 12, inputMode: "numeric", pattern: "[0-9]*" }}
                    onChange={(e) => setEditModel({ ...editModel, debtor_civil_id: onlyDigits(e.target.value, 12) })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    label="نوع القسمة"
                    value={editModel.distribution_type}
                    onChange={(e) => setEditModel({ ...editModel, distribution_type: e.target.value })}
                  >
                    <MenuItem value="cars">سيارات</MenuItem>
                    <MenuItem value="banks">بنوك</MenuItem>
                    <MenuItem value="real_estate">عقار</MenuItem>
                    <MenuItem value="cash">مبلغ مالي</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="الرقم الآلي"
                    value={editModel.machine_number}
                    inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
                    onChange={(e) => setEditModel({ ...editModel, machine_number: onlyDigits(e.target.value, 9) })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <DatePickerField
                    label="تاريخ الإيداع/البيع"
                    value={editModel.deposit_or_sale_date}
                    onChange={(value) => setEditModel({ ...editModel, deposit_or_sale_date: value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="مقدار الحصيلة"
                    value={editModel.proceed_amount}
                    inputProps={{ inputMode: "decimal" }}
                    onChange={(e) => setEditModel({ ...editModel, proceed_amount: onlyDecimal3(e.target.value) })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <DatePickerField
                    label="تاريخ القسمة"
                    value={editModel.distribution_date}
                    onChange={(value) => setEditModel({ ...editModel, distribution_date: value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    select
                    label="نوع قائمة التوزيع"
                    value={editModel.list_type}
                    onChange={(e) => setEditModel({ ...editModel, list_type: e.target.value })}
                  >
                    <MenuItem value="temporary">مؤقتة</MenuItem>
                    <MenuItem value="final">نهائية</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Typography fontWeight={700}>إضافة دائن جديد</Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="الرقم الآلي"
                    value={newCreditor.machine_number}
                    inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
                    onChange={(e) => setNewCreditor({ ...newCreditor, machine_number: onlyDigits(e.target.value, 9) })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="اسم الدائن"
                    value={newCreditor.creditor_name}
                    onChange={(e) => setNewCreditor({ ...newCreditor, creditor_name: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <DatePickerField
                    label="تاريخ الحجز"
                    value={newCreditor.attachment_date}
                    onChange={(value) => setNewCreditor({ ...newCreditor, attachment_date: value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="نوع الحجز"
                    value={newCreditor.attachment_type}
                    onChange={(e) => setNewCreditor({ ...newCreditor, attachment_type: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    label="قيمة المديونية"
                    value={newCreditor.debt_amount}
                    inputProps={{ inputMode: "decimal" }}
                    onChange={(e) => setNewCreditor({ ...newCreditor, debt_amount: onlyDecimal3(e.target.value) })}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    select
                    label="مرتبة الدين"
                    value={newCreditor.debt_rank}
                    onChange={(e) => setNewCreditor({ ...newCreditor, debt_rank: Number(e.target.value) })}
                  >
                    {rankOptions.map((rank) => (
                      <MenuItem key={rank.value} value={rank.value}>
                        {rank.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={addCreditor}>
                  إضافة دائن
                </Button>
                <Button variant="outlined" onClick={recalculateEdit}>
                  إعادة حساب القسمة
                </Button>
              </Stack>

              <Typography fontWeight={700}>تعديل الدائنين</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>الرقم الآلي</TableCell>
                      <TableCell>اسم الدائن</TableCell>
                      <TableCell>تاريخ الحجز</TableCell>
                      <TableCell>نوع الحجز</TableCell>
                      <TableCell>المديونية</TableCell>
                      <TableCell>المرتبة</TableCell>
                      <TableCell>مبلغ القسمة</TableCell>
                      <TableCell>حذف</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editModel.creditors.map((creditor, idx) => (
                      <TableRow key={`edit-creditor-${creditor.id || idx}`}>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={creditor.machine_number}
                            inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
                            onChange={(e) => updateCreditor(idx, "machine_number", onlyDigits(e.target.value, 9))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField fullWidth size="small" value={creditor.creditor_name} onChange={(e) => updateCreditor(idx, "creditor_name", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <DatePickerField
                            label=""
                            size="small"
                            value={creditor.attachment_date}
                            onChange={(value) => updateCreditor(idx, "attachment_date", value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField fullWidth size="small" value={creditor.attachment_type} onChange={(e) => updateCreditor(idx, "attachment_type", e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={creditor.debt_amount}
                            inputProps={{ inputMode: "decimal" }}
                            onChange={(e) => updateCreditor(idx, "debt_amount", onlyDecimal3(e.target.value))}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField fullWidth size="small" select value={creditor.debt_rank} onChange={(e) => updateCreditor(idx, "debt_rank", e.target.value)}>
                            {rankOptions.map((rank) => (
                              <MenuItem key={rank.value} value={rank.value}>
                                {rank.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField fullWidth size="small" value={creditor.distribution_amount || "0.000"} InputProps={{ readOnly: true }} />
                        </TableCell>
                        <TableCell>
                          <IconButton color="error" onClick={() => removeCreditor(idx)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={saveEdit}>
            حفظ التعديلات
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
