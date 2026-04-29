import React from "react";
import { Text, StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { Typography } from "./typography";

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
    ...Typography.sectionLabel,
  },
});

