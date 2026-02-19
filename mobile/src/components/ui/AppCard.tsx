import React from "react";
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
} from "react-native";
import { Colors } from "../../constants/Colors";

type AppCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
};

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  onPress,
}) => {
  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.card, style]}
      activeOpacity={onPress ? 0.85 : undefined}
      onPress={onPress}
    >
      {children}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
});

