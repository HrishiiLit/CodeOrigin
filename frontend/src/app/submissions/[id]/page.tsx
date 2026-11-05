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
import { Submission, RepositoryTreeResponse, AnalysisRunResponse, Finding } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { RepositoryFileBrowser } from '@/components/RepositoryFileBrowser';

export default function SubmissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

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

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading submission…</div>;

  if (error || !submission) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-700">
        <h2 className="text-lg font-semibold">Error</h2>
        <p className="text-sm mt-1">{error || 'Submission not found.'}</p>
        <Link href="/submissions" className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:underline">← Back</Link>
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

  return (
    <div className="space-y-6">

      {/* Breadcrumb + Title + Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link href="/submissions" className="hover:text-indigo-600">Submissions</Link>
            <span>/</span>
            <span className="font-mono text-slate-600">{submission.submission_id.slice(0, 8)}…</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3 flex-wrap">
            <span>{submission.original_filename}</span>
            <StatusBadge status={submission.status} />
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
              isRepo
                ? 'bg-violet-50 border-violet-200 text-violet-700'
                : 'bg-sky-50 border-sky-200 text-sky-700'
            }`}>
              {isRepo ? '🗂 Repository' : '🐍 Single File'}
            </span>
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={getDownloadUrl(submission.submission_id)}
            download
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition shadow-sm inline-flex items-center gap-1.5"
          >
            <span>📥 Download</span>
          </a>
          <Link
            href={`/compare?base=${submission.submission_id}`}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition shadow-sm"
          >
            Compare Revision
          </Link>
          <Link
            href="/review"
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            Faculty Review
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Submission ID', value: submission.submission_id, mono: true },
          { label: 'Project ID', value: submission.project_id, mono: true },
          {
            label: isRepo ? 'Total Files' : 'File Size',
            value: isRepo ? `${submission.total_files} files (${submission.source_files_count} .py)` : `${(submission.size_bytes / 1024).toFixed(1)} KB`,
          },
          { label: 'SHA-256', value: submission.source_sha256.slice(0, 12) + '…', mono: true },
        ].map(({ label, value, mono }) => (
          <div key={label} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-xs text-slate-800 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Main content: tree + code viewer */}
      <div className={`grid gap-4 ${isRepo ? 'grid-cols-1 lg:grid-cols-[260px_1fr]' : 'grid-cols-1'}`}>

        {/* File Browser (repository only) */}
        {isRepo && repoTree && (
          <RepositoryFileBrowser
            tree={repoTree.tree}
            sourceFiles={repoTree.source_files}
            selectedPath={selectedFile}
            onSelectFile={handleSelectFile}
          />
        )}

        {/* Code Viewer */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-xs font-mono text-slate-600 truncate">
                {selectedFile ?? submission.original_filename}
              </span>
              {loadingSource && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
            </div>
            <button
              onClick={handleCopy}
              disabled={!sourceCode || loadingSource}
              className="text-xs text-slate-500 hover:text-indigo-600 px-2 py-1 border border-slate-200 bg-white rounded shadow-sm transition shrink-0"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <div className="overflow-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed max-h-[500px]">
            {sourceCode ? (
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/50">
                      <td className="pr-4 select-none text-slate-500 text-right w-10 align-top text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="pl-2 whitespace-pre text-slate-200">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 italic text-xs">Select a file from the tree to view its source.</p>
            )}
          </div>
        </div>
      </div>

      {/* Static Analysis Pipeline Section (Phase 3) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Static Analysis Pipeline</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">Phase 3</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Multi-tool static evaluation combining AST structure parsing, Ruff linting, Radon complexity, and Bandit security scans.
            </p>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={runningAnalysis}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
          >
            {runningAnalysis ? 'Running Analysis…' : analysis ? 'Re-run Analysis' : 'Run Static Analysis'}
          </button>
        </div>

        {/* Analysis Results Display */}
        {analysis ? (
          <div className="space-y-5">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Findings</div>
                <div className="text-xl font-bold text-slate-900 mt-0.5">{analysis.summary.finding_count}</div>
              </div>
              <div className="bg-rose-50 p-3.5 rounded-lg border border-rose-100">
                <div className="text-[10px] font-semibold text-rose-600 uppercase">Errors</div>
                <div className="text-xl font-bold text-rose-700 mt-0.5">{analysis.summary.error_count}</div>
              </div>
              <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-100">
                <div className="text-[10px] font-semibold text-amber-600 uppercase">Warnings</div>
                <div className="text-xl font-bold text-amber-700 mt-0.5">{analysis.summary.warning_count}</div>
              </div>
              <div className="bg-sky-50 p-3.5 rounded-lg border border-sky-100">
                <div className="text-[10px] font-semibold text-sky-600 uppercase">Informational</div>
                <div className="text-xl font-bold text-sky-700 mt-0.5">{analysis.summary.info_count}</div>
              </div>
            </div>

            {/* Tool versions pill */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <span className="font-semibold text-slate-700">Tool Versions:</span>
              {Object.entries(analysis.tool_versions).map(([t, v]) => (
                <span key={t} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px]">
                  {t}: {v}
                </span>
              ))}
              <span className="ml-auto text-slate-400">Duration: {analysis.duration_ms}ms</span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1">
                {['all', 'error', 'warning', 'info'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition ${
                      filterSeverity === sev
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {sev} ({sev === 'all' ? analysis.findings.length : analysis.findings.filter(f => f.severity === sev).length})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                {['all', 'security', 'complexity', 'maintainability', 'correctness'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-0.5 rounded text-[11px] capitalize transition ${
                      filterCategory === cat
                        ? 'bg-slate-800 text-white font-medium'
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
              <div className="py-8 text-center text-xs text-slate-400">
                No findings match the selected filters.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFindings.map((f) => (
                  <div
                    key={f.finding_id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          f.severity === 'error'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : f.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-sky-100 text-sky-800 border border-sky-200'
                        }`}>
                          {f.severity}
                        </span>
                        <span className="text-xs font-mono font-semibold text-slate-800">
                          {f.tool.toUpperCase()}: {f.rule_id}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize bg-slate-100 px-1.5 py-0.5 rounded">
                          {f.category}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {f.file}:{f.line}
                      </div>
                    </div>

                    <p className="text-xs text-slate-800 font-medium">{f.message}</p>

                    {f.suggestion && (
                      <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 flex items-start gap-2">
                        <span className="text-indigo-600 font-bold">💡</span>
                        <span>{f.suggestion}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 font-bold text-sm">
              AST
            </div>
            <h3 className="text-xs font-semibold text-slate-800">Static Analysis has not been run yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click &quot;Run Static Analysis&quot; above to parse the AST and execute Ruff, Radon, and Bandit checks.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
