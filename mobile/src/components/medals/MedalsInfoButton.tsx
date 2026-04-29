import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { MedalsInfoModal } from "./MedalsInfoModal";

type MedalsInfoButtonProps = {
  /** Tamaño del ícono (default 20) */
  size?: number;
  /** Estilo del contenedor opcional */
  style?: object;
};

/**
 * Botón (ícono "i") que abre el modal "Info de Medallas".
 * Usar junto a cualquier sección donde se muestren medallas.
 */
export function MedalsInfoButton({ size = 20, style }: MedalsInfoButtonProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.btn, style]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
      >
        <Ionicons name="information-circle-outline" size={size} color={Colors.primary} />
      </TouchableOpacity>
      <MedalsInfoModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
