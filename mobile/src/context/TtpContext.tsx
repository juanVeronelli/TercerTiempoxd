import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import apiClient from "../api/apiClient";
import { TtpGainOverlay } from "../components/ui/TtpGainOverlay";

type TtpContextValue = {
  balance: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setBalance: (next: number | null) => void;
  animateGain: (params: { amount: number; balanceAfter?: number | null }) => void;
};

const TtpContext = createContext<TtpContextValue | null>(null);

export function TtpProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [gainPulse, setGainPulse] = useState<{ visible: boolean; amount: number }>({
    visible: false,
    amount: 0,
  });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Evitar requests inútiles si no hay sesión.
      const token = await SecureStore.getItemAsync("userToken");
      if (!token) {
        setBalance(null);
        return;
      }
      const res = await apiClient.get<{ balance: number }>("/economy/ttp");
      setBalance(typeof res.data?.balance === "number" ? res.data.balance : null);
    } catch {
      // Silencioso: si la API no está disponible o aún no hay sesión,
      // no queremos romper headers/pantallas.
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
    const startPolling = async () => {
      if (pollRef.current) return;
      const token = await SecureStore.getItemAsync("userToken");
      if (!token) {
        stopPolling();
        setBalance(null);
        return;
      }
      pollRef.current = setInterval(() => {
        refresh();
      }, 25_000);
    };

    // Primer refresh (si hay sesión).
    refresh();
    void startPolling();

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === "active") {
        refresh();
        void startPolling();
      }
      if (next.match(/inactive|background/)) {
        stopPolling();
      }
    });

    return () => {
      sub.remove();
      stopPolling();
    };
  }, [refresh]);

  const animateGain = useCallback(
    ({ amount, balanceAfter }: { amount: number; balanceAfter?: number | null }) => {
      const a = Math.max(0, Math.floor(Number(amount) || 0));
      if (typeof balanceAfter === "number") {
        setBalance(balanceAfter);
      } else if (a > 0 && typeof balance === "number") {
        setBalance(balance + a);
      }
      if (a <= 0) return;
      setGainPulse({ visible: true, amount: a });
      // auto-hide (la animación también hace fade-out, pero esto limpia el árbol)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setGainPulse({ visible: false, amount: 0 });
      }, 1150);
    },
    [balance],
  );

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const value = useMemo<TtpContextValue>(
    () => ({ balance, loading, refresh, setBalance, animateGain }),
    [animateGain, balance, loading, refresh],
  );

  return (
    <TtpContext.Provider value={value}>
      {children}
      <TtpGainOverlay visible={gainPulse.visible} amount={gainPulse.amount} />
    </TtpContext.Provider>
  );
}

export function useTtp() {
  return useContext(TtpContext);
}

