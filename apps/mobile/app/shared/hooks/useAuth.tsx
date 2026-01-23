// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { setUserContext } from '../lib/sentry';
import { AuthController, type AuthProfile, type AuthUser, type AuthState } from '@barber-app/shared';
import { createMobileAuthAdapter } from '../lib/auth-adapter';

// Types
export type UserRole = 'client' | 'barber';

export type UserProfile = AuthProfile;

interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole, businessName?: string) => Promise<boolean | 'needs-confirmation' | 'already-exists'>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  addToFavorites: (barberId: string) => Promise<void>;
  removeFromFavorites: (barberId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authAdapter = createMobileAuthAdapter();
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

  const register = async (
    name: string,
    email: string,
    password: string,
    role: UserRole,
    businessName?: string
  ): Promise<boolean | 'needs-confirmation' | 'already-exists'> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, status: 'loading' }));
      const { state: next, result } = await authController.register({
        name,
        email,
        password,
        role,
        businessName,
      });
      applyState(setState, next);

      if (result.needsConfirmation) return 'needs-confirmation';
      if (result.alreadyExists) return 'already-exists';
      return result.ok;
    } catch (error) {
      logger.error('Registration error', error);
      return false;
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

  const addToFavorites = async (barberId: string) => {
    try {
      const next = await authController.addToFavorites(state, barberId);
      applyState(setState, next);
    } catch (error) {
      logger.error('Add to favorites error:', error);
      throw error;
    }
  };

  const removeFromFavorites = async (barberId: string) => {
    try {
      const next = await authController.removeFromFavorites(state, barberId);
      applyState(setState, next);
    } catch (error) {
      logger.error('Remove from favorites error:', error);
      throw error;
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
        addToFavorites,
        removeFromFavorites,
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