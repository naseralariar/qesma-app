import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

import App from "./App";

const theme = createTheme({
  direction: "rtl",
  palette: {
    mode: "light",
    primary: { main: "#0f4c81" },
  },
  typography: {
    fontFamily: "Tahoma, Arial, sans-serif",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          direction: "rtl",
        },
        body: {
          direction: "rtl",
          textAlign: "right",
        },
        "#root": {
          direction: "rtl",
        },
      },
    },
  },
});

document.documentElement.setAttribute("dir", "rtl");
document.documentElement.setAttribute("lang", "ar");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
