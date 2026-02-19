import React, { createContext, useCallback, useContext, useState } from "react";
import * as Haptics from "expo-haptics";
import { CustomAlert } from "../components/CustomAlert";
import type { CustomAlertButton, AlertType } from "../components/CustomAlert";

interface AlertState {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: CustomAlertButton[];
}

interface AlertContextValue {
  /** Muestra una alerta. type: 'success' | 'error' | 'warning' | 'info' (default: 'info') */
  showAlert: (
    title: string,
    message?: string,
    buttons?: CustomAlertButton[],
    type?: AlertType
  ) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

function triggerHaptics(type: AlertType) {
  try {
    switch (type) {
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "info":
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
    }
  } catch {
    // expo-haptics no disponible (web, etc.)
  }
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<AlertState>({ title: "" });

  const showAlert = useCallback(
    (
      title: string,
      message?: string,
      buttons?: CustomAlertButton[],
      type: AlertType = "info"
    ) => {
      setState({
        title,
        message,
        type,
        buttons:
          buttons?.length ? buttons : [{ text: "Aceptar", style: "default" }],
      });
      setVisible(true);
      triggerHaptics(type);
    },
    []
  );

  const onDismiss = useCallback(() => setVisible(false), []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert
        visible={visible}
        onDismiss={onDismiss}
        title={state.title}
        message={state.message}
        type={state.type ?? "info"}
        buttons={state.buttons}
      />
    </AlertContext.Provider>
  );
}

export function useCustomAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useCustomAlert must be used within AlertProvider");
  }
  return ctx;
}
