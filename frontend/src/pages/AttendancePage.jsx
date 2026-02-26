import { Alert, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import client from "../api/client";
import { useEffect, useMemo, useState } from "react";
import { findDistributionsForAttendance } from "../api/distributions";
import DatePickerField from "../components/DatePickerField";
import { ATTENDANCE_LOCATIONS } from "../constants/attendanceLocations";

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export default function AttendancePage() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const availableLocations = useMemo(() => {
    const allowAll = user.role === "admin" || user.attendance_allow_all_locations !== false;
    if (allowAll) {
      return ATTENDANCE_LOCATIONS;
    }
    const selected = Array.isArray(user.attendance_allowed_locations) ? user.attendance_allowed_locations : [];
    return ATTENDANCE_LOCATIONS.filter((location) => selected.includes(location));
  }, [user]);

  const [search, setSearch] = useState({ machine_number: "", civil_id: "" });
  const [distributionOptions, setDistributionOptions] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState({
    distribution_id: "",
    attendance_date: "",
    attendance_time: "",
    location: availableLocations[0] || "",
    floor: "",
    room_number: "",
  });

  useEffect(() => {
    setPayload((prev) => ({ ...prev, location: availableLocations[0] || "" }));
  }, [availableLocations]);

  const doSearch = async () => {
    try {
      setError("");
      setMessage("");
      if (!search.machine_number && !search.civil_id) {
        setError("أدخل الرقم الآلي أو الرقم المدني للمدين للبحث");
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
      const data = await findDistributionsForAttendance({
        machineNumber: search.machine_number,
        civilId: search.civil_id,
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

  const generate = async () => {
    try {
      setError("");
      if (!payload.distribution_id) {
        setError("اختر قسمة من نتائج البحث أولاً");
        return;
      }
      if (!isIsoDate(payload.attendance_date)) {
        setError("صيغة تاريخ الحضور يجب أن تكون يوم/شهر/سنة");
        return;
      }
      if (!payload.location) {
        setError("لا توجد مواقع تبليغ متاحة لهذا المستخدم");
        return;
      }
      const response = await client.post(
        "/reports/attendance-notices/",
        payload,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank");
    } catch {
      setError("تعذر إنشاء ملف التباليغ");
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">إنشاء تباليغ بالحضور</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {availableLocations.length === 0 && <Alert severity="warning">لا توجد لديك صلاحية على أي موقع تبليغ</Alert>}

      <Typography variant="subtitle2">بحث القسمة بالرقم الآلي أو المدني للمدين</Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            label="الرقم الآلي للقسمة"
            value={search.machine_number}
            inputProps={{ maxLength: 9, inputMode: "numeric", pattern: "[0-9]*" }}
            onChange={(e) =>
              setSearch({
                ...search,
                machine_number: e.target.value.replace(/\D/g, "").slice(0, 9),
              })
            }
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            fullWidth
            label="الرقم المدني للمدين"
            value={search.civil_id}
            inputProps={{ maxLength: 12, inputMode: "numeric", pattern: "[0-9]*" }}
            onChange={(e) =>
              setSearch({
                ...search,
                civil_id: e.target.value.replace(/\D/g, "").slice(0, 12),
              })
            }
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
        label="اختر القسمة من نتائج البحث"
        value={payload.distribution_id}
        onChange={(e) => setPayload({ ...payload, distribution_id: e.target.value })}
      >
        {distributionOptions.map((row) => (
          <MenuItem key={row.id} value={row.id}>
            #{row.serial_number || row.id} - {row.machine_number} - {row.debtor_data?.full_name || "بدون اسم"} - {row.debtor_data?.civil_id || "بدون مدني"} - تاريخ القسمة: {row.distribution_date || "-"} - المبلغ المودع: {row.proceed_amount || "0.000"}
          </MenuItem>
        ))}
      </TextField>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 3 }}>
          <DatePickerField
            label="تاريخ الحضور"
            value={payload.attendance_date}
            onChange={(value) => setPayload({ ...payload, attendance_date: value })}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField fullWidth type="time" label="ساعة الحضور" InputLabelProps={{ shrink: true }} value={payload.attendance_time} onChange={(e) => setPayload({ ...payload, attendance_time: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth select label="مقر الحضور" value={payload.location} onChange={(e) => setPayload({ ...payload, location: e.target.value })}>
            {availableLocations.map((location) => (
              <MenuItem key={location} value={location}>
                {location}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, md: 2 }}>
          <TextField fullWidth label="الطابق" value={payload.floor} onChange={(e) => setPayload({ ...payload, floor: e.target.value })} />
        </Grid>
        <Grid size={{ xs: 6, md: 1 }}>
          <TextField fullWidth label="رقم الغرفة" value={payload.room_number} onChange={(e) => setPayload({ ...payload, room_number: e.target.value })} />
        </Grid>
      </Grid>

      <Button variant="contained" onClick={generate} disabled={availableLocations.length === 0} sx={{ width: { xs: "100%", md: "auto" } }}>
        معاينة PDF
      </Button>
    </Stack>
  );
}
