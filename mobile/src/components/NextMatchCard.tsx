import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/Colors"; // Asegúrate de que esta ruta sea correcta
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface NextMatchCardProps {
  match: any;
  isAdmin: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit?: () => void;
}

const STATUS_COLORS: any = {
  OPEN: {
    bg: "rgba(59, 130, 246, 0.2)",
    text: "#60A5FA",
    border: "rgba(59, 130, 246, 0.5)",
    label: "ABIERTO",
  },
  ACTIVE: {
    bg: "rgba(16, 185, 129, 0.2)",
    text: "#34D399",
    border: "rgba(16, 185, 129, 0.5)",
    label: "EN JUEGO",
  },
  FINISHED: {
    bg: "rgba(245, 158, 11, 0.2)",
    text: "#FBBF24",
    border: "rgba(245, 158, 11, 0.5)",
    label: "VOTANDO",
  },
  CANCELLED: {
    bg: "rgba(239, 68, 68, 0.2)",
    text: "#F87171",
    border: "rgba(239, 68, 68, 0.5)",
    label: "CANCELADO",
  },
  COMPLETED: {
    bg: "rgba(107, 114, 128, 0.2)",
    text: "#9CA3AF",
    border: "rgba(107, 114, 128, 0.5)",
    label: "CERRADO",
  },
};

export const NextMatchCard = ({
  match,
  isAdmin,
  onConfirm,
  onCancel,
  onEdit,
}: NextMatchCardProps) => {
  if (!match) return null;

  const dateObj = new Date(match.date_time);
  const dateFormatted = format(dateObj, "EEEE d 'de' MMMM", { locale: es });
  const timeFormatted = format(dateObj, "HH:mm");

  // 1. ESTADO DEL USUARIO
  const isConfirmed =
    match.has_confirmed === true || match.user_status === "CONFIRMED";

  // 2. PERMISOS DE INTERACCIÓN
  // Solo se puede interactuar (sumarse/bajarse) si el partido está ABIERTO.
  // Ni siquiera el Admin debería bajarse desde la tarjeta si ya arrancó (debe usar "Gestionar").
  const isMatchOpen = match.status === "OPEN";
  const canInteract = isMatchOpen;

  // 3. ESTILOS
  const statusStyle = STATUS_COLORS[match.status] || STATUS_COLORS.COMPLETED;

  return (
    <View style={styles.card}>
      {/* --- HEADER (Badges y Botón Admin) --- */}
      <View style={styles.header}>
        <View style={styles.badgesWrapper}>
          {/* Badge de "Próximo" solo si está abierto */}
          {isMatchOpen && (
            <View style={styles.titleBadge}>
              <Ionicons
                name="flash"
                size={10}
                color="#FFD700"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.titleBadgeText}>PRÓXIMO</Text>
            </View>
          )}
          {/* Badge de Estado del Partido */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusStyle.bg,
                borderColor: statusStyle.border,
              },
            ]}
          >
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {statusStyle.label || match.status}
            </Text>
          </View>
        </View>

        {/* Botón Gestionar (Solo Admin) */}
        {isAdmin && onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Text style={styles.editText}>Gestionar</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Colors.textSecondary || "#9CA3AF"}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* --- INFO DEL PARTIDO (Fecha, Lugar, Precio) --- */}
      <View style={styles.infoRow}>
        <View style={styles.dateBox}>
          <Text style={styles.dayNumber}>{format(dateObj, "d")}</Text>
          <Text style={styles.monthName}>
            {format(dateObj, "MMM", { locale: es })
              .toUpperCase()
              .replace(".", "")}
          </Text>
        </View>

        <View style={styles.detailsBox}>
          <Text numberOfLines={1} style={styles.locationText}>
            {match.location_name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color="#9CA3AF"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.timeText}>
              {dateFormatted} - {timeFormatted} hs
            </Text>
          </View>
          <Text style={styles.priceText}>
            ${match.price_per_player}{" "}
            <Text style={styles.perPlayer}>/ Jugador</Text>
          </Text>
        </View>
      </View>

      {/* --- FOOTER (Botones de Acción) --- */}
      <View style={styles.footer}>
        {isConfirmed ? (
          // CASO A: EL USUARIO YA ESTÁ CONFIRMADO
          <TouchableOpacity
            style={styles.statusBoxConfirmed}
            // Si no puede interactuar (ej: partido en juego), deshabilitamos el click
            onPress={canInteract ? onCancel : undefined}
            activeOpacity={canInteract ? 0.7 : 1}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="checkmark-done" size={20} color="#4ADE80" />
              <Text style={styles.confirmedText}>ASISTENCIA CONFIRMADA</Text>
            </View>
            {/* Solo mostramos el texto de cancelar si el partido sigue abierto */}
            {canInteract && (
              <Text style={styles.cancelHint}>(Tocar para cancelar)</Text>
            )}
          </TouchableOpacity>
        ) : // CASO B: NO CONFIRMADO + PARTIDO ABIERTO
        canInteract ? (
          <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.confirmText}>CONFIRMAR ASISTENCIA</Text>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="white"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        ) : (
          // CASO C: NO CONFIRMADO + PARTIDO CERRADO/JUGANDO/CANCELADO
          <View style={styles.statusBoxNone}>
            {match.status === "CANCELLED" ? (
              <>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color="#F87171"
                />
                <Text style={[styles.noneText, { color: "#F87171" }]}>
                  PARTIDO SUSPENDIDO
                </Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#94A3B8"
                />
                <Text style={styles.noneText}>CONVOCATORIA CERRADA</Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  // Header Styles
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    paddingBottom: 12,
  },
  badgesWrapper: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  titleBadgeText: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  editButton: { flexDirection: "row", alignItems: "center", padding: 4 },
  editText: {
    color: "#9CA3AF",
    fontSize: 11,
    marginRight: 2,
    fontWeight: "600",
  },

  // Info Row Styles
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  dateBox: {
    backgroundColor: "#111827",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    marginRight: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    minWidth: 60,
  },
  dayNumber: { color: "white", fontSize: 22, fontWeight: "bold" },
  monthName: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailsBox: { flex: 1, justifyContent: "center" },
  locationText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  timeText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  priceText: { color: "#60A5FA", fontSize: 14, fontWeight: "800" },
  perPlayer: { color: "#6B7280", fontSize: 11, fontWeight: "400" },

  // Footer Styles
  footer: { paddingTop: 4 },
  confirmButton: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#2563EB",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statusBoxConfirmed: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "rgba(74, 222, 128, 0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.2)",
  },
  confirmedText: {
    color: "#4ADE80",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 12,
  },
  cancelHint: {
    color: "#4ADE80",
    fontSize: 10,
    marginTop: 4,
    opacity: 0.8,
  },
  statusBoxNone: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  noneText: {
    color: "#94A3B8",
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
    fontStyle: "italic",
  },
});
