'use client';

import React, { useState } from 'react';
import { useAuth, DEFAULT_STUDENT, DEFAULT_FACULTY, DEFAULT_ADMIN } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { GraduationCap, BookOpen, ArrowRight, ShieldCheck, Shield } from 'lucide-react';

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
    } else if (role === 'faculty') {
      setUsername('prof-evaluation');
    } else {
      setUsername('admin-root');
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
      if (selectedRole === 'admin') {
        window.location.href = '/admin';
      } else if (selectedRole === 'faculty') {
        window.location.href = '/review';
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check credentials.');
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: UserRole) => {
    setIsLoading(true);
    setError(null);
    try {
      const targetUser =
        role === 'admin'
          ? DEFAULT_ADMIN.user_id
          : role === 'faculty'
          ? DEFAULT_FACULTY.user_id
          : DEFAULT_STUDENT.user_id;
      await login(role, targetUser);
      if (role === 'admin') {
        window.location.href = '/admin';
      } else if (role === 'faculty') {
        window.location.href = '/review';
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" /> Institutional Portal
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Sign In to CodeOrigin AI
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
          Choose your university role to access specialized workspaces for student assignment submissions, faculty evaluations, or academic administration.
        </p>
      </div>

      {/* Role Switcher Tabs */}
      <div className="grid grid-cols-3 p-1.5 bg-slate-200/80 rounded-2xl gap-2 shadow-inner">
        <button
          type="button"
          onClick={() => handleRoleSelect('student')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            selectedRole === 'student'
              ? 'bg-white text-indigo-700 shadow-md ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className={`w-4 h-4 ${selectedRole === 'student' ? 'text-indigo-600' : 'text-slate-400'}`} />
          Student
        </button>
        <button
          type="button"
          onClick={() => handleRoleSelect('faculty')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            selectedRole === 'faculty'
              ? 'bg-white text-purple-700 shadow-md ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className={`w-4 h-4 ${selectedRole === 'faculty' ? 'text-purple-600' : 'text-slate-400'}`} />
          Faculty
        </button>
        <button
          type="button"
          onClick={() => handleRoleSelect('admin')}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            selectedRole === 'admin'
              ? 'bg-white text-amber-800 shadow-md ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className={`w-4 h-4 ${selectedRole === 'admin' ? 'text-amber-600' : 'text-slate-400'}`} />
          Dean / Admin
        </button>
      </div>

      {/* Main Login Card */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Active Role Overview Banner */}
        <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
          selectedRole === 'admin'
            ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
            : selectedRole === 'faculty'
            ? 'bg-purple-50/70 border-purple-200/80 text-purple-950'
            : 'bg-indigo-50/70 border-indigo-200/80 text-indigo-950'
        }`}>
          {selectedRole === 'admin' ? (
            <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          ) : selectedRole === 'faculty' ? (
            <BookOpen className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
          ) : (
            <GraduationCap className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          )}
          <div className="text-xs space-y-1">
            <span className="font-semibold text-sm">
              {selectedRole === 'admin'
                ? 'Academic Administration & Institutional Oversight'
                : selectedRole === 'faculty'
                ? 'Faculty & Instructor Evaluation Workspace'
                : 'Student Assignment Workspace'}
            </span>
            <p className={
              selectedRole === 'admin'
                ? 'text-amber-800'
                : selectedRole === 'faculty'
                ? 'text-purple-800'
                : 'text-indigo-800'
            }>
              {selectedRole === 'admin'
                ? 'Inspect overall institution telemetry, static analysis distribution, faculty evaluation ratios, and immutable audit logs.'
                : selectedRole === 'faculty'
                ? 'Review student submissions, attach qualitative feedback and rubric scoring, and generate formal audit reports.'
                : 'Upload assignments (.py & archives), run automated static analyzers, and inspect revision diffs.'}
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
              {selectedRole === 'admin'
                ? 'Administrator ID / Dean Username'
                : selectedRole === 'faculty'
                ? 'Faculty Username / Staff ID'
                : 'Student Username or ID'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                selectedRole === 'admin'
                  ? 'e.g. admin-root'
                  : selectedRole === 'faculty'
                  ? 'e.g. prof-evaluation'
                  : 'e.g. student-alex'
              }
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
            className={`w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition ${
              selectedRole === 'admin'
                ? 'bg-amber-700 hover:bg-amber-800'
                : selectedRole === 'faculty'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Opening Portal...' : `Sign In as ${selectedRole.toUpperCase()}`}
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
              Or 1-Click Demo Profiles
            </span>
          </div>
        </div>

        {/* 1-Click Presets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleQuickLogin('student')}
            className="flex items-center gap-2.5 p-3 text-left border border-indigo-200/80 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl transition group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">Alex Chen</div>
              <div className="text-[10px] text-slate-500">Student</div>
            </div>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleQuickLogin('faculty')}
            className="flex items-center gap-2.5 p-3 text-left border border-purple-200/80 bg-purple-50/40 hover:bg-purple-50 rounded-xl transition group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">Prof. Marcus Vance</div>
              <div className="text-[10px] text-slate-500">Faculty Reviewer</div>
            </div>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleQuickLogin('admin')}
            className="flex items-center gap-2.5 p-3 text-left border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 rounded-xl transition group disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">Dean Eleanor Cross</div>
              <div className="text-[10px] text-slate-500">Administrator</div>
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