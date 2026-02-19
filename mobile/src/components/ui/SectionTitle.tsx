import React from "react";
import { Text, StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { Colors } from "../../constants/Colors";

type SectionTitleProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export const SectionTitle: React.FC<SectionTitleProps> = ({
  label,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    marginTop: 5,
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

