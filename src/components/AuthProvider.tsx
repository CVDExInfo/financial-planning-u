import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UserInfo, UserRole } from '@/types/domain';
import { 
  getDefaultUserRole, 
  getAvailableRoles, 
  canAccessRoute, 
  canPerformAction,
  getDefaultRouteForRole,
  DEMO_USERS 
} from '@/lib/auth';
import { useKV } from '@github/spark/hooks';
import { toast } from 'sonner';

interface AuthContextType {
  // Authentication state
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Role management
  currentRole: UserRole;
  availableRoles: UserRole[];
  setRole: (role: UserRole) => void;
  
  // Permission checking
  canAccessRoute: (route: string) => boolean;
  canPerformAction: (action: string) => boolean;
  
  // Authentication actions
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
  
  // Persist current role selection
  const [currentRole, setCurrentRole] = useKV<UserRole>('user-current-role', 'PMO');

  const isAuthenticated = !!user;

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Update available roles when user changes
  useEffect(() => {
    if (user) {
      const roles = getAvailableRoles(user);
      setAvailableRoles(roles);
      
      // Set default role if none is set or current role is not available
      const effectiveCurrentRole = currentRole || 'PMO';
      if (!roles.includes(effectiveCurrentRole)) {
        const defaultRole = getDefaultUserRole(user);
        setCurrentRole(defaultRole);
      }
    }
  }, [user, currentRole, setCurrentRole]);

  const initializeAuth = async () => {
    setIsLoading(true);
    
    try {
      // Try to get user from Spark runtime
      if (typeof window !== 'undefined' && (window as any).spark?.user) {
        const sparkUser = await (window as any).spark.user();
        
        // Enhance with role information
        const demoUserData = DEMO_USERS[sparkUser.login] || {};
        const effectiveCurrentRole = currentRole || 'PMO';
        const enhancedUser: UserInfo = {
          ...sparkUser,
          roles: demoUserData.roles || [getDefaultUserRole(sparkUser)],
          current_role: effectiveCurrentRole
        };
        
        setUser(enhancedUser);
        
        console.log('Auth initialized with user:', enhancedUser);
        
      } else {
        // Fallback to demo user for development
        const effectiveCurrentRole = currentRole || 'PMO';
        const demoUser: UserInfo = {
          id: 'demo-user',
          login: 'demo-user',
          email: 'demo@ikusi.com',
          avatarUrl: '',
          isOwner: true,
          roles: ['PMO', 'SDMT', 'VENDOR', 'EXEC_RO'],
          current_role: effectiveCurrentRole
        };
        
        setUser(demoUser);
        console.log('Auth initialized with demo user:', demoUser);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      
      // Still provide demo user as fallback
      const fallbackUser: UserInfo = {
        id: 'fallback-user',
        login: 'fallback-user',
        email: 'fallback@ikusi.com',
        avatarUrl: '',
        isOwner: false,
        roles: ['SDMT'],
        current_role: 'SDMT'
      };
      
      setUser(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (): Promise<void> => {
    // In a real implementation, this would handle OAuth or other auth flows
    // For now, just reinitialize
    await initializeAuth();
  };

  const signOut = (): void => {
    setUser(null);
    setCurrentRole('PMO');
    setAvailableRoles([]);
    
    // Clear any persisted auth data
    localStorage.removeItem('auth-token'); // If you were storing tokens
    
    toast.success('Signed out successfully');
  };

  const setRole = (role: UserRole): void => {
    if (!availableRoles.includes(role)) {
      toast.error('Access denied', {
        description: `You don't have permission to switch to ${role} role`
      });
      return;
    }

    const previousRole = currentRole;
    setCurrentRole(role);
    
    // Update user object
    if (user) {
      setUser(prev => prev ? { ...prev, current_role: role } : prev);
    }

    toast.success(`Role changed to ${role}`, {
      description: `Switched from ${previousRole} to ${role}`
    });
  };

  const checkRouteAccess = (route: string): boolean => {
    return canAccessRoute(route, currentRole || 'PMO');
  };

  const checkActionPermission = (action: string): boolean => {
    return canPerformAction(action, currentRole || 'PMO');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    currentRole: currentRole || 'PMO',
    availableRoles,
    setRole,
    canAccessRoute: checkRouteAccess,
    canPerformAction: checkActionPermission,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
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

// Convenience hooks for common use cases
export function useCurrentUser() {
  const { user } = useAuth();
  return user;
}

export function useCurrentRole() {
  const { currentRole, setRole, availableRoles } = useAuth();
  return { currentRole, setRole, availableRoles };
}

export function usePermissions() {
  const { canAccessRoute, canPerformAction } = useAuth();
  return { canAccessRoute, canPerformAction };
}