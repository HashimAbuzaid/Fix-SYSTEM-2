import { createContext, useContext } from 'react';
export type UserRole = 'admin' | 'qa' | 'agent' | 'supervisor';
export type UserProfile = {
  id: string;
  role: UserRole;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
  email: string;
  is_active: boolean;
};
export type AuthContextValue = {
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
};
export const AuthContext = createContext<AuthContextValue>({
  profile: null,
  loading: true,
  logout: async () => {},
});
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthContext.Provider');
  }
  return ctx;
}