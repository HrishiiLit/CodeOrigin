import {
  AnalysisRunResponse,
  ApiError,
  ComparisonPayload,
  ComparisonResponse,
  CreateReviewPayload,
  GitHubIngestPayload,
  HealthResponse,
  RepositoryTreeResponse,
  Review,
  ReviewReportResponse,
  Submission,
  SubmissionListResponse,
  AuthResponse,
  LoginPayload,
  UserProfile,
  IssueDraftRequest,
  IssueDraftResponse,
  CreateIssueRequest,
  CreateIssueResponse,
  AdminOverviewResponse,
  AuditEventItem,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiClientError extends Error {
  code: string;
  details?: any;
  requestId?: string;
  statusCode: number;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    details?: any,
    requestId?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: ApiError | null = null;
    try {
      errorData = await res.json();
    } catch {
      // Body not JSON
    }

    if (errorData?.error) {
      throw new ApiClientError(
        errorData.error.message,
        errorData.error.code,
        res.status,
        errorData.error.details,
        errorData.error.request_id
      );
    }

    throw new ApiClientError(
      `Request failed with status ${res.status}: ${res.statusText}`,
      'HTTP_ERROR',
      res.status
    );
  }

  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
  if (!res.ok && res.status === 503) {
    try {
      const data = await res.json();
      if (data && data.services) return data as HealthResponse;
    } catch {
      // fallback
    }
  }
  return handleResponse<HealthResponse>(res);
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('codeorigin_user');
    if (raw) {
      const u = JSON.parse(raw);
      return {
        'X-User-ID': u.user_id || 'student-alex',
        'X-User-Role': u.role || 'student',
      };
    }
  } catch {}
  return {};
}

/** Upload a .py file or .zip/.tar.gz archive */
export async function uploadSubmission(formData: FormData): Promise<Submission> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  return handleResponse<Submission>(res);
}

/** Ingest a public or private GitHub repository by URL */
export async function ingestFromGitHub(payload: GitHubIngestPayload): Promise<Submission> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/github`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<Submission>(res);
}

export async function listSubmissions(params?: {
  project_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<SubmissionListResponse> {
  const query = new URLSearchParams();
  if (params?.project_id) query.set('project_id', params.project_id);
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions${qs}`, { cache: 'no-store' });
  return handleResponse<SubmissionListResponse>(res);
}

export async function getSubmission(id: string): Promise<Submission> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${id}`, { cache: 'no-store' });
  return handleResponse<Submission>(res);
}

export async function getRepositoryTree(id: string): Promise<RepositoryTreeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${id}/tree`, { cache: 'no-store' });
  return handleResponse<RepositoryTreeResponse>(res);
}

export async function getSubmissionSource(id: string, filePath?: string): Promise<string> {
  const qs = filePath ? `?path=${encodeURIComponent(filePath)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${id}/source${qs}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new ApiClientError(`Failed to load source (${res.status})`, 'SOURCE_FETCH_ERROR', res.status);
  }
  return res.text();
}

/** Phase 3 — Static Analysis */
export async function runAnalysis(submissionId: string): Promise<AnalysisRunResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${submissionId}/analyze`, {
    method: 'POST',
  });
  return handleResponse<AnalysisRunResponse>(res);
}

export async function getAnalysis(submissionId: string): Promise<AnalysisRunResponse | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${submissionId}/analysis`, {
    cache: 'no-store',
  });
  if (res.status === 404) {
    return null;
  }
  return handleResponse<AnalysisRunResponse>(res);
}

/** Phase 4 — Revision Comparison */
export async function createComparison(payload: ComparisonPayload): Promise<ComparisonResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/comparisons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<ComparisonResponse>(res);
}

export async function getComparison(id: string): Promise<ComparisonResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/comparisons/${id}`, { cache: 'no-store' });
  return handleResponse<ComparisonResponse>(res);
}

/** Phase 5 — Faculty Review & Reporting */
export async function createReview(payload: CreateReviewPayload): Promise<Review> {
  const res = await fetch(`${API_BASE_URL}/api/v1/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Review>(res);
}

export async function listReviews(submissionId: string): Promise<Review[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${submissionId}/reviews`, {
    cache: 'no-store',
  });
  return handleResponse<Review[]>(res);
}

export async function getSubmissionReport(submissionId: string): Promise<ReviewReportResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${submissionId}/report`, {
    cache: 'no-store',
  });
  return handleResponse<ReviewReportResponse>(res);
}

/** File Download & Deletion */
export function getDownloadUrl(submissionId: string, path?: string): string {
  const qs = path ? `?path=${encodeURIComponent(path)}` : '';
  return `${API_BASE_URL}/api/v1/submissions/${submissionId}/download${qs}`;
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/${submissionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new ApiClientError(`Failed to delete submission (${res.status})`, 'DELETE_ERROR', res.status);
  }
}

/** Authentication & Roles */
export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}

export async function getDemoUsers(): Promise<UserProfile[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/demo-users`, {
    cache: 'no-store',
  });
  return handleResponse<UserProfile[]>(res);
}

/** GitHub Integration */
export async function prepareIssueDraft(payload: IssueDraftRequest): Promise<IssueDraftResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/integrations/github/issues/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<IssueDraftResponse>(res);
}

export async function createGitHubIssue(
  payload: CreateIssueRequest,
  actorId?: string
): Promise<CreateIssueResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (actorId) {
    headers['X-User-ID'] = actorId;
  }
  const res = await fetch(`${API_BASE_URL}/api/v1/integrations/github/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return handleResponse<CreateIssueResponse>(res);
}

/** Administration & System Governance */
export async function getAdminStats(role: string = 'admin'): Promise<AdminOverviewResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/stats`, {
    cache: 'no-store',
    headers: { 'X-User-Role': role },
  });
  return handleResponse<AdminOverviewResponse>(res);
}

export async function getAuditLogs(limit: number = 50): Promise<AuditEventItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/audit-logs?limit=${limit}`, {
    cache: 'no-store',
  });
  return handleResponse<AuditEventItem[]>(res);
}


