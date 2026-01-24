/**
 * Common Utility Functions
 * Static utility methods to eliminate duplicate code and hardcoded values
 */

class CommonUtils {
    // ============ String Processing Utils ============
    
    /**
     * Safe string formatting with placeholders
     * @param {string} template - Template string using {0}, {1}, {2} placeholders
     * @param {...any} args - Replacement arguments
     * @returns {string}
     */
    static formatString(template, ...args) {
        return template.replace(/\{(\d+)\}/g, (match, index) => {
            return args[index] !== undefined ? String(args[index]) : match;
        });
    }
    
    /**
     * Convert to safe HTML attribute value
     * @param {string} str 
     * @returns {string}
     */
    static toSafeAttribute(str) {
        if (!str) return '';
        return String(str)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    
    /**
     * Truncate long text and add ellipsis
     * @param {string} text 
     * @param {number} maxLength 
     * @returns {string}
     */
    static truncateText(text, maxLength = 50) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }
    
    /**
     * Check if string is empty
     * @param {string} str 
     * @returns {boolean}
     */
    static isEmpty(str) {
        return !str || str.trim().length === 0;
    }

    // ============ Number Processing Utils ============
    
    /**
     * Format number with thousand separators
     * @param {number} num 
     * @param {number} decimals 
     * @returns {string}
     */
    static formatNumber(num, decimals = 0) {
        if (isNaN(num)) return '0';
        const factor = Math.pow(10, decimals);
        const rounded = Math.round(num * factor) / factor;
        return rounded.toLocaleString('zh-TW', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }
    
    /**
     * Format number for display with fixed decimal places (legacy compatibility)
     * @param {number} num 
     * @returns {string}
     */
    static formatNumberFixed(num) {
        if (num === undefined || num === null) return '0';
        
        try {
            const rounded = Number(num).toFixed(2);
            // Remove trailing zeros after decimal point
            const cleaned = rounded.replace(/\.?0+$/, '');
            return cleaned === '' ? '0' : cleaned;
        } catch (e) {
            return '0';
        }
    }
    
    /**
     * Standardize value between different units
     * @param {string} fromUnit - Source unit
     * @param {number} value - Value to convert
     * @param {string} toUnit - Target unit
     * @returns {number} - Converted value
     */
    static standardizeValue(fromUnit, value, toUnit) {
        if (!value && value !== 0) return 0;
        if (fromUnit === toUnit) return value;
        if (fromUnit === 'metric_ton' && toUnit === 'kilogram') return value * 1000;
        if (fromUnit === 'kilogram' && toUnit === 'metric_ton') return value / 1000;
        return value; // Default: no conversion
    }
    
    /**
     * Format file size in human readable format
     * @param {number} bytes 
     * @returns {string}
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Format percentage
     * @param {number} value 
     * @param {number} total 
     * @param {number} decimals 
     * @returns {string}
     */
    static formatPercentage(value, total, decimals = 1) {
        if (total === 0) return '0%';
        const percentage = (value / total) * 100;
        return percentage.toFixed(decimals) + '%';
    }

    // ============ Date Time Utils ============
    
    /**
     * Format date with specified format
     * @param {Date|string} date 
     * @param {string} format - 'YYYY-MM-DD', 'YYYY-MM', 'MM-DD' etc
     * @returns {string}
     */
    static formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const second = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hour)
            .replace('mm', minute)
            .replace('ss', second);
    }
    
    /**
     * Get relative time description
     * @param {Date|string} date 
     * @returns {string}
     */
    static getRelativeTime(date) {
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minutes ago`;
        if (hours < 24) return `${hours} hours ago`;
        if (days < 7) return `${days} days ago`;
        
        return this.formatDate(date, 'YYYY-MM-DD');
    }

    // ============ Array Processing Utils ============
    
    /**
     * Safe array deduplication
     * @param {Array} arr 
     * @param {string} key - Key for deduplication in object arrays
     * @returns {Array}
     */
    static uniqueArray(arr, key = null) {
        if (!Array.isArray(arr)) return [];
        
        if (key) {
            const seen = new Set();
            return arr.filter(item => {
                const value = item[key];
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        }
        
        return [...new Set(arr)];
    }
    
    /**
     * Safe array sorting
     * @param {Array} arr 
     * @param {string} key 
     * @param {boolean} desc 
     * @returns {Array}
     */
    static sortArray(arr, key = null, desc = false) {
        if (!Array.isArray(arr)) return [];
        
        const sorted = [...arr].sort((a, b) => {
            let valA = key ? a[key] : a;
            let valB = key ? b[key] : b;
            
            // Handle numeric comparison
            if (typeof valA === 'string' && !isNaN(valA)) valA = Number(valA);
            if (typeof valB === 'string' && !isNaN(valB)) valB = Number(valB);
            
            if (valA < valB) return desc ? 1 : -1;
            if (valA > valB) return desc ? -1 : 1;
            return 0;
        });
        
        return sorted;
    }

    // ============ Object Processing Utils ============
    
    /**
     * Deep clone object
     * @param {any} obj 
     * @returns {any}
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        const cloned = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }
    
    /**
     * Safely get nested object property
     * @param {Object} obj 
     * @param {string} path - Path in 'a.b.c' format
     * @param {any} defaultValue 
     * @returns {any}
     */
    static get(obj, path, defaultValue = null) {
        if (!obj || !path) return defaultValue;
        
        const keys = path.split('.');
        let result = obj;
        
        for (let key of keys) {
            if (result === null || result === undefined || !(key in result)) {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result;
    }

    // ============ URL Processing Utils ============
    
    /**
     * Safe URL parameter parsing
     * @param {string} url 
     * @returns {Object}
     */
    static parseURLParams(url = window.location.href) {
        const params = {};
        const urlObj = new URL(url);
        
        for (const [key, value] of urlObj.searchParams) {
            params[key] = decodeURIComponent(value);
        }
        
        return params;
    }
    
    /**
     * Build URL parameter string
     * @param {Object} params 
     * @returns {string}
     */
    static buildURLParams(params) {
        if (!params || typeof params !== 'object') return '';
        
        const searchParams = new URLSearchParams();
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                searchParams.append(key, String(value));
            }
        });
        
        return searchParams.toString();
    }

    // ============ Validation Utils ============
    
    /**
     * Validate email format
     * @param {string} email 
     * @returns {boolean}
     */
    static isValidEmail(email) {
        if (!email) return false;
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    }
    
    /**
     * Validate Taiwan mobile phone number
     * @param {string} phone 
     * @returns {boolean}
     */
    static isValidTWPhone(phone) {
        if (!phone) return false;
        const pattern = /^09\d{8}$/;
        return pattern.test(phone.replace(/[\s-]/g, ''));
    }
    
    /**
     * Validate password strength
     * @param {string} password 
     * @returns {Object}
     */
    static validatePassword(password) {
        const result = {
            isValid: false,
            score: 0,
            issues: []
        };
        
        if (!password) {
            result.issues.push('Password cannot be empty');
            return result;
        }
        
        if (password.length < 8) result.issues.push('Password must be at least 8 characters');
        else result.score++;
        
        if (!/[a-z]/.test(password)) result.issues.push('Must contain lowercase letters');
        else result.score++;
        
        if (!/[A-Z]/.test(password)) result.issues.push('Must contain uppercase letters');
        else result.score++;
        
        if (!/\d/.test(password)) result.issues.push('Must contain numbers');
        else result.score++;
        
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) result.issues.push('Must contain special characters');
        else result.score++;
        
        result.isValid = result.issues.length === 0;
        return result;
    }

    // ============ Debounce and Throttle Utils ============
    
    /**
     * Debounce function
     * @param {Function} func 
     * @param {number} delay 
     * @returns {Function}
     */
    static debounce(func, delay = 300) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    /**
     * Throttle function
     * @param {Function} func 
     * @param {number} limit 
     * @returns {Function}
     */
    static throttle(func, limit = 300) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ============ Localization Utils ============
    
    /**
     * Get localized text
     * @param {string} key 
     * @param {...any} args 
     * @returns {string}
     */
    static t(key, ...args) {
        // Connect to actual multi-language system here
        const translations = {
            'common.confirm': '確認',
            'common.cancel': '取消',
            'common.save': '保存',
            'common.delete': '刪除',
            'common.edit': '編輯',
            'common.add': '新增',
            'common.search': '搜尋',
            'common.loading': '載入中...',
            'common.error': '發生錯誤',
            'common.success': '操作成功',
            'error.network': '網路錯誤，請檢查連線',
            'error.server': '伺服器錯誤，請稍後再試',
            'error.validation': '輸入格式不正確'
        };
        
        const text = translations[key] || key;
        return args.length > 0 ? this.formatString(text, ...args) : text;
    }

    // ============ Random Utils ============
    
    /**
     * Generate random ID
     * @param {number} length 
     * @returns {string}
     */
    static generateId(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    /**
     * Generate UUID v4
     * @returns {string}
     */
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // ============ Common Dialog Replacements ============
    
    /**
     * Safe alert replacement
     * @param {string} message 
     * @param {string} type 
     */
    static showAlert(message, type = 'info') {
        if (window.NotificationUtils) {
            window.NotificationUtils.showAlert('提示', message, type);
        } else {
            // Fallback to native alert if NotificationUtils not available
            alert(message);
        }
    }
    
    /**
     * Safe confirm replacement
     * @param {string} message 
     * @param {Function} callback 
     */
    static showConfirm(message, callback) {
        if (window.NotificationUtils) {
            window.NotificationUtils.showConfirm('確認', message, callback);
        } else {
            // Fallback to native confirm if NotificationUtils not available
            if (confirm(message)) {
                callback();
            }
        }
    }
    
    /**
     * Safe prompt replacement
     * @param {string} message 
     * @param {string} defaultValue 
     * @param {Function} callback 
     */
    static showPrompt(message, defaultValue = '', callback) {
        if (window.ModalUtils) {
            const modal = window.ModalUtils.createInputModal('輸入', message, defaultValue, callback);
            window.ModalUtils.showModal(modal);
        } else {
            // Fallback to native prompt if ModalUtils not available
            const result = prompt(message, defaultValue);
            if (result !== null) {
                callback(result);
            }
        }
    }

    // ============ Loading State Helpers ============
    
    /**
     * Show loading on element
     * @param {HTMLElement} element 
     * @param {string} message 
     * @returns {string} loader ID
     */
    static showLoading(element, message = 'Loading...') {
        if (window.LoadingUtils) {
            return window.LoadingUtils.showElementLoading(element, message);
        }
        return null;
    }
    
    /**
     * Hide loading from element
     * @param {string} loaderId 
     */
    static hideLoading(loaderId) {
        if (window.LoadingUtils && loaderId) {
            window.LoadingUtils.hideElementLoading(loaderId);
        }
    }
}

// Export utility class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CommonUtils };
} else {
    window.CommonUtils = CommonUtils;
}