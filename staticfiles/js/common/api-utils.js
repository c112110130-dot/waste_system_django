/**
 * API Utilities - Standardized error handling and API communication
 * Provides consistent patterns for all frontend-backend API interactions
 */

window.APIUtils = (function() {
    'use strict';

    // Use centralized configuration
    const DEFAULT_TIMEOUT = window.AppConfig ? window.AppConfig.get('api.DEFAULT_TIMEOUT', 30000) : 30000;
    const DEFAULT_RETRY_ATTEMPTS = 3;
    const RETRY_DELAY = 1000; // Base delay in ms
    const CIRCUIT_BREAKER_THRESHOLD = 5; // Number of failures before opening circuit
    const CIRCUIT_BREAKER_TIMEOUT = 60000; // Time to wait before trying again (ms)
    
    const ERROR_MESSAGES = window.AppConfig ? window.AppConfig.MESSAGES.ERROR : {
        NETWORK: '網路連接失敗，請檢查網路狀態',
        TIMEOUT: '請求超時，請稍後再試', 
        SERVER_ERROR: '伺服器錯誤，請稍後再試',
        UNAUTHORIZED: '身份驗證失敗，請重新登入',
        FORBIDDEN: '權限不足，無法執行此操作',
        NOT_FOUND: '請求的資源不存在',
        VALIDATION_ERROR: '資料驗證失敗',
        GENERIC: '操作失敗，請稍後再試',
        CIRCUIT_BREAKER: '服務暫時不可用，請稍後再試',
        RETRY_EXHAUSTED: '重試次數已達上限，請稍後再試'
    };

    // Circuit breaker state management
    const circuitBreaker = {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failureCount: 0,
        lastFailureTime: null,
        isRequestAllowed() {
            if (this.state === 'CLOSED') return true;
            if (this.state === 'OPEN') {
                if (Date.now() - this.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
                    this.state = 'HALF_OPEN';
                    return true;
                }
                return false;
            }
            if (this.state === 'HALF_OPEN') return true;
            return false;
        },
        recordSuccess() {
            this.failureCount = 0;
            this.state = 'CLOSED';
        },
        recordFailure() {
            this.failureCount++;
            this.lastFailureTime = Date.now();
            if (this.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
                this.state = 'OPEN';
            }
        }
    };

    // Request cache for deduplication
    const requestCache = new Map();
    const CACHE_TTL = 5000; // 5 seconds

    /**
     * Standard API response format checker
     */
    function validateResponse(data) {
        if (typeof data !== 'object' || data === null) {
            return false;
        }
        
        // Check for standard response structure
        return 'success' in data || 'status' in data || 'error' in data;
    }

    /**
     * Extract error message from response
     */
    function extractErrorMessage(data, defaultMessage = ERROR_MESSAGES.GENERIC) {
        if (!data) return defaultMessage;
        
        // Try different error message fields
        if (data.error) return data.error;
        if (data.message) return data.message;
        if (data.detail) return data.detail;
        if (data.msg) return data.msg;
        
        return defaultMessage;
    }

    /**
     * Create timeout promise
     */
    function createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), ms);
        });
    }

    /**
     * Sleep utility for retry delays
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate cache key for request deduplication
     */
    function getCacheKey(url, options) {
        return `${options.method || 'GET'}-${url}-${JSON.stringify(options.body || {})}`;
    }

    /**
     * Exponential backoff calculation
     */
    function calculateBackoffDelay(attempt, baseDelay = RETRY_DELAY) {
        // Exponential backoff with jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, 10000); // Cap at 10 seconds
    }

    /**
     * Check if error is retryable
     */
    function isRetryableError(error, status) {
        // Retry on network errors, timeouts, and server errors (5xx)
        if (error.message === 'TIMEOUT') return true;
        if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
        if (status >= 500 && status < 600) return true;
        if (status === 429) return true; // Rate limited
        return false;
    }

    /**
     * Standardized fetch with timeout, retry, and circuit breaker
     */
    async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
        const fetchPromise = fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        try {
            const response = await Promise.race([fetchPromise, createTimeout(timeout)]);
            return response;
        } catch (error) {
            if (error.message === 'TIMEOUT') {
                throw new Error('TIMEOUT');
            }
            throw error;
        }
    }

    /**
     * Request with retry logic and circuit breaker
     */
    async function requestWithRetry(url, options = {}, retryOptions = {}) {
        const {
            maxRetries = DEFAULT_RETRY_ATTEMPTS,
            baseDelay = RETRY_DELAY,
            enableCircuitBreaker = true,
            enableCache = false
        } = retryOptions;

        // Check circuit breaker
        if (enableCircuitBreaker && !circuitBreaker.isRequestAllowed()) {
            throw new Error(ERROR_MESSAGES.CIRCUIT_BREAKER);
        }

        // Check request cache for GET requests
        if (enableCache && (!options.method || options.method === 'GET')) {
            const cacheKey = getCacheKey(url, options);
            const cached = requestCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                return cached.response;
            }
        }

        let lastError;
        let lastStatus;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add attempt number to headers for debugging
                const requestOptions = {
                    ...options,
                    headers: {
                        ...options.headers,
                        'X-Request-Attempt': attempt + 1
                    }
                };

                const response = await fetchWithTimeout(url, requestOptions);
                
                // Record success for circuit breaker
                if (enableCircuitBreaker) {
                    circuitBreaker.recordSuccess();
                }

                // Cache successful GET responses
                if (enableCache && (!options.method || options.method === 'GET') && response.ok) {
                    const cacheKey = getCacheKey(url, options);
                    requestCache.set(cacheKey, {
                        response: response.clone(),
                        timestamp: Date.now()
                    });
                }

                return response;

            } catch (error) {
                lastError = error;
                lastStatus = error.status;

                // Don't retry non-retryable errors
                if (!isRetryableError(error, lastStatus)) {
                    break;
                }

                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Calculate delay and wait
                const delay = calculateBackoffDelay(attempt, baseDelay);
                console.warn(`Request attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
                await sleep(delay);
            }
        }

        // Record failure for circuit breaker
        if (enableCircuitBreaker) {
            circuitBreaker.recordFailure();
        }

        // All retries exhausted
        if (lastError.message === 'TIMEOUT') {
            throw new Error('TIMEOUT');
        } else if (maxRetries > 0) {
            throw new Error('RETRY_EXHAUSTED');
        } else {
            throw lastError;
        }
    }

    /**
     * Standard API request handler with enhanced error handling
     */
    async function apiRequest(url, options = {}, requestOptions = {}) {
        const result = {
            success: false,
            data: null,
            error: null,
            status: null,
            retries: 0,
            responseTime: 0
        };

        const startTime = Date.now();

        try {
            const response = await requestWithRetry(url, options, requestOptions);
            result.status = response.status;
            result.responseTime = Date.now() - startTime;

            // Handle different HTTP status codes
            if (!response.ok) {
                let errorMessage;
                
                switch (response.status) {
                    case 400:
                        errorMessage = ERROR_MESSAGES.VALIDATION_ERROR;
                        break;
                    case 401:
                        errorMessage = ERROR_MESSAGES.UNAUTHORIZED;
                        break;
                    case 403:
                        errorMessage = ERROR_MESSAGES.FORBIDDEN;
                        break;
                    case 404:
                        errorMessage = ERROR_MESSAGES.NOT_FOUND;
                        break;
                    case 429:
                        errorMessage = 'Rate limit exceeded, please slow down requests';
                        break;
                    case 500:
                    case 502:
                    case 503:
                        errorMessage = ERROR_MESSAGES.SERVER_ERROR;
                        break;
                    default:
                        errorMessage = ERROR_MESSAGES.GENERIC;
                }

                // Try to get error message from response body
                try {
                    const errorData = await response.json();
                    errorMessage = extractErrorMessage(errorData, errorMessage);
                    
                    // Extract validation errors if present
                    if (errorData.validation_errors) {
                        result.validation_errors = errorData.validation_errors;
                    }
                    if (errorData.error_code) {
                        result.error_code = errorData.error_code;
                    }
                } catch (e) {
                    // Use default message if response body is not JSON
                }

                result.error = errorMessage;
                return result;
            }

            // Parse response data
            const data = await response.json();
            
            // Validate response format
            if (!validateResponse(data)) {
                console.warn('API response format validation failed:', data);
            }

            // Check for application-level errors
            if (data.success === false || data.status === 'error') {
                result.error = extractErrorMessage(data);
                result.data = data;  // Keep original data even when success=false (for conflict handling)
                if (data.validation_errors) {
                    result.validation_errors = data.validation_errors;
                }
                if (data.error_code) {
                    result.error_code = data.error_code;
                }
                return result;
            }

            result.success = true;
            result.data = data;
            return result;

        } catch (error) {
            result.responseTime = Date.now() - startTime;
            let errorMessage;

            if (error.message === 'TIMEOUT') {
                errorMessage = ERROR_MESSAGES.TIMEOUT;
            } else if (error.message === 'RETRY_EXHAUSTED') {
                errorMessage = ERROR_MESSAGES.RETRY_EXHAUSTED;
                result.retries = requestOptions.maxRetries || DEFAULT_RETRY_ATTEMPTS;
            } else if (error.message === ERROR_MESSAGES.CIRCUIT_BREAKER) {
                errorMessage = ERROR_MESSAGES.CIRCUIT_BREAKER;
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = ERROR_MESSAGES.NETWORK;
            } else {
                errorMessage = ERROR_MESSAGES.GENERIC;
                console.error('API request error:', error);
            }

            result.error = errorMessage;
            return result;
        }
    }

    /**
     * GET request helper
     */
    async function get(url, params = {}) {
        const urlObj = new URL(url, window.location.origin);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                urlObj.searchParams.append(key, params[key]);
            }
        });

        return await apiRequest(urlObj.toString(), {
            method: 'GET'
        });
    }

    /**
     * POST request helper
     */
    async function post(url, data = {}, csrfToken = null) {
        const options = {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {}
        };

        // Add CSRF token if provided
        if (csrfToken) {
            options.headers['X-CSRFToken'] = csrfToken;
        }

        return await apiRequest(url, options);
    }

    /**
     * PUT request helper
     */
    async function put(url, data = {}, csrfToken = null) {
        const options = {
            method: 'PUT', 
            body: JSON.stringify(data),
            headers: {}
        };

        if (csrfToken) {
            options.headers['X-CSRFToken'] = csrfToken;
        }

        return await apiRequest(url, options);
    }

    /**
     * DELETE request helper
     */
    async function del(url, data = {}, csrfToken = null) {
        const options = {
            method: 'DELETE',
            headers: {}
        };

        if (Object.keys(data).length > 0) {
            options.body = JSON.stringify(data);
        }

        if (csrfToken) {
            options.headers['X-CSRFToken'] = csrfToken;
        }

        return await apiRequest(url, options);
    }

    /**
     * Form data POST helper (for file uploads)
     */
    async function postFormData(url, formData, csrfToken = null) {
        const options = {
            method: 'POST',
            body: formData,
            headers: {}
        };

        // Don't set Content-Type for FormData - browser will set it with boundary
        if (csrfToken) {
            options.headers['X-CSRFToken'] = csrfToken;
        }

        return await apiRequest(url, options);
    }

    /**
     * Batch request helper - executes multiple requests concurrently
     */
    async function batchRequest(requests) {
        try {
            const results = await Promise.allSettled(
                requests.map(req => apiRequest(req.url, req.options))
            );

            return results.map((result, index) => ({
                success: result.status === 'fulfilled' && result.value.success,
                data: result.status === 'fulfilled' ? result.value.data : null,
                error: result.status === 'fulfilled' ? result.value.error : result.reason?.message,
                originalRequest: requests[index]
            }));
        } catch (error) {
            console.error('Batch request error:', error);
            throw error;
        }
    }

    /**
     * Error boundary for API operations
     */
    function withErrorBoundary(apiOperation, fallbackValue = null) {
        return async (...args) => {
            try {
                return await apiOperation(...args);
            } catch (error) {
                console.error('API operation error boundary:', error);
                
                // Show user-friendly error message
                if (window.ModalUtils) {
                    window.ModalUtils.showError(ERROR_MESSAGES.GENERIC);
                }
                
                return {
                    success: false,
                    data: fallbackValue,
                    error: ERROR_MESSAGES.GENERIC
                };
            }
        };
    }

    /**
     * Get CSRF token from various sources
     */
    function getCSRFToken() {
        // Try meta tag first
        const csrfMeta = document.querySelector('meta[name=csrf-token]');
        if (csrfMeta) {
            return csrfMeta.getAttribute('content');
        }

        // Try form input
        const token = document.querySelector('[name=csrfmiddlewaretoken]');
        if (token) {
            return token.value;
        }

        // Try cookies
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }

        return null;
    }

    /**
     * POST with auto-CSRF token
     */
    async function postWithCSRF(url, data = {}) {
        const csrfToken = getCSRFToken();
        return await post(url, data, csrfToken);
    }

    /**
     * PUT with auto-CSRF token
     */
    async function putWithCSRF(url, data = {}) {
        const csrfToken = getCSRFToken();
        return await put(url, data, csrfToken);
    }

    /**
     * DELETE with auto-CSRF token
     */
    async function deleteWithCSRF(url, data = {}) {
        const csrfToken = getCSRFToken();
        return await del(url, data, csrfToken);
    }

    /**
     * FormData POST with auto-CSRF token
     */
    async function postFormDataWithCSRF(url, formData) {
        const csrfToken = getCSRFToken();
        return await postFormData(url, formData, csrfToken);
    }

    /**
     * Clear request cache
     */
    function clearCache() {
        requestCache.clear();
    }

    /**
     * Get circuit breaker status
     */
    function getCircuitBreakerStatus() {
        return {
            state: circuitBreaker.state,
            failureCount: circuitBreaker.failureCount,
            lastFailureTime: circuitBreaker.lastFailureTime
        };
    }

    /**
     * Reset circuit breaker
     */
    function resetCircuitBreaker() {
        circuitBreaker.state = 'CLOSED';
        circuitBreaker.failureCount = 0;
        circuitBreaker.lastFailureTime = null;
    }

    // Public API
    return {
        // Core functions
        request: apiRequest,
        get: withErrorBoundary(get),
        post: withErrorBoundary(post),
        put: withErrorBoundary(put),
        delete: withErrorBoundary(del),
        postFormData: withErrorBoundary(postFormData),
        batchRequest: withErrorBoundary(batchRequest),
        
        // CSRF functions
        postWithCSRF: withErrorBoundary(postWithCSRF),
        putWithCSRF: withErrorBoundary(putWithCSRF),
        deleteWithCSRF: withErrorBoundary(deleteWithCSRF),
        postFormDataWithCSRF: withErrorBoundary(postFormDataWithCSRF),
        
        // Utility functions
        validateResponse,
        extractErrorMessage,
        getCSRFToken,
        clearCache,
        getCircuitBreakerStatus,
        resetCircuitBreaker,
        
        // Constants
        ERROR_MESSAGES,
        DEFAULT_TIMEOUT,
        DEFAULT_RETRY_ATTEMPTS,
        CIRCUIT_BREAKER_THRESHOLD,
        
        // Advanced features
        withErrorBoundary,
        requestWithRetry,
        
        // Raw functions (without error boundary) for custom error handling
        raw: {
            get,
            post,
            put,
            delete: del,
            postFormData,
            batchRequest,
            postWithCSRF,
            putWithCSRF,
            deleteWithCSRF,
            postFormDataWithCSRF
        }
    };
})();