import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/Colors";
import { PROFILE_THEME } from "./profileConstants";

type SettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  isLast?: boolean;
  value?: React.ReactNode;
};

function SettingItem({
  icon,
  label,
  onPress,
  color = PROFILE_THEME.accentBlue,
  isLast = false,
  value = null,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconBox, { backgroundColor: color + "20" }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.settingText, color === PROFILE_THEME.danger && { color: PROFILE_THEME.danger }]}>
          {label}
        </Text>
      </View>
      {value ?? (
        <Ionicons name="chevron-forward" size={16} color={PROFILE_THEME.textSecondary} style={{ opacity: 0.5 }} />
      )}
    </TouchableOpacity>
  );
}

type ProSettingItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  isLast?: boolean;
  isPro: boolean;
  onLockedPress: () => void;
};

function ProSettingItem({
  icon,
  label,
  onPress,
  isLast = false,
  isPro,
  onLockedPress,
}: ProSettingItemProps) {
  const handlePress = () => (isPro ? onPress() : onLockedPress());
  return (
    <TouchableOpacity
      style={[styles.settingItem, !isLast && styles.settingItemBorder]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View
          style={[
            styles.settingIconBox,
            { backgroundColor: isPro ? PROFILE_THEME.accentGold + "20" : Colors.border },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={isPro ? PROFILE_THEME.accentGold : Colors.textSecondary}
          />
        </View>
        <Text style={[styles.settingText, !isPro && { color: Colors.textSecondary }]}>{label}</Text>
      </View>
      {isPro ? (
        <Ionicons name="chevron-forward" size={16} color={PROFILE_THEME.textSecondary} style={{ opacity: 0.5 }} />
      ) : (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={10} color={Colors.textInverse} />
          <Text style={styles.lockBadgeText}>PRO</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export type ProfileSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  isPro: boolean;
  activeAccent: string;
  notificationsEnabled: boolean;
  onNotificationsChange: (v: boolean) => void;
  onOpenBanner: () => void;
  onOpenFrame: () => void;
  onOpenAccent: () => void;
  onOpenShowcase: () => void;
  onEditName: () => void;
  onEditPhoto: () => void;
  onEditBio: () => void;
  onEditPosition: () => void;
  onLegalUrl: (url: string) => void;
  onManageSubscription: () => void;
  onGoPaywall: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onProLockedPress?: (label: string) => void;
  privacyUrl: string;
  termsUrl: string;
};

export function ProfileSettingsModal({
  visible,
  onClose,
  isPro,
  activeAccent,
  notificationsEnabled,
  onNotificationsChange,
  onOpenBanner,
  onOpenFrame,
  onOpenAccent,
  onOpenShowcase,
  onEditName,
  onEditPhoto,
  onEditBio,
  onEditPosition,
  onLegalUrl,
  onManageSubscription,
  onGoPaywall,
  onChangePassword,
  onLogout,
  onDeleteAccount,
  onProLockedPress,
  privacyUrl,
  termsUrl,
}: ProfileSettingsModalProps) {
  const handleProLocked = (label: string) => {
    onProLockedPress?.(label);
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>CONFIGURACIÓN</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#D1D5DB" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.sectionHeaderBox}>
            <Text style={[styles.settingSectionTitle, { color: PROFILE_THEME.accentGold }]}>
              ESTILO PREMIUM
            </Text>
          </View>
          <View
            style={[
              styles.sectionGroup,
              { borderColor: isPro ? PROFILE_THEME.cardBorder : PROFILE_THEME.accentGold + "40" },
            ]}
          >
            <ProSettingItem
              icon="image"
              label="Portada de Perfil"
              onPress={onOpenBanner}
              isPro={isPro}
              onLockedPress={() => handleProLocked("Portada de Perfil")}
            />
            <ProSettingItem
              icon="scan"
              label="Marco de Avatar"
              onPress={onOpenFrame}
              isPro={isPro}
              onLockedPress={() => handleProLocked("Marco de Avatar")}
            />
            <ProSettingItem
              icon="color-palette"
              label="Color de Acento"
              onPress={onOpenAccent}
              isPro={isPro}
              onLockedPress={() => handleProLocked("Color de Acento")}
            />
            <ProSettingItem
              icon="grid"
              label="Personalizar Vitrina"
              onPress={onOpenShowcase}
              isLast
              isPro={isPro}
              onLockedPress={() => handleProLocked("Personalizar Vitrina")}
            />
          </View>

          <View style={styles.sectionHeaderBox}>
            <Text style={styles.settingSectionTitle}>PERSONAL</Text>
          </View>
          <View style={styles.sectionGroup}>
            <SettingItem icon="person" label="Nombre" onPress={onEditName} color={activeAccent} />
            <SettingItem icon="camera" label="Foto de Perfil" onPress={onEditPhoto} color={activeAccent} />
            <SettingItem icon="document-text" label="Biografía" onPress={onEditBio} color={activeAccent} />
            <SettingItem
              icon="shirt"
              label="Posición"
              onPress={onEditPosition}
              color={activeAccent}
              isLast
            />
          </View>

          <View style={styles.sectionHeaderBox}>
            <Text style={styles.settingSectionTitle}>PREFERENCIAS</Text>
          </View>
          <View style={styles.sectionGroup}>
            <SettingItem
              icon="notifications"
              label="Notificaciones"
              onPress={() => {}}
              color={activeAccent}
              value={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={onNotificationsChange}
                  trackColor={{ false: "#767577", true: activeAccent }}
                  thumbColor="white"
                />
              }
              isLast
            />
          </View>

          <View style={styles.sectionHeaderBox}>
            <Text style={styles.settingSectionTitle}>LEGALES</Text>
          </View>
          <View style={styles.sectionGroup}>
            <SettingItem
              icon="document-text-outline"
              label="Política de Privacidad"
              onPress={() => onLegalUrl(privacyUrl)}
              color={activeAccent}
            />
            <SettingItem
              icon="document-attach-outline"
              label="Términos y Condiciones"
              onPress={() => onLegalUrl(termsUrl)}
              color={activeAccent}
            />
          </View>

          <View style={styles.sectionHeaderBox}>
            <Text
              style={[
                styles.settingSectionTitle,
                { color: isPro ? PROFILE_THEME.textSecondary : PROFILE_THEME.accentGold },
              ]}
            >
              SUSCRIPCIÓN
            </Text>
          </View>
          <View
            style={[
              styles.sectionGroup,
              { borderColor: isPro ? PROFILE_THEME.cardBorder : PROFILE_THEME.accentGold + "40" },
            ]}
          >
            {isPro ? (
              <SettingItem
                icon="card"
                label="Gestionar suscripción"
                onPress={onManageSubscription}
                color={PROFILE_THEME.accentGold}
                isLast
              />
            ) : (
              <SettingItem
                icon="diamond"
                label="Hazte PRO"
                onPress={onGoPaywall}
                color={PROFILE_THEME.accentGold}
                isLast
              />
            )}
          </View>

          <View style={styles.sectionHeaderBox}>
            <Text style={styles.settingSectionTitle}>CUENTA</Text>
          </View>
          <View style={styles.sectionGroup}>
            <SettingItem
              icon="key"
              label="Cambiar contraseña"
              onPress={onChangePassword}
              color={activeAccent}
            />
            <SettingItem
              icon="log-out"
              label="Cerrar Sesión"
              onPress={onLogout}
              color={PROFILE_THEME.danger}
            />
            <TouchableOpacity
              style={[styles.settingItem, styles.deleteAccountButton]}
              onPress={onDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View
                  style={[styles.settingIconBox, { backgroundColor: PROFILE_THEME.danger + "20" }]}
                >
                  <Ionicons name="trash" size={18} color={PROFILE_THEME.danger} />
                </View>
                <Text style={[styles.settingText, { color: PROFILE_THEME.danger }]}>
                  Eliminar mi cuenta
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={PROFILE_THEME.danger} style={{ opacity: 0.7 }} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PROFILE_THEME.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: PROFILE_THEME.cardBorder,
  },
  title: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  closeBtn: { padding: 5 },
  modalContent: { padding: 20 },
  sectionHeaderBox: { marginBottom: 5, marginTop: 10 },
  settingSectionTitle: {
    color: PROFILE_THEME.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10,
    marginLeft: 5,
  },
  sectionGroup: {
    backgroundColor: PROFILE_THEME.cardBg,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 25,
    borderWidth: 1,
    borderColor: PROFILE_THEME.cardBorder,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: PROFILE_THEME.cardBg,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  deleteAccountButton: {
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 68, 68, 0.3)",
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: { color: "white", fontSize: 14, fontWeight: "600" },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PROFILE_THEME.accentGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockBadgeText: {
    color: "black",
    fontSize: 10,
    fontWeight: "900",
    marginLeft: 2,
  },
});
