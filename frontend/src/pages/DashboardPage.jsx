import { Card, CardContent, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useEffect, useState } from "react";

import { getDashboard } from "../api/distributions";

const Item = ({ title, value }) => (
  <Card>
    <CardContent>
      <Typography variant="body2">{title}</Typography>
      <Typography variant="h5" sx={{ mt: 1, fontWeight: 700 }}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDashboard().then(setStats);
  }, []);

  return (
    <Stack spacing={3}>
      <Typography variant="h6">لوحة المؤشرات</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Item title="إجمالي القساميات" value={stats?.total_distributions ?? 0} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Item title="عدد القساميات المؤقتة" value={stats?.temporary_count ?? 0} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Item title="عدد القساميات النهائية" value={stats?.final_count ?? 0} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Item title="إجمالي المبالغ الموزعة" value={stats?.total_distributed_amount ?? 0} />
        </Grid>
      </Grid>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        إحصائية حسب الإدارة
      </Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>الإدارة</TableCell>
              <TableCell>عدد القساميات</TableCell>
              <TableCell>إجمالي الحصيلة</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(stats?.by_department || []).map((row) => (
              <TableRow key={row.department__id}>
                <TableCell>{row.department__name}</TableCell>
                <TableCell>{row.total_distributions}</TableCell>
                <TableCell>{row.total_proceeds}</TableCell>
              </TableRow>
            ))}
            {(!stats?.by_department || stats.by_department.length === 0) && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  لا توجد بيانات
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
