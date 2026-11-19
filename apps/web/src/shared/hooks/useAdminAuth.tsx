import { useAuth } from './use-auth-zustand';
import { supabase } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin';
  avatar_url?: string;
}

/**
 * Admin status comes from GET /api/me `isAdmin` (auth app_metadata.role, set
 * with scripts/set-admin.ts). There is a single admin level, so isSuperAdmin
 * equals isAdmin. The API checks the same claim on every /api/admin call.
 */
export function useAdminAuth() {
  const { user, status, isInitialized } = useAuth();
  const loading = !isInitialized || status === 'loading';
  const isAdmin = !!user?.isAdmin;

  const adminUser: AdminUser | null =
    user && isAdmin
      ? { id: user.id, name: user.name, email: user.email, role: 'admin', avatar_url: user.avatar_url }
      : null;

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('Error logging out', error);
    }
  };

  return {
    adminUser,
    isAdmin,
    isSuperAdmin: isAdmin,
    loading,
    logout,
    checkAdminStatus: async () => undefined,
  };
}
