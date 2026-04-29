import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DateTimePickerButton } from "../ui/DateTimePickerButton";
import { Colors } from "../../constants/Colors";

const THEME = {
  accentBlue: Colors.primary,
  cardBg: "#1F2937",
  cardBorder: "rgba(255,255,255,0.08)",
  textPrimary: "#FFFFFF",
  danger: "#EF4444",
};

type MatchScoreBoardProps = {
  match: any;
  isEditing: boolean;
  scoreA: string;
  setScoreA: (v: string) => void;
  scoreB: string;
  setScoreB: (v: string) => void;
  editLocation: string;
  setEditLocation: (v: string) => void;
  editDateTime: Date;
  setEditDateTime: (d: Date) => void;
  editPrice: string;
  setEditPrice: (v: string) => void;
  errors?: Record<string, string>;
  touched?: Record<string, boolean>;
  onDateConfirm?: () => void;
  onTouch?: (field: string) => void;
};

export function MatchScoreBoard({
  match,
  isEditing,
  scoreA,
  setScoreA,
  scoreB,
  setScoreB,
  editLocation,
  setEditLocation,
  editDateTime,
  setEditDateTime,
  editPrice,
  setEditPrice,
  errors = {},
  touched = {},
  onDateConfirm,
  onTouch,
}: MatchScoreBoardProps) {
  const showNumericScore =
    isEditing || ["FINISHED", "COMPLETED"].includes(match?.status);
  const dateObj = match?.date_time ? new Date(match.date_time) : new Date();

  return (
    <View style={styles.heroContainer}>
      <View style={styles.scoreboardMain}>
        <View style={styles.scoreSide}>
          <Text style={styles.teamLabel}>
            {match?.is_external ? "EQUIPO" : "LOCAL"}
          </Text>
          {showNumericScore ? (
            isEditing ? (
              <TextInput
                style={styles.scoreInput}
                value={scoreA}
                onChangeText={setScoreA}
                keyboardType="numeric"
                maxLength={2}
              />
            ) : (
              <Text style={styles.scoreBig}>{scoreA}</Text>
            )
          ) : (
            <Text style={styles.teamPlaceholder}>A</Text>
          )}
        </View>

        <View style={styles.scoreDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <View style={styles.scoreSide}>
          <Text style={styles.teamLabel}>
            {match?.is_external ? "RIVAL" : "VISITA"}
          </Text>
          {showNumericScore ? (
            isEditing ? (
              <TextInput
                style={styles.scoreInput}
                value={scoreB}
                onChangeText={setScoreB}
                keyboardType="numeric"
                maxLength={2}
              />
            ) : (
              <Text style={styles.scoreBig}>{scoreB}</Text>
            )
          ) : (
            <Text style={styles.teamPlaceholder}>B</Text>
          )}
        </View>
      </View>

      <View style={styles.detailsRow}>
        {isEditing ? (
          <View style={styles.editForm}>
            <View style={styles.editRow}>
              <Ionicons name="location-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.inlineInput}
                value={editLocation}
                onChangeText={setEditLocation}
                onBlur={() => onTouch?.("location")}
                placeholder="Lugar"
                placeholderTextColor="#555"
              />
            </View>
            {touched.location && errors.location ? (
              <Text style={styles.helperError}>{errors.location}</Text>
            ) : null}
            <DateTimePickerButton
              value={editDateTime}
              onChange={setEditDateTime}
              onConfirm={onDateConfirm}
              label="FECHA Y HORA"
              error={touched.dateTime ? errors.dateTime : undefined}
            />
            <View style={styles.editRow}>
              <Ionicons name="cash-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.inlineInput}
                value={editPrice}
                onChangeText={setEditPrice}
                onBlur={() => onTouch?.("price")}
                placeholder="Precio"
                placeholderTextColor="#555"
                keyboardType="numeric"
              />
            </View>
            {touched.price && errors.price ? (
              <Text style={styles.helperError}>{errors.price}</Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={styles.detailItem}>
              <Ionicons name="location-sharp" size={14} color={THEME.accentBlue} />
              <Text style={styles.detailText}>{match?.location_name}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="calendar" size={14} color={THEME.accentBlue} />
              <Text style={styles.detailText}>
                {dateObj.toLocaleDateString()} -{" "}
                {dateObj.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                hs
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="cash" size={14} color={THEME.accentBlue} />
              <Text style={styles.detailText}>${match?.price_per_player}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    backgroundColor: THEME.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.cardBorder,
  },
  scoreboardMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  scoreSide: { alignItems: "center", flex: 1 },
  teamLabel: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "900",
    marginBottom: 5,
  },
  scoreBig: { color: "white", fontSize: 42, fontWeight: "900" },
  scoreInput: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    borderBottomWidth: 1,
    borderColor: THEME.accentBlue,
    width: 50,
  },
  teamPlaceholder: { color: "#374151", fontSize: 36, fontWeight: "900" },
  scoreDivider: { alignItems: "center", width: 40 },
  vsText: { color: "#4B5563", fontSize: 16, fontWeight: "900" },
  detailsRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingTop: 15,
    gap: 8,
  },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { color: "#D1D5DB", fontSize: 13, fontWeight: "500" },
  editForm: { gap: 4 },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  inlineInput: { flex: 1, color: "white", marginLeft: 10, fontSize: 13 },
  helperError: { color: Colors.error, fontSize: 11, marginTop: 2, marginLeft: 4 },
});
