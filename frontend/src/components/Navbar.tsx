'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HealthIndicator } from './HealthIndicator';

import { useAuth } from '@/context/AuthContext';
import { GraduationCap, BookOpen, LogOut, LogIn, Repeat } from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, role, switchRole, logout } = useAuth();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/submissions', label: 'Submissions' },
    { href: '/compare', label: 'Compare' },
    { href: '/review', label: 'Faculty Review' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 text-indigo-600 font-bold text-xl tracking-tight">
            <span className="p-1.5 bg-indigo-600 text-white rounded-lg text-sm shadow">CO</span>
            <span>CodeOrigin AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <HealthIndicator />

          {/* User & Role Badge */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                  role === 'faculty'
                    ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
                title="Click to switch role or account"
              >
                {role === 'faculty' ? (
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span className="hidden sm:inline font-semibold">{user.name}</span>
                <span className="uppercase text-[10px] tracking-wider px-1.5 py-0.5 bg-white/80 rounded-full border border-black/5">
                  {role}
                </span>
              </Link>

              {/* 1-Click Quick Role Toggle */}
              <button
                type="button"
                onClick={() => switchRole(role === 'student' ? 'faculty' : 'student')}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                title={`Switch to ${role === 'student' ? 'Faculty' : 'Student'} mode`}
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
