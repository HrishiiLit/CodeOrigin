'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { listSubmissions, createComparison } from '@/lib/api';
import { Submission, ComparisonResponse } from '@/types';
import {
  GitCompare,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Minus,
  FileCode2,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';

function CompareContent() {
  const searchParams = useSearchParams();
  const initialBase = searchParams.get('base') || '';
  const initialTarget = searchParams.get('target') || '';

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [baseId, setBaseId] = useState<string>(initialBase);
  const [targetId, setTargetId] = useState<string>(initialTarget);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loadingSubs, setLoadingSubs] = useState<boolean>(true);
  const [comparing, setComparing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await listSubmissions({ limit: 50 });
        setSubmissions(res.items);

        if (initialBase && initialTarget) {
          handleCompare(initialBase, initialTarget);
        } else if (initialBase && res.items.length > 1) {
          const other = res.items.find((s) => s.submission_id !== initialBase);
          if (other) setTargetId(other.submission_id);
        } else if (res.items.length >= 2 && !baseId && !targetId) {
          // Preload first two submissions for immediate comparison convenience
          setBaseId(res.items[1].submission_id);
          setTargetId(res.items[0].submission_id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load submissions.');
      } finally {
        setLoadingSubs(false);
      }
    })();
  }, [initialBase, initialTarget]);

  const handleCompare = async (base: string = baseId, target: string = targetId) => {
    if (!base || !target) {
      setError('Please select both a base revision and a target revision to compare.');
      return;
    }
    if (base === target) {
      setError('Base revision and target revision cannot be identical.');
      return;
    }

    setComparing(true);
    setError(null);
    try {
      const res = await createComparison({
        base_submission_id: base,
        target_submission_id: target,
      });
      setComparison(res);
    } catch (err: any) {
      setError(err.message || 'Failed to compute revision diff.');
    } finally {
      setComparing(false);
    }
  };

  const handleSwap = () => {
    const temp = baseId;
    setBaseId(targetId);
    setTargetId(temp);
    if (targetId && temp) {
      handleCompare(targetId, temp);
    }
  };

  const diffLines = comparison?.diff ? comparison.diff.split('\n') : [];
  const baseSub = submissions.find((s) => s.submission_id === baseId);
  const targetSub = submissions.find((s) => s.submission_id === targetId);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-slate-200/80 pb-5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold tracking-wide uppercase mb-2">
          <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
          <span>Code Evolution Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Revision Comparison & Diff Studio
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
          Inspect unified source diffs, added/deleted syntax changes, and structural evolution between student project revisions.
        </p>
      </div>

      {/* Few submissions warning banner */}
      {!loadingSubs && submissions.length < 2 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>At least two code submissions are required to compare code revisions. Use the Submissions page or run the demo seeder.</span>
          </div>
          <Link href="/submissions" className="px-3 py-1 bg-amber-200/60 hover:bg-amber-200 text-amber-900 rounded-lg font-bold transition">
            Go to Submissions →
          </Link>
        </div>
      )}

      {/* Selectors Panel */}
      <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Base Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Base Revision (Earlier Version)
            </label>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              disabled={loadingSubs}
              className="w-full text-xs font-mono rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Select Base Revision --</option>
              {submissions.map((s) => (
                <option key={s.submission_id} value={s.submission_id}>
                  {s.original_filename} ({s.submission_id.slice(0, 8)}…) — {new Date(s.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center md:pt-5">
            <button
              type="button"
              onClick={handleSwap}
              disabled={!baseId || !targetId}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition border border-slate-200 shadow-2xs active:scale-95 disabled:opacity-40"
              title="Swap revision directions"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Target Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Target Revision (Refactored / Newer Version)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={loadingSubs}
              className="w-full text-xs font-mono rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">-- Select Target Revision --</option>
              {submissions.map((s) => (
                <option key={s.submission_id} value={s.submission_id}>
                  {s.original_filename} ({s.submission_id.slice(0, 8)}…) — {new Date(s.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500">
            {baseSub && targetSub ? (
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{baseSub.original_filename}</span>
                <span className="text-slate-400">→</span>
                <span className="font-semibold text-indigo-700">{targetSub.original_filename}</span>
              </span>
            ) : (
              <span>Select two revisions above to evaluate source changes.</span>
            )}
          </div>
          <button
            onClick={() => handleCompare()}
            disabled={comparing || !baseId || !targetId}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm shadow-indigo-600/20 active:scale-95"
          >
            {comparing ? 'Computing Diff…' : 'Compute Revision Diff'}
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary metrics cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl shadow-xs flex items-center gap-3.5 border border-emerald-100">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl shadow-2xs">
                +
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lines Added</div>
                <div className="text-2xl font-black text-emerald-600 mt-0.5">+{comparison.summary.added_lines}</div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl shadow-xs flex items-center gap-3.5 border border-rose-100">
              <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xl shadow-2xs">
                −
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lines Removed</div>
                <div className="text-2xl font-black text-rose-600 mt-0.5">−{comparison.summary.removed_lines}</div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl shadow-xs flex items-center gap-3.5 border border-indigo-100">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl shadow-2xs">
                Δ
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Changed Files</div>
                <div className="text-2xl font-black text-indigo-600 mt-0.5">{comparison.summary.changed_files}</div>
              </div>
            </div>
          </div>

          {/* Unified Diff Panel */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  Unified Code Diff
                </h3>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Diff Hash: <span className="text-slate-200">{comparison.comparison_id.slice(0, 8)}…</span>
              </div>
            </div>

            <div className="p-4 font-mono text-xs overflow-auto max-h-[650px] leading-relaxed">
              {diffLines.length === 0 ? (
                <div className="text-slate-500 italic py-8 text-center">
                  No textual differences found between revisions.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {diffLines.map((line, idx) => {
                      let rowStyle = 'text-slate-300';
                      let bgStyle = '';
                      if (line.startsWith('+++') || line.startsWith('---')) {
                        rowStyle = 'text-cyan-400 font-bold';
                        bgStyle = 'bg-cyan-950/30';
                      } else if (line.startsWith('@@')) {
                        rowStyle = 'text-indigo-400 font-bold';
                        bgStyle = 'bg-indigo-950/40';
                      } else if (line.startsWith('+')) {
                        rowStyle = 'text-emerald-400';
                        bgStyle = 'bg-emerald-950/40';
                      } else if (line.startsWith('-')) {
                        rowStyle = 'text-rose-400';
                        bgStyle = 'bg-rose-950/40';
                      }

                      return (
                        <tr key={idx} className={`${bgStyle} hover:bg-slate-900/60 transition-colors`}>
                          <td className="w-12 pr-4 text-right select-none text-slate-600 text-[11px] align-top font-mono">
                            {idx + 1}
                          </td>
                          <td className={`pl-2 whitespace-pre ${rowStyle}`}>
                            {line || ' '}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading comparison module…</div>}>
      <CompareContent />
    </Suspense>
  );
}
