import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

// Límites para subida de foto de perfil
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

import { useCustomAlert } from "../../../../src/context/AlertContext";
import { Colors } from "../../../../src/constants/Colors";
import apiClient, { getApiBaseUrl } from "../../../../src/api/apiClient";
import { ScreenHeader } from "../../../../src/components/ui/ScreenHeader";
import { AchievementsWidget } from "../../../../src/components/profile/AchievementsWidget";
import { NativeAdCardWrapper } from "../../../../src/components/ads/NativeAdCardWrapper";
import { ShareableProfileCard } from "../../../../src/components/share/ShareableProfileCard";
import { presentCustomerCenter } from "../../../../src/services/SubscriptionUI";

import {
  PROFILE_THEME,
  PRESET_BANNERS,
  AVATAR_FRAMES,
  ACCENT_COLORS,
  SHOWCASE_OPTIONS,
  LEGAL_URLS,
  ProfileHeaderCard,
  ShareProfileButton,
  ProfileShowcaseSection,
  ProfileRecentMatches,
  ProfileLoadingSkeleton,
  ProfileSettingsModal,
  ProfileEditModal,
  ProfileChangePasswordModal,
  ProfileShowcaseModal,
  ProfileBannerModal,
  ProfileFrameModal,
  ProfileAccentModal,
} from "../../../../src/components/profile";
import type { AvatarFramePreset } from "../../../../src/components/profile/profileConstants";

