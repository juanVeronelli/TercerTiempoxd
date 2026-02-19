import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Colors } from "../../constants/Colors";

type LoadingOverlayProps = {
  visible: boolean;
  message?: string;
};

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message,
}) => {
  const { width, height } = useWindowDimensions();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={[styles.overlay, { width, height }]}>
        <View style={styles.box}>
          <ActivityIndicator size="large" color={Colors.accentGold} />
          {message ? (
            <Text style={styles.message} numberOfLines={2}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    minWidth: 200,
  },
  message: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
});
