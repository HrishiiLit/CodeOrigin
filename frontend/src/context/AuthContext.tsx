'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserRole } from '@/types';
import { loginUser } from '@/lib/api';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  login: (role: UserRole, username: string) => Promise<UserProfile>;
  switchRole: (newRole: UserRole) => void;
  logout: () => void;
}

export const DEFAULT_STUDENT: UserProfile = {
  user_id: 'student-alex',
  name: 'Alex Chen',
  email: 'alex.chen@university.edu',
  role: 'student',
  student_id: 'STU-2026-0814',
};

export const DEFAULT_FACULTY: UserProfile = {
  user_id: 'prof-evaluation',
  name: 'Prof. Marcus Vance',
  email: 'm.vance@university.edu',
  role: 'faculty',
  department: 'Computer Science & Engineering',
};

export const DEFAULT_ADMIN: UserProfile = {
  user_id: 'admin-root',
  name: 'Dean Dr. Eleanor Cross',
  email: 'dean.cross@university.edu',
  role: 'admin',
  department: 'Academic Affairs & Computing Governance',
};

const getFallbackUser = (targetRole: UserRole): UserProfile => {
  if (targetRole === 'admin') return DEFAULT_ADMIN;
  if (targetRole === 'faculty') return DEFAULT_FACULTY;
  return DEFAULT_STUDENT;
};

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_STUDENT,
  role: 'student',
  isAuthenticated: true,
  login: async () => DEFAULT_STUDENT,
  switchRole: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(DEFAULT_STUDENT);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('codeorigin_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // Local storage not available or parse error
    }
  }, []);

  const login = async (role: UserRole, username: string): Promise<UserProfile> => {
    try {
      const res = await loginUser({ role, username });
      setUser(res.user);
      localStorage.setItem('codeorigin_user', JSON.stringify(res.user));
      localStorage.setItem('codeorigin_token', res.access_token);
      return res.user;
    } catch {
      const fallbackUser = getFallbackUser(role);
      setUser(fallbackUser);
      localStorage.setItem('codeorigin_user', JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  };

  const switchRole = (newRole: UserRole) => {
    const newUser = getFallbackUser(newRole);
    setUser(newUser);
    try {
      localStorage.setItem('codeorigin_user', JSON.stringify(newUser));
    } catch {
      // ignore
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('codeorigin_user');
      localStorage.removeItem('codeorigin_token');
    } catch {
      // ignore
    }
  };

  const role: UserRole = user?.role || 'student';
  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, login, switchRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
