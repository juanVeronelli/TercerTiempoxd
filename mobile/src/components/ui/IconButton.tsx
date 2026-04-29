import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { UI } from "./tokens";

type IconButtonProps = {
  onPress: () => void;
  children: React.ReactNode;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: typeof UI.hitSlop;
  testID?: string;
};

export function IconButton({
  onPress,
  children,
  accessibilityLabel,
  disabled,
  style,
  hitSlop,
  testID,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.base, disabled && styles.disabled, style]}
      activeOpacity={0.7}
      hitSlop={hitSlop ?? UI.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});

