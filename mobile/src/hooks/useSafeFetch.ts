import { useEffect, useRef } from "react";

/**
 * Hook que proporciona un AbortSignal vinculado al ciclo de vida del componente.
 * Al desmontarse el componente, se abortan automáticamente todas las peticiones
 * HTTP en curso que usen este signal (p. ej. con Axios: apiClient.get(url, { signal })).
 *
 * Uso con useFocusEffect o useEffect:
 *   const { signal } = useSafeFetch();
 *   useFocusEffect(useCallback(() => {
 *     apiClient.get("/auth/me", { signal }).then(...);
 *   }, [signal]));
 *
 * Uso en una función que hace varios requests:
 *   const { signal } = useSafeFetch();
 *   const fetchData = () => {
 *     apiClient.get("/auth/me", { signal }).then(...);
 *     apiClient.get("/leagues/123/members", { signal }).then(...);
 *   };
 */
export function useSafeFetch() {
  const controllerRef = useRef<AbortController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new AbortController();
  }
  const controller = controllerRef.current;

  useEffect(() => {
    return () => {
      controller.abort();
    };
  }, []);

  return {
    signal: controller.signal,
  };
}
