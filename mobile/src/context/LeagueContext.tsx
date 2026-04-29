import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type LeagueContextType = {
  leagueId: string | null;
  leagueName: string | null;
  setLeague: (id: string, name: string) => void;
};

const LeagueContext = createContext<LeagueContextType | null>(null);

const STORAGE_KEY = "tt:last_league";

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);

  const setLeague = useCallback((id: string, name: string) => {
    setLeagueId(id);
    setLeagueName(name || null);
    // Persistimos para que tabs (perfil/stats) tengan liga aunque el usuario no pase por Home.
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id, name: name || null }),
    ).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { id?: string; name?: string | null };
          const id = typeof parsed?.id === "string" ? parsed.id : null;
          const name = typeof parsed?.name === "string" ? parsed.name : null;
          if (id) {
            setLeagueId(id);
            setLeagueName(name);
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LeagueContext.Provider value={{ leagueId, leagueName, setLeague }}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeagueContext() {
  const ctx = useContext(LeagueContext);
  return ctx;
}

/**
 * Hook que devuelve el leagueId actual: primero del contexto (liga seleccionada
 * en el selector del home), y si no hay, el de los params de la ruta.
 * Así ranking/stats usan siempre la liga correcta al cambiar de tab.
 */
export function useCurrentLeagueId(fromParams?: string | null): string | null {
  const ctx = useLeagueContext();
  const fromContext = ctx?.leagueId ?? null;
  if (fromContext) return fromContext;
  return fromParams ?? null;
}
