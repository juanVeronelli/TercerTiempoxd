import apiClient from "../api/apiClient";

export const authService = {
  login: async (credentials: any) => {
    return await apiClient.post("/auth/login", credentials);
  },
  register: async (userData: any) => {
    return await apiClient.post("/auth/register", userData);
  },
  verifyEmail: async (payload: { email: string; code: string }) => {
    return await apiClient.post("/auth/verify", payload);
  },
  forgotPassword: async (payload: { email: string }) => {
    return await apiClient.post("/auth/forgot-password", payload);
  },
  resetPassword: async (payload: { token: string; newPassword: string }) => {
    return await apiClient.post("/auth/reset-password", payload);
  },
};
