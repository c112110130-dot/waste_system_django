/**
 * Unified CSV Validation System
 * Provides consistent CSV validation rules that match backend validation exactly
 * Used across all import functionality (WasteManagement, WasteTransportation, WastePrediction)
 */

window.CSVValidator = (function() {
    'use strict';

    // Configuration for different CSV types
    const CSV_TYPES = {
        DEPARTMENT_WASTE: 'department_waste',
        TRANSPORTATION: 'transportation', 
        PREDICTION: 'prediction'
    };

    // Validation rules that match backend exactly
    const VALIDATION_RULES = {
        DATE_FORMAT: {
            pattern: /^\d{4}-(0[1-9]|1[0-2])$/,  // YYYY-MM format
            minYear: 1970,
            maxYear: 9999
        },
        AMOUNT: {
            min: 0,
            maxPrecision: 2
        },
        FILE_SIZE: {
            maxSize: 5 * 1024 * 1024,  // 5MB
            maxRows: 10000
        },
        ENCODING: {
            supported: ['utf-8', 'utf-8-bom', 'big5', 'gb2312']
        }
    };

    // Error messages that match backend messages
    const ERROR_MESSAGES = {
        EMPTY_FILE: 'CSV檔案為空',
        INVALID_FORMAT: 'CSV格式錯誤',
        MISSING_DATE_COLUMN: 'CSV檔案必須包含「日期」欄位',
        INVALID_DATE_FORMAT: '日期格式錯誤，請使用YYYY-MM格式',
        INVALID_AMOUNT: '數量格式錯誤或為負數',
        UNKNOWN_DEPARTMENTS: '未知部門',
        DUPLICATE_COLUMNS: '重複欄位',
        FILE_TOO_LARGE: '檔案過大，請分割後上傳',
        TOO_MANY_ROWS: '資料行數過多，請分割後上傳',
        ENCODING_ERROR: '檔案編碼不支援，請使用UTF-8格式'
    };

    /**
     * Main CSV Validator class
     */
    class CSVValidator {
        constructor(csvType = CSV_TYPES.DEPARTMENT_WASTE) {
            this.csvType = csvType;
            this.validationErrors = [];
            this.validationWarnings = [];
        }

        /**
         * Validate complete CSV content
         * @param {string|File} input - CSV content string or File object
         * @param {Object} options - Validation options
         * @returns {Promise<Object>} Validation result
         */
        async validate(input, options = {}) {
            this.clearErrors();
            
            try {
                // Handle File object
                let csvContent;
                if (input instanceof File) {
                    const fileValidation = this.validateFile(input);
                    if (!fileValidation.valid) {
                        return fileValidation;
                    }
                    csvContent = await this.readFileContent(input);
                } else {
                    csvContent = input;
                }

                // Parse CSV content
                const parseResult = this.parseCSV(csvContent);
                if (!parseResult.valid) {
                    return parseResult;
                }

                const { headers, rows } = parseResult.data;

                // Validate structure
                const structureValidation = this.validateStructure(headers, options);
                if (!structureValidation.valid) {
                    return structureValidation;
                }

                // Validate data rows
                const dataValidation = this.validateDataRows(headers, rows, options);
                if (!dataValidation.valid) {
                    return dataValidation;
                }

                return {
                    valid: true,
                    data: {
                        headers,
                        rows,
                        validRows: dataValidation.data.validRows,
                        stats: {
                            totalRows: rows.length,
                            validRows: dataValidation.data.validRows.length,
                            invalidRows: rows.length - dataValidation.data.validRows.length
                        }
                    },
                    warnings: this.validationWarnings
                };

            } catch (error) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.INVALID_FORMAT + ': ' + error.message,
                    details: { originalError: error.message }
                };
            }
        }

        /**
         * Validate file properties (size, type)
         */
        validateFile(file) {
            // Check file size
            if (file.size > VALIDATION_RULES.FILE_SIZE.maxSize) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.FILE_TOO_LARGE,
                    details: { 
                        fileSize: file.size, 
                        maxSize: VALIDATION_RULES.FILE_SIZE.maxSize 
                    }
                };
            }

            // Check file type
            const allowedTypes = ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'];
            const hasValidExtension = file.name.toLowerCase().endsWith('.csv');
            
            if (!allowedTypes.includes(file.type) && !hasValidExtension) {
                this.addWarning('檔案類型可能不正確，建議使用.csv格式');
            }

            return { valid: true };
        }

        /**
         * Read file content with encoding detection
         */
        async readFileContent(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    let content = e.target.result;
                    
                    // Handle BOM for UTF-8
                    if (content.charCodeAt(0) === 0xFEFF) {
                        content = content.slice(1);
                    }
                    
                    resolve(content);
                };
                
                reader.onerror = () => {
                    reject(new Error(ERROR_MESSAGES.ENCODING_ERROR));
                };
                
                // Try UTF-8 first
                reader.readAsText(file, 'UTF-8');
            });
        }

        /**
         * Parse CSV content into headers and rows
         */
        parseCSV(content) {
            if (!content || content.trim() === '') {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.EMPTY_FILE
                };
            }

            try {
                // Simple CSV parsing (handles common cases)
                const lines = content.trim().split('\n').filter(line => line.trim() !== '');
                
                if (lines.length === 0) {
                    return {
                        valid: false,
                        error: ERROR_MESSAGES.EMPTY_FILE
                    };
                }

                const headers = this.parseCSVLine(lines[0]);
                const rows = lines.slice(1).map(line => this.parseCSVLine(line));

                // Check for too many rows
                if (rows.length > VALIDATION_RULES.FILE_SIZE.maxRows) {
                    return {
                        valid: false,
                        error: ERROR_MESSAGES.TOO_MANY_ROWS,
                        details: { rowCount: rows.length, maxRows: VALIDATION_RULES.FILE_SIZE.maxRows }
                    };
                }

                return {
                    valid: true,
                    data: { headers, rows }
                };

            } catch (error) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.INVALID_FORMAT + ': ' + error.message
                };
            }
        }

        /**
         * Parse a single CSV line handling quotes and commas
         */
        parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        // Escaped quote
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // Field separator
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            // Add last field
            result.push(current.trim());
            
            return result;
        }

        /**
         * Validate CSV structure (headers)
         */
        validateStructure(headers, options = {}) {
            // Check for empty headers
            if (!headers || headers.length === 0) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.EMPTY_FILE
                };
            }

            // Check for duplicate columns
            const duplicates = headers.filter((header, index) => 
                headers.indexOf(header) !== index
            );
            
            if (duplicates.length > 0) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.DUPLICATE_COLUMNS + ': ' + duplicates.join(', ')
                };
            }

            // Type-specific validation
            switch (this.csvType) {
                case CSV_TYPES.DEPARTMENT_WASTE:
                    return this.validateDepartmentWasteStructure(headers, options);
                case CSV_TYPES.TRANSPORTATION:
                    return this.validateTransportationStructure(headers, options);
                case CSV_TYPES.PREDICTION:
                    return this.validatePredictionStructure(headers, options);
                default:
                    return { valid: true };
            }
        }

        /**
         * Validate department waste CSV structure
         */
        validateDepartmentWasteStructure(headers, options) {
            // Must have date column
            if (!headers.includes('日期')) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.MISSING_DATE_COLUMN
                };
            }

            // Validate department names if provided
            if (options.validDepartments) {
                const departmentHeaders = headers.filter(h => h !== '日期');
                const unknownDepartments = departmentHeaders.filter(h => 
                    !options.validDepartments.includes(h)
                );
                
                if (unknownDepartments.length > 0) {
                    return {
                        valid: false,
                        error: ERROR_MESSAGES.UNKNOWN_DEPARTMENTS + ': ' + unknownDepartments.join(', ')
                    };
                }
            }

            return { valid: true };
        }

        /**
         * Validate transportation CSV structure (placeholder)
         */
        validateTransportationStructure(headers, options) {
            // Define required columns for transportation
            const requiredColumns = ['聯單編號', '廢棄物名稱', '事業機構'];
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            
            if (missingColumns.length > 0) {
                return {
                    valid: false,
                    error: '缺少必要欄位: ' + missingColumns.join(', ')
                };
            }

            return { valid: true };
        }

        /**
         * Validate prediction CSV structure (placeholder)
         */
        validatePredictionStructure(headers, options) {
            // Define required columns for prediction
            const requiredColumns = ['日期', '因子'];
            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            
            if (missingColumns.length > 0) {
                return {
                    valid: false,
                    error: '缺少必要欄位: ' + missingColumns.join(', ')
                };
            }

            return { valid: true };
        }

        /**
         * Validate data rows
         */
        validateDataRows(headers, rows, options = {}) {
            const validRows = [];
            const errors = [];
            
            for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
                const row = rows[rowIndex];
                const rowValidation = this.validateSingleRow(headers, row, rowIndex + 2); // +2 for 1-based + header
                
                if (rowValidation.valid) {
                    validRows.push(rowValidation.data);
                } else {
                    errors.push({
                        row: rowIndex + 2,
                        error: rowValidation.error,
                        details: rowValidation.details
                    });
                }
            }

            // If too many errors, fail validation
            const errorThreshold = Math.max(10, Math.floor(rows.length * 0.1)); // 10% or minimum 10
            if (errors.length > errorThreshold) {
                return {
                    valid: false,
                    error: `資料錯誤過多 (${errors.length} 行錯誤)，請檢查檔案格式`,
                    details: { errors: errors.slice(0, 10) } // Show first 10 errors
                };
            }

            // If some errors but below threshold, add as warnings
            if (errors.length > 0) {
                this.addWarning(`忽略了 ${errors.length} 行錯誤資料`);
            }

            return {
                valid: true,
                data: { validRows }
            };
        }

        /**
         * Validate a single data row
         */
        validateSingleRow(headers, row, rowNumber) {
            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
                return { valid: false, error: '空白行' };
            }

            // Check column count
            if (row.length !== headers.length) {
                this.addWarning(`第 ${rowNumber} 行欄位數量不匹配`);
            }

            const rowData = {};
            const errors = [];

            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const value = i < row.length ? row[i] : '';
                const validation = this.validateCellValue(header, value, rowNumber);
                
                if (validation.valid) {
                    rowData[header] = validation.value;
                } else {
                    errors.push(`${header}: ${validation.error}`);
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    error: errors.join(', '),
                    details: { errors }
                };
            }

            return {
                valid: true,
                data: rowData
            };
        }

        /**
         * Validate individual cell value
         */
        validateCellValue(header, value, rowNumber) {
            const trimmedValue = value ? value.trim() : '';
            
            // Handle empty values
            if (!trimmedValue || trimmedValue === '') {
                if (header === '日期') {
                    return { valid: false, error: '日期不能為空' };
                }
                return { valid: true, value: null };
            }

            // Date validation
            if (header === '日期') {
                return this.validateDateValue(trimmedValue);
            }

            // Amount validation (for non-date columns)
            if (header !== '日期') {
                return this.validateAmountValue(trimmedValue);
            }

            return { valid: true, value: trimmedValue };
        }

        /**
         * Validate date value (matches backend validation exactly)
         */
        validateDateValue(dateStr) {
            if (!dateStr || dateStr.length !== 7 || dateStr[4] !== '-') {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.INVALID_DATE_FORMAT
                };
            }

            try {
                const [yearStr, monthStr] = dateStr.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr);
                
                if (year < VALIDATION_RULES.DATE_FORMAT.minYear || 
                    year > VALIDATION_RULES.DATE_FORMAT.maxYear ||
                    month < 1 || month > 12) {
                    return {
                        valid: false,
                        error: ERROR_MESSAGES.INVALID_DATE_FORMAT
                    };
                }

                return { valid: true, value: dateStr };
                
            } catch (error) {
                return {
                    valid: false,
                    error: ERROR_MESSAGES.INVALID_DATE_FORMAT
                };
            }
        }

        /**
         * Validate amount value (matches backend validation exactly)
         */
        validateAmountValue(amountStr) {
            try {
                const amount = parseFloat(amountStr);
                
                if (isNaN(amount)) {
                    return {
                        valid: false,
                        error: '無效的數字格式'
                    };
                }
                
                if (amount < VALIDATION_RULES.AMOUNT.min) {
                    return {
                        valid: false,
                        error: ERROR_MESSAGES.INVALID_AMOUNT
                    };
                }

                return { valid: true, value: amount };
                
            } catch (error) {
                return {
                    valid: false,
                    error: '無效的數字格式'
                };
            }
        }

        /**
         * Clear validation errors and warnings
         */
        clearErrors() {
            this.validationErrors = [];
            this.validationWarnings = [];
        }

        /**
         * Add validation warning
         */
        addWarning(message) {
            this.validationWarnings.push(message);
        }

        /**
         * Add validation error
         */
        addError(message) {
            this.validationErrors.push(message);
        }
    }

    // Export public API
    return {
        CSVValidator,
        CSV_TYPES,
        VALIDATION_RULES,
        ERROR_MESSAGES,
        
        // Convenience factory functions
        createDepartmentValidator() {
            return new CSVValidator(CSV_TYPES.DEPARTMENT_WASTE);
        },
        
        createTransportationValidator() {
            return new CSVValidator(CSV_TYPES.TRANSPORTATION);
        },
        
        createPredictionValidator() {
            return new CSVValidator(CSV_TYPES.PREDICTION);
        },

        // Quick validation functions
        async validateDepartmentCSV(input, validDepartments = []) {
            const validator = new CSVValidator(CSV_TYPES.DEPARTMENT_WASTE);
            return await validator.validate(input, { validDepartments });
        },

        async validateTransportationCSV(input, options = {}) {
            const validator = new CSVValidator(CSV_TYPES.TRANSPORTATION);
            return await validator.validate(input, options);
        },

        async validatePredictionCSV(input, options = {}) {
            const validator = new CSVValidator(CSV_TYPES.PREDICTION);
            return await validator.validate(input, options);
        }
    };
})();