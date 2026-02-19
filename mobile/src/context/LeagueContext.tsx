import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type LeagueContextType = {
  leagueId: string | null;
  leagueName: string | null;
  setLeague: (id: string, name: string) => void;
};

const LeagueContext = createContext<LeagueContextType | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);

  const setLeague = useCallback((id: string, name: string) => {
    setLeagueId(id);
    setLeagueName(name || null);
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
