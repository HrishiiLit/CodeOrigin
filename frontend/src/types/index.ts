export type SubmissionStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type SubmissionType = 'file' | 'repository';

export interface FileTreeNode {
  path: string;
  name: string;
  size_bytes: number;
  extension: string;
  is_source: boolean;
  is_python?: boolean;
}

export interface RepositoryTreeResponse {
  is_directory: boolean;
  root_name: string;
  total_files: number;
  source_files_count: number;
  tree: FileTreeNode[];
  source_files: string[];
}

export interface Submission {
  submission_id: string;
  project_id: string;
  owner_id: string;
  parent_submission_id: string | null;
  original_filename: string;
  submission_type: SubmissionType;
  language: string;
  source_sha256: string;
  size_bytes: number;
  total_files: number;
  source_files_count: number;
  source_files: string[];
  status: SubmissionStatus;
  error_details: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionListResponse {
  total: number;
  items: Submission[];
}

export interface HealthResponse {
  status: 'healthy' | 'degraded';
  version: string;
  timestamp: string;
  services: {
    api: 'up' | 'down';
    database: 'up' | 'down';
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any;
    request_id: string;
  };
}

export interface GitHubIngestPayload {
  repo_url: string;
  ref?: string;
  project_id?: string;
  display_name?: string;
}

// Phase 3 — Static Analysis
export type FindingCategory = 'correctness' | 'maintainability' | 'complexity' | 'security' | 'style';
export type FindingSeverity = 'error' | 'warning' | 'info';

export interface Finding {
  finding_id: string;
  tool: string;
  rule_id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  message: string;
  file: string;
  line: number;
  column: number;
  end_line?: number | null;
  end_column?: number | null;
  suggestion?: string | null;
}

export interface AnalysisSummary {
  finding_count: number;
  error_count: number;
  warning_count: number;
  info_count: number;
}

export interface AnalysisRunResponse {
  analysis_id: string;
  submission_id: string;
  status: string;
  tool_versions: Record<string, string>;
  summary: AnalysisSummary;
  findings: Finding[];
  duration_ms: number;
  created_at: string;
}

// Phase 4 — Revision Comparison
export interface ComparisonSummary {
  added_lines: number;
  removed_lines: number;
  changed_files: number;
}

export interface ComparisonResponse {
  comparison_id: string;
  base_submission_id: string;
  target_submission_id: string;
  summary: ComparisonSummary;
  diff: string;
  created_at: string;
}

export interface ComparisonPayload {
  base_submission_id: string;
  target_submission_id: string;
}

// Phase 5 — Review and Reports
export interface Review {
  review_id: string;
  submission_id: string;
  author_id: string;
  notes: string;
  created_at: string;
}

export interface CreateReviewPayload {
  submission_id: string;
  notes: string;
  author_id?: string;
}

export interface ReviewReportResponse {
  report_id: string;
  submission_id: string;
  generated_at: string;
  submission_metadata: Record<string, any>;
  analysis_summary?: AnalysisSummary | null;
  findings_count: number;
  reviews: Review[];
  markdown_report: string;
}

// Authentication & Roles
export type UserRole = 'student' | 'faculty';

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  student_id?: string;
}

export interface LoginPayload {
  role: UserRole;
  username: string;
  password?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

// Phase 7 — GitHub Integration
export interface IssueDraftRequest {
  submission_id: string;
  finding_ids?: string[];
  repository_url?: string;
  custom_title?: string;
  custom_notes?: string;
}

export interface IssueDraftResponse {
  submission_id: string;
  repository: string;
  title: string;
  body: string;
  finding_count: number;
  selected_finding_ids: string[];
}

export interface CreateIssueRequest {
  submission_id: string;
  repository: string;
  title: string;
  body: string;
  confirmed: boolean;
  finding_ids?: string[];
}

export interface CreateIssueResponse {
  issue_id: number;
  issue_number: number;
  issue_url: string;
  title: string;
  repository: string;
  created_at: string;
  actor_id: string;
  status: string;
}


