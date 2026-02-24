import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COACHMARK_ALWAYS_SHOW, type CoachmarkKey } from "../constants/CoachmarkKeys";

/**
 * Hook para mostrar un coachmark solo la primera vez que el usuario entra a una pantalla.
 * Si COACHMARK_ALWAYS_SHOW es true (modo test), aparece siempre al entrar.
 * @param storageKey - Clave de AsyncStorage (ej. CoachmarkKeys.RANKING)
 * @returns { shouldShow, markSeen } - shouldShow true si debe mostrarse; markSeen() para marcarlo como visto
 */
export function useCoachmark(storageKey: CoachmarkKey) {
  const [shouldShow, setShouldShow] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await AsyncStorage.getItem(storageKey);
        if (!cancelled) {
          setShouldShow(value !== "true");
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setShouldShow(false);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const markSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(storageKey, "true");
      if (!COACHMARK_ALWAYS_SHOW) setShouldShow(false);
    } catch {}
  }, [storageKey]);

  const effectiveShow = COACHMARK_ALWAYS_SHOW ? loaded : loaded && shouldShow;
  return { shouldShow: effectiveShow, markSeen, loaded };
}

const COACHMARK_READY_DELAY_MS = 600;

/**
 * Retrasa la aparición del coachmark hasta que la pantalla esté estable.
 * Evita parpadeos al entrar: solo permite mostrar cuando `readyToShow` es true
 * durante al menos `delayMs` ms.
 */
export function useCoachmarkReady(
  readyToShow: boolean,
  delayMs: number = COACHMARK_READY_DELAY_MS,
) {
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    if (!readyToShow) {
      setCanShow(false);
      return;
    }
    const timer = setTimeout(() => setCanShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [readyToShow, delayMs]);

  return canShow;
}
