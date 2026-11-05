'use client';

import React, { useState } from 'react';
import { ReviewReportResponse, Finding } from '@/types';
import {
  FileText,
  Download,
  Copy,
  Printer,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldCheck,
  UserCheck,
  Code2,
  Calendar,
  Hash,
  GraduationCap,
  ExternalLink,
} from 'lucide-react';

interface FacultyReportViewerProps {
  report: ReviewReportResponse;
  submissionFilename: string;
}

export const FacultyReportViewer: React.FC<FacultyReportViewerProps> = ({
  report,
  submissionFilename,
}) => {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState(false);

  const meta = report.submission_metadata || {};
  const summary = report.analysis_summary;
  const findings: Finding[] = report.findings || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(report.markdown_report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([report.markdown_report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic_report_${submissionFilename.replace(/[/\\?%*:|"<>]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden transition-all print:border-none print:shadow-none">
      {/* Top Action Toolbar (Hidden in Print) */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Official Faculty Evaluation Report
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-medium">
                {report.report_id.slice(0, 8)}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Generated {new Date(report.generated_at).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="bg-slate-200/80 p-0.5 rounded-lg flex text-xs">
            <button
              onClick={() => setViewMode('formatted')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                viewMode === 'formatted'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Document View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                viewMode === 'raw'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw Markdown
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
            title="Copy Markdown"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
            title="Download Markdown file"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>.md</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Raw Markdown View */}
      {viewMode === 'raw' && (
        <div className="p-6 bg-slate-950 text-slate-200 font-mono text-xs max-h-[600px] overflow-auto whitespace-pre-wrap leading-relaxed select-all">
          {report.markdown_report}
        </div>
      )}

      {/* Formatted Document View */}
      {viewMode === 'formatted' && (
        <div className="p-6 sm:p-8 space-y-6 max-h-[750px] overflow-y-auto print:max-h-none print:overflow-visible bg-gradient-to-b from-white to-slate-50/50">
          
          {/* Document Letterhead */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold tracking-widest text-indigo-700 uppercase">
                CodeOrigin AI • Academic Code Review & Evaluation Board
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 mt-1 tracking-tight">
                Student Code Review & Evolution Report
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Automated multi-tool static analysis with qualitative faculty appraisal
              </p>
            </div>

            <div className="text-left sm:text-right text-[11px] text-slate-600 font-mono space-y-0.5 shrink-0 bg-slate-50 sm:bg-transparent p-2.5 sm:p-0 rounded-lg border sm:border-none border-slate-200">
              <div><strong className="text-slate-900">Report Ref:</strong> {report.report_id}</div>
              <div><strong className="text-slate-900">Date:</strong> {new Date(report.generated_at).toUTCString()}</div>
              <div><strong className="text-slate-900">Integrity Check:</strong> <span className="text-emerald-700 font-semibold">VERIFIED</span></div>
            </div>
          </div>

          {/* Section 1: Submission Details Grid */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              1. Submission Details & Provenance
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Filename / Target</span>
                <span className="font-semibold text-slate-900 text-sm truncate block mt-0.5">
                  {meta.original_filename || submissionFilename}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Student / Owner</span>
                <span className="font-semibold text-slate-900 text-sm block mt-0.5">
                  {meta.owner_id || 'student-alex'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 block">Submission Type</span>
                <span className="font-semibold text-indigo-700 uppercase tracking-wide text-xs block mt-1">
                  {meta.submission_type || 'file'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs sm:col-span-2 md:col-span-3">
                <span className="text-[11px] text-slate-500 block">Cryptographic SHA-256 Digest</span>
                <span className="font-mono text-[11px] text-slate-700 break-all block mt-0.5">
                  {meta.source_sha256 || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Static Analysis Performance Scorecard */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              2. Static Quality Scorecard
            </h4>

            {summary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Findings</span>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1">{summary.finding_count}</div>
                  <span className="text-[10px] text-slate-400">multi-tool total</span>
                </div>
                <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-200">
                  <span className="text-[11px] font-semibold text-rose-700 uppercase">Errors / Security</span>
                  <div className="text-2xl font-extrabold text-rose-700 mt-1">{summary.error_count}</div>
                  <span className="text-[10px] text-rose-500">critical issues</span>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200">
                  <span className="text-[11px] font-semibold text-amber-700 uppercase">Warnings</span>
                  <div className="text-2xl font-extrabold text-amber-700 mt-1">{summary.warning_count}</div>
                  <span className="text-[10px] text-amber-500">complexity / lint</span>
                </div>
                <div className="p-3 bg-sky-50/70 rounded-lg border border-sky-200">
                  <span className="text-[11px] font-semibold text-sky-700 uppercase">Informational</span>
                  <div className="text-2xl font-extrabold text-sky-700 mt-1">{summary.info_count}</div>
                  <span className="text-[10px] text-sky-500">style / advisory</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No static analysis executed yet.</p>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1">Evaluated By:</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono text-[11px]">Bandit (Security)</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono text-[11px]">Radon (CC Complexity)</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono text-[11px]">Ruff (Linter)</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono text-[11px]">AST Parser (Structural)</span>
            </div>
          </div>

          {/* Section 3: Diagnostic Findings Breakdown */}
          {findings.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  3. Diagnostic Findings & Suggestions ({findings.length})
                </span>
                <span className="text-[11px] text-slate-400 font-normal">Ranked by severity</span>
              </h4>

              <div className="space-y-2.5">
                {findings.map((f, idx) => {
                  const isError = f.severity === 'error';
                  const isWarning = f.severity === 'warning';
                  return (
                    <div
                      key={f.finding_id || idx}
                      className={`p-3.5 rounded-lg border text-xs transition ${
                        isError
                          ? 'bg-rose-50/40 border-rose-200'
                          : isWarning
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isError
                                ? 'bg-rose-600 text-white'
                                : isWarning
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-600 text-white'
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-mono font-bold text-slate-900">{f.rule_id}</span>
                          <span className="text-[11px] text-slate-400">via</span>
                          <span className="font-semibold text-slate-700 capitalize">{f.tool} ({f.category})</span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                          {f.file}:{f.line}
                        </div>
                      </div>

                      <p className="text-slate-800 font-medium mb-1">{f.message}</p>

                      {f.suggestion && (
                        <div className="mt-1.5 text-[11px] text-indigo-900 bg-indigo-50/80 p-2 rounded border border-indigo-100 flex items-start gap-1.5">
                          <strong className="shrink-0 text-indigo-700">Remediation:</strong>
                          <span>{f.suggestion}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Qualitative Faculty Review History */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600" />
              4. Qualitative Faculty Reviews ({report.reviews?.length || 0})
            </h4>

            {report.reviews && report.reviews.length > 0 ? (
              <div className="space-y-3">
                {report.reviews.map((rev) => (
                  <div
                    key={rev.review_id}
                    className="p-4 rounded-xl bg-purple-50/40 border border-purple-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-600 border-b border-purple-100 pb-2">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-purple-700" />
                        <span className="font-bold text-slate-900">{rev.author_id}</span>
                        <span className="text-[10px] bg-purple-200/70 text-purple-900 px-2 py-0.2 rounded-full font-medium">Faculty Examiner</span>
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(rev.created_at).toLocaleString()}</span>
                    </div>
                    <blockquote className="text-xs text-slate-800 italic leading-relaxed pl-1 whitespace-pre-wrap">
                      "{rev.notes}"
                    </blockquote>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No faculty review notes attached yet.</p>
            )}
          </div>

          {/* Section 5: Educational Advisory Disclaimer */}
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Info className="w-4 h-4 text-indigo-600" />
              Academic Advisory & Integrity Notice
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              This report is generated by CodeOrigin AI for educational code review and self-directed improvement.
              Static findings and complexity rankings are advisory indicators designed to guide maintainability and secure coding habits.
              They do not constitute automated grading decisions or accusations of misconduct.
            </p>
          </div>

          {/* Document Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
            <span>CodeOrigin AI Academic Platform • Version 1.0 (MVP)</span>
            <span>Page 1 of 1</span>
          </div>

        </div>
      )}
    </div>
  );
};
