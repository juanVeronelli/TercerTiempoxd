import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { Colors } from "../../../src/constants/Colors";
import { useCustomAlert } from "../../../src/context/AlertContext";
import apiClient from "../../../src/api/apiClient";
import * as Clipboard from "expo-clipboard";
import { useCurrentUser } from "../../../src/hooks/useCurrentUser";
import { UserAvatar } from "../../../src/components/ui/UserAvatar";
import { Skeleton } from "../../../src/components/ui/Skeleton";
import { MEDALS_INFO } from "../../../src/constants/MedalsInfo";
import { getApiBaseUrl } from "../../../src/api/apiClient";

// Tipado de Miembro
type Member = {
  user_id: string;
  role: string;
  users: {
    full_name: string;
    profile_photo_url: string | null;
  };
};

export default function LeagueSettingsScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const { showAlert } = useCustomAlert();

  const params = useLocalSearchParams();
  const leagueId = Array.isArray(params.leagueId)
    ? params.leagueId[0]
    : params.leagueId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  // Datos de la Liga
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  /** Mapeo id medalla -> nombre personalizado (ej. tronco -> "Carnicero") */
  const [customMedalNames, setCustomMedalNames] = useState<Record<string, string>>({});
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Rol del usuario logueado
  const [myRole, setMyRole] = useState("MEMBER");

  useEffect(() => {
    if (leagueId && userId) {
      loadData();
    }
  }, [leagueId, userId]);

  const loadData = async () => {
    try {
      const [leagueRes, membersRes] = await Promise.all([
        apiClient.get(`/leagues/${leagueId}`),
        apiClient.get(`/leagues/${leagueId}/members`),
      ]);

      // Cargamos info básica
      setName(leagueRes.data.name);
      setDescription(leagueRes.data.description || "");
      setInviteCode(leagueRes.data.invite_code);
      setCustomMedalNames(leagueRes.data.custom_medal_names ?? {});
      setProfilePhotoUrl(leagueRes.data.profile_photo_url ?? null);

      // Cargamos miembros y nuestro rol (inyectado por el backend)
      const mData = membersRes.data;
      if (mData.members) {
        setMembers(mData.members);
        setMyRole(mData.myRole);
      } else {
        setMembers(mData);
        const me = mData.find((m: any) => String(m.user_id) === String(userId));
        setMyRole(me?.role || "MEMBER");
      }
    } catch (error) {
      console.error("Error en settings:", error);
      showAlert("Error", "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  };

  const isAdminOrOwner = myRole === "ADMIN" || myRole === "OWNER";
  const isOwner = myRole === "OWNER";

  // --- ACCIONES DE GESTIÓN ---

  const handleUpdate = async () => {
    if (!isAdminOrOwner) return;
    setSaving(true);
    try {
      await apiClient.put(
        `/leagues/${leagueId}`,
        { name, description, custom_medal_names: customMedalNames },
      );
      showAlert("Éxito", "Cambios guardados correctamente.");
    } catch (error) {
      showAlert("Error", "No se pudo actualizar la liga.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRole = (
    memberId: string,
    currentRole: string,
    memberName: string,
  ) => {
    if (currentRole === "OWNER") {
      showAlert("Acción prohibida", "No puedes modificar al Creador.");
      return;
    }

    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    const actionText =
      newRole === "ADMIN" ? "Hacer Administrador" : "Quitar Administrador";
    const confirmText =
      newRole === "ADMIN"
        ? `${memberName} tendrá permisos para editar y gestionar.`
        : `${memberName} volverá a ser un miembro normal.`;

    showAlert(actionText, confirmText, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "CONFIRMAR",
        onPress: async () => {
          try {
            await apiClient.put(
              `/leagues/${leagueId}/members/${memberId}/role`,
              { newRole },
            );
            setMembers((prev) =>
              prev.map((m) =>
                m.user_id === memberId ? { ...m, role: newRole } : m,
              ),
            );
          } catch (e: any) {
            showAlert(
              "Error",
              e.response?.data?.error || "Error al cambiar rol.",
            );
          }
        },
      },
    ]);
  };

  const handleKickMember = (memberId: string, memberName: string) => {
    showAlert("Expulsar", `¿Seguro que quieres eliminar a ${memberName}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "EXPULSAR",
        style: "destructive",
        onPress: async () => {
          try {
            await apiClient.delete(`/leagues/${leagueId}/members/${memberId}`);
            setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
          } catch (e) {
            showAlert("Error", "No se pudo expulsar.");
          }
        },
      },
    ]);
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    showAlert("Copiado", "Código copiado al portapapeles.");
  };

  const handlePickLeaguePhoto = useCallback(async () => {
    if (!isAdminOrOwner || !leagueId) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showAlert("Permiso denegado", "Necesitamos acceso a fotos para subir la imagen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const uri = asset.uri;
      const fileName = uri.split("/").pop() ?? "league.jpg";
      const type = "image/jpeg";
      const formData = new FormData();
      // @ts-expect-error - React Native FormData
      formData.append("photo", { uri, name: fileName, type });
      const token = await SecureStore.getItemAsync("userToken");
      const url = `${getApiBaseUrl()}/leagues/${leagueId}/upload-photo`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as { league?: { profile_photo_url?: string }; error?: string };
      if (res.ok && data.league?.profile_photo_url) {
        setProfilePhotoUrl(data.league.profile_photo_url);
        showAlert("Listo", "Foto de la liga actualizada.");
      } else {
        showAlert("Error", data?.error ?? "No se pudo subir la foto.");
      }
    } catch (e) {
      showAlert("Error", "No se pudo subir la foto. Revisá tu conexión.");
    } finally {
      setUploadingPhoto(false);
    }
  }, [leagueId, isAdminOrOwner, showAlert]);

  if (loading)
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Skeleton width="100%" height={56} borderRadius={12} style={{ flex: 1 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Skeleton width="100%" height={280} borderRadius={16} style={{ marginTop: 8 }} />
        </ScrollView>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER CORREGIDO: Proporcional y Estilizado */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerLeftBtn}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>CONFIGURACIÓN</Text>

        <View style={styles.headerRightBox}>
          {isAdminOrOwner ? (
            <TouchableOpacity onPress={handleUpdate} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.saveBtnText}>GUARDAR</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 28 }} />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* INVITACIÓN */}
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>INVITACIÓN</Text>
        </View>
        <View style={styles.inviteCard}>
          <View>
            <Text style={styles.inputLabel}>CÓDIGO DE ACCESO</Text>
            <Text style={styles.inviteCodeText}>{inviteCode}</Text>
          </View>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
            <Ionicons name="copy-outline" size={20} color="black" />
          </TouchableOpacity>
        </View>

        {/* FOTO DE LA LIGA */}
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>FOTO DE LA LIGA</Text>
        </View>
        <View style={styles.leaguePhotoCard}>
          <View style={styles.leaguePhotoWrap}>
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.leaguePhotoImage} />
            ) : (
              <View style={styles.leaguePhotoPlaceholder}>
                <MaterialCommunityIcons name="image-plus" size={40} color={Colors.textMuted} />
              </View>
            )}
          </View>
          {isAdminOrOwner && (
            <TouchableOpacity
              style={styles.leaguePhotoBtn}
              onPress={handlePickLeaguePhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={18} color="white" />
                  <Text style={styles.leaguePhotoBtnText}>
                    {profilePhotoUrl ? "Cambiar foto" : "Subir foto"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* INFORMACIÓN */}
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>INFORMACIÓN DE LA LIGA</Text>
        </View>
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              NOMBRE{" "}
              {isAdminOrOwner && (
                <Text style={{ color: Colors.primary }}>(EDITABLE)</Text>
              )}
            </Text>
            {isAdminOrOwner ? (
              <TextInput
                style={styles.editableInput}
                value={name}
                onChangeText={setName}
                placeholderTextColor={Colors.textMuted}
              />
            ) : (
              <Text style={styles.readOnlyText}>{name}</Text>
            )}
          </View>
          <View style={[styles.inputGroup, { borderBottomWidth: 0 }]}>
            <Text style={styles.inputLabel}>
              DESCRIPCIÓN{" "}
              {isAdminOrOwner && (
                <Text style={{ color: Colors.primary }}>(EDITABLE)</Text>
              )}
            </Text>
            {isAdminOrOwner ? (
              <TextInput
                style={[
                  styles.editableInput,
                  { height: 80, textAlignVertical: "top" },
                ]}
                value={description}
                onChangeText={setDescription}
                multiline
              />
            ) : (
              <Text style={styles.readOnlyText}>
                {description || "Sin descripción"}
              </Text>
            )}
          </View>
        </View>

        {/* PERSONALIZAR MEDALLAS (solo Admin) */}
        {isAdminOrOwner && (
          <>
            <View style={styles.sectionHeaderBox}>
              <Text style={styles.sectionHeader}>PERSONALIZAR MEDALLAS</Text>
            </View>
            <View style={styles.formContainer}>
              {MEDALS_INFO.filter(
                (m) => m.id !== "segundo" && m.id !== "tercero",
              ).map((medal) => (
                <View key={medal.id} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{medal.name} (por defecto)</Text>
                  <TextInput
                    style={styles.editableInput}
                    value={customMedalNames[medal.id] ?? ""}
                    onChangeText={(text) =>
                      setCustomMedalNames((prev) => ({
                        ...prev,
                        [medal.id]: text.trim(),
                      }))
                    }
                    placeholder={medal.name}
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {/* MIEMBROS */}
        <View style={styles.sectionHeaderBox}>
          <Text style={styles.sectionHeader}>MIEMBROS ({members.length})</Text>
        </View>
        <View style={styles.membersContainer}>
          {members.map((member, i) => {
            const user = member.users || {
              full_name: "Usuario",
              profile_photo_url: null,
            };
            const isMe = String(member.user_id) === String(userId);
            const isTargetOwner = member.role === "OWNER";
            const isTargetAdmin = member.role === "ADMIN";

            return (
              <View
                key={member.user_id}
                style={[
                  styles.memberRow,
                  i === members.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.memberInfo}>
                  <UserAvatar
                    imageUrl={user.profile_photo_url}
                    name={user.full_name}
                    size={40}
                  />
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Text style={styles.memberName}>{user.full_name}</Text>
                      {isTargetOwner && (
                        <MaterialCommunityIcons
                          name="crown"
                          size={14}
                          color={Colors.accentGold}
                        />
                      )}
                      {isTargetAdmin && (
                        <MaterialCommunityIcons
                          name="shield-check"
                          size={14}
                          color={Colors.primary}
                        />
                      )}
                    </View>
                    <Text style={styles.memberRoleLabel}>
                      {isTargetOwner
                        ? "Creador"
                        : isTargetAdmin
                          ? "Administrador"
                          : "Miembro"}
                      {isMe && " (Tú)"}
                    </Text>
                  </View>
                </View>

                {isAdminOrOwner && !isMe && !isTargetOwner && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      style={[
                        styles.iconActionBtn,
                        {
                          backgroundColor: isTargetAdmin
                            ? "rgba(245, 158, 11, 0.1)"
                            : "rgba(59, 130, 246, 0.1)",
                        },
                      ]}
                      onPress={() =>
                        handleToggleRole(
                          member.user_id,
                          member.role,
                          user.full_name,
                        )
                      }
                    >
                      <MaterialCommunityIcons
                        name={isTargetAdmin ? "shield-off" : "shield-plus"}
                        size={18}
                        color={isTargetAdmin ? Colors.accentGold : Colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.iconActionBtn,
                        { backgroundColor: "rgba(239, 68, 68, 0.1)" },
                      ]}
                      onPress={() =>
                        handleKickMember(member.user_id, user.full_name)
                      }
                    >
                      <MaterialIcons
                        name="person-remove"
                        size={18}
                        color={Colors.status.error}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* NAVEGACIÓN Y PELIGRO */}
        <TouchableOpacity
          style={[styles.navButton, { marginTop: 30 }]}
          onPress={() => router.replace("/(main)")}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="swap-horizontal"
              size={20}
              color="white"
              style={{ marginRight: 10 }}
            />
            <Text style={styles.navButtonText}>CAMBIAR DE LIGA</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={
            isOwner
              ? () => {
                  /* handleDeleteLeague */
                }
              : () => {
                  /* handleLeaveLeague */
                }
          }
        >
          <Ionicons
            name={isOwner ? "trash" : "exit-outline"}
            size={20}
            color={Colors.status.error}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.dangerText}>
            {isOwner ? "ELIMINAR LIGA" : "ABANDONAR LIGA"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  headerLeftBtn: { width: 45, height: 45, justifyContent: "center" },
  headerTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    flex: 1,
    textAlign: "center",
  },
  headerRightBox: {
    width: 70,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  saveBtnText: { color: Colors.primary, fontWeight: "900", fontSize: 13 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 50 },
  sectionHeaderBox: { marginBottom: 12, marginTop: 20 },
  sectionHeader: {
    color: Colors.accentGold,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  inviteCodeText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 3,
  },
  copyButton: {
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 10,
  },
  leaguePhotoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
  },
  leaguePhotoWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: Colors.surfaceDark,
    marginBottom: 12,
  },
  leaguePhotoImage: {
    width: "100%",
    height: "100%",
  },
  leaguePhotoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  leaguePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  leaguePhotoBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: "hidden",
  },
  inputGroup: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 8,
  },
  editableInput: {
    backgroundColor: Colors.surfaceDark,
    color: "white",
    fontSize: 15,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.placeholder,
  },
  readOnlyText: { color: Colors.textTertiary, fontSize: 15, fontWeight: "600" },
  membersContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  memberInfo: { flexDirection: "row", alignItems: "center" },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: Colors.borderLight,
  },
  memberName: { color: "white", fontSize: 14, fontWeight: "700" },
  memberRoleLabel: { color: Colors.textSecondary, fontSize: 11 },
  iconActionBtn: { padding: 8, borderRadius: 8 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  navButtonText: { color: "white", fontSize: 14, fontWeight: "700" },
  dangerButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.status.error,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    marginTop: 20,
  },
  dangerText: { color: Colors.status.error, fontWeight: "900", fontSize: 12 },
});
