import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Colors } from "../../constants/Colors";

type DateTimePickerButtonProps = {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  label?: string;
  error?: string;
  disabled?: boolean;
  onConfirm?: () => void;
  testID?: string;
};

export function DateTimePickerButton({
  value,
  onChange,
  minimumDate,
  label = "FECHA Y HORA",
  error,
  disabled,
  onConfirm,
  testID,
}: DateTimePickerButtonProps) {
  const [mode, setMode] = useState<"date" | "time">("date");
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  const displayText = format(value, "EEEE d MMM · HH:mm", { locale: es });

  const handleOpenDate = () => {
    if (disabled) return;
    setTempDate(value);
    setMode("date");
    setShow(true);
  };

  const handlePickerChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected === undefined) {
      if (Platform.OS === "android") setShow(false);
      return;
    }

    if (mode === "date") {
      setTempDate(selected);
      if (Platform.OS === "ios") {
        setMode("time");
      } else {
        setShow(false);
        setMode("time");
        setTimeout(() => setShow(true), 100);
      }
    } else {
      const next = new Date(tempDate);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      if (Platform.OS === "ios") {
        setTempDate(next);
      } else {
        onChange(next);
        onConfirm?.();
        setShow(false);
      }
    }
  };

  const handleConfirmTime = () => {
    onChange(tempDate);
    onConfirm?.();
    setShow(false);
  };

  const pickerValue = mode === "date" ? tempDate : tempDate;
  const picker = (
    <DateTimePicker
      value={pickerValue}
      mode={mode}
      display={Platform.OS === "ios" ? "spinner" : "default"}
      onChange={handlePickerChange}
      minimumDate={minimumDate}
      locale="es-ES"
    />
  );

  return (
    <View style={styles.wrapper}>
      {label != null && label !== "" && (
        <Text style={styles.label}>{label}</Text>
      )}
      <TouchableOpacity
        style={[
          styles.button,
          error && styles.buttonError,
          disabled && styles.buttonDisabled,
        ]}
        onPress={handleOpenDate}
        activeOpacity={0.8}
        disabled={disabled}
        testID={testID}
      >
        <Ionicons
          name="calendar-outline"
          size={20}
          color={error ? Colors.error : "#9CA3AF"}
          style={styles.icon}
        />
        <Text style={[styles.buttonText, error && styles.buttonTextError]}>
          {displayText}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#6B7280" />
      </TouchableOpacity>
      {error != null && error !== "" && (
        <Text style={styles.helperError}>{error}</Text>
      )}

      {Platform.OS === "ios" && show && (
        <Modal transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShow(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShow(false)}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </Pressable>
                <Text style={styles.modalTitle}>
                  {mode === "date" ? "Elegir fecha" : "Elegir hora"}
                </Text>
                <Pressable
                  onPress={
                    mode === "date"
                      ? () => {
                          setMode("time");
                        }
                      : handleConfirmTime
                  }
                >
                  <Text style={styles.modalDone}>
                    {mode === "date" ? "Siguiente" : "Listo"}
                  </Text>
                </Pressable>
              </View>
              {picker}
            </View>
          </Pressable>
        </Modal>
      )}

      {Platform.OS === "android" && show && picker}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.inputBg || "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 15,
    height: 50,
  },
  buttonError: { borderColor: Colors.error },
  buttonDisabled: { opacity: 0.6 },
  icon: { marginRight: 10 },
  buttonText: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  buttonTextError: { color: Colors.error },
  helperError: {
    color: Colors.error,
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#1F2937",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  modalCancel: { color: "#9CA3AF", fontSize: 16 },
  modalTitle: { color: Colors.white, fontWeight: "700", fontSize: 16 },
  modalDone: { color: Colors.primary, fontWeight: "700", fontSize: 16 },
});
