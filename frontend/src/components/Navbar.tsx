'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HealthIndicator } from './HealthIndicator';

export const Navbar: React.FC = () => {
  const pathname = usePathname();

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
        <div className="flex items-center gap-4">
          <HealthIndicator />
          <div className="text-xs text-slate-500 font-mono hidden sm:block bg-slate-100 px-2 py-1 rounded">
            Role: Student
          </div>
        </div>
      </div>
    </header>
  );
};
