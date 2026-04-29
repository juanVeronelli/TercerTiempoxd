import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../constants/Colors";

type ActivityHeatmapProps = {
  /** Array de fechas (ISO string o Date) donde el usuario jugó. */
  dates: Array<string | Date>;
  /** Color de acento para los días con actividad. */
  accentColor?: string;
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseToLocalDate(raw: string | Date): Date | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  // Evita el pitfall de JS: "YYYY-MM-DD" se interpreta como UTC.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function ActivityHeatmap({ dates, accentColor }: ActivityHeatmapProps) {
  const color = accentColor || Colors.primary;

  const { days, activeKeys } = useMemo(() => {
    const keys = new Set<string>();
    for (const raw of dates || []) {
      const d = parseToLocalDate(raw);
      if (!d) continue;
      keys.add(toDateKey(d));
    }

    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - 149);

    const range: Date[] = [];
    for (let i = 0; i < 150; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      range.push(d);
    }

    return { days: range, activeKeys: keys };
  }, [dates]);

  const cellStyle = (isActive: boolean) => {
    if (!isActive) return [styles.cell, styles.cellEmpty];
    return [styles.cell, { backgroundColor: color, borderColor: `${color}55` }];
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>ACTIVIDAD</Text>
        <Text style={styles.subtitle}>Últimos 150 días</Text>
      </View>

      <View style={styles.grid}>
        {days.map((d, i) => {
          const key = toDateKey(d);
          const isActive = activeKeys.has(key);
          return <View key={`${key}-${i}`} style={cellStyle(isActive)} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#1F2937",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#374151",
    padding: 14,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    overflow: "hidden",
  },
  cell: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
  cellEmpty: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.06)",
  },
});

