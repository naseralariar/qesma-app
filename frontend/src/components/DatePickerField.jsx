import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import "dayjs/locale/ar";

export default function DatePickerField({ label, value, onChange, fullWidth = true, size = "medium" }) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ar">
      <DatePicker
        label={label}
        format="DD/MM/YYYY"
        value={value ? dayjs(value) : null}
        onChange={(newValue) => onChange(newValue && newValue.isValid() ? newValue.format("YYYY-MM-DD") : "")}
        slotProps={{
          textField: {
            fullWidth,
            size,
            InputLabelProps: { shrink: true },
            inputProps: { dir: "ltr" },
          },
        }}
      />
    </LocalizationProvider>
  );
}
