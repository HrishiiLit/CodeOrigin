'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSubmissions } from '@/lib/api';
import { Submission } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { SubmissionUploadForm } from '@/components/SubmissionUploadForm';
import { useAuth } from '@/context/AuthContext';
import {
  FileCode2,
  FolderArchive,
  ShieldCheck,
  GitCompare,
  ArrowRight,
  Plus,
  Sparkles,
  Layers,
  CheckCircle2,
  Cpu,
  GraduationCap,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, role } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showUpload, setShowUpload] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const data = await listSubmissions({ limit: 10 });
      setSubmissions(data.items);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadSuccess = (newSub: Submission) => {
    setSubmissions((prev) => [newSub, ...prev]);
    setShowUpload(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalRepos = submissions.filter((s) => s.submission_type === 'repository').length;
  const totalFiles = submissions.filter((s) => s.submission_type === 'file').length;

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* Editorial Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-8 sm:p-12 border border-slate-800 shadow-2xl">
        {/* Ambient Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-medium text-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Academic Code Intelligence & Integrity Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15]">
            Evaluate Code Quality, <br />
            <span className="bg-gradient-to-r from-indigo-300 via-sky-200 to-white bg-clip-text text-transparent">
              Track Real Evolutionary Progress.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
            Ingest Python code or repository archives, run zero-runtime static security & complexity scans, 
            and generate verified faculty appraisals with unified revision diffs.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{showUpload ? 'Close Ingestion Form' : 'New Code Submission'}</span>
            </button>

            <Link
              href="/compare"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
            >
              <GitCompare className="w-4 h-4 text-indigo-300" />
              <span>Compare Revisions</span>
            </Link>

            <Link
              href="/review"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
            >
              <GraduationCap className="w-4 h-4 text-purple-300" />
              <span>Faculty Review Hub</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Collapsible Upload Drawer */}
      {showUpload && (
        <div className="animate-fadeIn">
          <SubmissionUploadForm onSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Submissions */}
        <div className="glass-panel p-6 rounded-2xl hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Registered Code
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                <FileCode2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {loading ? '…' : submissions.length}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{totalRepos} repos</span>
            <span>•</span>
            <span>{totalFiles} single files</span>
            <Link href="/submissions" className="text-indigo-600 font-semibold hover:underline ml-auto flex items-center gap-0.5">
              <span>View</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Analysis Engine */}
        <div className="glass-panel p-6 rounded-2xl hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Static Engine
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">Active</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 truncate">
            AST • Ruff • Radon • Bandit
          </div>
        </div>

        {/* Card 3: Ingestion Channels */}
        <div className="glass-panel p-6 rounded-2xl hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Ingestion Paths
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              3 Channels
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 truncate">
            .py source • ZIP archive • GitHub URL
          </div>
        </div>

        {/* Card 4: Evaluation Protocol */}
        <div className="glass-panel p-6 rounded-2xl hover:shadow-lg transition-all duration-200 flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Review Protocol
              </span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              Human-in-Loop
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Deliberate approval gate</span>
            <Link href="/review" className="text-sky-600 font-semibold hover:underline">
              Hub →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Submissions Showcase */}
      <div className="glass-panel rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Recent Code Submissions
            </h2>
            <p className="text-xs text-slate-500">
              Latest source files and repositories queued or analyzed
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Refresh submissions"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <Link
              href="/submissions"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              <span>View All Submissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Fetching submissions from persistent storage…</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl font-bold shadow-xs">
              <FileCode2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Submissions Recorded Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upload a single Python script or whole repository archive to begin static inspection and revision tracking.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Submission</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/70 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Filename / Title</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Size</th>
                  <th className="px-6 py-3.5">SHA-256 Digest</th>
                  <th className="px-6 py-3.5">Ingested</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {submissions.map((sub) => {
                  const isRepo = sub.submission_type === 'repository';
                  return (
                    <tr
                      key={sub.submission_id}
                      className="hover:bg-indigo-50/30 transition-colors group"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isRepo ? 'bg-purple-50 text-purple-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {isRepo ? <FolderArchive className="w-4 h-4" /> : <FileCode2 className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {sub.original_filename}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {sub.submission_id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                          isRepo
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {isRepo ? 'Repo Archive' : 'Single .py'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge status={sub.status} />
                      </td>

                      <td className="px-6 py-4 text-slate-600 text-xs font-mono">
                        {isRepo
                          ? `${sub.total_files} files (${sub.source_files_count} py)`
                          : `${(sub.size_bytes / 1024).toFixed(1)} KB`}
                      </td>

                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400">
                        {sub.source_sha256.substring(0, 10)}…
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/submissions/${sub.submission_id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
