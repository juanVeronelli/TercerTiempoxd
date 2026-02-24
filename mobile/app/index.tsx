import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Colors } from "../src/constants/Colors";
import { OnboardingSlider } from "../src/components/onboarding";

const ONBOARDING_VIEWED_KEY = "@onboarding_viewed";

export default function Index() {
  const [onboardingViewed, setOnboardingViewed] = useState<boolean | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const viewed = await AsyncStorage.getItem(ONBOARDING_VIEWED_KEY);
        setOnboardingViewed(viewed === "true");
      } catch (error) {
        console.error("Error checking onboarding:", error);
        setOnboardingViewed(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (onboardingViewed !== true) return;
    checkLoginStatus();
  }, [onboardingViewed]);

  const checkLoginStatus = async () => {
    try {
      const token = await SecureStore.getItemAsync("userToken");
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error("Auth check failed", error);
      setIsLoggedIn(false);
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_VIEWED_KEY, "true");
      setOnboardingViewed(true);
    } catch (error) {
      console.error("Error saving onboarding flag:", error);
      setOnboardingViewed(true);
    }
  };

  // Loading inicial (onboarding o login)
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

  // Mostrar onboarding si aún no lo vio
  if (!onboardingViewed) {
    return (
      <OnboardingSlider
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // Onboarding visto: redirigir según login
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
