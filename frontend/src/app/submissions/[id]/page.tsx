'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  getSubmission,
  getRepositoryTree,
  getSubmissionSource,
  getAnalysis,
  runAnalysis,
  getDownloadUrl,
  deleteSubmission,
} from '@/lib/api';
import { Submission, RepositoryTreeResponse, AnalysisRunResponse } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { RepositoryFileBrowser } from '@/components/RepositoryFileBrowser';
import { GitHubIssueModal } from '@/components/GitHubIssueModal';
import { useAuth } from '@/context/AuthContext';
import {
  Github,
  ExternalLink,
  Download,
  GitCompare,
  BookOpen,
  Trash2,
  Copy,
  Check,
  FileCode2,
  FolderGit2,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  HardDrive,
  Hash,
} from 'lucide-react';

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;
  const { role } = useAuth();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [repoTree, setRepoTree] = useState<RepositoryTreeResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sourceCode, setSourceCode] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisRunResponse | null>(null);
  const [runningAnalysis, setRunningAnalysis] = useState<boolean>(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const [loadingSource, setLoadingSource] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // GitHub Integration State
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([]);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [createdIssueInfo, setCreatedIssueInfo] = useState<{ url: string; number: number; repo: string } | null>(null);

  // Initial load
  useEffect(() => {
    if (!submissionId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const sub = await getSubmission(submissionId);
        setSubmission(sub);

        const tree = await getRepositoryTree(submissionId);
        setRepoTree(tree);

        // Preload first python file or the only file
        const defaultFile = tree.source_files[0] ?? tree.tree[0]?.path ?? null;
        if (defaultFile) {
          setSelectedFile(defaultFile);
          const code = await getSubmissionSource(submissionId, tree.is_directory ? defaultFile : undefined);
          setSourceCode(code);
        }

        // Try to load existing analysis
        const existingAnalysis = await getAnalysis(submissionId);
        setAnalysis(existingAnalysis);
      } catch (err: any) {
        setError(err.message || 'Failed to load submission.');
      } finally {
        setLoading(false);
      }
    })();
  }, [submissionId]);

  // Load a different file when selected from tree
  const handleSelectFile = async (path: string) => {
    if (path === selectedFile || !repoTree?.is_directory) return;
    setSelectedFile(path);
    setLoadingSource(true);
    try {
      const code = await getSubmissionSource(submissionId, path);
      setSourceCode(code);
    } catch (err: any) {
      setSourceCode(`# Error loading file: ${err.message}`);
    } finally {
      setLoadingSource(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunAnalysis = async () => {
    if (!submissionId) return;
    setRunningAnalysis(true);
    try {
      const res = await runAnalysis(submissionId);
      setAnalysis(res);
      // Refresh submission status
      const updatedSub = await getSubmission(submissionId);
      setSubmission(updatedSub);
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this submission and its stored source files?')) return;
    setDeleting(true);
    try {
      await deleteSubmission(submissionId);
      router.push('/submissions');
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading submission workspace...</p>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-rose-50/70 border border-rose-200 rounded-2xl p-8 text-center text-rose-800 space-y-3 shadow-sm">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold">Submission Retrieval Error</h2>
        <p className="text-xs text-rose-600 max-w-sm mx-auto">{error || 'Submission not found.'}</p>
        <div className="pt-2">
          <Link
            href="/submissions"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-xs"
          >
            ← Back to Submissions Vault
          </Link>
        </div>
      </div>
    );
  }

  const isRepo = submission.submission_type === 'repository';
  const lines = sourceCode.split('\n');

  // Filter findings
  const filteredFindings = (analysis?.findings || []).filter((f) => {
    if (filterSeverity !== 'all' && f.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && f.category !== filterCategory) return false;
    return true;
  });

  const toggleSelectFinding = (findingId: string) => {
    setSelectedFindingIds((prev) =>
      prev.includes(findingId) ? prev.filter((id) => id !== findingId) : [...prev, findingId]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredFindings.map((f) => f.finding_id);
    setSelectedFindingIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleDeselectAll = () => {
    setSelectedFindingIds([]);
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Header & Breadcrumb & Action Cluster */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 border-b border-slate-200/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Link href="/submissions" className="hover:text-indigo-600 transition font-medium">Submissions Vault</Link>
            <span>/</span>
            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
              {submission.submission_id.slice(0, 10)}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {submission.original_filename}
            </h1>
            <StatusBadge status={submission.status} />
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
              isRepo
                ? 'bg-purple-50 border-purple-200/70 text-purple-700'
                : 'bg-sky-50 border-sky-200/70 text-sky-700'
            }`}>
              {isRepo ? <FolderGit2 className="w-3.5 h-3.5" /> : <FileCode2 className="w-3.5 h-3.5" />}
              {isRepo ? 'Repository Archive' : 'Single Python File'}
            </span>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href={getDownloadUrl(submission.submission_id)}
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
          <Link
            href={`/compare?base=${submission.submission_id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare
          </Link>
          {role !== 'student' && (
            <Link
              href="/review"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs hover:shadow-indigo-500/25"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Faculty Review
            </Link>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Metadata Bento Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-3.5 rounded-2xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Hash className="w-3 h-3 text-indigo-500" /> Submission ID
          </div>
          <div className="text-xs font-mono font-semibold text-slate-800 truncate" title={submission.submission_id}>
            {submission.submission_id}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3 text-purple-500" /> Project Identifier
          </div>
          <div className="text-xs font-mono font-semibold text-slate-800 truncate" title={submission.project_id}>
            {submission.project_id}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            <HardDrive className="w-3 h-3 text-sky-500" /> {isRepo ? 'Total Files' : 'Payload Size'}
          </div>
          <div className="text-xs font-semibold text-slate-800">
            {isRepo ? `${submission.total_files} files (${submission.source_files_count} .py)` : `${(submission.size_bytes / 1024).toFixed(1)} KB`}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-2xl">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            <Clock className="w-3 h-3 text-emerald-500" /> Ingestion Time
          </div>
          <div className="text-xs text-slate-700 truncate" title={submission.created_at}>
            {new Date(submission.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
      </div>

      {/* Code Browser & Tree Explorer Dual Pane */}
      <div className={`grid gap-4 ${isRepo ? 'grid-cols-1 lg:grid-cols-[280px_1fr]' : 'grid-cols-1'}`}>

        {/* File Browser (repository only) */}
        {isRepo && repoTree && (
          <RepositoryFileBrowser
            tree={repoTree.tree}
            sourceFiles={repoTree.source_files}
            selectedPath={selectedFile}
            onSelectFile={handleSelectFile}
          />
        )}

        {/* Code Viewer Panel */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
          {/* Top Bar of Viewer */}
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 ring-4 ring-emerald-500/20 shrink-0" />
              <span className="text-xs font-mono font-medium text-slate-300 truncate">
                {selectedFile ?? submission.original_filename}
              </span>
              {loadingSource && (
                <span className="text-[11px] text-indigo-400 font-mono animate-pulse">
                  Streaming source…
                </span>
              )}
            </div>
            <button
              onClick={handleCopy}
              disabled={!sourceCode || loadingSource}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition shadow-xs shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Syntax Code Body */}
          <div className="overflow-auto p-4 text-slate-100 font-mono text-xs leading-relaxed max-h-[520px]">
            {sourceCode ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/60 transition-colors">
                      <td className="pr-4 select-none text-slate-600 text-right w-12 align-top text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="pl-3 whitespace-pre text-slate-200 selection:bg-indigo-700 selection:text-white">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-slate-500 italic text-xs">
                Select a file from the repository tree to inspect its source code.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Static Analysis Pipeline Section */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-indigo-500/20" />
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Automated Static Analysis Pipeline</h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/80">
                Multi-Tool Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Deterministic AST structure parsing combined with Ruff rule verification, Radon cyclomatic complexity, and Bandit security scans.
            </p>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={runningAnalysis}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 shadow-sm hover:shadow-indigo-500/25"
          >
            {runningAnalysis ? 'Executing Pipeline Checks…' : analysis ? 'Re-run Static Pipeline' : 'Run Static Analysis'}
          </button>
        </div>

        {/* Analysis Results Display */}
        {analysis ? (
          <div className="space-y-6">
            {/* Metric Summary Bento Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-xs">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Findings</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{analysis.summary.finding_count}</div>
              </div>
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/60 shadow-xs">
                <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Errors
                </div>
                <div className="text-2xl font-black text-rose-800 mt-1">{analysis.summary.error_count}</div>
              </div>
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60 shadow-xs">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Warnings
                </div>
                <div className="text-2xl font-black text-amber-800 mt-1">{analysis.summary.warning_count}</div>
              </div>
              <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200/60 shadow-xs">
                <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1">
                  <Info className="w-3 h-3" /> Informational
                </div>
                <div className="text-2xl font-black text-sky-800 mt-1">{analysis.summary.info_count}</div>
              </div>
            </div>

            {/* Tool versions bar */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 bg-slate-50/90 px-3.5 py-2.5 rounded-xl border border-slate-200/70">
              <span className="font-semibold text-slate-700">Analyzers:</span>
              {Object.entries(analysis.tool_versions).map(([t, v]) => (
                <span key={t} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md font-mono text-[11px] text-slate-700">
                  {t}: {v}
                </span>
              ))}
              <span className="ml-auto text-slate-400 font-mono text-[11px]">Duration: {analysis.duration_ms}ms</span>
            </div>

            {/* GitHub Issue Created Banner */}
            {createdIssueInfo && (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 text-xs text-emerald-900 shadow-xs animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>GitHub Issue Created:</strong> Issue #{createdIssueInfo.number} in <code className="font-mono bg-emerald-100/60 px-1 py-0.5 rounded">{createdIssueInfo.repo}</code>
                  </span>
                </div>
                <a
                  href={createdIssueInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition"
                >
                  View on GitHub
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Selection & GitHub Export Action Bar (Faculty & Admin Only) */}
            {role !== 'student' && (
              <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold transition shadow-xs"
                  >
                    Select All Filtered ({filteredFindings.length})
                  </button>
                  {selectedFindingIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-slate-900 font-medium transition"
                    >
                      Clear ({selectedFindingIds.length})
                    </button>
                  )}
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-600 font-medium">
                    {selectedFindingIds.length} finding{selectedFindingIds.length === 1 ? '' : 's'} selected
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGitHubModalOpen(true)}
                  disabled={selectedFindingIds.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white rounded-xl font-semibold transition shadow-xs"
                >
                  <Github className="w-4 h-4" />
                  Export to GitHub Issue
                </button>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-1.5">
                {['all', 'error', 'warning', 'info'].map((sev) => {
                  const count = sev === 'all'
                    ? analysis.findings.length
                    : analysis.findings.filter(f => f.severity === sev).length;
                  return (
                    <button
                      key={sev}
                      onClick={() => setFilterSeverity(sev)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                        filterSeverity === sev
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {sev} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                {['all', 'security', 'complexity', 'maintainability', 'correctness'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] capitalize transition font-medium ${
                      filterCategory === cat
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Finding Cards List */}
            {filteredFindings.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No diagnostic findings match the selected filters.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFindings.map((f) => {
                  const isChecked = selectedFindingIds.includes(f.finding_id);
                  return (
                    <div
                      key={f.finding_id}
                      className={`p-4 rounded-xl border bg-white transition shadow-xs space-y-2.5 ${
                        f.severity === 'error'
                          ? 'border-l-4 border-l-rose-500 border-slate-200 hover:border-slate-300'
                          : f.severity === 'warning'
                          ? 'border-l-4 border-l-amber-500 border-slate-200 hover:border-slate-300'
                          : 'border-l-4 border-l-sky-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectFinding(f.finding_id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4 cursor-pointer"
                            aria-label={`Select finding ${f.rule_id}`}
                          />
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                            f.severity === 'error'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : f.severity === 'warning'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-sky-100 text-sky-800 border border-sky-200'
                          }`}>
                            {f.severity}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900">
                            {f.tool.toUpperCase()}: {f.rule_id}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium capitalize bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                            {f.category}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                          {f.file}:{f.line}
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 font-medium leading-relaxed">{f.message}</p>

                      {f.suggestion && (
                        <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-950 flex items-start gap-2.5">
                          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <span>{f.suggestion}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center border-2 border-dashed border-slate-200/80 rounded-2xl space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto font-black text-sm">
              AST
            </div>
            <h3 className="text-sm font-bold text-slate-800">Static Analysis Pipeline has not been run yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click &quot;Run Static Analysis&quot; above to parse the AST and execute Ruff, Radon, and Bandit scans across all submission files.
            </p>
          </div>
        )}
      </div>

      {/* GitHub Issue Export Modal */}
      <GitHubIssueModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        submissionId={submissionId}
        selectedFindingIds={selectedFindingIds}
        onSuccess={(issue) => {
          setCreatedIssueInfo({
            url: issue.issue_url,
            number: issue.issue_number,
            repo: issue.repository,
          });
        }}
      />
    </div>
  );
}