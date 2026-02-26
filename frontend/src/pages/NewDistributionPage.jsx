import {
  Alert,
  Button,
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
import { useState } from "react";

import { calculateDistribution, createDebtor, createDistribution, printDistribution } from "../api/distributions";
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

const onlyDigits = (value, maxLength) => value.replace(/\D/g, "").slice(0, maxLength);
const onlyDecimal3 = (value) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 3)}`;
};
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function NewDistributionPage() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canWrite = ["admin", "manager", "officer"].includes(user.role);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savedDistributionId, setSavedDistributionId] = useState(null);

  const [debtorForm, setDebtorForm] = useState({ full_name: "", civil_id: "" });
  const [form, setForm] = useState({
    distribution_type: "cars",
    deposit_or_sale_date: "",
    proceed_amount: "",
    machine_number: "",
    distribution_date: "",
    list_type: "temporary",
  });
  const [creditors, setCreditors] = useState([]);
  const [creditor, setCreditor] = useState(emptyCreditor);

  const validateDebtor = () => {
    if (!debtorForm.full_name || !debtorForm.civil_id) return "بيانات المدين إلزامية";
    if (/\d/.test(debtorForm.full_name)) return "اسم المدين لا يقبل أرقام";
    if (!/^\d{12}$/.test(debtorForm.civil_id)) return "الرقم المدني يجب أن يكون 12 رقم";
    if (debtorForm.full_name.length > 40) return "اسم المدين لا يجب أن يتجاوز 40 حرف";
    return null;
  };

  const validateDistribution = () => {
    if (!form.deposit_or_sale_date || !form.proceed_amount || !form.machine_number || !form.distribution_date || !form.list_type) {
      return "كل بيانات القسمة إلزامية";
    }
    if (!/^\d{8}0$/.test(form.machine_number)) return "الرقم الآلي يجب أن يكون 9 أرقام وينتهي بصفر";
    if (!/^\d+(\.\d{1,3})?$/.test(String(form.proceed_amount || ""))) {
      return "مقدار الحصيلة يجب أن يكون رقمًا صحيحًا أو عشريًا حتى 3 منازل";
    }
    if (!isIsoDate(form.deposit_or_sale_date) || !isIsoDate(form.distribution_date)) {
      return "صيغة التاريخ يجب أن تكون يوم/شهر/سنة";
    }
    if (creditors.length === 0) return "أضف دائن واحد على الأقل";
    return null;
  };

  const validateCreditor = (row) => {
    if (!row.machine_number || !row.creditor_name || !row.attachment_date || !row.attachment_type || !row.debt_amount) {
      return "كل حقول الدائن إلزامية";
    }
    if (!/^\d{8}0$/.test(row.machine_number)) return "الرقم الآلي للدائن يجب أن يكون 9 أرقام وينتهي بصفر";
    if (!/^\d+(\.\d{1,3})?$/.test(String(row.debt_amount || ""))) {
      return "قيمة المديونية يجب أن تكون رقمًا صحيحًا أو عشريًا حتى 3 منازل";
    }
    if (!isIsoDate(row.attachment_date)) return "صيغة تاريخ الحجز يجب أن تكون يوم/شهر/سنة";
    return null;
  };

  const addCreditor = () => {
    setError("");
    const err = validateCreditor(creditor);
    if (err) return setError(err);

    setCreditors((prev) => [...prev, { ...creditor, debt_rank: Number(creditor.debt_rank), distribution_amount: "0.000" }]);
    setCreditor(emptyCreditor);
  };

  const removeCreditor = (index) => {
    const ok = window.confirm("هل أنت متأكد من حذف هذا الدائن؟");
    if (!ok) return;
    setCreditors((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCreditor = (index, key, value) => {
    setCreditors((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return { ...row, [key]: key === "debt_rank" ? Number(value) : value };
      })
    );
  };

  const calculate = async () => {
    try {
      setError("");
      setMessage("");
      if (!form.proceed_amount) return setError("أدخل مقدار الحصيلة قبل الحساب");
      if (creditors.length === 0) return setError("أضف دائنين قبل الحساب");

      for (const row of creditors) {
        const err = validateCreditor(row);
        if (err) return setError(err);
      }

      const calculatePayload = {
        proceed_amount: form.proceed_amount,
        creditors,
      };

      const data = await calculateDistribution(calculatePayload);
      const distributionByIndex = new Map(data.creditors.map((item) => [item.client_index, item.distribution_amount]));
      setCreditors((prev) => prev.map((row, idx) => ({ ...row, distribution_amount: distributionByIndex.get(idx) || "0.000" })));
      setMessage("تم حساب القسمة بنجاح");
    } catch {
      setError("تعذر حساب القسمة، تحقق من البيانات المدخلة");
    }
  };

  const clearForm = () => {
    setMessage("");
    setError("");
    setSavedDistributionId(null);
    setDebtorForm({ full_name: "", civil_id: "" });
    setForm({
      distribution_type: "cars",
      deposit_or_sale_date: "",
      proceed_amount: "",
      machine_number: "",
      distribution_date: "",
      list_type: "temporary",
    });
    setCreditors([]);
    setCreditor(emptyCreditor);
  };

  const submit = async () => {
    try {
      setError("");
      setMessage("");

      const debtorErr = validateDebtor();
      if (debtorErr) return setError(debtorErr);

      const distributionErr = validateDistribution();
      if (distributionErr) return setError(distributionErr);

      const departmentId = user.department;
      if (!departmentId) return setError("تعذر تحديد الإدارة الحالية للمستخدم");

      const debtor = await createDebtor({
        full_name: debtorForm.full_name,
        civil_id: debtorForm.civil_id,
        department: departmentId,
      });

      const result = await createDistribution({
        ...form,
        debtor: debtor.id,
        department: departmentId,
        creditors,
      });

      setSavedDistributionId(result.id);
      setMessage(`تم حفظ القسمة بنجاح - رقم القسمة ${result.serial_number || result.id}`);
    } catch (err) {
      const detail = err?.response?.data;
      if (Array.isArray(detail?.non_field_errors) && detail.non_field_errors.length > 0) {
        setError(detail.non_field_errors[0]);
        return;
      }
      if (typeof detail === "string" && detail) {
        setError(detail);
        return;
      }
      setError("تعذر حفظ القسمة، تأكد من صحة البيانات المدخلة");
    }
  };

  const printSaved = async () => {
    try {
      setError("");
      if (!savedDistributionId) return setError("احفظ القسمة أولاً قبل الطباعة");
      const blob = await printDistribution(savedDistributionId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setError("تعذر إنشاء ملف الطباعة");
    }
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="h6">إدخال قسمة جديدة</Typography>
      {!canWrite && <Alert severity="warning">صلاحيتك الحالية عرض فقط، لا يمكنك إضافة أو تعديل بيانات القسمة.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          القسم الأول: بيانات المدين
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="اسم المدين"
              value={debtorForm.full_name}
              inputProps={{ maxLength: 40 }}
              onChange={(e) => setDebtorForm({ ...debtorForm, full_name: e.target.value })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="الرقم المدني"
              value={debtorForm.civil_id}
              inputProps={{ maxLength: 12, inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => setDebtorForm({ ...debtorForm, civil_id: onlyDigits(e.target.value, 12) })}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          القسم الثاني: بيانات القسمة
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="الرقم الآلي"
              value={form.machine_number}
              inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => setForm({ ...form, machine_number: onlyDigits(e.target.value, 9) })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="نوع القسمة" value={form.distribution_type} onChange={(e) => setForm({ ...form, distribution_type: e.target.value })}>
              <MenuItem value="cars">سيارات</MenuItem>
              <MenuItem value="banks">بنوك</MenuItem>
              <MenuItem value="real_estate">عقار</MenuItem>
              <MenuItem value="cash">مبلغ مالي</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="مقدار الحصيلة (د.ك)"
              value={form.proceed_amount}
              inputProps={{ inputMode: "decimal" }}
              onChange={(e) => setForm({ ...form, proceed_amount: onlyDecimal3(e.target.value) })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <DatePickerField
              label="تاريخ الإيداع أو البيع"
              value={form.deposit_or_sale_date}
              onChange={(value) => setForm({ ...form, deposit_or_sale_date: value })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <DatePickerField
              label="تاريخ القسمة"
              value={form.distribution_date}
              onChange={(value) => setForm({ ...form, distribution_date: value })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField fullWidth select label="نوع قائمة التوزيع" value={form.list_type} onChange={(e) => setForm({ ...form, list_type: e.target.value })}>
              <MenuItem value="temporary">مؤقتة</MenuItem>
              <MenuItem value="final">نهائية</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          القسم الثالث: جدول الدائنين
        </Typography>
        <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="الرقم الآلي"
              value={creditor.machine_number}
              inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => setCreditor({ ...creditor, machine_number: onlyDigits(e.target.value, 9) })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth label="اسم الدائن" value={creditor.creditor_name} onChange={(e) => setCreditor({ ...creditor, creditor_name: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <DatePickerField
              label="تاريخ الحجز"
              value={creditor.attachment_date}
              onChange={(value) => setCreditor({ ...creditor, attachment_date: value })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth label="نوع الحجز" value={creditor.attachment_type} onChange={(e) => setCreditor({ ...creditor, attachment_type: e.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="قيمة المديونية"
              value={creditor.debt_amount}
              inputProps={{ inputMode: "decimal" }}
              onChange={(e) => setCreditor({ ...creditor, debt_amount: onlyDecimal3(e.target.value) })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth select label="مرتبة الدين" value={creditor.debt_rank} onChange={(e) => setCreditor({ ...creditor, debt_rank: Number(e.target.value) })}>
              {rankOptions.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Button variant="outlined" onClick={addCreditor} disabled={!canWrite}>
          إضافة دائن (AJAX)
        </Button>

        <TableContainer sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>الرقم الآلي</TableCell>
                <TableCell>اسم الدائن</TableCell>
                <TableCell>تاريخ الحجز</TableCell>
                <TableCell>نوع الحجز</TableCell>
                <TableCell>قيمة المديونية</TableCell>
                <TableCell>مرتبة الدين</TableCell>
                <TableCell>مبلغ القسمة</TableCell>
                <TableCell>حذف</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {creditors.map((row, idx) => (
                <TableRow key={`cred-${idx}`}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={row.machine_number}
                      inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
                      onChange={(e) => updateCreditor(idx, "machine_number", onlyDigits(e.target.value, 9))}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={row.creditor_name} onChange={(e) => updateCreditor(idx, "creditor_name", e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <DatePickerField
                      label=""
                      size="small"
                      value={row.attachment_date}
                      onChange={(value) => updateCreditor(idx, "attachment_date", value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={row.attachment_type} onChange={(e) => updateCreditor(idx, "attachment_type", e.target.value)} />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={row.debt_amount}
                      inputProps={{ inputMode: "decimal" }}
                      onChange={(e) => updateCreditor(idx, "debt_amount", onlyDecimal3(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" select value={row.debt_rank} onChange={(e) => updateCreditor(idx, "debt_rank", e.target.value)}>
                      {rankOptions.map((r) => (
                        <MenuItem key={r.value} value={r.value}>
                          {r.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={row.distribution_amount || "0.000"} InputProps={{ readOnly: true }} />
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
      </Paper>

      <Stack direction="row" spacing={1.2} flexWrap="wrap">
        <Button variant="outlined" onClick={calculate} disabled={!canWrite}>
          حساب القسمة
        </Button>
        <Button variant="contained" onClick={submit} disabled={!canWrite}>
          حفظ القسمة
        </Button>
        <Button variant="outlined" color="inherit" onClick={clearForm}>
          تفريغ الصفحة
        </Button>
        <Button variant="outlined" onClick={printSaved}>
          طباعة القسمة
        </Button>
      </Stack>

      <Typography variant="body2">عدد الدائنين الحالي: {creditors.length}</Typography>
    </Stack>
  );
}
