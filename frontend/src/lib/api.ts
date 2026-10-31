import {
  ApiError,
  GitHubIngestPayload,
  HealthResponse,
  RepositoryTreeResponse,
  Submission,
  SubmissionListResponse,
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
  return handleResponse<HealthResponse>(res);
}

/** Upload a .py file or .zip/.tar.gz archive */
export async function uploadSubmission(formData: FormData): Promise<Submission> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<Submission>(res);
}

/** Ingest a public or private GitHub repository by URL */
export async function ingestFromGitHub(payload: GitHubIngestPayload): Promise<Submission> {
  const res = await fetch(`${API_BASE_URL}/api/v1/submissions/github`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
