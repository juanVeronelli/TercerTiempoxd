import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Colors } from "../src/constants/Colors";

export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      // Check for token in secure storage
      const token = await SecureStore.getItemAsync("userToken");

      // If token exists, we assume user is logged in.
      // (The HomeScreen will verify if it's still valid later)
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error("Auth check failed", error);
      setIsLoggedIn(false);
    }
  };

  // Show loading spinner while checking storage (usually instant)
  if (isLoggedIn === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return isLoggedIn ? (
    <Redirect href="/(main)" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
