import { create } from "zustand";

type UserProfile = {
  id: string;
  username: string;
  nickname: string;
};

type AuthState = {
  token: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  clearAuth: () => set({ token: null, user: null })
}));