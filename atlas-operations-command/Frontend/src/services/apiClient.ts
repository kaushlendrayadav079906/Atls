import { config } from '../config';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

/**
 * Maps raw backend responses / HTTP status codes into secure, user-safe error messages.
 * Never exposes server stack traces, database schema details, or sensitive internals.
 */
export function getUserSafeErrorMessage(status: number, responseData?: any, fallbackMessage?: string): string {
  // Extract detail if provided by API
  let detail: any = null;
  if (responseData) {
    detail = responseData.detail || responseData.message;
  }

  // If detail is an array (e.g. FastAPI 422 validation errors)
  if (Array.isArray(detail)) {
    const errorStrings = detail
      .map((d: any) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join(' -> ') : '';
          const msg = d.msg || 'Invalid field';
          return loc ? `${loc}: ${msg}` : msg;
        }
        return 'Invalid input parameter';
      })
      .filter(Boolean);
    if (errorStrings.length > 0) {
      return errorStrings.join('; ');
    }
  }

  // If detail is a safe string and doesn't look like an internal stack trace or raw SQL error
  if (typeof detail === 'string' && detail.trim().length > 0) {
    const isSensitive =
      detail.includes('Traceback (most recent call last)') ||
      detail.includes('OperationalError') ||
      detail.includes('ProgrammingError') ||
      detail.includes('pymysql') ||
      detail.includes('sqlalchemy') ||
      detail.includes('SELECT ') ||
      detail.includes('INSERT INTO') ||
      detail.includes('password') ||
      detail.includes('secret');

    if (!isSensitive) {
      return detail;
    }
  }

  // Standard status code mapping
  switch (status) {
    case 0:
      return 'Unable to connect to the server. Please check your network connection.';
    case 400:
      return 'The request was invalid. Please check your submission.';
    case 401:
      return 'Your session has expired or you are not logged in. Please sign in again.';
    case 403:
      return 'Access forbidden. You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found or is unavailable.';
    case 409:
      return 'A conflict occurred with existing records. Please review your data.';
    case 413:
      return 'The uploaded file is too large. Please upload a smaller file.';
    case 415:
      return 'Unsupported media or file type. Please upload a supported format.';
    case 422:
      return 'Validation error. Please verify the submitted data format.';
    case 429:
      return 'Too many requests. Please slow down and try again in a few moments.';
    case 500:
      return 'An internal server error occurred. Please try again later.';
    case 502:
      return 'Bad gateway. The backend server is temporarily unavailable.';
    case 503:
      return 'Service temporarily unavailable. Please try again shortly.';
    case 504:
      return 'Gateway timeout. The server took too long to respond.';
    default:
      if (status >= 500) {
        return 'Server error. The service is currently unable to process your request.';
      }
      return fallbackMessage || `Request failed with status ${status}.`;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private getToken(): string | null {
    return localStorage.getItem('atlasops_token');
  }

  public setToken(token: string): void {
    localStorage.setItem('atlasops_token', token);
  }

  public clearToken(): void {
    localStorage.removeItem('atlasops_token');
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { requiresAuth = true, headers = {}, ...customConfig } = options;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(headers as Record<string, string>),
    };

    if (requiresAuth) {
      const token = this.getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...customConfig,
        headers: requestHeaders,
      });

      if (response.status === 401) {
        // Unauthenticated -> clear invalid token
        this.clearToken();
      }

      let responseData: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }
      } else {
        try {
          responseData = await response.text();
        } catch {
          responseData = null;
        }
      }

      if (!response.ok) {
        const errorMessage = getUserSafeErrorMessage(response.status, responseData);
        throw new ApiError(errorMessage, response.status, responseData);
      }

      return responseData as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      const safeMessage = getUserSafeErrorMessage(0, null, err.message);
      throw new ApiError(safeMessage, 0);
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public async postFormData<T>(endpoint: string, formData: FormData, options: RequestOptions = {}): Promise<T> {
    const { requiresAuth = true, headers = {}, ...customConfig } = options;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const requestHeaders: Record<string, string> = {
      ...(headers as Record<string, string>),
    };

    // Note: We deliberately do NOT set 'Content-Type': 'multipart/form-data' so the browser
    // automatically attaches the correct multipart boundary.

    if (requiresAuth) {
      const token = this.getToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...customConfig,
        method: 'POST',
        headers: requestHeaders,
        body: formData,
      });

      if (response.status === 401) {
        this.clearToken();
      }

      let responseData: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }
      } else {
        try {
          responseData = await response.text();
        } catch {
          responseData = null;
        }
      }

      if (!response.ok) {
        const errorMessage = getUserSafeErrorMessage(response.status, responseData);
        throw new ApiError(errorMessage, response.status, responseData);
      }

      return responseData as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      const safeMessage = getUserSafeErrorMessage(0, null, err.message);
      throw new ApiError(safeMessage, 0);
    }
  }

  public put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(config.apiBaseUrl);
