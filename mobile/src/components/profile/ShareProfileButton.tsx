import React from "react";
import { StyleSheet } from "react-native";
import { ShareButton } from "../share/ShareButton";

type ShareProfileButtonProps = {
  accentColor: string;
  onShare: () => void;
};

export function ShareProfileButton({ accentColor, onShare }: ShareProfileButtonProps) {
  return (
    <ShareButton
      onPress={onShare}
      variant="filled"
      accentColor={accentColor}
      style={styles.wrapper}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
});
