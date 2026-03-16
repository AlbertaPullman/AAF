import { create } from "zustand";
import { persist } from "zustand/middleware";

export type User = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  platformRole: string;
  createdAt: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUser: (patch: Partial<User>) => void;
};

export const useAuthStore = create<AuthState>()(persist(
  (set) => ({
    token: null,
    user: null,
    isLoading: false,
    error: null,
    setAuth: (token, user) => set({ token, user, error: null }),
    clearAuth: () => set({ token: null, user: null }),
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    updateUser: (patch) =>
      set((state) => ({
        user: state.user ? { ...state.user, ...patch } : state.user
      }))
  }),
  {
    name: "auth-storage"
  }
));