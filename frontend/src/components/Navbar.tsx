'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HealthIndicator } from './HealthIndicator';
import { useAuth } from '@/context/AuthContext';
import {
  GraduationCap,
  BookOpen,
  LogOut,
  LogIn,
  Repeat,
  Sparkles,
  Menu,
  X,
  FileCode2,
  GitCompare,
  CheckSquare2,
  LayoutDashboard,
  BarChart3,
  Shield,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, role, switchRole, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/submissions', label: 'Submissions', icon: FileCode2 },
    { href: '/compare', label: 'Compare', icon: GitCompare },
    { href: '/review', label: 'Faculty Review', icon: CheckSquare2 },
    { href: '/admin', label: 'Admin Stats', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-nav transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-transform duration-150 active:scale-95"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                CO
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-200"></div>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                CodeOrigin<span className="text-indigo-600">.AI</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase -mt-0.5">
                Academic Integrity & Review
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/70 p-1 rounded-xl border border-slate-200/60">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-xs shadow-slate-200/80 border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: System Health + Auth */}
        <div className="flex items-center gap-3">
          <HealthIndicator />

          {/* User Account / Role Pill */}
          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border shadow-2xs transition-all hover:scale-102 ${
                  role === 'admin'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                    : role === 'faculty'
                    ? 'bg-purple-50/80 border-purple-200 text-purple-800 hover:bg-purple-100/80'
                    : 'bg-indigo-50/80 border-indigo-200 text-indigo-800 hover:bg-indigo-100/80'
                }`}
                title="Account Settings / Role Profile"
              >
                {role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                ) : role === 'faculty' ? (
                  <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span className="hidden sm:inline font-semibold">{user.name}</span>
                <span className="uppercase text-[9px] tracking-wider px-2 py-0.5 bg-white rounded-full font-bold border border-slate-200 shadow-2xs">
                  {role}
                </span>
              </Link>

              {/* Quick Role Switcher */}
              <button
                type="button"
                onClick={() => {
                  const nextRole = role === 'student' ? 'faculty' : role === 'faculty' ? 'admin' : 'student';
                  switchRole(nextRole);
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-lg transition border border-transparent hover:border-indigo-100"
                title={`Cycle role (currently: ${role})`}
              >
                <Repeat className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition border border-transparent hover:border-rose-100"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-sm shadow-indigo-600/20 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 py-3 space-y-1.5 shadow-lg animate-fadeIn">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};
