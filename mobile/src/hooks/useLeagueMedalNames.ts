import { useState, useEffect } from "react";
import apiClient from "../api/apiClient";

/**
 * Devuelve el mapeo de nombres personalizados de medallas de la liga (custom_medal_names).
 * Si la liga no tiene o falla la petición, devuelve {}.
 */
export function useLeagueMedalNames(leagueId: string | null): Record<string, string> {
  const [customMedalNames, setCustomMedalNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!leagueId) {
      setCustomMedalNames({});
      return;
    }
    let cancelled = false;
    apiClient
      .get(`/leagues/${leagueId}`)
      .then((res) => {
        if (!cancelled && res.data?.custom_medal_names)
          setCustomMedalNames(res.data.custom_medal_names);
      })
      .catch(() => {
        if (!cancelled) setCustomMedalNames({});
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  return customMedalNames;
}