export default function ProfileScreen() {
  const router = useRouter();
  const { showAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [careerStats, setCareerStats] = useState<any>(null);
  const [trophyCase, setTrophyCase] = useState<any>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [userCosmetics, setUserCosmetics] = useState<string[]>([]);

  const [showcaseSelection, setShowcaseSelection] = useState<string[]>(["matches", "avg_hist", "best_rating"]);
  const [activeAccent, setActiveAccent] = useState(PROFILE_THEME.accentBlue);
  const [activeFrame, setActiveFrame] = useState<AvatarFramePreset>(AVATAR_FRAMES[1]);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showcaseModalVisible, setShowcaseModalVisible] = useState(false);
  const [bannerModalVisible, setBannerModalVisible] = useState(false);
  const [frameModalVisible, setFrameModalVisible] = useState(false);
  const [accentModalVisible, setAccentModalVisible] = useState(false);

  const [editType, setEditType] = useState<"NAME" | "BIO" | "POSITION" | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [tempName, setTempName] = useState("");
  const [tempSurname, setTempSurname] = useState("");

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingCustomization, setSavingCustomization] = useState(false);

  const unlockedKeysSet = useMemo(() => new Set(userCosmetics), [userCosmetics]);
  const availableFrames = useMemo(
    () => AVATAR_FRAMES.filter((f) => !f.cosmeticKey || unlockedKeysSet.has(f.cosmeticKey)),
    [unlockedKeysSet],
  );
  const availableShowcaseOptions = useMemo(
    () => SHOWCASE_OPTIONS.filter((o) => !o.cosmeticKey || unlockedKeysSet.has(o.cosmeticKey)),
    [unlockedKeysSet],
  );
  const availableBanners = useMemo(
    () => PRESET_BANNERS.filter((b) => !b.cosmeticKey || unlockedKeysSet.has(b.cosmeticKey)),
    [unlockedKeysSet],
  );
  const availableAccentColors = useMemo(
    () => ACCENT_COLORS.filter((a) => !a.cosmeticKey || unlockedKeysSet.has(a.cosmeticKey)),
    [unlockedKeysSet],
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await apiClient.get("/auth/profile/global");
      const data = res.data;
      const rawUser = data.profile;
      const fullName = rawUser?.full_name || rawUser?.fullName || rawUser?.username || "Usuario";
      const [firstName, ...restName] = String(fullName).trim().split(" ");
      const formattedUser = {
        ...rawUser,
        photoUrl: rawUser?.profile_photo_url || rawUser?.photo || rawUser?.photoUrl || null,
        name: firstName || "Usuario",
        surname: restName.join(" "),
        bannerUrl: rawUser?.banner_url || rawUser?.bannerUrl || null,
        mainPosition: rawUser?.main_position || rawUser?.mainPosition || "MID",
        planType: rawUser?.plan_type || rawUser?.planType || "FREE",
      };
      setUser(formattedUser);
      setCareerStats(data.careerStats);
      setTrophyCase(data.trophyCase);
      setRecentMatches(data.recentMatches ?? []);
      setUserCosmetics(
        (data.userCosmetics ?? []).map((c: { cosmetic_key: string }) => c.cosmetic_key),
      );

      try {
        const achRes = await apiClient.get("/achievements/me");
        setAchievements(achRes.data ?? []);
      } catch {
        setAchievements([]);
      }

      const unlockedKeys = new Set(
        (data.userCosmetics ?? []).map((c: { cosmetic_key: string }) => c.cosmetic_key),
      );
      const accentAvailable = (a: (typeof ACCENT_COLORS)[0]) =>
        !a.cosmeticKey || unlockedKeys.has(a.cosmeticKey);
      const bannerAvailable = (b: (typeof PRESET_BANNERS)[0]) =>
        !b.cosmeticKey || unlockedKeys.has(b.cosmeticKey);
      const frameAvailable = (f: (typeof AVATAR_FRAMES)[0]) =>
        !f.cosmeticKey || unlockedKeys.has(f.cosmeticKey);
      const showcaseAvailable = (opt: (typeof SHOWCASE_OPTIONS)[0]) =>
        !opt.cosmeticKey || unlockedKeys.has(opt.cosmeticKey);

      if (rawUser?.accent_color) {
        const accentOpt = ACCENT_COLORS.find((a) => a.color === rawUser.accent_color);
        if (accentOpt && accentAvailable(accentOpt)) setActiveAccent(rawUser.accent_color);
      }
      if (rawUser?.avatar_frame) {
        const savedFrame = AVATAR_FRAMES.find((f) => f.id === rawUser.avatar_frame);
        if (savedFrame && frameAvailable(savedFrame)) setActiveFrame(savedFrame);
      }
      if (rawUser?.showcase_items && Array.isArray(rawUser.showcase_items)) {
        const validItems = rawUser.showcase_items.filter((id: string) => {
          const opt = SHOWCASE_OPTIONS.find((o) => o.id === id);
          return opt && showcaseAvailable(opt);
        });
        if (validItems.length > 0) setShowcaseSelection(validItems);
      }
      if (rawUser?.banner_url) {
        const bannerOpt = PRESET_BANNERS.find((b) => b.id === rawUser.banner_url);
        if (bannerOpt && !bannerAvailable(bannerOpt)) {
          setUser((prev: any) => (prev ? { ...prev, bannerUrl: null } : prev));
        }
      }
    } catch (error) {
      console.error("Error cargando perfil:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const openSubModal = useCallback((modalSetter: (value: boolean) => void) => {
    setSettingsVisible(false);
    setTimeout(() => modalSetter(true), 500);
  }, []);

  const saveCustomization = useCallback(
    async (field: "banner" | "frame" | "accent" | "showcase", value: any) => {
      setSavingCustomization(true);
      try {
        const payload: any = {};
        if (field === "banner") payload.bannerUrl = value;
        if (field === "accent") payload.accentColor = value;
        if (field === "frame") payload.avatarFrame = value.id;
        if (field === "showcase") payload.showcaseItems = value;

        await apiClient.put("/auth/update-profile", payload, { timeout: 15000 });

        if (field === "banner") setUser((prev: any) => (prev ? { ...prev, bannerUrl: value } : prev));
        if (field === "frame") setActiveFrame(value);
        if (field === "accent") setActiveAccent(value);
        if (field === "showcase") setShowcaseSelection(value);

        setBannerModalVisible(false);
        setFrameModalVisible(false);
        setAccentModalVisible(false);
        setShowcaseModalVisible(false);
      } catch (error: any) {
        const msg =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          (error?.code === "ECONNABORTED"
            ? "La solicitud tardó demasiado. Revisa tu conexión."
            : "No se pudieron guardar los cambios.");
        setBannerModalVisible(false);
        setFrameModalVisible(false);
        setAccentModalVisible(false);
        setShowcaseModalVisible(false);
        showAlert("Error", msg);
        fetchData();
      } finally {
        setSavingCustomization(false);
      }
    },
    [showAlert, fetchData],
  );

  const toggleShowcaseItem = useCallback(
    (id: string) => {
      if (showcaseSelection.includes(id)) {
        setShowcaseSelection((prev) => prev.filter((item) => item !== id));
      } else {
        if (showcaseSelection.length < 3) {
          setShowcaseSelection((prev) => [...prev, id]);
        } else {
          showAlert("Vitrina Llena", "Solo puedes destacar 3 estadísticas.");
        }
      }
    },
    [showcaseSelection, showAlert],
  );

  const getShowcaseValue = useCallback(
    (id: string) => {
      if (!careerStats || !trophyCase) return "-";
      switch (id) {
        case "mvp":
          return trophyCase.mvp || 0;
        case "matches":
          return careerStats.totalMatches || 0;
        case "avg_hist":
          return Number(careerStats.averageRating || 0).toFixed(1);
        case "best_rating":
          return Number(careerStats.highestRating || 0).toFixed(1);
        case "tronco":
          return trophyCase.tronco || 0;
        case "duel":
          return trophyCase.duel ?? 0;
        case "oracle":
          return trophyCase.oracle ?? 0;
        case "last_match":
          const last = recentMatches[0];
          return last ? Number(last.rating || 0).toFixed(1) : "-";
        default:
          return "-";
      }
    },
    [careerStats, trophyCase, recentMatches],
  );

  const uploadImage = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      try {
        setUploading(true);
        const { uri, fileSize, mimeType, fileName } = asset;

        // Validar tamaño de la imagen
        let sizeBytes = fileSize;
        if (sizeBytes == null) {
          const info = await FileSystem.getInfoAsync(uri);
          sizeBytes = (info as { size?: number }).size ?? 0;
        }
        if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
          showAlert(
            "Imagen demasiado grande",
            "La imagen no puede superar 5 MB. Por favor, elige una foto más pequeña o comprímela antes de subirla.",
            undefined,
            "error"
          );
          return;
        }

        // Validar formato (mimeType puede ser null en algunas plataformas)
        const type = mimeType ?? (fileName?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
        if (type && !ALLOWED_MIME_TYPES.includes(type)) {
          showAlert(
            "Formato no válido",
            "Solo se permiten imágenes JPEG, PNG, GIF o WebP.",
            undefined,
            "error"
          );
          return;
        }

        const formData = new FormData();
        const filename = fileName ?? "profile.jpg";
        const contentType = type ?? "image/jpeg";
        // @ts-expect-error - React Native FormData acepta { uri, name, type } para archivos
        formData.append("photo", { uri, name: filename, type: contentType });

        const token = await SecureStore.getItemAsync("userToken");
        const url = `${getApiBaseUrl()}/auth/upload-avatar`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = (await res.json().catch(() => ({}))) as { user?: { profile_photo_url?: string }; photoUrl?: string; url?: string; error?: string; message?: string };

        if (res.ok) {
          const newPhotoUrl = data?.user?.profile_photo_url ?? data?.photoUrl ?? data?.url;
          if (newPhotoUrl) {
            setUser((prev: any) => (prev ? { ...prev, photoUrl: newPhotoUrl } : prev));
            setTimeout(() => fetchData(), 500);
          }
          return;
        }

        // Errores HTTP del backend
        const backendMsg = data?.error ?? data?.message;
        if (res.status === 413) {
          showAlert(
            "Imagen demasiado grande",
            "El servidor rechazó la imagen por su tamaño. Prueba con una foto más pequeña.",
            undefined,
            "error"
          );
          return;
        }
        if (res.status === 415) {
          showAlert(
            "Formato no válido",
            "El formato de imagen no es válido. Usa JPEG, PNG, GIF o WebP.",
            undefined,
            "error"
          );
          return;
        }
        showAlert(
          "Error al subir",
          backendMsg ?? `No se pudo subir la imagen (error ${res.status}).`,
          undefined,
          "error"
        );
      } catch (e: unknown) {
        const err = e as { name?: string; code?: string; message?: string };
        if (__DEV__) {
          console.warn("[uploadImage] Error:", err.name ?? err.code ?? err.message);
        }
        const isNetwork =
          err.name === "AbortError" ||
          err.code === "ERR_NETWORK" ||
          err.code === "ECONNABORTED" ||
          err.code === "ETIMEDOUT" ||
          err.message?.toLowerCase().includes("network") ||
          err.message === "Failed to fetch";
        const message = isNetwork
          ? "Problema de conexión. Verifica que tengas internet y vuelve a intentarlo."
          : err.code === "ECONNREFUSED"
            ? "No se pudo conectar al servidor. Intenta más tarde."
            : "Ocurrió un problema al subir la imagen. Intenta de nuevo más tarde.";
        showAlert("Error al subir la foto", message, undefined, "error");
      } finally {
        setUploading(false);
      }
    },
    [showAlert, fetchData],
  );

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return showAlert("Permiso denegado", undefined, undefined, "error");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) await uploadImage(result.assets[0]);
  }, [showAlert, uploadImage]);

  const handleSaveProfile = useCallback(async () => {
    try {
      setLoading(true);
      const payload: any = {};
      if (editType === "NAME") {
        payload.name = tempName;
        payload.surname = tempSurname;
      } else if (editType === "BIO") payload.bio = tempValue;
      else if (editType === "POSITION") payload.mainPosition = tempValue;

      await apiClient.put("/auth/update-profile", payload);
      setEditModalVisible(false);
      fetchData();
    } catch {
      showAlert("Error al guardar.");
    } finally {
      setLoading(false);
    }
  }, [editType, tempName, tempSurname, tempValue, fetchData, showAlert]);

  const handleLogout = useCallback(async () => {
    await SecureStore.deleteItemAsync("userToken");
    router.replace("/(auth)/login");
  }, [router]);

  const openLegalUrl = useCallback(
    (url: string) => {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) Linking.openURL(url);
        else showAlert("Error", "No se puede abrir el enlace.");
      });
    },
    [showAlert],
  );

  const closeChangePasswordModal = useCallback(() => {
    setChangePasswordVisible(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword) {
      showAlert("Error", "Ingresa tu contraseña actual.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showAlert("Error", "La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Error", "Las contraseñas no coinciden.");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await apiClient.post(
        "/auth/change-password",
        { oldPassword: currentPassword, newPassword },
        { timeout: 25000, validateStatus: () => true },
      );
      const ok = res.status >= 200 && res.status < 300;
      closeChangePasswordModal();
      setChangingPassword(false);
      if (ok) {
        setTimeout(() => showAlert("Listo", "Tu contraseña fue actualizada correctamente."), 300);
        return;
      }
      const backendMsg = res.data?.message ?? res.data?.error ?? `Error ${res.status}`;
      setTimeout(() => showAlert("Error", backendMsg), 300);
    } catch (e: any) {
      closeChangePasswordModal();
      setChangingPassword(false);
      const backendMsg = e.response?.data?.message ?? e.response?.data?.error;
      const msg =
        backendMsg ??
        (e.code === "ECONNABORTED"
          ? "La solicitud tardó demasiado. Revisa tu conexión."
          : e.code === "ECONNREFUSED"
            ? "No se pudo conectar al servidor. ¿Está el backend corriendo?"
            : e.code === "ERR_NETWORK" || e.message?.includes("Network")
              ? "Error de red. Comprueba que el backend esté en marcha y la URL en .env (EXPO_PUBLIC_API_URL)."
              : e.message || "No se pudo cambiar la contraseña.");
      setTimeout(() => showAlert("Error", msg), 300);
    }
  }, [
    currentPassword,
    newPassword,
    confirmPassword,
    closeChangePasswordModal,
    showAlert,
  ]);

  const handleDeleteAccount = useCallback(() => {
    showAlert(
      "Eliminar mi cuenta",
      "¿Estás seguro? Esta acción es irreversible y borrará todos tus datos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete("/users/me");
              await SecureStore.deleteItemAsync("userToken");
              router.replace("/(auth)/login");
            } catch (e: any) {
              showAlert("Error", e.response?.data?.error || "No se pudo eliminar la cuenta.");
            }
          },
        },
      ],
    );
  }, [showAlert, router]);

  const getRatingColor = useCallback((rating: number) => {
    if (rating >= 8) return PROFILE_THEME.accentGreen;
    if (rating >= 6) return PROFILE_THEME.accentGold;
    return PROFILE_THEME.danger;
  }, []);

  const viewShotRef = useRef<ViewShot>(null);
  const handleShare = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri);
    } catch {
      showAlert("Error", "No se pudo compartir la imagen.");
    }
  }, [showAlert]);

  const shareCardData = useMemo(() => {
    if (!user) return null;
    const bannerDef = user.bannerUrl
      ? PRESET_BANNERS.find((b) => b.id === user.bannerUrl)
      : undefined;
    const frameColorResolved = activeFrame.color === "accent" ? activeAccent : activeFrame.color;
    const items = showcaseSelection
      .map((id) => {
        const opt = SHOWCASE_OPTIONS.find((o) => o.id === id);
        return opt
          ? { id, label: opt.label, icon: opt.icon, value: getShowcaseValue(id), color: opt.color }
          : null;
      })
      .filter(Boolean) as {
      id: string;
      label: string;
      icon: string;
      value: string | number;
      color: string;
    }[];
    return {
      bannerSource: bannerDef?.source ?? null,
      photoUrl: user.photoUrl ?? null,
      name: [user.name, user.surname].filter(Boolean).join(" ").trim() || "Usuario",
      username: user.username || "usuario",
      mainPosition: user.mainPosition || "Posición no definida",
      isPro: user.planType === "PRO",
      frameSource: activeFrame.source ?? null,
      frameColor: frameColorResolved,
      frameWidth: activeFrame.width ?? 0,
      accentColor: activeAccent,
      showcaseItems: items,
    };
  }, [user, activeFrame, activeAccent, showcaseSelection, getShowcaseValue]);

  if (loading && !refreshing && !editModalVisible) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: PROFILE_THEME.bg }} edges={["bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={PROFILE_THEME.bg} />
        <ProfileLoadingSkeleton />
      </SafeAreaView>
    );
  }

  const isPro = user?.planType === "PRO";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PROFILE_THEME.bg }} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={PROFILE_THEME.bg} />

      <ScreenHeader
        title="MI PERFIL"
        showBack
        showBell
        rightAction={
          <TouchableOpacity onPress={() => setSettingsVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="settings-sharp" size={24} color={PROFILE_THEME.textPrimary} />
          </TouchableOpacity>
        }
      />

      {shareCardData && (
        <View style={{ position: "absolute", left: -9999, top: 0, width: 340, height: 520, opacity: 0 }} pointerEvents="none">
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 0.9 }} style={{ width: 340, height: 520, backgroundColor: Colors.surface }}>
            <ShareableProfileCard {...shareCardData} />
          </ViewShot>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={activeAccent}
          />
        }
      >
        <ProfileHeaderCard
          user={user}
          activeFrame={activeFrame}
          activeAccent={activeAccent}
          uploading={uploading}
          onPickImage={handlePickImage}
        />
        <ShareProfileButton accentColor={activeAccent} onShare={handleShare} />

        <ProfileShowcaseSection
          isPro={isPro}
          showcaseSelection={showcaseSelection}
          showcaseOptions={SHOWCASE_OPTIONS}
          getShowcaseValue={getShowcaseValue}
          activeAccent={activeAccent}
          onEditShowcase={() => setShowcaseModalVisible(true)}
          onUnlockPro={() => router.push("/(main)/paywall")}
        />

        <View style={{ marginBottom: 20 }}>
          <AchievementsWidget achievements={achievements} accentColor={activeAccent} />
        </View>
        <NativeAdCardWrapper style={{ marginBottom: 20 }} isPro={isPro} />

        <ProfileRecentMatches
          recentMatches={recentMatches}
          activeAccent={activeAccent}
          getRatingColor={getRatingColor}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      <ProfileShowcaseModal
        visible={showcaseModalVisible}
        onClose={() => !savingCustomization && setShowcaseModalVisible(false)}
        availableOptions={availableShowcaseOptions}
        showcaseSelection={showcaseSelection}
        activeAccent={activeAccent}
        onToggleItem={toggleShowcaseItem}
        onSave={() => saveCustomization("showcase", showcaseSelection)}
        saving={savingCustomization}
      />
      <ProfileBannerModal
        visible={bannerModalVisible}
        onClose={() => setBannerModalVisible(false)}
        availableBanners={availableBanners}
        currentBannerId={user?.bannerUrl}
        activeAccent={activeAccent}
        onSelect={(id) => saveCustomization("banner", id)}
      />
      <ProfileFrameModal
        visible={frameModalVisible}
        onClose={() => setFrameModalVisible(false)}
        availableFrames={availableFrames}
        activeFrame={activeFrame}
        activeAccent={activeAccent}
        onSelect={(frame) => saveCustomization("frame", frame)}
      />
      <ProfileAccentModal
        visible={accentModalVisible}
        onClose={() => setAccentModalVisible(false)}
        availableAccentColors={availableAccentColors}
        activeAccent={activeAccent}
        onSelect={(color) => saveCustomization("accent", color)}
      />

      <ProfileSettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        isPro={isPro}
        activeAccent={activeAccent}
        notificationsEnabled={notificationsEnabled}
        onNotificationsChange={setNotificationsEnabled}
        onOpenBanner={() => openSubModal(setBannerModalVisible)}
        onOpenFrame={() => openSubModal(setFrameModalVisible)}
        onOpenAccent={() => openSubModal(setAccentModalVisible)}
        onOpenShowcase={() => openSubModal(setShowcaseModalVisible)}
        onEditName={() =>
          openSubModal(() => {
            setEditModalVisible(true);
            setEditType("NAME");
            setTempName(user?.name ?? "");
            setTempSurname(user?.surname ?? "");
          })
        }
        onEditPhoto={handlePickImage}
        onEditBio={() =>
          openSubModal(() => {
            setEditModalVisible(true);
            setEditType("BIO");
            setTempValue(user?.bio ?? "");
          })
        }
        onEditPosition={() =>
          openSubModal(() => {
            setEditModalVisible(true);
            setEditType("POSITION");
            setTempValue(user?.mainPosition ?? "");
          })
        }
        onLegalUrl={openLegalUrl}
        onManageSubscription={() => {
          setSettingsVisible(false);
          presentCustomerCenter().catch(() =>
            showAlert("Error", "No se pudo abrir el centro de suscripción."),
          );
        }}
        onGoPaywall={() => {
          setSettingsVisible(false);
          router.push("/(main)/paywall");
        }}
        onChangePassword={() => openSubModal(() => setChangePasswordVisible(true))}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
        onProLockedPress={(label) => showAlert("Premium", `Hazte PRO para desbloquear "${label}".`)}
        privacyUrl={LEGAL_URLS.privacy}
        termsUrl={LEGAL_URLS.terms}
      />

      <ProfileEditModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        editType={editType}
        tempValue={tempValue}
        tempName={tempName}
        tempSurname={tempSurname}
        onTempValueChange={setTempValue}
        onTempNameChange={setTempName}
        onTempSurnameChange={setTempSurname}
        onSave={handleSaveProfile}
        activeAccent={activeAccent}
      />
      <ProfileChangePasswordModal
        visible={changePasswordVisible}
        onClose={closeChangePasswordModal}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onCurrentChange={setCurrentPassword}
        onNewChange={setNewPassword}
        onConfirmChange={setConfirmPassword}
        onSave={handleChangePassword}
        changing={changingPassword}
        activeAccent={activeAccent}
      />
    </SafeAreaView>
  );
}
