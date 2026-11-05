'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminStats } from '@/lib/api';
import { AdminOverviewResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import {
  Shield,
  Activity,
  HardDrive,
  Users,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FolderGit2,
  FileCode2,
  Repeat,
  Terminal,
  BookOpen,
  GraduationCap,
  Layers,
  Lock,
  Eye,
  Check,
  X,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, role, switchRole } = useAuth();
  const [stats, setStats] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'matrix' | 'audit'>('telemetry');

  const fetchStats = async () => {
    try {
      const data = await getAdminStats(role);
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load administrative telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [role]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading administrative governance telemetry...</p>
      </div>
    );
  }

  const submissions = stats?.submissions;
  const analysis = stats?.analysis;
  const reviews = stats?.reviews;
  const comparisons = stats?.comparisons;
  const system = stats?.system;
  const activity = stats?.recent_activity || [];

  // Calculate percentages for tools
  const toolTotal = analysis?.total_findings || 1;
  const ruffCount = analysis?.by_tool?.ruff || 0;
  const astCount = analysis?.by_tool?.ast || 0;
  const radonCount = analysis?.by_tool?.radon || 0;
  const banditCount = analysis?.by_tool?.bandit || 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header & Governance Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <span className="font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Institutional Governance
            </span>
            <span>/</span>
            <span className="text-slate-600 font-medium">Administration Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            System Administration & Analytics Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Campus-wide static analysis metrics, student assignment velocity, faculty evaluation throughput, and security audit trails.
          </p>
        </div>

        {/* System Health Pill + Refresh Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="glass-panel px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>API: <strong>{system?.api.toUpperCase()}</strong></span>
            <span className="text-slate-300">|</span>
            <span>Store: <strong>{system?.database}</strong></span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300/80 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* Role Notice If Not Admin */}
      {role !== 'admin' && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span>You are viewing telemetry as <strong>{user?.name || 'User'}</strong> ({role} role).</span>
              <p className="text-amber-800 text-[11px] mt-0.5">Switch to Academic Dean / Admin mode to access full governance oversight.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchRole('admin')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-semibold transition shadow-xs shrink-0"
          >
            <Repeat className="w-3.5 h-3.5" />
            Switch to Admin Mode
          </button>
        </div>
      )}

      {/* Navigation View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'telemetry'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overall Telemetry & KPIs
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'matrix'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Student vs. Faculty Visibility Matrix
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'audit'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Institutional Audit Log Stream ({activity.length})
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs">
          {error}
        </div>
      )}

      {/* TAB 1: OVERALL TELEMETRY & KPIS */}
      {activeTab === 'telemetry' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Top 4 KPI Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Submissions */}
            <div className="glass-panel p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Submissions</span>
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FolderGit2 className="w-4 h-4" />
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {submissions?.total || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>{submissions?.files || 0} single .py</span>
                  <span>•</span>
                  <span>{submissions?.repositories || 0} repo archives</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
                <span>Storage footprint</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {((submissions?.total_storage_bytes || 0) / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            {/* Card 2: Analysis Findings */}
            <div className="glass-panel p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Static Findings</span>
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {analysis?.total_findings || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span className="text-rose-600 font-semibold">{analysis?.by_severity?.error || 0} errors</span>
                  <span>•</span>
                  <span className="text-amber-600 font-semibold">{analysis?.by_severity?.warning || 0} warnings</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
                <span>Total pipeline runs</span>
                <span className="font-mono text-slate-700 font-semibold">{analysis?.total_runs || 0} runs</span>
              </div>
            </div>

            {/* Card 3: Faculty Reviews */}
            <div className="glass-panel p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Faculty Reviews</span>
                <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <BookOpen className="w-4 h-4" />
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {reviews?.total_reviews || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>{reviews?.unique_reviewers || 0} active instructors</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
                <span>Avg latency</span>
                <span className="font-mono text-slate-700 font-semibold">{analysis?.avg_duration_ms || 0}ms</span>
              </div>
            </div>

            {/* Card 4: Code Evolution & Churn */}
            <div className="glass-panel p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revision Comparisons</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Repeat className="w-4 h-4" />
                </span>
              </div>
              <div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {comparisons?.total_comparisons || 0}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span className="text-emerald-600 font-semibold">+{comparisons?.total_added_lines || 0} lines</span>
                  <span>•</span>
                  <span className="text-rose-600 font-semibold">-{comparisons?.total_removed_lines || 0} lines</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex justify-between">
                <span>Unique student projects</span>
                <span className="font-mono text-slate-700 font-semibold">{submissions?.unique_projects || 0}</span>
              </div>
            </div>
          </div>

          {/* Deep Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Analyzer Engine Breakdown */}
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-600" />
                  Multi-Tool Static Engine Distribution
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">AST • RUFF • RADON • BANDIT</span>
              </div>

              <div className="space-y-4">
                {/* Ruff */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">Ruff Linting & Code Style</span>
                    <span className="font-mono text-slate-500">{ruffCount} ({Math.round((ruffCount / toolTotal) * 100)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(ruffCount / toolTotal) * 100}%` }} />
                  </div>
                </div>

                {/* AST */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">AST Structural Security & Dynamic Execution</span>
                    <span className="font-mono text-slate-500">{astCount} ({Math.round((astCount / toolTotal) * 100)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: `${(astCount / toolTotal) * 100}%` }} />
                  </div>
                </div>

                {/* Radon */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">Radon Cyclomatic Complexity Check</span>
                    <span className="font-mono text-slate-500">{radonCount} ({Math.round((radonCount / toolTotal) * 100)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(radonCount / toolTotal) * 100}%` }} />
                  </div>
                </div>

                {/* Bandit */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">Bandit Vulnerability Scans</span>
                    <span className="font-mono text-slate-500">{banditCount} ({Math.round((banditCount / toolTotal) * 100)}%)</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(banditCount / toolTotal) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Severity Pill Counts */}
              <div className="pt-2 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800">
                  <div className="text-[10px] font-bold uppercase">Errors</div>
                  <div className="text-base font-extrabold">{analysis?.by_severity?.error || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-800">
                  <div className="text-[10px] font-bold uppercase">Warnings</div>
                  <div className="text-base font-extrabold">{analysis?.by_severity?.warning || 0}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-800">
                  <div className="text-[10px] font-bold uppercase">Info</div>
                  <div className="text-base font-extrabold">{analysis?.by_severity?.info || 0}</div>
                </div>
              </div>
            </div>

            {/* Ingestion & Status Telemetry */}
            <div className="glass-panel p-6 rounded-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                  Submission Status & Storage Reliability
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">SECURE ZERO-EXECUTION</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Completed Submissions</div>
                  <div className="text-xl font-black text-slate-900">{submissions?.by_status?.completed || 0}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">100% verified ingestion</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Enrolled Students</div>
                  <div className="text-xl font-black text-slate-900">{submissions?.unique_students || 0}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Distinct submitting student IDs</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Archive Security Gate</div>
                  <div className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zip Slip Proof
                  </div>
                  <div className="text-[10px] text-slate-500">Path traversal tests passing</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">GitHub Issue Gate</div>
                  <div className="text-sm font-bold text-indigo-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Reviewer Verified
                  </div>
                  <div className="text-[10px] text-slate-500">Explicit confirmation required</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl text-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold">Total Platform Code Churn</div>
                  <div className="text-slate-400 text-[11px]">
                    Net delta: {((comparisons?.total_added_lines || 0) - (comparisons?.total_removed_lines || 0))} lines
                  </div>
                </div>
                <Link
                  href="/compare"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Inspect Diffs →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT VS. FACULTY VISIBILITY MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-panel p-6 rounded-2xl space-y-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Institutional Role Access & Visibility Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Complete breakdown of views, permissions, write capabilities, and evaluation tools visible to Students vs Faculty vs Administrators.
            </p>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                    <th className="p-4 font-bold uppercase tracking-wider text-[11px]">Feature / Workspace</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-indigo-700">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4" /> Student View
                      </div>
                    </th>
                    <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-purple-700">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" /> Faculty View
                      </div>
                    </th>
                    <th className="p-4 font-bold uppercase tracking-wider text-[11px] text-amber-800">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4" /> Admin / Dean View
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    {
                      feature: 'Code Submissions (Upload .py, .zip, .tar.gz, GitHub URL)',
                      student: { access: true, desc: 'Can upload, re-upload revisions, and download own source files' },
                      faculty: { access: true, desc: 'Can view, inspect, and download any student submission archive' },
                      admin: { access: true, desc: 'Full upload, storage lifecycle management, and purge permissions' },
                    },
                    {
                      feature: 'Multi-Tool Static Analysis (AST, Ruff, Radon, Bandit)',
                      student: { access: true, desc: 'Can run checks on their submissions and see suggestions' },
                      faculty: { access: true, desc: 'Can run checks, inspect severity, and view rule IDs' },
                      admin: { access: true, desc: 'Platform-wide telemetry, tool latency, and severity aggregation' },
                    },
                    {
                      feature: 'Source Code Tree & Syntax Viewer',
                      student: { access: true, desc: 'Can view full files, copy snippets, and inspect AST nodes' },
                      faculty: { access: true, desc: 'Can inspect full files, line numbers, and diagnostic tags' },
                      admin: { access: true, desc: 'Can inspect any file across all enrolled student projects' },
                    },
                    {
                      feature: 'Revision Evolution & Comparison Studio',
                      student: { access: true, desc: 'Compare their v1 vs v2 submissions to verify fixes' },
                      faculty: { access: true, desc: 'Inspect student revision progress, line churn, and resolved issues' },
                      admin: { access: true, desc: 'View global code churn rates and student refactoring velocity' },
                    },
                    {
                      feature: 'Faculty Feedback Notes & Rubric Evaluation',
                      student: { access: false, desc: 'Read-only: Students cannot write faculty reviews' },
                      faculty: { access: true, desc: 'Full write access: attach qualitative feedback and review notes' },
                      admin: { access: true, desc: 'Oversight: inspect all faculty evaluations and review counts' },
                    },
                    {
                      feature: 'Official Faculty Review Report Generation',
                      student: { access: false, desc: 'Cannot generate formal institutional review documents' },
                      faculty: { access: true, desc: 'Full document generator: letterhead, scorecards, print & download' },
                      admin: { access: true, desc: 'Access all generated institutional reports for grade accreditation' },
                    },
                    {
                      feature: 'Export Findings to GitHub Issues',
                      student: { access: false, desc: 'Restricted: Students cannot trigger institutional issue exports' },
                      faculty: { access: true, desc: 'Authorized: Draft and submit issues with deliberate confirmation' },
                      admin: { access: true, desc: 'Audit log oversight of all external issue creation events' },
                    },
                    {
                      feature: 'Campus-wide Administration & Audit Log Stream',
                      student: { access: false, desc: 'Hidden from student workflow' },
                      faculty: { access: false, desc: 'Restricted to departmental leadership & admins' },
                      admin: { access: true, desc: 'Full access: view all system telemetry and security audit logs' },
                    },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-semibold text-slate-800 text-xs max-w-xs">{row.feature}</td>
                      <td className="p-4">
                        <div className="flex items-start gap-1.5">
                          {row.student.access ? (
                            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span className={`text-[11px] ${row.student.access ? 'text-slate-700' : 'text-slate-400'}`}>
                            {row.student.desc}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-start gap-1.5">
                          {row.faculty.access ? (
                            <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span className={`text-[11px] ${row.faculty.access ? 'text-slate-700' : 'text-slate-400'}`}>
                            {row.faculty.desc}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-start gap-1.5">
                          {row.admin.access ? (
                            <Check className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span className={`text-[11px] ${row.admin.access ? 'text-slate-700' : 'text-slate-400'}`}>
                            {row.admin.desc}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INSTITUTIONAL AUDIT TRAIL STREAM */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-700" />
                Immutable Institutional Audit Log Stream
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cryptographically tracked events logged across submissions, static evaluations, review memos, and external issue exports.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              Showing {activity.length} recent events
            </span>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden shadow-xs">
            {activity.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No audit events recorded yet in this environment.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activity.map((ev) => (
                  <div key={ev.event_id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          ev.action.includes('REVIEW')
                            ? 'bg-purple-100 text-purple-800'
                            : ev.action.includes('REPORT')
                            ? 'bg-indigo-100 text-indigo-800'
                            : ev.action.includes('GITHUB')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {ev.action}
                        </span>
                        <span className="font-semibold text-slate-800">
                          Actor: <code className="font-mono text-indigo-600">{ev.actor_id}</code>
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {JSON.stringify(ev.details)}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(ev.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
