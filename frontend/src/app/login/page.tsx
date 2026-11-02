'use client';

import React, { useState } from 'react';
import { useAuth, DEFAULT_STUDENT, DEFAULT_FACULTY } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { GraduationCap, BookOpen, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login, user } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [username, setUsername] = useState<string>('student-alex');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError(null);
    if (role === 'student') {
      setUsername('student-alex');
    } else {
      setUsername('prof-evaluation');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please provide a username or identifier.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await login(selectedRole, username.trim());
      // Student opens Dashboard (/), Faculty opens Review (/review)
      window.location.href = selectedRole === 'faculty' ? '/review' : '/';
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check credentials.');
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole) => {
    setIsLoading(true);
    setError(null);
    try {
      const targetUser = role === 'faculty' ? DEFAULT_FACULTY.user_id : DEFAULT_STUDENT.user_id;
      await login(role, targetUser);
      window.location.href = role === 'faculty' ? '/review' : '/';
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" /> Institutional Portal
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Sign In to CodeOrigin AI
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Choose your university role to access specialized workspaces for student assignment submission or faculty evaluation.
        </p>
      </div>

      {/* Role Switcher Tabs */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-200/80 rounded-2xl gap-2 shadow-inner">
        <button
          type="button"
          onClick={() => handleRoleSelect('student')}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
            selectedRole === 'student'
              ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className={`w-4 h-4 ${selectedRole === 'student' ? 'text-indigo-600' : 'text-slate-400'}`} />
          Student Portal
        </button>
        <button
          type="button"
          onClick={() => handleRoleSelect('faculty')}
          className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
            selectedRole === 'faculty'
              ? 'bg-white text-purple-700 shadow-md ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className={`w-4 h-4 ${selectedRole === 'faculty' ? 'text-purple-600' : 'text-slate-400'}`} />
          Faculty / Reviewer
        </button>
      </div>

      {/* Main Login Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Active Role Overview Banner */}
        <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
          selectedRole === 'student'
            ? 'bg-indigo-50/60 border-indigo-100 text-indigo-900'
            : 'bg-purple-50/60 border-purple-100 text-purple-900'
        }`}>
          {selectedRole === 'student' ? (
            <GraduationCap className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          ) : (
            <BookOpen className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
          )}
          <div className="text-xs space-y-1">
            <span className="font-semibold text-sm">
              {selectedRole === 'student' ? 'Student Workspace' : 'Faculty & Instructor Workspace'}
            </span>
            <p className={selectedRole === 'student' ? 'text-indigo-700' : 'text-purple-700'}>
              {selectedRole === 'student'
                ? 'Upload assignments (.py & archives), run automated static analyzers, and inspect revision diffs.'
                : 'Review student submissions, attach qualitative feedback and rubric scoring, and generate formal audit reports.'}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {selectedRole === 'student' ? 'Student Username or ID' : 'Faculty Username / Staff ID'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={selectedRole === 'student' ? 'e.g. student-alex' : 'e.g. prof-evaluation'}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password <span className="text-slate-400 font-normal lowercase">(optional for demo mode)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition ${
              selectedRole === 'student'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-purple-600 hover:bg-purple-700'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Opening Portal...' : `Sign In as ${selectedRole === 'student' ? 'Student' : 'Faculty'}`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">
              Or 1-Click Demo Sign In
            </span>
          </div>
        </div>

        {/* 1-Click Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleQuickLogin('student')}
            className="flex items-center gap-3 p-3 text-left border border-indigo-200/80 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl transition group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Alex Chen (Student)</div>
              <div className="text-[11px] text-slate-500">ID: STU-2026-0814</div>
            </div>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleQuickLogin('faculty')}
            className="flex items-center gap-3 p-3 text-left border border-purple-200/80 bg-purple-50/40 hover:bg-purple-50 rounded-xl transition group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">Prof. Marcus Vance</div>
              <div className="text-[11px] text-slate-500">Dept: Computer Science</div>
            </div>
          </button>
        </div>
      </div>

      {/* Currently logged in status */}
      {user && (
        <div className="text-center text-xs text-slate-500">
          Currently signed in as <span className="font-semibold text-slate-800">{user.name}</span> ({user.role})
        </div>
      )}
    </div>
  );
}
