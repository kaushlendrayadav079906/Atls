import axios from 'axios';

/**
 * Pydantic validation error structure
 */
interface ValidationError {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

/**
 * User-friendly error messages for common scenarios
 */
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  // Network errors
  'network error': 'Unable to connect. Please check your internet connection',
  'timeout': 'Request is taking too long. Please try again',
  'econnaborted': 'Connection timeout. Please try again',
  
  // Authentication errors
  'session expired': 'Your session has expired. Please login again',
  'unauthorized': 'Please login to continue',
  'invalid credentials': 'Incorrect username or password',
  'invalid username or password': 'Incorrect username or password',
  'already exists': 'An account with this username or email already exists',
  'authentication': 'Please login to continue',
  
  // Resource errors
  'not found': 'Item not found',
  
  // SAP/Backend errors
  'sap service': 'System temporarily unavailable. Please try again',
  'service unavailable': 'Service temporarily unavailable. Please try again',
  'bad gateway': 'Service temporarily unavailable. Please try again',
  
  // Stock errors
  'out of stock': 'This item is currently out of stock',
  'insufficient stock': 'Not enough items in stock',
  'no stock': 'Stock unavailable',
  
  // Payment errors
  'payment failed': 'Payment could not be processed. Please try again',
  'insufficient payment': 'Payment amount is insufficient',
  
  // General errors
  'failed to fetch': 'Unable to load data. Please refresh',
};

/**
 * Parses Pydantic validation errors and returns user-friendly message
 */
const parseValidationErrors = (errors: unknown): string | null => {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  
  try {
    const validationErrors = errors as ValidationError[];
    const messages: string[] = [];
    
    for (const err of validationErrors) {
      const field = err.loc?.join('.').toLowerCase() || '';
      const message = err.msg?.toLowerCase() || '';
      const errorType = err.type?.toLowerCase() || '';
      
      // Stock/Quantity related errors
      if (field.includes('stock') || field.includes('quantity')) {
        if (message.includes('greater than') || errorType === 'greater_than') {
          return 'Item is out of stock or insufficient quantity available';
        }
        if (message.includes('required') || errorType === 'missing') {
          return 'Quantity information is missing';
        }
        return 'Invalid stock or quantity value';
      }
      
      // Total/Price related errors
      if (field.includes('total') || field.includes('price') || field.includes('amount')) {
        if (message.includes('greater than') || errorType === 'greater_than') {
          return 'Transaction amount must be greater than zero';
        }
        if (message.includes('required') || errorType === 'missing') {
          return 'Amount information is missing';
        }
        return 'Invalid amount value';
      }
      
      // Item/Product related errors
      if (field.includes('item') || field.includes('product')) {
        if (message.includes('empty') || message.includes('min_length')) {
          return 'Please add items to your cart';
        }
        if (message.includes('required') || errorType === 'missing') {
          return 'Product information is missing';
        }
        return 'Invalid product data';
      }
      
      // Payment related errors
      if (field.includes('payment')) {
        if (message.includes('required') || errorType === 'missing') {
          return 'Payment method is required';
        }
        return 'Invalid payment information';
      }
      
      // Collect generic validation messages
      if (err.msg) {
        messages.push(err.msg);
      }
    }
    
    // If we collected messages but no specific match, return first message
    if (messages.length > 0) {
      return messages[0];
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Safely converts any error type to a string for analysis
 */
const extractErrorString = (error: unknown): string => {
  // Handle null/undefined
  if (error == null) {
    return 'unknown error';
  }

  // Handle arrays - join them or get first meaningful item
  if (Array.isArray(error)) {
    if (error.length === 0) return 'unknown error';
    
    // Try to extract meaningful strings from array
    const messages = error
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'message' in item) return String(item.message);
        if (item && typeof item === 'object' && 'detail' in item) return String(item.detail);
        return JSON.stringify(item);
      })
      .filter(Boolean);
    
    return messages.join('; ') || 'multiple errors occurred';
  }

  // Handle Axios errors
  if (axios.isAxiosError(error)) {
    const response = error.response;
    
    // Handle 422 Validation Errors (Pydantic)
    if (response?.status === 422 && response?.data?.detail) {
      if (Array.isArray(response.data.detail)) {
        // Parse Pydantic validation errors
        const validationMsg = parseValidationErrors(response.data.detail);
        if (validationMsg) return validationMsg;
        
        // Fallback: try to extract messages from the array
        const messages = response.data.detail
          .map((err: { msg?: string; message?: string }) => err.msg || err.message)
          .filter(Boolean);
        if (messages.length > 0) {
          return messages.join(', ');
        }
      }
      // If detail is a string
      if (typeof response.data.detail === 'string') {
        return response.data.detail;
      }
    }
    
    // Try to extract error from response data
    if (response?.data) {
      if (typeof response.data === 'string') return response.data;
      if (response.data.detail && typeof response.data.detail === 'string') {
        return response.data.detail;
      }
      if (response.data.message) return String(response.data.message);
      if (response.data.error) return String(response.data.error);
    }
    
    // Try status-based messages
    if (response?.status) {
      const status = response.status;
      if (status === 401) return 'unauthorized';
      if (status === 403) return 'forbidden';
      if (status === 404) return 'not found';
      if (status === 422) return 'validation error';
      if (status === 500) return 'server error';
      if (status === 502) return 'bad gateway';
      if (status === 503) return 'service unavailable';
    }
    
    // Fallback to axios error message
    return error.message || 'network error';
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle objects with message/detail properties
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    
    if ('message' in obj && typeof obj.message === 'string') {
      return obj.message;
    }
    if ('detail' in obj && typeof obj.detail === 'string') {
      return obj.detail;
    }
    if ('error' in obj && typeof obj.error === 'string') {
      return obj.error;
    }
    
    // Try to stringify if it's a simple object
    try {
      const str = JSON.stringify(error);
      // Avoid returning useless strings like "{}" or "[object Object]"
      if (str && str !== '{}' && str !== 'null' && str.length < 200) {
        return str;
      }
    } catch {
      // JSON.stringify failed, continue
    }
  }

  // Handle primitive types
  if (typeof error === 'string') {
    return error;
  }

  // Last resort
  return String(error);
};

