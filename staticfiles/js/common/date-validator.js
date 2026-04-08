/**
 * Unified Date Validation System
 * Standardizes YYYY-MM date format validation across frontend
 * All database operations use YYYY-MM format (Year-Month) for monthly tracking
 * Matches backend date_validators.py exactly
 */

window.DateValidator = (function() {
    'use strict';

    // Standard date formats used throughout the system
    const DateFormatStandards = {
        // Primary format for database storage: YYYY-MM (Year-Month only)
        DATABASE_FORMAT: 'YYYY-MM',
        DATABASE_PATTERN: /^\d{4}-(0[1-9]|1[0-2])$/,
        
        // Input formats for user interfaces
        INPUT_FORMAT: 'YYYY-MM',
        
        // Validation constraints
        MIN_YEAR: 1970,
        MAX_YEAR: 9999,
        MIN_MONTH: 1,
        MAX_MONTH: 12,
        
        // Error messages (match backend exactly)
        INVALID_FORMAT_MSG: '日期格式錯誤，請使用YYYY-MM格式',
        INVALID_YEAR_MSG: `年份必須在1970-9999之間`,
        INVALID_MONTH_MSG: `月份必須在01-12之間`,
        EMPTY_DATE_MSG: '日期不能為空'
    };

    /**
     * Validate YYYY-MM date format (primary database format)
     * @param {string} dateStr - Date string to validate
     * @returns {Object} {isValid: boolean, errorMessage: string}
     */
    function validateYYYYMMFormat(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return { isValid: false, errorMessage: DateFormatStandards.EMPTY_DATE_MSG };
        }

        const trimmedDate = dateStr.trim();

        // Check basic format pattern
        if (!DateFormatStandards.DATABASE_PATTERN.test(trimmedDate)) {
            return { isValid: false, errorMessage: DateFormatStandards.INVALID_FORMAT_MSG };
        }

        try {
            // Parse and validate date components
            const [yearStr, monthStr] = trimmedDate.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);

            // Validate year range
            if (year < DateFormatStandards.MIN_YEAR || year > DateFormatStandards.MAX_YEAR) {
                return { isValid: false, errorMessage: DateFormatStandards.INVALID_YEAR_MSG };
            }

            // Validate month range
            if (month < DateFormatStandards.MIN_MONTH || month > DateFormatStandards.MAX_MONTH) {
                return { isValid: false, errorMessage: DateFormatStandards.INVALID_MONTH_MSG };
            }

            // Verify using Date object (create first day of month)
            const dateObj = new Date(year, month - 1, 1);
            if (isNaN(dateObj.getTime()) || 
                dateObj.getFullYear() !== year || 
                dateObj.getMonth() !== month - 1) {
                return { isValid: false, errorMessage: DateFormatStandards.INVALID_FORMAT_MSG };
            }

            return { isValid: true, errorMessage: '' };

        } catch (error) {
            console.debug(`Date validation error for '${trimmedDate}':`, error);
            return { isValid: false, errorMessage: DateFormatStandards.INVALID_FORMAT_MSG };
        }
    }

    /**
     * Normalize date string to standard YYYY-MM format
     * @param {string} dateStr - Input date string
     * @returns {string|null} Normalized YYYY-MM string or null if invalid
     */
    function normalizeYYYYMMDate(dateStr) {
        const validation = validateYYYYMMFormat(dateStr);
        if (!validation.isValid) {
            return null;
        }

        try {
            const [yearStr, monthStr] = dateStr.trim().split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            
            // Ensure consistent formatting (pad month with zero if needed)
            return `${year}-${month.toString().padStart(2, '0')}`;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get current date in YYYY-MM format
     * @returns {string} Current date as YYYY-MM string
     */
    function getCurrentYYYYMM() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }

    /**
     * Compare two YYYY-MM dates
     * @param {string} date1 - First date string
     * @param {string} date2 - Second date string
     * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2, 0 if either invalid
     */
    function compareYYYYMMDates(date1, date2) {
        try {
            const validation1 = validateYYYYMMFormat(date1);
            const validation2 = validateYYYYMMFormat(date2);

            if (!validation1.isValid || !validation2.isValid) {
                return 0;
            }

            const normalized1 = normalizeYYYYMMDate(date1);
            const normalized2 = normalizeYYYYMMDate(date2);

            if (normalized1 < normalized2) {
                return -1;
            } else if (normalized1 > normalized2) {
                return 1;
            } else {
                return 0;
            }
        } catch (error) {
            return 0;
        }
    }

    /**
     * Generate list of YYYY-MM dates between start and end (inclusive)
     * @param {string} startDate - Start date in YYYY-MM format
     * @param {string} endDate - End date in YYYY-MM format
     * @returns {string[]} Array of YYYY-MM date strings
     */
    function generateMonthRange(startDate, endDate) {
        try {
            const startValidation = validateYYYYMMFormat(startDate);
            const endValidation = validateYYYYMMFormat(endDate);

            if (!startValidation.isValid || !endValidation.isValid) {
                return [];
            }

            const [startYear, startMonth] = startDate.split('-').map(n => parseInt(n, 10));
            const [endYear, endMonth] = endDate.split('-').map(n => parseInt(n, 10));

            const startObj = new Date(startYear, startMonth - 1, 1);
            const endObj = new Date(endYear, endMonth - 1, 1);

            if (startObj > endObj) {
                return [];
            }

            const months = [];
            let currentYear = startYear;
            let currentMonth = startMonth;

            while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
                months.push(`${currentYear}-${currentMonth.toString().padStart(2, '0')}`);

                // Move to next month
                if (currentMonth === 12) {
                    currentYear++;
                    currentMonth = 1;
                } else {
                    currentMonth++;
                }
            }

            return months;

        } catch (error) {
            console.error('Error generating month range:', error);
            return [];
        }
    }

    /**
     * Legacy function compatibility (used by existing code)
     * @param {string} dateStr - Date string to validate
     * @param {string} format - Format string (defaults to YYYY-MM)
     * @returns {boolean} True if valid, False otherwise
     */
    function validateDateFormat(dateStr, format = 'YYYY-MM') {
        if (format === 'YYYY-MM' || format === '%Y-%m') {
            const validation = validateYYYYMMFormat(dateStr);
            return validation.isValid;
        }

        // For other formats, use basic validation
        if (!dateStr) {
            return false;
        }

        try {
            const patterns = {
                'YYYY-MM-DD': /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
                'MM-DD': /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
                'DD/MM/YYYY': /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/
            };

            const pattern = patterns[format];
            if (pattern) {
                return pattern.test(dateStr);
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Create standardized error response for date validation failures
     * @param {string} dateStr - The invalid date string
     * @returns {Object} Object with error details
     */
    function createDateValidationError(dateStr) {
        const validation = validateYYYYMMFormat(dateStr);

        return {
            success: false,
            error: validation.errorMessage,
            error_code: 'INVALID_DATE_FORMAT',
            details: {
                input_date: dateStr,
                expected_format: DateFormatStandards.INPUT_FORMAT,
                example: getCurrentYYYYMM()
            }
        };
    }

    /**
     * Format date input value for HTML month input
     * @param {string} dateStr - YYYY-MM date string
     * @returns {string} Formatted for HTML input or empty string if invalid
     */
    function formatForMonthInput(dateStr) {
        const normalized = normalizeYYYYMMDate(dateStr);
        return normalized || '';
    }

    /**
     * Parse HTML month input value to YYYY-MM format
     * @param {string} inputValue - Value from HTML month input
     * @returns {string|null} YYYY-MM string or null if invalid
     */
    function parseMonthInput(inputValue) {
        return normalizeYYYYMMDate(inputValue);
    }

    /**
     * Validate date range (start <= end)
     * @param {string} startDate - Start date in YYYY-MM format
     * @param {string} endDate - End date in YYYY-MM format
     * @returns {Object} {isValid: boolean, errorMessage: string}
     */
    function validateDateRange(startDate, endDate) {
        const startValidation = validateYYYYMMFormat(startDate);
        if (!startValidation.isValid) {
            return { isValid: false, errorMessage: `開始日期：${startValidation.errorMessage}` };
        }

        const endValidation = validateYYYYMMFormat(endDate);
        if (!endValidation.isValid) {
            return { isValid: false, errorMessage: `結束日期：${endValidation.errorMessage}` };
        }

        if (compareYYYYMMDates(startDate, endDate) > 0) {
            return { isValid: false, errorMessage: '開始日期不能晚於結束日期' };
        }

        return { isValid: true, errorMessage: '' };
    }

    // Public API
    return {
        // Core validation functions
        validateYYYYMM: validateYYYYMMFormat,
        normalize: normalizeYYYYMMDate,
        getCurrentYYYYMM,
        compare: compareYYYYMMDates,
        generateMonthRange,
        validateRange: validateDateRange,

        // Legacy compatibility
        validateDateFormat,

        // Helper functions
        createValidationError: createDateValidationError,
        formatForMonthInput,
        parseMonthInput,

        // Constants
        Standards: DateFormatStandards,

        // Quick validation functions
        isValid: function(dateStr) {
            return validateYYYYMMFormat(dateStr).isValid;
        },

        getErrorMessage: function(dateStr) {
            return validateYYYYMMFormat(dateStr).errorMessage;
        }
    };
})();