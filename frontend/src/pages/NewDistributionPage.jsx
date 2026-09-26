import {
  Alert,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
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
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

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
  debt_rank: "",
  distribution_amount: "0.000",
};

const onlyDigits = (value, maxLength) => value.replace(/\D/g, "").slice(0, maxLength);
const onlyDecimal3 = (value) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts.slice(1).join("").slice(0, 3)}`;
};

const amountToFils = (value) => {
  const [whole = "0", fraction = ""] = String(value || "0").split(".");
  return (BigInt(whole || "0") * 1000n) + BigInt(fraction.padEnd(3, "0").slice(0, 3) || "0");
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

const getCalculateErrorMessage = (err) => {
  const detail = err?.response?.data?.detail;

  if (detail === "proceed_amount is required") {
    return "يرجى إدخال مقدار الحصيلة";
  }

  if (detail === "Invalid proceed_amount") {
    return "مقدار الحصيلة غير صحيح. يرجى إدخال مبلغ صحيح حتى 3 منازل عشرية";
  }

  if (typeof detail === "string" && detail.startsWith("Invalid creditor row at index ")) {
    const index = Number(detail.replace("Invalid creditor row at index ", ""));
    if (Number.isInteger(index)) {
      return `بيانات الدائن رقم ${index + 1} غير صحيحة. يرجى مراجعة قيمة المديونية ومرتبة الدين`;
    }
  }

  if (typeof detail === "string" && /[\u0600-\u06FF]/.test(detail)) {
    return detail;
  }

  return "تعذر حساب القسمة بسبب خطأ تقني. يرجى المحاولة مرة أخرى.";
};


export default function NewDistributionPage() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canWrite = ["admin", "manager", "officer"].includes(user.role);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [savedDistributionId, setSavedDistributionId] = useState(null);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { setHasUnsavedChanges } = useOutletContext();

  useEffect(() => {
    setHasUnsavedChanges(isDirty);

    return () => {
      setHasUnsavedChanges(false);
    };
  }, [isDirty, setHasUnsavedChanges]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const [debtorForm, setDebtorForm] = useState({ full_name: "", civil_id: "" });
  const [form, setForm] = useState({
    distribution_type: "",
    deposit_or_sale_date: "",
    proceed_amount: "",
    machine_number: "",
    distribution_date: "",
    list_type: "",
  });
  const [creditors, setCreditors] = useState([]);
  const [creditor, setCreditor] = useState(emptyCreditor);

  const validateDebtor = () => {
    if (!debtorForm.full_name) return "يرجى إدخال اسم المدين";
    if (!debtorForm.civil_id) return "يرجى إدخال الرقم المدني للمدين";
    if (/\d/.test(debtorForm.full_name)) return "اسم المدين لا يجوز أن يحتوي على أرقام";
    if (!/^\d{12}$/.test(debtorForm.civil_id)) return "الرقم المدني للمدين يجب أن يتكون من 12 رقمًا";
    if (debtorForm.full_name.length > 40) return "اسم المدين يجب ألا يتجاوز 40 حرفًا";
    return null;
  };

  const validateDistribution = () => {
    if (!form.distribution_type) return "يرجى اختيار نوع القسمة";
    if (!form.deposit_or_sale_date) return "يرجى إدخال تاريخ الإيداع أو البيع";
    if (!form.proceed_amount) return "يرجى إدخال مقدار الحصيلة";
    if (!form.machine_number) return "يرجى إدخال الرقم الآلي للقسمة";
    if (!form.distribution_date) return "يرجى إدخال تاريخ القسمة";
    if (!form.list_type) return "يرجى اختيار نوع قائمة التوزيع";
    if (!/^\d{8}0$/.test(form.machine_number)) return "الرقم الآلي للقسمة يجب أن يتكون من 9 أرقام وينتهي بصفر";
    if (!/^\d+(\.\d{1,3})?$/.test(String(form.proceed_amount || ""))) {
      return "مقدار الحصيلة يجب أن يكون رقمًا صحيحًا أو عشريًا حتى 3 منازل";
    }
    if (Number(form.proceed_amount) <= 0) return "مقدار الحصيلة يجب أن يكون أكبر من صفر";
    if (!isIsoDate(form.deposit_or_sale_date)) return "يرجى إدخال تاريخ الإيداع أو البيع بصيغة صحيحة";
    if (!isIsoDate(form.distribution_date)) return "يرجى إدخال تاريخ القسمة بصيغة صحيحة";
    if (creditors.length === 0) return "يجب إضافة دائن واحد على الأقل قبل حساب أو حفظ القسمة";
    return null;
  };

  const validateCreditor = (row) => {
    if (!row.machine_number) return "يرجى إدخال الرقم الآلي للدائن";
    if (!row.creditor_name) return "يرجى إدخال اسم الدائن";
    if (!row.attachment_date) return "يرجى إدخال تاريخ الحجز";
    if (!row.attachment_type) return "يرجى اختيار نوع الحجز";
    if (!row.debt_amount) return "يرجى إدخال قيمة المديونية";
    if (!row.debt_rank) return "يرجى اختيار مرتبة الدين";
    if (!/^\d{8}0$/.test(row.machine_number)) return "الرقم الآلي للدائن يجب أن يتكون من 9 أرقام وينتهي بصفر";
    if (!/^\d+(\.\d{1,3})?$/.test(String(row.debt_amount || ""))) {
      return "قيمة المديونية يجب أن تكون رقمًا صحيحًا أو عشريًا حتى 3 منازل";
    }
    if (Number(row.debt_amount) <= 0) return "قيمة المديونية يجب أن تكون أكبر من صفر";
    if (!isIsoDate(row.attachment_date)) return "يرجى إدخال تاريخ الحجز بصيغة صحيحة";
    return null;
  };

  const validateProceedsAgainstDebts = () => {
    const totalDebts = creditors.reduce(
      (sum, row) => sum + amountToFils(row.debt_amount),
      0n
    );
    const proceeds = amountToFils(form.proceed_amount);

    if (proceeds >= totalDebts) {
      return "لا يمكن إجراء القسمة لأن مقدار الحصيلة يكفي لسداد إجمالي مديونيات الدائنين. يرجى مراجعة البيانات المدخلة.";
    }

    return null;
  };

  const addCreditor = () => {
    setError("");
    const err = validateCreditor(creditor);
    if (err) return setError(err);

    setCreditors((prev) => [...prev, { ...creditor, debt_rank: Number(creditor.debt_rank), distribution_amount: "0.000" }]);
    setIsCalculated(false);
    setIsDirty(true);
    setCreditor(emptyCreditor);
  };

  const removeCreditor = (index) => {
    const ok = window.confirm("هل أنت متأكد من حذف هذا الدائن؟");
    if (!ok) return;
    setCreditors((prev) => prev.filter((_, i) => i !== index));
    setIsCalculated(false);
    setIsDirty(true);
  };

  const updateCreditor = (index, key, value) => {
    setIsCalculated(false);
    setIsDirty(true);
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

      for (let index = 0; index < creditors.length; index += 1) {
        const err = validateCreditor(creditors[index]);
        if (err) return setError(`الدائن رقم ${index + 1}: ${err}`);
      }

      const proceedsErr = validateProceedsAgainstDebts();
      if (proceedsErr) return setError(proceedsErr);

      const calculatePayload = {
        proceed_amount: form.proceed_amount,
        creditors,
      };

      const data = await calculateDistribution(calculatePayload);
      const distributionByIndex = new Map(data.creditors.map((item) => [item.client_index, item.distribution_amount]));
      setCreditors((prev) => prev.map((row, idx) => ({ ...row, distribution_amount: distributionByIndex.get(idx) || "0.000" })));
      setIsCalculated(true);
      setMessage("تم حساب القسمة بنجاح");
    } catch (err) {
      setError(getCalculateErrorMessage(err));
    }
  };

  const clearForm = () => {
    setMessage("");
    setError("");
    setSavedDistributionId(null);
    setDebtorForm({ full_name: "", civil_id: "" });
    setForm({
      distribution_type: "",
      deposit_or_sale_date: "",
      proceed_amount: "",
      machine_number: "",
      distribution_date: "",
      list_type: "",
    });
    setCreditors([]);
    setCreditor(emptyCreditor);
    setIsCalculated(false);
    setIsDirty(false);
  };

  const getSaveErrorMessage = (err) => {
    const detail = err?.response?.data;

    if (Array.isArray(detail?.non_field_errors) && detail.non_field_errors.length > 0) {
      return detail.non_field_errors[0];
    }

    if (typeof detail === "string" && detail) {
      return detail;
    }

    if (detail && typeof detail === "object") {
      const fieldLabels = {
        debtor: "المدين",
        department: "الإدارة",
        distribution_type: "نوع القسمة",
        deposit_or_sale_date: "تاريخ الإيداع أو البيع",
        proceed_amount: "مقدار الحصيلة",
        machine_number: "الرقم الآلي للقسمة",
        distribution_date: "تاريخ القسمة",
        list_type: "نوع قائمة التوزيع",
        creditors: "بيانات الدائنين",
        full_name: "اسم المدين",
        civil_id: "الرقم المدني للمدين",
      };

      for (const [field, value] of Object.entries(detail)) {
        const message = Array.isArray(value) ? value[0] : value;

        if (typeof message === "string" && message) {
          const label = fieldLabels[field] || field;
          return `${label}: ${message}`;
        }

        if (value && typeof value === "object") {
          return `${fieldLabels[field] || field}: توجد بيانات غير صحيحة، يرجى مراجعتها`;
        }
      }
    }

    return "تعذر حفظ القسمة بسبب خطأ تقني. يرجى المحاولة مرة أخرى.";
  };

  const submit = async () => {
    try {
      setError("");
      setMessage("");

      const debtorErr = validateDebtor();
      if (debtorErr) return setError(debtorErr);

      const distributionErr = validateDistribution();
      if (distributionErr) return setError(distributionErr);

      if (!isCalculated) {
        return setError("يرجى حساب القسمة ومراجعة مبالغ التوزيع قبل الحفظ.");
      }

      for (let index = 0; index < creditors.length; index += 1) {
        const err = validateCreditor(creditors[index]);
        if (err) return setError(`الدائن رقم ${index + 1}: ${err}`);
      }

      const proceedsErr = validateProceedsAgainstDebts();
      if (proceedsErr) return setError(proceedsErr);

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
      setIsDirty(false);
      setMessage(`تم حفظ القسمة بنجاح - رقم القسمة ${result.serial_number || result.id}`);
    } catch (err) {
      setError(getSaveErrorMessage(err));
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
    <Stack spacing={{ xs: 1.5, md: 2 }}>
      <Typography variant="h6">إدخال قسمة جديدة</Typography>
      {!canWrite && <Alert severity="warning">صلاحيتك الحالية عرض فقط، لا يمكنك إضافة أو تعديل بيانات القسمة.</Alert>}

      <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          القسم الأول: بيانات المدين
        </Typography>
        <Grid container spacing={{ xs: 1.25, md: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="اسم المدين"
              value={debtorForm.full_name}
              inputProps={{ maxLength: 40 }}
              onChange={(e) => {
                setIsDirty(true);
                setDebtorForm({ ...debtorForm, full_name: e.target.value });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              size="small"
              label="الرقم المدني"
              value={debtorForm.civil_id}
              inputProps={{ maxLength: 12, inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => {
                setIsDirty(true);
                setDebtorForm({ ...debtorForm, civil_id: onlyDigits(e.target.value, 12) });
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          القسم الثاني: بيانات القسمة
        </Typography>
        <Grid container spacing={{ xs: 1.25, md: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="الرقم الآلي"
              value={form.machine_number}
              inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => {
                setIsDirty(true);
                setForm({ ...form, machine_number: onlyDigits(e.target.value, 9) });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <TextField fullWidth size="small" select label="نوع القسمة" value={form.distribution_type} onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, distribution_type: e.target.value });
            }}>
              <MenuItem value="" disabled>اختر نوع القسمة</MenuItem>
              <MenuItem value="cars">سيارات</MenuItem>
              <MenuItem value="banks">بنوك</MenuItem>
              <MenuItem value="real_estate">عقار</MenuItem>
              <MenuItem value="cash">مبلغ مالي</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <TextField
              fullWidth
              size="small"
              label="مقدار الحصيلة (د.ك)"
              value={form.proceed_amount}
              inputProps={{ inputMode: "decimal" }}
              onChange={(e) => {
                setIsCalculated(false);
                setIsDirty(true);
                setForm({ ...form, proceed_amount: onlyDecimal3(e.target.value) });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <DatePickerField
                size="small"
              label="تاريخ الإيداع أو البيع"
              value={form.deposit_or_sale_date}
              onChange={(value) => {
                setIsDirty(true);
                setForm({ ...form, deposit_or_sale_date: value });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <DatePickerField
                size="small"
              label="تاريخ القسمة"
              value={form.distribution_date}
              onChange={(value) => {
                setIsDirty(true);
                setForm({ ...form, distribution_date: value });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
            <TextField fullWidth size="small" select label="نوع قائمة التوزيع" value={form.list_type} onChange={(e) => {
              setIsDirty(true);
              setForm({ ...form, list_type: e.target.value });
            }}>
              <MenuItem value="" disabled>اختر نوع قائمة التوزيع</MenuItem>
              <MenuItem value="temporary">مؤقتة</MenuItem>
              <MenuItem value="final">نهائية</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
          القسم الثالث: جدول الدائنين
        </Typography>
        <Grid container spacing={{ xs: 1.25, md: 1.5 }} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="الرقم الآلي"
              value={creditor.machine_number}
              inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
              onChange={(e) => {
                setIsDirty(true);
                setCreditor({ ...creditor, machine_number: onlyDigits(e.target.value, 9) });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <TextField fullWidth size="small" label="اسم الدائن" value={creditor.creditor_name} onChange={(e) => {
              setIsDirty(true);
              setCreditor({ ...creditor, creditor_name: e.target.value });
            }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <DatePickerField
                size="small"
              label="تاريخ الحجز"
              value={creditor.attachment_date}
              onChange={(value) => {
                setIsDirty(true);
                setCreditor({ ...creditor, attachment_date: value });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <TextField fullWidth size="small" label="نوع الحجز" value={creditor.attachment_type} onChange={(e) => {
              setIsDirty(true);
              setCreditor({ ...creditor, attachment_type: e.target.value });
            }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="قيمة المديونية"
              value={creditor.debt_amount}
              inputProps={{ inputMode: "decimal" }}
              onChange={(e) => {
                setIsDirty(true);
                setCreditor({ ...creditor, debt_amount: onlyDecimal3(e.target.value) });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
            <TextField fullWidth size="small" select label="مرتبة الدين" value={creditor.debt_rank} onChange={(e) => {
              setIsDirty(true);
              setCreditor({ ...creditor, debt_rank: Number(e.target.value) });
            }}>
              <MenuItem value="" disabled>اختر مرتبة الدين</MenuItem>
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

        <TableContainer
          sx={{
            mt: 1.5,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Table size="small" sx={{ minWidth: 1050 }}>
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

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{
          "& .MuiButton-root": {
            minHeight: 40,
            width: { xs: "100%", sm: "auto" },
          },
        }}
      >
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

      <Snackbar
        open={Boolean(error || message)}
        autoHideDuration={message ? 5000 : null}
        onClose={(_, reason) => {
          if (reason === "clickaway") return;
          setError("");
          setMessage("");
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          "& .MuiAlert-root": {
            width: { xs: "calc(100vw - 24px)", sm: "auto" },
            maxWidth: 720,
          },
        }}
      >
        <Alert
          severity={error ? "error" : "success"}
          variant="filled"
          onClose={() => {
            setError("");
            setMessage("");
          }}
          sx={{ width: "100%" }}
        >
          {error || message}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
