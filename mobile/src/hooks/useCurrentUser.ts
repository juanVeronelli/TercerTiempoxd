import { useState, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode"; // <--- Ojo: importación con llaves {}

interface UserToken {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export const useCurrentUser = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      try {
        // 1. Leemos el token guardado en el login
        const token = await SecureStore.getItemAsync("userToken");

        if (!isMounted) return;

        if (token) {
          // 2. Lo decodificamos
          const decoded: UserToken = jwtDecode(token);

          // 3. Verificamos si expiró (opcional pero recomendado)
          const currentTime = Date.now() / 1000;
          if (decoded.exp && decoded.exp < currentTime) {
            if (isMounted) setUserId(null);
            await SecureStore.deleteItemAsync("userToken");
          } else {
            if (isMounted) setUserId(decoded.userId);
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error al decodificar token:", error);
          setUserId(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    getUser();

    return () => {
      isMounted = false;
    };
  }, []);

  // Retornamos el ID y un flag de carga por si querés poner un spinner
  return { userId, loading };
};
