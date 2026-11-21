// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { setUserContext } from '../lib/sentry';
import {
  AuthController,
  type AuthProfile,
  type AuthRegisterResult,
  type AuthUser,
  type AuthState,
} from '@barber-app/shared';
import { createAuthAdapter } from '../lib/auth-adapter';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

// Types
export type UserRole = 'client' | 'barber';

export type UserProfile = AuthProfile;

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  /** Sign-up; the database creates the profile (and barber rows) from the metadata. */
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    username?: string;
    businessName?: string;
  }) => Promise<AuthRegisterResult>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  /** Reloads the profile from GET /api/me (after onboarding or settings changes). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const authAdapter = createAuthAdapter({ supabase, api });
const authController = new AuthController(authAdapter);

function applyState(setState: (next: AuthState) => void, next: AuthState) {
  setState(next);
  if (next.user?.id) {
    setUserContext({ id: next.user.id, email: next.user.email || undefined });
  } else {
    setUserContext(null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    isLoading: true,
    isInitialized: false,
    user: null,
    profile: null,
  });

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const next = await authController.initialize();
        if (mounted) {
          applyState(setState, next);
        }
      } catch (error) {
        logger.error('Auth initialize error', error);
        if (mounted) {
          applyState(setState, {
            status: 'unauthenticated',
            isLoading: false,
            isInitialized: true,
            user: null,
            profile: null,
          });
        }
      }
    };

    bootstrap();

    const { unsubscribe } = authAdapter.onAuthStateChange(async (user) => {
      const next = await authController.handleAuthChange(user);
      if (mounted) {
        applyState(setState, next);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, status: 'loading' }));
      const { state: next, result } = await authController.login(email, password);
      applyState(setState, next);
      return result.ok;
    } catch (error) {
      logger.error('Login error', error);
      return false;
    }
  };

  const register: AuthContextType['register'] = async (input) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, status: 'loading' }));
      const { state: next, result } = await authController.register(input);
      applyState(setState, next);
      return result;
    } catch (error) {
      logger.error('Registration error', error);
      applyState(setState, {
        status: 'unauthenticated',
        isLoading: false,
        isInitialized: true,
        user: null,
        profile: null,
      });
      return { ok: false, reason: 'auth-error', errorMessage: 'Registration failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      const next = await authController.logout();
      applyState(setState, next);
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      const next = await authController.updateProfile(state, data);
      applyState(setState, next);
    } catch (error) {
      logger.error('Profile update error:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!state.user) return;
    try {
      const next = await authController.refreshProfile(state.user.id);
      // Keep the current state when the profile could not be loaded (e.g. offline);
      // keep the signed-in user (with email) from the current state.
      if (next.profile) applyState(setState, { ...next, user: state.user });
    } catch (error) {
      logger.error('Profile refresh error:', error);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user: state.user,
        userProfile: state.profile,
        loading: state.isLoading, 
        login, 
        register, 
        logout,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}