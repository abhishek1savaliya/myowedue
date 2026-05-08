"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import Slide from "@mui/material/Slide";
import useMediaQuery from "@mui/material/useMediaQuery";

const AppAlertContext = createContext(null);

function SlideUp(props) {
  return <Slide {...props} direction="up" />;
}

function normalizeSeverity(severity) {
  return ["success", "info", "warning", "error"].includes(severity) ? severity : "info";
}

export function AppAlertProvider({ children }) {
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [alertState, setAlertState] = useState({
    open: false,
    message: "",
    severity: "info",
    autoHideDuration: 3200,
  });

  const showAlert = useCallback((message, options = {}) => {
    const text = String(message || "").trim();
    if (!text) return;

    setAlertState({
      open: true,
      message: text,
      severity: normalizeSeverity(options.severity),
      autoHideDuration: Number(options.autoHideDuration || 3200),
    });
  }, []);

  const closeAlert = useCallback((_event, reason) => {
    if (reason === "clickaway") return;
    setAlertState((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    function handleAppAlert(event) {
      const detail = event.detail || {};
      showAlert(detail.message, {
        severity: detail.severity,
        autoHideDuration: detail.autoHideDuration,
      });
    }

    window.addEventListener("app-alert", handleAppAlert);
    window.showAppAlert = showAlert;
    return () => {
      window.removeEventListener("app-alert", handleAppAlert);
      if (window.showAppAlert === showAlert) delete window.showAppAlert;
    };
  }, [showAlert]);

  const value = useMemo(() => ({ showAlert }), [showAlert]);

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <Snackbar
        open={alertState.open}
        autoHideDuration={alertState.autoHideDuration}
        onClose={closeAlert}
        TransitionComponent={SlideUp}
        anchorOrigin={isDesktop ? { vertical: "top", horizontal: "right" } : { vertical: "bottom", horizontal: "center" }}
        sx={{
          left: { xs: 12, sm: "auto" },
          right: { xs: 12, sm: 24 },
          width: { xs: "auto", sm: "min(460px, calc(100vw - 48px))" },
          maxWidth: "calc(100vw - 24px)",
          zIndex: 9999,
        }}
      >
        <Alert
          severity={alertState.severity}
          variant="filled"
          elevation={6}
          sx={{
            width: "100%",
            borderRadius: 2,
            alignItems: "center",
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
            "& .MuiAlert-message": {
              overflowWrap: "anywhere",
            },
          }}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  const context = useContext(AppAlertContext);
  if (!context) {
    return {
      showAlert(message, options) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app-alert", { detail: { message, ...options } }));
        }
      },
    };
  }
  return context;
}

export function showAppAlert(message, options = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app-alert", { detail: { message, ...options } }));
}
