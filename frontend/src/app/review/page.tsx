'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { listSubmissions, createReview, listReviews, getSubmissionReport } from '@/lib/api';
import { Submission, Review, ReviewReportResponse } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';

import { useAuth } from '@/context/AuthContext';
import { BookOpen, ShieldAlert, Repeat } from 'lucide-react';

export default function ReviewPage() {
  const { user, role, switchRole } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [authorId, setAuthorId] = useState<string>(user?.name || 'Prof. Marcus Vance');
  const [report, setReport] = useState<ReviewReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name) {
      setAuthorId(user.name);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const res = await listSubmissions({ limit: 50 });
        setSubmissions(res.items);
        if (res.items.length > 0) {
          setSelectedSubId(res.items[0].submission_id);
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedSubId) return;
    setReport(null);
    setStatusMsg(null);
    (async () => {
      try {
        const revs = await listReviews(selectedSubId);
        setReviews(revs);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedSubId]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId || !reviewNote.trim()) return;

    setSubmitting(true);
    setStatusMsg(null);
    try {
      const created = await createReview({
        submission_id: selectedSubId,
        notes: reviewNote,
        author_id: authorId || 'demo-faculty',
      });
      setReviews((prev) => [created, ...prev]);
      setReviewNote('');
      setStatusMsg('✓ Review note successfully saved.');
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedSubId) return;
    setGeneratingReport(true);
    try {
      const rep = await getSubmissionReport(selectedSubId);
      setReport(rep);
    } catch (err: any) {
      setStatusMsg(`Report generation error: ${err.message}`);
    } finally {
      setGeneratingReport(false);
    }
  };

  const selectedSub = submissions.find((s) => s.submission_id === selectedSubId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Faculty Review & Reporting Hub</h1>
        <p className="text-sm text-slate-500 mt-1">
          Inspect student code submissions, attach qualitative evaluation feedback, and generate formal review reports.
        </p>
      </div>

      {/* Student notice banner */}
      {role === 'student' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              You are currently signed in as <strong>{user?.name || 'Student'}</strong> (Student mode). Faculty reviews and formal evaluations are submitted by instructors.
            </span>
          </div>
          <button
            type="button"
            onClick={() => switchRole('faculty')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition shrink-0"
          >
            <Repeat className="w-3.5 h-3.5" />
            Switch to Faculty Mode
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left column: Submissions list */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Submissions ({submissions.length})
          </h2>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No submissions found.</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {submissions.map((sub) => {
                const isSelected = sub.submission_id === selectedSubId;
                return (
                  <button
                    key={sub.submission_id}
                    onClick={() => setSelectedSubId(sub.submission_id)}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 truncate">
                      {sub.original_filename}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span className="font-mono">{sub.submission_id.slice(0, 8)}…</span>
                      <StatusBadge status={sub.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Selected submission review panel */}
        <div className="space-y-5">
          {selectedSub ? (
            <>
              {/* Submission Header Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">{selectedSub.submission_id}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {selectedSub.original_filename}
                    <StatusBadge status={selectedSub.status} />
                  </h2>
                  <div className="text-xs text-slate-500 mt-1">
                    Submitted by <span className="font-semibold">{selectedSub.owner_id}</span> ·{' '}
                    {new Date(selectedSub.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/submissions/${selectedSub.submission_id}`}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition"
                  >
                    View Code & AST →
                  </Link>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                  >
                    {generatingReport ? 'Generating Report…' : 'Generate Full Report'}
                  </button>
                </div>
              </div>

              {statusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs">
                  {statusMsg}
                </div>
              )}

              {/* Add Review Note Form */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Add Faculty Feedback Note</h3>
                <form onSubmit={handleAddReview} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Faculty / Reviewer Identifier
                    </label>
                    <input
                      type="text"
                      value={authorId}
                      onChange={(e) => setAuthorId(e.target.value)}
                      className="w-full sm:w-64 text-xs font-mono rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
                      Qualitative Feedback
                    </label>
                    <textarea
                      rows={3}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Enter constructive evaluation, structural guidance, or notes regarding findings..."
                      className="w-full text-xs rounded-lg border border-slate-300 p-3 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || !reviewNote.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                    >
                      {submitting ? 'Saving Note…' : 'Save Review Note'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Saved Review Notes History */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Review Notes History ({reviews.length})</h3>

                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No review notes recorded yet for this submission.</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((rev) => (
                      <div key={rev.review_id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span className="font-semibold text-indigo-700">👤 {rev.author_id}</span>
                          <span>{new Date(rev.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 whitespace-pre-wrap">{rev.notes}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Official Report Preview Modal/Card */}
              {report && (
                <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Formal Report</span>
                      <h3 className="text-sm font-bold text-slate-900">Review & Evolution Report ({report.report_id.slice(0, 8)}…)</h3>
                    </div>
                    <button
                      onClick={() => {
                        const blob = new Blob([report.markdown_report], { type: 'text/markdown;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `report_${selectedSub.original_filename}.md`;
                        a.click();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition shadow-sm"
                    >
                      Download .md Report
                    </button>
                  </div>

                  <div className="p-4 bg-slate-950 text-slate-200 font-mono text-xs rounded-lg max-h-[400px] overflow-auto whitespace-pre-wrap leading-relaxed">
                    {report.markdown_report}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
              Select a submission from the list on the left to inspect and review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
