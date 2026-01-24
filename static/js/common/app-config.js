/**
 * Centralized Application Configuration
 * Provides consistent configuration management across all modules
 */

window.AppConfig = (function() {
    'use strict';

    // API Configuration
    const API_CONFIG = {
        DEFAULT_TIMEOUT: 30000,
        BATCH_DELAY: 200,
        BATCH_SIZE: 50,
        MAX_CONCURRENT: 1,
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000
    };

    // Chart Configuration
    const CHART_CONFIG = {
        DEFAULT_HEIGHT: 600,
        COLORS: {
            primary: '#2563eb',
            secondary: '#7c3aed', 
            success: '#059669',
            warning: '#d97706',
            error: '#dc2626',
            info: '#0284c7'
        },
        THEME: {
            LIGHT: 'light',
            DARK: 'dark'
        },
        ANIMATION: {
            ENABLED: false,
            DURATION: 300
        }
    };

    // UI Configuration
    const UI_CONFIG = {
        MODAL_ANIMATION_DURATION: 200,
        NOTIFICATION_DURATION: 5000,
        LOADING_DELAY: 300,
        DEBOUNCE_DELAY: 500,
        PAGINATION: {
            DEFAULT_PAGE_SIZE: 20,
            MAX_PAGE_SIZE: 100
        }
    };

    // File Processing Configuration
    const FILE_CONFIG = {
        MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
        ALLOWED_TYPES: {
            CSV: ['.csv'],
            EXCEL: ['.xlsx', '.xls'],
            IMAGE: ['.png', '.jpg', '.jpeg', '.gif'],
            PDF: ['.pdf']
        },
        CHUNK_SIZE: 1024 * 1024 // 1MB chunks
    };

    // Date/Time Configuration
    const DATE_CONFIG = {
        TIMEZONE: 'Asia/Taipei',
        FORMAT: {
            DATE: 'YYYY-MM-DD',
            MONTH: 'YYYY-MM',
            DATETIME: 'YYYY-MM-DD HH:mm:ss',
            TIME: 'HH:mm:ss'
        },
        LOCALE: 'zh-TW'
    };

    // Validation Configuration
    const VALIDATION_CONFIG = {
        PASSWORD: {
            MIN_LENGTH: 8,
            MAX_LENGTH: 128,
            REQUIRE_UPPERCASE: true,
            REQUIRE_LOWERCASE: true,
            REQUIRE_NUMBERS: true,
            REQUIRE_SYMBOLS: false
        },
        INPUT: {
            MAX_TEXT_LENGTH: 255,
            MAX_TEXTAREA_LENGTH: 2000,
            MAX_NUMBER: 999999999.99,
            MIN_NUMBER: -999999999.99
        }
    };

    // Security Configuration
    const SECURITY_CONFIG = {
        SESSION_WARNING_TIME: 5 * 60 * 1000, // 5 minutes before expiry
        AUTO_LOGOUT_TIME: 30 * 60 * 1000,    // 30 minutes
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_DURATION: 15 * 60 * 1000,    // 15 minutes
        CSRF_HEADER: 'X-CSRFToken'
    };

    // 常用硬編碼字串常量
    const TEXT_CONSTANTS = {
        // 按鈕文字
        BUTTONS: {
            CONFIRM: '確認',
            CANCEL: '取消',
            SAVE: '保存',
            DELETE: '刪除',
            EDIT: '編輯',
            ADD: '新增',
            SEARCH: '搜尋',
            EXPORT: '匯出',
            IMPORT: '匯入',
            UPLOAD: '上傳',
            DOWNLOAD: '下載',
            REFRESH: '重新整理',
            RESET: '重設',
            SUBMIT: '送出',
            CLOSE: '關閉'
        },
        
        // 狀態文字
        STATUS: {
            LOADING: '載入中...',
            SAVING: '保存中...',
            PROCESSING: '處理中...',
            SUCCESS: '操作成功',
            ERROR: '發生錯誤',
            WARNING: '警告',
            INFO: '資訊',
            COMPLETED: '完成',
            PENDING: '等待中',
            FAILED: '失敗'
        },
        
        // 錯誤訊息
        ERRORS: {
            NETWORK: '網路錯誤，請檢查連線',
            SERVER: '伺服器錯誤，請稍後再試',
            VALIDATION: '輸入格式不正確',
            UNAUTHORIZED: '權限不足',
            NOT_FOUND: '找不到指定資料',
            FILE_TOO_LARGE: '檔案大小超過限制',
            INVALID_FILE_TYPE: '不支援的檔案格式',
            REQUIRED_FIELD: '此欄位為必填',
            INVALID_EMAIL: '電子郵件格式不正確',
            INVALID_PHONE: '手機號碼格式不正確',
            PASSWORD_TOO_WEAK: '密碼強度不足'
        },
        
        // 確認訊息
        CONFIRMATIONS: {
            DELETE: '確定要刪除此項目嗎？此操作無法復原。',
            SAVE: '確定要保存變更嗎？',
            DISCARD: '確定要放棄變更嗎？',
            LOGOUT: '確定要登出嗎？',
            RESET: '確定要重設資料嗎？此操作無法復原。',
            EXPORT: '確定要匯出資料嗎？',
            IMPORT: '確定要匯入資料嗎？這可能會覆蓋現有資料。'
        },
        
        // 表單標籤
        LABELS: {
            NAME: '名稱',
            EMAIL: '電子郵件',
            PHONE: '電話',
            ADDRESS: '地址',
            DATE: '日期',
            TIME: '時間',
            DESCRIPTION: '描述',
            NOTES: '備註',
            STATUS: '狀態',
            TYPE: '類型',
            CATEGORY: '類別',
            AMOUNT: '數量',
            PRICE: '價格',
            TOTAL: '總計'
        },
        
        // 單位
        UNITS: {
            KG: '公斤',
            TONS: '公噸',
            PIECES: '件',
            BOXES: '箱',
            NTD: '新台幣',
            PERCENT: '%',
            DAYS: '天',
            HOURS: '小時',
            MINUTES: '分鐘'
        }
    };

    // CSS 類別名稱常量
    const CSS_CLASSES = {
        // 按鈕樣式
        BUTTON: {
            PRIMARY: 'ts-button is-primary',
            SECONDARY: 'ts-button is-secondary',
            SUCCESS: 'ts-button is-positive',
            WARNING: 'ts-button is-warning', 
            DANGER: 'ts-button is-negative',
            INFO: 'ts-button is-info',
            FLUID: 'ts-button is-fluid',
            LOADING: 'ts-button is-loading'
        },
        
        // 表單樣式
        INPUT: {
            DEFAULT: 'ts-input',
            FLUID: 'ts-input is-fluid',
            ERROR: 'ts-input is-negative',
            SUCCESS: 'ts-input is-positive'
        },
        
        // 模態框樣式
        MODAL: {
            DEFAULT: 'ts-modal',
            VISIBLE: 'ts-modal is-visible',
            SMALL: 'ts-modal is-small',
            LARGE: 'ts-modal is-large'
        },
        
        // 通知樣式
        NOTIFICATION: {
            SUCCESS: 'ts-snackbar is-positive',
            ERROR: 'ts-snackbar is-negative',
            WARNING: 'ts-snackbar is-warning',
            INFO: 'ts-snackbar is-info'
        },
        
        // 載入樣式
        LOADING: {
            SPINNER: 'ts-spinner',
            OVERLAY: 'loading-overlay',
            SKELETON: 'skeleton-loading'
        }
    };

    // URL 路徑常量
    const URL_PATHS = {
        API: {
            BASE: '/api/',
            TIME: '/api/time/',
            CHART_DATA: '/api/extended-chart-data/',
            ACCOUNT: '/account/api/',
            MANAGEMENT: '/management/api/',
            TRANSPORTATION: '/transportation/api/',
            PREDICTION: '/prediction/api/'
        },
        STATIC: {
            JS: '/static/js/',
            CSS: '/static/css/',
            IMG: '/static/img/',
            FONTS: '/static/fonts/'
        }
    };

    // 廢棄物相關常量
    const WASTE_CONSTANTS = {
        TYPES: {
            GENERAL: '一般廢棄物',
            BIOMEDICAL: '生物醫療廢棄物', 
            PHARMACEUTICAL: '藥物廢棄物',
            CHEMICAL: '化學廢棄物',
            RADIOACTIVE: '放射性廢棄物'
        },
        
        REGIONS: {
            TAINAN: '台南',
            RENWU: '仁武'
        },
        
        UNITS: {
            KG: 'kg',
            TON: 'ton',
            PIECE: 'pcs'
        },
        
        COLORS: {
            RED_BAG: '#dc2626',      // 紅袋
            YELLOW_BAG: '#eab308',   // 黃袋  
            GENERAL: '#6b7280',      // 一般廢棄物
            RECYCLABLE: '#059669'    // 可回收
        }
    };

    // Error Messages
    const ERROR_MESSAGES = {
        NETWORK: '網路連接失敗，請檢查網路狀態',
        TIMEOUT: '請求超時，請稍後再試',
        SERVER_ERROR: '伺服器錯誤，請稍後再試',
        UNAUTHORIZED: '身份驗證失敗，請重新登入',
        FORBIDDEN: '權限不足，無法執行此操作',
        NOT_FOUND: '請求的資源不存在',
        VALIDATION_ERROR: '資料驗證失敗',
        FILE_TOO_LARGE: '檔案大小超過限制',
        INVALID_FILE_TYPE: '不支援的檔案類型',
        GENERIC: '操作失敗，請稍後再試'
    };

    // Success Messages
    const SUCCESS_MESSAGES = {
        SAVE: '資料儲存成功',
        UPDATE: '資料更新成功',
        DELETE: '資料刪除成功',
        UPLOAD: '檔案上傳成功',
        EXPORT: '資料匯出成功',
        IMPORT: '資料匯入成功',
        LOGIN: '登入成功',
        LOGOUT: '登出成功'
    };

    // Environment Detection
    function getEnvironment() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        } else {
            return 'production';
        }
    }

    // Feature Flags
    const FEATURE_FLAGS = {
        DEBUG_MODE: getEnvironment() === 'development',
        ANALYTICS_ENABLED: getEnvironment() === 'production',
        BETA_FEATURES: getEnvironment() !== 'production',
        PERFORMANCE_MONITORING: true,
        ERROR_TRACKING: getEnvironment() === 'production'
    };

    // Dynamic Configuration (can be updated at runtime)
    let dynamicConfig = {
        theme: localStorage.getItem('app-theme') || 'light',
        language: localStorage.getItem('app-language') || 'zh-TW',
        notifications: JSON.parse(localStorage.getItem('app-notifications') || 'true'),
        autoSave: JSON.parse(localStorage.getItem('app-autosave') || 'true')
    };

    /**
     * Get configuration value by path
     * @param {string} path - Dot notation path (e.g., 'api.timeout')
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} Configuration value
     */
    function get(path, defaultValue = null) {
        const parts = path.split('.');
        let current = {
            api: API_CONFIG,
            chart: CHART_CONFIG,
            ui: UI_CONFIG,
            file: FILE_CONFIG,
            date: DATE_CONFIG,
            validation: VALIDATION_CONFIG,
            security: SECURITY_CONFIG,
            messages: {
                error: ERROR_MESSAGES,
                success: SUCCESS_MESSAGES
            },
            features: FEATURE_FLAGS,
            dynamic: dynamicConfig
        };

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Set dynamic configuration value
     * @param {string} path - Dot notation path
     * @param {*} value - Value to set
     */
    function set(path, value) {
        if (!path.startsWith('dynamic.')) {
            console.warn('Can only set dynamic configuration values');
            return false;
        }

        const parts = path.replace('dynamic.', '').split('.');
        let current = dynamicConfig;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) {
                current[part] = {};
            }
            current = current[part];
        }

        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;

        // Persist to localStorage
        localStorage.setItem(`app-${lastPart}`, JSON.stringify(value));
        return true;
    }

    /**
     * Get all configuration for a specific module
     * @param {string} module - Module name (api, chart, ui, etc.)
     * @returns {object} Module configuration
     */
    function getModule(module) {
        return get(module, {});
    }

    /**
     * Check if a feature is enabled
     * @param {string} feature - Feature name
     * @returns {boolean} Feature status
     */
    function isFeatureEnabled(feature) {
        return get(`features.${feature}`, false);
    }

    /**
     * Get environment-specific configuration
     * @returns {string} Current environment
     */
    function getEnv() {
        return getEnvironment();
    }

    /**
     * Initialize configuration with custom values
     * @param {object} customConfig - Custom configuration to merge
     */
    function init(customConfig = {}) {
        // Merge custom configuration with defaults
        if (customConfig.dynamic) {
            Object.assign(dynamicConfig, customConfig.dynamic);
        }

        // Load saved preferences
        const savedTheme = localStorage.getItem('app-theme');
        if (savedTheme) {
            dynamicConfig.theme = savedTheme;
        }

        const savedLanguage = localStorage.getItem('app-language');
        if (savedLanguage) {
            dynamicConfig.language = savedLanguage;
        }

        console.log('AppConfig initialized:', {
            environment: getEnvironment(),
            theme: dynamicConfig.theme,
            language: dynamicConfig.language,
            debug: FEATURE_FLAGS.DEBUG_MODE
        });
    }

    /**
     * Validate configuration value against rules
     * @param {string} type - Validation type
     * @param {*} value - Value to validate
     * @returns {object} Validation result
     */
    function validate(type, value) {
        const rules = get(`validation.${type}`);
        if (!rules) {
            return { valid: true };
        }

        // Example validation for password
        if (type === 'password') {
            if (!value || value.length < rules.MIN_LENGTH) {
                return { 
                    valid: false, 
                    message: `密碼長度至少需要 ${rules.MIN_LENGTH} 個字元` 
                };
            }
            if (value.length > rules.MAX_LENGTH) {
                return { 
                    valid: false, 
                    message: `密碼長度不可超過 ${rules.MAX_LENGTH} 個字元` 
                };
            }
        }

        return { valid: true };
    }

    // Initialize on load
    document.addEventListener('DOMContentLoaded', function() {
        init();
    });

    // Public API
    return {
        get,
        set,
        getModule,
        isFeatureEnabled,
        getEnv,
        init,
        validate,
        
        // Direct access to common configs
        API: API_CONFIG,
        CHART: CHART_CONFIG,
        UI: UI_CONFIG,
        FILE: FILE_CONFIG,
        DATE: DATE_CONFIG,
        VALIDATION: VALIDATION_CONFIG,
        SECURITY: SECURITY_CONFIG,
        MESSAGES: {
            ERROR: ERROR_MESSAGES,
            SUCCESS: SUCCESS_MESSAGES
        },
        FEATURES: FEATURE_FLAGS,
        TEXT: TEXT_CONSTANTS,
        CSS: CSS_CLASSES,
        URL: URL_PATHS,
        WASTE: WASTE_CONSTANTS
    };
})();