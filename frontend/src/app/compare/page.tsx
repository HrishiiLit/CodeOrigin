'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { listSubmissions, createComparison } from '@/lib/api';
import { Submission, ComparisonResponse } from '@/types';

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

        // Auto-select if query params provided
        if (initialBase && initialTarget) {
          handleCompare(initialBase, initialTarget);
        } else if (initialBase && res.items.length > 1) {
          // If only base provided, suggest the latest or parent submission as target
          const other = res.items.find((s) => s.submission_id !== initialBase);
          if (other) setTargetId(other.submission_id);
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

  const diffLines = comparison?.diff ? comparison.diff.split('\n') : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Revision Comparison Engine</h1>
        <p className="text-sm text-slate-500 mt-1">
          Compute unified source diffs, added/removed line metrics, and evolutionary changes across code submissions.
        </p>
      </div>

      {/* Few submissions warning banner */}
      {!loadingSubs && submissions.length < 2 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
          <span>⚠️ At least two code submissions are required for revision comparison. Please upload revisions first or run the demo seeder.</span>
          <Link href="/submissions" className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md font-medium transition">
            Go to Submissions →
          </Link>
        </div>
      )}

      {/* Selectors Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Base Revision (Prior Version)
            </label>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              disabled={loadingSubs}
              className="w-full text-xs font-mono rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Select Base Revision --</option>
              {submissions.map((s) => (
                <option key={s.submission_id} value={s.submission_id}>
                  {s.original_filename} ({s.submission_id.slice(0, 8)}…) — {new Date(s.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Revision (Newer Version)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={loadingSubs}
              className="w-full text-xs font-mono rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            {baseId && targetId && (
              <span>Comparing <span className="font-mono font-semibold">{baseId.slice(0, 8)}</span> vs <span className="font-mono font-semibold">{targetId.slice(0, 8)}</span></span>
            )}
          </div>
          <button
            onClick={() => handleCompare()}
            disabled={comparing || !baseId || !targetId}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
          >
            {comparing ? 'Computing Diff…' : 'Compare Revisions'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-5 animate-fadeIn">
          {/* Summary metrics cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                +
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">Lines Added</div>
                <div className="text-xl font-bold text-emerald-600">+{comparison.summary.added_lines}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg">
                −
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">Lines Removed</div>
                <div className="text-xl font-bold text-rose-600">−{comparison.summary.removed_lines}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                Δ
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">Changed Files</div>
                <div className="text-xl font-bold text-indigo-600">{comparison.summary.changed_files}</div>
              </div>
            </div>
          </div>

          {/* Unified Diff Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <h3 className="text-xs font-semibold text-slate-800">Unified Revision Diff</h3>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Comparison ID: {comparison.comparison_id.slice(0, 8)}…
              </div>
            </div>

            <div className="p-4 bg-slate-950 font-mono text-xs overflow-auto max-h-[650px] leading-relaxed">
              {diffLines.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">No textual differences found between revisions.</div>
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
                        <tr key={idx} className={`${bgStyle} hover:bg-slate-800/60`}>
                          <td className="w-10 pr-3 text-right select-none text-slate-600 text-[11px] align-top">
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