/**
 * Gets a user-friendly error message
 * @param error - The error object, message, array, or any unknown type
 * @param context - Optional context for logging (e.g., 'Login', 'Product Fetch')
 * @returns User-friendly error message suitable for display to users
 */
export const handleError = (error: unknown, context?: string): string => {
  try {
    void context;
    // Special handling for Axios errors with validation errors (422)
    if (axios.isAxiosError(error) && error.response?.status === 422) {
      const validationErrors = error.response?.data?.detail;
      if (Array.isArray(validationErrors)) {
        const userMsg = parseValidationErrors(validationErrors);

        if (userMsg) return userMsg;
      }
    }
    
    // Extract a string representation for analysis
    const errorString = extractErrorString(error);
    const lowerErrorString = errorString.toLowerCase();
    
    // Find a user-friendly message based on keywords
    for (const [keyword, friendlyMessage] of Object.entries(USER_FRIENDLY_MESSAGES)) {
      if (lowerErrorString.includes(keyword)) {
        return friendlyMessage;
      }
    }
    
    // Check for common patterns that weren't caught
    if (lowerErrorString.includes('401') || lowerErrorString.includes('auth')) {
      return 'Your session has expired. Please login again';
    }
    if (lowerErrorString.includes('403')) {
      return "You don't have permission to perform this action";
    }
    if (lowerErrorString.includes('404')) {
      return 'The requested item could not be found';
    }
    if (lowerErrorString.includes('422')) {
      return 'Please check your input and try again';
    }
    if (lowerErrorString.includes('500')) {
      return 'Something went wrong. Please try again';
    }
    if (lowerErrorString.includes('502') || lowerErrorString.includes('503')) {
      return 'Service temporarily unavailable. Please try again';
    }
    
    // Default fallback message
    return 'Something went wrong. Please try again';
    
  } catch (e) {
    void e;
    void error;
    return 'Something went wrong. Please try again';
  }
};

/**
 * Handles success callback
 * @param message - Success message
 * @param context - Optional context for logging
 */
export const handleSuccess = (message: string, context?: string): void => {
  void message;
  void context;
};
