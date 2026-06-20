import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, clearToken, getToken } from "@/src/api/client";

export type Role = "customer" | "driver";
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  phone_verified: boolean;
  role: Role;
  active_role: Role;
  avatar?: string | null;
  rating: number;
  num_ratings: number;
  driver_profile?: any;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signup: (body: any) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  switchRole: (role: Role) => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const t = await getToken();
      if (t) {
        const u = await api.me();
        setUserState(u);
      }
    } catch (e) {
      await clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signup = async (body: any) => {
    const res = await api.signup(body);
    await setToken(res.access_token);
    setUserState(res.user);
    return res.user;
  };

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    await setToken(res.access_token);
    setUserState(res.user);
    return res.user;
  };

  const logout = async () => {
    await clearToken();
    setUserState(null);
  };

  const switchRole = async (role: Role) => {
    const u = await api.switchRole(role);
    setUserState(u);
  };

  const refresh = async () => {
    try {
      const u = await api.me();
      setUserState(u);
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signup, login, logout, switchRole, refresh, setUser: setUserState }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
