import { Alert, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useState } from "react";
import client from "../api/client";
import { searchDistributions } from "../api/distributions";

const MAX_PAGE1_LINES = 15;
const MAX_PAGE2_LINES = 20;
const MAX_LINE_CHARS = 110;

const normalizePage1Body = (value) => {
  const rawLines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const clippedLines = rawLines.slice(0, MAX_PAGE1_LINES).map((line) => line.slice(0, MAX_LINE_CHARS));
  return clippedLines.join("\n");
};

const normalizePage2Body = (value) => {
  const rawLines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  const clippedLines = rawLines.slice(0, MAX_PAGE2_LINES).map((line) => line.slice(0, MAX_LINE_CHARS));
  return clippedLines.join("\n");
};

const isPage1BodyValid = (value) => {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  if (lines.length > MAX_PAGE1_LINES) return false;
  return lines.every((line) => line.length <= MAX_LINE_CHARS);
};

const isPage2BodyValid = (value) => {
  const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
  if (lines.length > MAX_PAGE2_LINES) return false;
  return lines.every((line) => line.length <= MAX_LINE_CHARS);
};

export default function SessionMinutesPage() {
  const [search, setSearch] = useState({ machine_number: "", civil_id: "" });
  const [distributionOptions, setDistributionOptions] = useState([]);
  const [form, setForm] = useState({ distribution_id: "", chairperson_name: "", page1_body: "", page2_body: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const onlyDigits = (value, maxLength) => value.replace(/\D/g, "").slice(0, maxLength);

  const openPdf = (blob) => {
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const doSearch = async () => {
    try {
      setError("");
      setMessage("");
      if (!search.machine_number && !search.civil_id) {
        setError("أدخل الرقم الآلي أو الرقم المدني للبحث");
        return;
      }
      if (search.machine_number && !/^\d{9}$/.test(search.machine_number)) {
        setError("الرقم الآلي يجب أن يكون 9 أرقام");
        return;
      }
      if (search.civil_id && !/^\d{12}$/.test(search.civil_id)) {
        setError("الرقم المدني يجب أن يكون 12 رقم");
        return;
      }
      const data = await searchDistributions({
        machine_number: search.machine_number,
        civil_id: search.civil_id,
      });
      const rows = data.results || data || [];
      setDistributionOptions(rows);
      if (rows.length === 0) {
        setError("لا توجد قساميات مطابقة");
      } else {
        setMessage(`تم العثور على ${rows.length} قسامية`);
      }
    } catch {
      setError("تعذر تنفيذ البحث");
    }
  };

  const generateMinutes = async () => {
    try {
      setError("");
      if (!form.distribution_id) {
        setError("اختر القسمة المراد تحرير محضر لها");
        return;
      }
      if (!isPage1BodyValid(form.page1_body)) {
        setError("نص الصفحة الأولى يجب ألا يتجاوز 15 سطرًا، وبحد أقصى 110 حرفًا (بالمسافات) لكل سطر");
        return;
      }
      if (!isPage2BodyValid(form.page2_body)) {
        setError("نص الصفحة الثانية يجب ألا يتجاوز 20 سطرًا، وبحد أقصى 110 حرفًا (بالمسافات) لكل سطر");
        return;
      }
      const response = await client.post("/reports/session-minutes/", form, { responseType: "blob" });
      openPdf(response.data);
    } catch {
      setError("تعذر توليد المحضر بالنص المحرر");
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">تحرير محضر جلسة توزيع</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Typography>ابحث عن القسمة أولاً ثم أدخل البيانات الإضافية قبل نص الصفحة.</Typography>

      <Typography variant="subtitle2">بحث عن القسمة المراد تحرير المحضر لها</Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            label="الرقم الآلي"
            value={search.machine_number}
            inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
            onChange={(e) => setSearch({ ...search, machine_number: onlyDigits(e.target.value, 9) })}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            label="الرقم المدني"
            value={search.civil_id}
            inputProps={{ maxLength: 12, inputMode: "numeric", pattern: "[0-9]*" }}
            onChange={(e) => setSearch({ ...search, civil_id: onlyDigits(e.target.value, 12) })}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Button variant="outlined" onClick={doSearch} fullWidth sx={{ height: "100%", minHeight: 56 }}>
            بحث
          </Button>
        </Grid>
      </Grid>

      <TextField
        fullWidth
        select
        label="اختر القسمة"
        value={form.distribution_id}
        onChange={(e) => setForm({ ...form, distribution_id: e.target.value })}
      >
        {distributionOptions.map((row) => (
          <MenuItem key={row.id} value={row.id}>
            #{row.serial_number || row.id} - {row.machine_number} - {row.debtor_data?.full_name || "بدون اسم"} - {row.debtor_data?.civil_id || "بدون مدني"} - تاريخ القسمة: {row.distribution_date || "-"} - المبلغ المودع: {row.proceed_amount || "0.000"}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        label="رئيس الجلسة (اختياري)"
        value={form.chairperson_name}
        inputProps={{ maxLength: 255 }}
        onChange={(e) => setForm({ ...form, chairperson_name: e.target.value })}
      />

      <TextField
        fullWidth
        multiline
        minRows={12}
        maxRows={16}
        label="نص إضافي للصفحة الأولى (اختياري)"
        value={form.page1_body}
        onChange={(e) => setForm({ ...form, page1_body: normalizePage1Body(e.target.value) })}
        helperText="الحد الأقصى: 15 سطر، وكل سطر حتى 110 حرف (شامل المسافات)"
      />
      <TextField
        fullWidth
        multiline
        minRows={12}
        maxRows={20}
        label="نص الصفحة الثانية (اختياري - إذا تُرك فارغًا لن تُنشأ صفحة ثانية)"
        value={form.page2_body}
        onChange={(e) => setForm({ ...form, page2_body: normalizePage2Body(e.target.value) })}
        helperText="الحد الأقصى: 20 سطر، وكل سطر حتى 110 حرف (شامل المسافات)"
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <Button variant="contained" onClick={generateMinutes} sx={{ width: { xs: "100%", md: "auto" } }}>معاينة محضر الجلسة</Button>
      </Stack>
    </Stack>
  );
}
