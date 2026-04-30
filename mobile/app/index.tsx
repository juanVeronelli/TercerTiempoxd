import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { Colors } from "../src/constants/Colors";
import { OnboardingSlider } from "../src/components/onboarding";

const ONBOARDING_VIEWED_KEY = "@onboarding_viewed";

type UserToken = {
  userId: string;
  exp?: number;
};

export default function Index() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [onboardingViewed, setOnboardingViewed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(ONBOARDING_VIEWED_KEY);
        setOnboardingViewed(v === "true");
      } catch {
        setOnboardingViewed(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (onboardingViewed !== true) return;
    checkLoginStatus();
  }, [onboardingViewed]);

  const checkLoginStatus = async () => {
    try {
      const token = await SecureStore.getItemAsync("userToken");
      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      // Si el JWT expiró, limpiamos y mandamos a login (sin flashes raros).
      try {
        const decoded = jwtDecode<UserToken>(token);
        const now = Date.now() / 1000;
        if (decoded?.exp && decoded.exp < now) {
          await SecureStore.deleteItemAsync("userToken");
          setIsLoggedIn(false);
          return;
        }
      } catch {
        // Token corrupto: limpiar sesión
        await SecureStore.deleteItemAsync("userToken");
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);
    } catch (error) {
      console.error("Auth check failed", error);
      setIsLoggedIn(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_VIEWED_KEY, "true");
      setOnboardingViewed(true);
    } catch {
      setOnboardingViewed(true);
    }
  };

  // Loading inicial (onboarding)
  if (onboardingViewed === null) {
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

  if (!onboardingViewed) {
    return <OnboardingSlider onComplete={handleOnboardingComplete} />;
  }

  // Loading inicial (login)
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
