(function() {
    'use strict';

    // Configuration manager for dynamic table system
    const ConfigManager = {
        // Unit configuration with display rules and formatters
        units: {
            metric_ton: {
                display: '公噸',
                symbol: 'MT',
                inputType: 'number',
                inputAttributes: { step: 'any' },
                formatter: (value) => {
                    if (value === null || value === undefined || value === '') return '';
                    return parseFloat(value).toString().replace(/\.0$/, '');
                },
                parser: (value) => value ? parseFloat(value) : null
            },
            kilogram: {
                display: '公斤',
                symbol: 'kg',
                inputType: 'number',
                inputAttributes: { step: 'any' },
                formatter: (value) => {
                    if (value === null || value === undefined || value === '') return '';
                    return parseFloat(value).toString().replace(/\.0$/, '');
                },
                parser: (value) => value ? parseFloat(value) : null
            },
            new_taiwan_dollar: {
                display: '新台幣',
                symbol: 'NTD',
                inputType: 'number',
                inputAttributes: { step: '1' },
                formatter: (value) => {
                    if (value === null || value === undefined || value === '') return '';
                    return parseInt(value).toLocaleString();
                },
                parser: (value) => value ? parseInt(value.toString().replace(/,/g, '')) : null
            },
            // Default configuration for unknown units
            default: {
                display: '',
                symbol: '',
                inputType: 'text',
                inputAttributes: {},
                formatter: (value) => value || '',
                parser: (value) => value || null
            }
        },

        // Get unit configuration with fallback
        getUnitConfig: function(unit) {
            return this.units[unit] || this.units.default;
        },

        // Generate field mapping from server configuration
        generateFieldMapping: function(fieldInfo) {
            const mapping = { '日期': 'date' };

            // Build dynamic mapping from field info
            Object.entries(fieldInfo || {}).forEach(([fieldKey, info]) => {
                if (info.name) {
                    mapping[info.name] = {
                        field: fieldKey,
                        unit: info.unit || 'default'
                    };
                }
            });

            return mapping;
        },

        // Create input element safely using DOM API (prevents XSS injection)
        createInput: function(field, fieldInfo, value = '', isNew = false) {
            const info = fieldInfo[field] || {};
            const unitConfig = this.getUnitConfig(info.unit);
            const inputId = isNew ? `new_${field}` : `edit_${field}`;

            // Check if field is auto-calculated (should not show input in add/edit mode)
            const isAutoCalculated = info.auto_calculated === true || info.editable === false;

            // For auto-calculated fields, return null (no input element)
            if (isAutoCalculated) {
                return null;
            }

            // Create container div for normal fields
            const container = document.createElement('div');
            container.className = 'ts-input is-basic';

            // Create input element safely
            const input = document.createElement('input');
            input.type = unitConfig.inputType;
            input.id = inputId;
            input.value = value;
            input.placeholder = unitConfig.display || info.name || field;

            // Apply attributes safely
            Object.entries(unitConfig.inputAttributes || {}).forEach(([key, val]) => {
                input.setAttribute(key, val);
            });

            container.appendChild(input);
            return container; // Return DOM element, not HTML string
        },

        // Format value for display based on unit
        formatValue: function(value, unit) {
            const unitConfig = this.getUnitConfig(unit);
            return unitConfig.formatter(value);
        },

        // Parse input value based on unit
        parseValue: function(value, unit) {
            const unitConfig = this.getUnitConfig(unit);
            return unitConfig.parser(value);
        },

        // Generate example data for import
        generateExampleData: function(fieldInfo, rowCount = 3) {
            const examples = [];

            for (let i = 1; i <= rowCount; i++) {
                const row = [`2025-0${i}`];

                Object.entries(fieldInfo || {}).forEach(([field, info]) => {
                    // Skip auto-calculated fields (like 'total')
                    if (info.auto_calculated === true || info.editable === false) {
                        return;
                    }

                    // Generate appropriate sample based on unit
                    let sampleValue = '';

                    if (i !== 2) { // Leave second row with some empty values
                        switch (info.unit) {
                            case 'new_taiwan_dollar':
                                sampleValue = (i * 5000).toString();
                                break;
                            case 'metric_ton':
                                sampleValue = (i * 1.5).toFixed(1);
                                break;
                            case 'kilogram':
                                sampleValue = (i * 25.5).toFixed(1);
                                break;
                            default:
                                sampleValue = `資料${i}`;
                        }
                    }

                    row.push(sampleValue);
                });

                examples.push(row);
            }

            return examples;
        },

        // Validate date format
        validateDate: function(date) {
            if (!date || typeof date !== 'string') return false;

            const pattern = /^\d{4}-\d{2}$/;
            if (!pattern.test(date)) return false;

            const [year, month] = date.split('-').map(Number);
            return year >= 1970 && year <= 9999 && month >= 1 && month <= 12;
        },

        // Unit conversion utilities
        convertUnit: function(value, fromUnit, toUnit) {
            if (!value || fromUnit === toUnit) return value;

            // Define conversion rules
            const conversions = {
                'metric_ton_to_kilogram': (v) => v * 1000,
                'kilogram_to_metric_ton': (v) => v / 1000
            };

            const key = `${fromUnit}_to_${toUnit}`;
            const converter = conversions[key];

            return converter ? converter(parseFloat(value)) : value;
        }
    };

    // Export to global scope
    window.ConfigManager = ConfigManager;
})();