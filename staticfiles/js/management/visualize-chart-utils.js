/**
 * Visualize Chart Utilities - Unified chart and table generation utilities
 * Centralized display logic for both chart preview and report preview modules
 */

class VisualizeChartUtils {
    
    // ============ Theme Management ============

    /**
     * Get system theme preference
     * @returns {string} 'light' or 'dark'
     */
    static getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    /**
     * Get the current effective theme based on Django template settings
     * @returns {string} 'light' or 'dark'
     */
    static getCurrentEffectiveTheme() {
        // Check if Django template variables are available
        if (typeof window.themeConfig !== 'undefined') {
            const { isLightMode, isDarkMode, isSystemTheme } = window.themeConfig;

            if (isLightMode) {
                return 'light';
            } else if (isDarkMode) {
                return 'dark';
            } else if (isSystemTheme) {
                return this.getSystemTheme();
            }
        }

        // Fallback detection using DOM classes
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) {
            return 'light';
        } else if (htmlRoot.classList.contains('is-dark')) {
            return 'dark';
        }

        return this.getSystemTheme();
    }

    /**
     * Get current switch theme setting from radio buttons
     * @returns {string} 'light' or 'dark'
     */
    static getCurrentSwitchTheme() {
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');

        if (lightRadio && lightRadio.checked) {
            return 'light';
        } else if (darkRadio && darkRadio.checked) {
            return 'dark';
        }

        // Default to current effective theme if no selection
        return this.getCurrentEffectiveTheme();
    }

    /**
     * Get current export theme setting
     * @returns {string} 'light' or 'dark'
     */
    static getCurrentExportTheme() {
        const exportThemeSelect = document.getElementById('exportTheme');
        return exportThemeSelect ? exportThemeSelect.value : this.getCurrentSwitchTheme();
    }

    // ============ Chart Creation ============

    /**
     * Comprehensive chart cleanup - unified implementation for both preview and export
     * @param {HTMLElement} container - Chart container element
     * @param {Object} chartInstance - ApexCharts instance to destroy
     */
    static thoroughChartCleanup(container, chartInstance = null) {
        try {
            // Destroy existing chart completely
            if (chartInstance) {
                chartInstance.destroy();
            }
            if (window.chart) {
                window.chart.destroy();
                window.chart = null;
            }

            // Clear chart container immediately using safe method
            if (container) {
                DOMUtils.clearElement(container);
            }

            // Remove any residual ApexCharts elements more aggressively
            const residualSelectors = [
                '.apexcharts-canvas',
                '.apexcharts-svg', 
                '.apexcharts-inner',
                '.apexcharts-graphical',
                '.apexcharts-datalabels',
                '.apexcharts-legend',
                '.apexcharts-tooltip',
                '.apexcharts-xcrosshairs',
                '.apexcharts-ycrosshairs',
                '.apexcharts-gridlines-horizontal',
                '.apexcharts-gridlines-vertical',
                '.apexcharts-text',
                '.apexcharts-title-text',
                '.apexcharts-subtitle-text'
            ];

            residualSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    try {
                        if (el.parentNode) {
                            el.parentNode.removeChild(el);
                        }
                    } catch (e) {
                        console.warn('Error removing residual chart element:', e);
                    }
                });
            });

            // Clear any lingering chart data
            if (window.chartData && !chartInstance) {
                window.chartData = null;
            }

            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
        } catch (e) {
            // Fallback: just clear the container using safe method
            if (container) {
                DOMUtils.clearElement(container);
            }
        }
    }

    /**
     * Calculate optimal Y-axis scale with readable intervals
     * @param {number} maxValue - Maximum data value
     * @param {number} idealTickCount - Desired number of ticks (5 or 10)
     * @returns {Object} { interval, max, tickAmount }
     */
    static calculateOptimalScale(maxValue, idealTickCount = 5) {
        if (!maxValue || maxValue <= 0) {
            return { interval: 1, max: idealTickCount, tickAmount: idealTickCount };
        }

        // Calculate rough interval based on data range
        const roughInterval = maxValue / idealTickCount;

        // Find the magnitude (power of 10)
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));

        // Nice intervals: 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000...
        const niceMultipliers = [1, 2, 5, 10];

        // Find the smallest nice interval that gives us <= idealTickCount ticks
        let bestInterval = magnitude;
        for (const multiplier of niceMultipliers) {
            const candidate = magnitude * multiplier;
            if (candidate >= roughInterval) {
                bestInterval = candidate;
                break;
            }
        }

        // Calculate the final max value (round up to next interval)
        const calculatedMax = Math.ceil(maxValue / bestInterval) * bestInterval;
        // Use Math.round to avoid floating point precision issues
        // Since calculatedMax is always a multiple of bestInterval, division should be exact
        // tickAmount represents number of intervals, not number of ticks
        // For example: max=5, interval=1 → 5 intervals → 6 ticks (0,1,2,3,4,5)
        const tickAmount = Math.round(calculatedMax / bestInterval);

        return {
            interval: bestInterval,
            max: calculatedMax,
            tickAmount: tickAmount
        };
    }

    /**
     * Format axis tick value based on interval (ensures consistent precision)
     * @param {number} val - Tick value
     * @param {number} interval - Tick interval
     * @returns {string} Formatted string
     */
    static formatAxisTick(val, interval) {
        if (val === 0) return '0';

        // Determine decimal places based on interval, not value
        let decimalPlaces;
        if (interval >= 1) {
            // Interval >= 1: always show integers
            // Examples: 1, 5, 10, 100, 1000 → 0 decimals
            decimalPlaces = 0;
        } else {
            // Interval < 1: calculate required decimal places
            // 0.1 → 1, 0.01 → 2, 0.001 → 3, etc.
            decimalPlaces = Math.max(0, Math.ceil(-Math.log10(interval)));
        }

        // Format with calculated precision
        const formatted = val.toFixed(decimalPlaces);

        // Remove trailing zeros only if we have decimals
        if (decimalPlaces === 0) {
            return formatted;
        }

        return formatted.replace(/\.?0+$/, '') || '0';
    }

    /**
     * Get common Y-axis configuration with dynamic max value and theme support
     * @param {boolean} showFullGrid - Whether to show full grid
     * @param {Array} seriesData - Chart series data
     * @param {string} yAxisValue - Y-axis selection value
     * @param {string} theme - Chart theme ('light' or 'dark')
     * @returns {Object} Y-axis configuration
     */
    static getYAxisConfig(showFullGrid, seriesData, yAxisValue, theme = 'light', config = null) {
        const textColor = theme === 'dark' ? '#ffffff' : '#374151';
        const isPercentage = yAxisValue.includes('percentage');
        const isPieOrDonut = false; // Handled separately in chart options
        let maxValue = 0;

        // Calculate highest value from data
        if (!isPercentage && !isPieOrDonut && seriesData && seriesData.length > 0) {
            try {
                // Check both chart_type and chartType for compatibility
                const chartType = config?.chart_type || config?.chartType;
                const isStackedChart = chartType === 'stacked_bar';

                if (isStackedChart) {
                    // For stacked charts, calculate the maximum sum at each x-axis position
                    const maxDataLength = Math.max(...seriesData.map(s => (s.data || []).length));

                    for (let i = 0; i < maxDataLength; i++) {
                        let stackSum = 0;
                        seriesData.forEach(series => {
                            const value = (series.data && series.data[i]) || 0;
                            if (!isNaN(value)) {
                                stackSum += parseFloat(value);
                            }
                        });
                        maxValue = Math.max(maxValue, stackSum);
                    }
                } else {
                    // For non-stacked charts, use individual maximum value
                    const allDataPoints = seriesData.flatMap(s => Array.isArray(s.data) ? s.data : []);
                    if (allDataPoints.length > 0) {
                        maxValue = Math.max(...allDataPoints.filter(v => !isNaN(v)));
                    }
                }
            } catch (e) {
                console.warn('Error calculating Y-axis max value:', e);
            }
        }

        // Calculate scale using optimal algorithm
        let calculatedMax, tickAmount, interval;

        if (isPercentage) {
            // Percentage mode: always 0-100%
            calculatedMax = 100;
            tickAmount = showFullGrid ? 10 : 5;
            interval = showFullGrid ? 10 : 20;
        } else if (maxValue > 0) {
            // Use optimal scale calculation
            const idealTickCount = showFullGrid ? 10 : 5;
            const scale = this.calculateOptimalScale(maxValue, idealTickCount);
            calculatedMax = scale.max;
            tickAmount = scale.tickAmount;
            interval = scale.interval;
        } else {
            // No data: use reasonable defaults
            calculatedMax = showFullGrid ? 10 : 5;
            tickAmount = showFullGrid ? 10 : 5;
            interval = 1;
        }

        const yAxisConfig = {
            title: {
                text: yAxisValue === 'metric_ton' ? '公噸' :
                    yAxisValue === 'kilogram' ? '公斤' :
                        yAxisValue === 'new_taiwan_dollar' ? '新台幣' : '百分比',
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                    color: textColor
                },
            },
            min: 0,
            max: calculatedMax,
            tickAmount: Math.max(2, tickAmount), // Ensure at least 2 ticks (0 and max)
            forceNiceScale: false, // Disable ApexCharts auto scaling
            labels: {
                formatter: (val) => {
                    // Excel-style conditional formatting based on value magnitude
                    const cleanedVal = this.formatAxisTick(val, interval);

                    if (yAxisValue === 'new_taiwan_dollar') {
                        const num = parseFloat(cleanedVal);
                        return num.toLocaleString ? num.toLocaleString('zh-TW') : cleanedVal;
                    }
                    if (yAxisValue.includes('percentage')) return `${cleanedVal}%`;
                    return cleanedVal;
                },
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                    colors: [textColor]
                },
            }
        };

        return yAxisConfig;
    }

    /**
     * Get common grid configuration
     * @param {boolean} showFullGrid - Whether to show full grid
     * @returns {Object} Grid configuration
     */
    static getGridConfig(showFullGrid) {
        return {
            xaxis: {
                lines: {
                    show: showFullGrid
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            },
            strokeDashArray: 0,
        };
    }

    /**
     * Create ApexChart with unified configuration - main chart creation function
     * @param {HTMLElement} container - Chart container element
     * @param {Object} data - Chart data from server
     * @param {Object} config - Chart configuration options
     * @param {string} theme - Chart theme ('light' or 'dark')
     * @returns {Promise<Object>} ApexCharts instance
     */
    static async createChart(container, data, config = {}, theme = 'light') {
        if (!container || !data || !data.series || !data.x_axis_labels) {
            throw new Error('Missing required parameters for chart creation');
        }

        // Ensure container exists and is visible in DOM
        if (!document.contains(container)) {
            throw new Error('Chart container must be in the DOM');
        }

        // Clean up any existing charts in container first
        this.thoroughChartCleanup(container);

        const {
            chartType = config.chart_type || 'bar',
            yAxis = config.y_axis || 'metric_ton',
            xAxis = config.x_axis || config.xAxis || 'month',
            title = config.title || '',
            showValues = config.show_values || config.showValues || false,
            showFullGrid = config.show_full_grid || config.showFullGrid || false
        } = config;

        const textColor = theme === 'dark' ? '#ffffff' : '#374151';

        let chartOptions = {
            chart: {
                type: chartType === 'stacked_bar' ? 'bar' : chartType,
                height: 600,
                toolbar: { show: true },
                zoom: {
                    enabled: true,
                    type: 'x',
                    autoScaleYaxis: false,
                    allowMouseWheelZoom: true
                },
                stacked: chartType === 'stacked_bar',
                animations: {
                    enabled: false,
                    speed: 0,
                    animateGradually: {
                        enabled: false,
                        delay: 0
                    },
                    dynamicAnimation: {
                        enabled: false,
                        speed: 0
                    }
                },
                background: 'transparent'
            },
            theme: {
                mode: theme
            },
            series: data.series,
            xaxis: {
                categories: xAxis === 'department_ranking' ?
                    // For department charts, truncate labels to 16 chars for display
                    data.x_axis_labels.map(label => label.length > 16 ? label.substring(0, 16) + '...' : label) :
                    // For other charts, use original labels
                    data.x_axis_labels,
                // For department ranking, force show all labels; for dates, limit to 24
                tickAmount: xAxis === 'department_ranking' ? undefined : 24,
                labels: {
                    maxHeight: xAxis === 'department_ranking' ? undefined : 120,
                    // Force all department labels to be shown, not truncated
                    showDuplicates: xAxis === 'department_ranking',
                    hideOverlappingLabels: xAxis !== 'department_ranking',
                    style: {
                        fontSize: '14px',
                        fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                        colors: [textColor]
                    }
                },
                title: {
                    text: xAxis.startsWith('year') ? '年度' : 
                          xAxis.startsWith('quarter') ? '季度' : 
                          xAxis === 'only_month' ? '月份' : 
                          xAxis === 'department_ranking' ? '部門' : '年月份',
                    style: {
                        fontSize: '14px',
                        fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                        color: textColor
                    },
                },
            },
            yaxis: this.getYAxisConfig(showFullGrid, data.series, yAxis, theme, config),
            title: {
                text: title || data.title,
                align: 'center',
                style: {
                    fontSize: '18px',
                    fontFamily: 'Sarasa Mono TC Bold, sans-serif',
                    color: textColor
                }
            },
            dataLabels: {
                enabled: showValues,
                dropShadow: {
                    enabled: true,
                    left: 2,
                    top: 2,
                    opacity: 0.25
                },
                style: {
                    fontSize: '15px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                },
                formatter: (val, opts) => {
                    if (['pie', 'donut'].includes(chartType)) {
                        return this.getUnifiedPieChartFormatter()(val, opts);
                    }
                    return yAxis.includes('percentage') ? `${val.toFixed(2)}%` : val;
                },
            },
            legend: {
                fontSize: '14px',
                fontFamily: 'Sarasa Mono TC Regular, monospace',
                labels: {
                    colors: [textColor],
                    useSeriesColors: false
                }
            },
            tooltip: {
                style: {
                    fontSize: '16px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                },
                theme: theme,
                fillSeriesColor: false,
                // Force tooltip colors for theme compatibility
                cssClass: `apexcharts-tooltip-${theme}`,
                y: {
                    formatter: function(value, { seriesIndex, dataPointIndex, w }) {
                        // For pie/donut charts, show both percentage and original value with unit
                        if (['pie', 'donut'].includes(chartType)) {
                            if (w && w.globals && w.globals.series && Array.isArray(w.globals.series)) {
                                const series = w.globals.series;
                                const total = series.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                const percent = total > 0 ? ((parseFloat(value) || 0) / total * 100).toFixed(2) : '0.00';

                                const unit = yAxis === 'metric_ton' ? '公噸' :
                                            yAxis === 'kilogram' ? '公斤' :
                                            yAxis === 'new_taiwan_dollar' ? '元' : '';

                                return `${percent}% (${value.toLocaleString('zh-TW')} ${unit})`;
                            }
                            const unit = yAxis === 'metric_ton' ? '公噸' :
                                        yAxis === 'kilogram' ? '公斤' :
                                        yAxis === 'new_taiwan_dollar' ? '元' : '';
                            return `${value.toLocaleString('zh-TW')} ${unit}`;
                        }

                        // For other charts
                        if (yAxis === 'new_taiwan_dollar') return value.toLocaleString('zh-TW') + ' 元';
                        if (yAxis.includes('percentage')) return `${value.toFixed(2)}%`;
                        if (yAxis === 'metric_ton') return `${value} 公噸`;
                        if (yAxis === 'kilogram') return `${value} 公斤`;
                        return value;
                    }
                }
            },
            grid: this.getGridConfig(showFullGrid),
            colors: data.series.map(s => s.color || '#000000'),
        };

        // Special configuration for pie and donut charts
        if (['pie', 'donut'].includes(chartType)) {
            chartOptions.labels = data.series.map(s => s.name);

            // Determine target unit for pie chart calculation
            const targetUnit = yAxis === 'metric_ton' ? 'metric_ton' :
                yAxis === 'kilogram' ? 'kilogram' :
                yAxis === 'new_taiwan_dollar' ? 'new_taiwan_dollar' :
                'kilogram'; // Default fallback

            chartOptions.series = data.series.map(s => {
                // Use raw_data with proper unit conversion for accurate percentage calculation
                const rawData = Array.isArray(s.raw_data) ? s.raw_data : (Array.isArray(s.data) ? s.data : []);
                const total = rawData.reduce((sum, val) => {
                    // Apply unit conversion to ensure consistent calculation
                    const standardizedVal = this.standardizeValue(s.unit || targetUnit, val || 0, targetUnit);
                    return sum + (parseFloat(standardizedVal) || 0);
                }, 0);
                return total;
            });
            chartOptions.yaxis = {
                title: {
                    text: yAxis === 'metric_ton' ? '公噸' :
                        yAxis === 'kilogram' ? '公斤' : '新台幣',
                    style: {
                        fontSize: '14px',
                        fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                        color: textColor
                    }
                }
            };

            // Use fixed pie chart dataLabels configuration
            chartOptions.dataLabels = {
                ...chartOptions.dataLabels,
                formatter: this.getUnifiedPieChartFormatter()
            };

            delete chartOptions.xaxis;
        }

        // Create and render chart
        const chart = new ApexCharts(container, chartOptions);
        await chart.render();

        return chart;
    }

    /**
     * Create chart for export with correct theme - unified implementation
     * @param {Object} chartOptions - ApexCharts options
     * @param {string} exportTheme - 'light' or 'dark'
     * @returns {Object} Chart export helper with render/destroy methods
     */
    static createChartForExport(chartOptions, exportTheme) {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '800px';
        tempContainer.style.height = '1000px';
        document.body.appendChild(tempContainer);

        // Apply theme to chart options with enhanced error handling
        const tempOptions = JSON.parse(JSON.stringify(chartOptions));
        tempOptions.theme = { mode: exportTheme };
        tempOptions.chart.animations = { enabled: false };
        tempOptions.chart.width = 800;
        tempOptions.chart.height = 1000;

        // Set background color based on theme - NOT transparent for export
        tempOptions.chart.background = exportTheme === 'dark' ? '#000000' : '#ffffff';

        // Set text colors based on theme
        const textColor = exportTheme === 'dark' ? '#ffffff' : '#374151';

        // Update ALL text elements to use proper colors
        if (tempOptions.xaxis) {
            if (tempOptions.xaxis.labels) {
                tempOptions.xaxis.labels.style = {
                    ...tempOptions.xaxis.labels.style,
                    colors: [textColor],
                    color: textColor
                };
            }
            if (tempOptions.xaxis.title) {
                tempOptions.xaxis.title.style = {
                    ...tempOptions.xaxis.title.style,
                    color: textColor
                };
            }
        }

        if (tempOptions.yaxis) {
            if (tempOptions.yaxis.labels) {
                tempOptions.yaxis.labels.style = {
                    ...tempOptions.yaxis.labels.style,
                    colors: [textColor],
                    color: textColor
                };
                
                // CRITICAL FIX: Restore Y-axis formatter that was lost during JSON serialization
                // Get the current yAxis setting to determine proper formatting
                const yAxisSelect = document.getElementById('yAxis');
                const yAxis = yAxisSelect ? yAxisSelect.value : 'metric_ton';
                
                tempOptions.yaxis.labels.formatter = function(val) {
                    if (val === undefined || val === null) return '';
                    
                    // Apply number formatting with trailing zero removal
                    const cleanedVal = Number(val).toFixed(2).replace(/\.?0+$/, '');
                    const numVal = parseFloat(cleanedVal);
                    
                    if (yAxis === 'new_taiwan_dollar') {
                        return numVal.toLocaleString ? numVal.toLocaleString('zh-TW') : cleanedVal;
                    }
                    if (yAxis.includes('percentage')) {
                        return `${cleanedVal}%`;
                    }
                    return cleanedVal;
                };
            }
            if (tempOptions.yaxis.title) {
                tempOptions.yaxis.title.style = {
                    ...tempOptions.yaxis.title.style,
                    color: textColor
                };
            }
        }

        if (tempOptions.title) {
            tempOptions.title.style = {
                ...tempOptions.title.style,
                color: textColor
            };
        }

        if (tempOptions.legend) {
            tempOptions.legend.labels = {
                ...tempOptions.legend.labels,
                colors: [textColor],
                useSeriesColors: false
            };
        }

        // Update dataLabels and ensure fixed pie chart formatting
        if (tempOptions.dataLabels) {
            // Apply fixed pie chart formatter
            tempOptions.dataLabels.formatter = this.getUnifiedPieChartFormatter();
            // Remove manual color setting, let ApexCharts theme handle it
            if (tempOptions.dataLabels.style && tempOptions.dataLabels.style.colors) {
                delete tempOptions.dataLabels.style.colors;
            }
        }

        // Ensure tooltip theme matches export theme
        if (tempOptions.tooltip) {
            tempOptions.tooltip.theme = exportTheme;
        } else {
            tempOptions.tooltip = { theme: exportTheme };
        }

        const tempChart = new ApexCharts(tempContainer, tempOptions);

        return {
            chart: tempChart,
            container: tempContainer,
            render: () => tempChart.render(),
            destroy: () => {
                try {
                    tempChart.destroy();
                    if (document.body.contains(tempContainer)) {
                        document.body.removeChild(tempContainer);
                    }
                } catch (e) {
                    // Silent failure for cleanup
                }
            }
        };
    }

    // ============ Table Generation ============

    /**
     * Generate unified table content for all export formats (PDF/Print/Excel/HTML)
     * @param {Object} data - Chart data
     * @param {Object} chartConfig - Chart configuration (optional)
     * @param {string} format - 'pdf', 'excel', 'html' etc.
     * @returns {Array} 2D array for PDF/Excel or HTML string
     */
    static generateTableContent(data, chartConfig = null, format = 'pdf') {
        if (!data || !data.series || !data.x_axis_labels) {
            return format === 'html' ? '' : [];
        }

        // Use chartConfig's yAxis if available, otherwise fallback to current selection
        const yAxis = chartConfig?.yAxis || document.getElementById('yAxis').value;
        const isPercentageMode = yAxis.includes('percentage');
        const isPieOrDonut = ['pie', 'donut'].includes(data.chart_type);
        
        // Determine unit based on Y-axis selection instead of field defaults
        const tableUnit = yAxis === 'weight_percentage_metric_ton' || yAxis === 'metric_ton' ? 'metric_ton' :
            yAxis === 'weight_percentage_kilogram' || yAxis === 'kilogram' ? 'kilogram' :
                yAxis === 'cost_percentage_new_taiwan_dollar' || yAxis === 'new_taiwan_dollar' ? 'new_taiwan_dollar' :
                    'kilogram'; // Default fallback

        // Calculate total sum of all raw data for percentage calculation in pie/donut charts
        let totalRawSum = 0;
        if (isPieOrDonut) {
            // For pie/donut charts, sum all series totals (not by time period)
            data.series.forEach(s => {
                const rawData = Array.isArray(s.raw_data) ? s.raw_data : [];
                const seriesTotal = rawData.reduce((sum, val) => {
                    const standardizedVal = this.standardizeValue(s.unit, val || 0, tableUnit);
                    return sum + (parseFloat(standardizedVal) || 0);
                }, 0);
                totalRawSum += seriesTotal;
            });
        }

        if (format === 'html') {
            return this.generateTableHtml(data, chartConfig, tableUnit, isPercentageMode, isPieOrDonut, totalRawSum);
        } else {
            return this.generateTableArray(data, chartConfig, tableUnit, isPercentageMode, isPieOrDonut, totalRawSum);
        }
    }

    /**
     * Generate table as HTML string with ts-box wrapper
     * @private
     */
    static generateTableHtml(data, chartConfig, tableUnit, isPercentageMode, isPieOrDonut, totalRawSum) {
        // Get current theme for appropriate table styling
        const currentTheme = this.getCurrentSwitchTheme();
        const isDark = currentTheme === 'dark';

        // Determine table header based on X-axis type
        const xAxis = chartConfig?.x_axis || chartConfig?.xAxis || 'month';
        const dateColumnHeader = xAxis === 'only_month' ? '月份' : '日期';

        // Create table structure using DOM API (safe from injection)
        const wrapper = document.createElement('div');
        wrapper.className = isDark ? 'ts-box is-dark' : 'ts-box';

        const table = DOMUtils.createElement(wrapper, 'table', {
            class: isDark ? 'ts-table is-celled is-dark' : 'ts-table is-celled',
            id: 'dataTable'
        });

        const thead = DOMUtils.createElement(table, 'thead');
        const headerRow = DOMUtils.createElement(thead, 'tr');

        // Create date/month header
        DOMUtils.createElement(headerRow, 'th', { class: 'date-column' }).textContent = dateColumnHeader;

        // Create series headers
        data.series.forEach(s => {
            const th = DOMUtils.createElement(headerRow, 'th', { class: 'data-column' });
            th.textContent = s.name || '';
        });

        const tbody = DOMUtils.createElement(table, 'tbody');

        // Create data rows
        data.x_axis_labels.forEach(label => {
            const row = DOMUtils.createElement(tbody, 'tr');

            // Date cell
            const dateCell = DOMUtils.createElement(row, 'td', { class: 'date-cell' });
            dateCell.textContent = label || '';

            // Data cells
            data.series.forEach(s => {
                const idx = data.x_axis_labels.indexOf(label);
                const rawData = Array.isArray(s.raw_data) ? s.raw_data : (Array.isArray(s.data) ? s.data : []);
                // Convert raw_data from database unit (s.unit) to user-selected unit (tableUnit)
                const rawValue = this.standardizeValue(s.unit, rawData[idx] || 0, tableUnit);
                const displayValue = tableUnit === 'new_taiwan_dollar' ?
                    rawValue.toLocaleString('zh-TW') : this.formatNumber(rawValue);

                let percentage;
                if (isPieOrDonut) {
                    percentage = totalRawSum ? ((parseFloat(rawValue) || 0) / totalRawSum * 100).toFixed(2) : '0.00';
                } else if (isPercentageMode && Array.isArray(s.data)) {
                    percentage = this.formatNumber(s.data[idx] || 0);
                } else {
                    percentage = null;
                }

                const unitText = tableUnit === 'metric_ton' ? '公噸' :
                    tableUnit === 'kilogram' ? '公斤' :
                        tableUnit === 'new_taiwan_dollar' ? '元' : '';

                const cellText = (isPercentageMode || isPieOrDonut) && percentage !== null ?
                    `${percentage}% (${displayValue} ${unitText})` :
                    `${displayValue} ${unitText}`;

                const cell = DOMUtils.createElement(row, 'td', { class: 'data-cell' });
                cell.textContent = cellText;
            });
        });

        return wrapper.outerHTML;
    }

    /**
     * Generate table as 2D array for PDF/Excel
     * @private
     */
    static generateTableArray(data, chartConfig, tableUnit, isPercentageMode, isPieOrDonut, totalRawSum) {
        // Determine table header based on X-axis type
        const xAxis = chartConfig?.x_axis || chartConfig?.xAxis || 'month';
        const dateColumnHeader = xAxis === 'only_month' ? '月份' : '日期';

        const headers = [{ text: dateColumnHeader, bold: true, font: 'NotoSansTC' }]
            .concat(data.series.map(s => ({ text: String(s.name || ''), bold: true, font: 'NotoSansTC' })));

        const body = data.x_axis_labels.map(label => {
            const row = [String(label || '')];
            
            data.series.forEach(s => {
                const idx = data.x_axis_labels.indexOf(label);
                const rawData = Array.isArray(s.raw_data) ? s.raw_data : [];
                const rawValue = this.standardizeValue(s.unit, rawData[idx] || 0, tableUnit);
                const displayValue = tableUnit === 'new_taiwan_dollar' ?
                    rawValue.toLocaleString('zh-TW') : this.formatNumber(rawValue);
                
                let percentage;
                if (isPieOrDonut) {
                    percentage = totalRawSum ? ((parseFloat(rawValue) || 0) / totalRawSum * 100).toFixed(2) : '0.00';
                } else if (isPercentageMode && Array.isArray(s.data)) {
                    percentage = this.formatNumber(s.data[idx] || 0);
                } else {
                    percentage = null;
                }
                
                const unitText = tableUnit === 'metric_ton' ? '公噸' :
                    tableUnit === 'kilogram' ? '公斤' :
                        tableUnit === 'new_taiwan_dollar' ? '元' : '';
                
                const cellText = (isPercentageMode || isPieOrDonut) && percentage !== null ?
                    `${percentage}% (${displayValue} ${unitText})` :
                    `${displayValue} ${unitText}`;
                
                row.push({ text: cellText, font: 'NotoSansTC' });
            });
            
            return row;
        });
        
        return [headers].concat(body);
    }

    // ============ Formatters and Utilities ============

    /**
     * Fixed pie chart percentage formatter function for consistency across all charts
     * @returns {Function} Formatter function
     */
    static getUnifiedPieChartFormatter() {
        return function(val, opts) {
            try {
                // For pie charts, val already represents the percentage value calculated by ApexCharts
                const percentage = parseFloat(val) || 0;
                return `${percentage.toFixed(2)}%`;
            } catch (e) {
                return `${(parseFloat(val) || 0).toFixed(2)}%`;
            }
        };
    }

    /**
     * Format number with smart precision based on magnitude
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    static formatNumber(num) {
        if (typeof CommonUtils !== 'undefined' && CommonUtils.formatNumberFixed) {
            return CommonUtils.formatNumberFixed(num);
        }
        // Fallback implementation with smart precision
        if (num === undefined || num === null) return '0';

        try {
            const absNum = Math.abs(num);

            // For very small numbers close to zero, return "0"
            if (absNum < 0.001) return '0';

            // Determine decimal places based on magnitude
            let decimalPlaces;
            if (absNum >= 100) {
                // Large numbers: no decimals or 1 decimal max
                decimalPlaces = absNum % 1 === 0 ? 0 : 1;
            } else if (absNum >= 10) {
                // Medium numbers: 0-1 decimals
                decimalPlaces = absNum % 1 === 0 ? 0 : 1;
            } else if (absNum >= 1) {
                // Small numbers >= 1: 0-2 decimals
                decimalPlaces = absNum % 1 === 0 ? 0 : 2;
            } else {
                // Numbers < 1: calculate needed precision
                // Find first non-zero decimal place
                const str = absNum.toFixed(10);
                const match = str.match(/\.0*[1-9]/);
                if (match) {
                    const zerosAfterDecimal = match[0].length - 2; // -2 for "." and the digit
                    decimalPlaces = Math.min(zerosAfterDecimal + 2, 4); // Max 4 decimals
                } else {
                    decimalPlaces = 2;
                }
            }

            // Format with calculated precision
            const formatted = Number(num).toFixed(decimalPlaces);
            // Remove trailing zeros and unnecessary decimal point
            const cleaned = formatted.replace(/\.?0+$/, '');
            return cleaned === '' || cleaned === '-' ? '0' : cleaned;

        } catch (e) {
            return '0';
        }
    }

    /**
     * Standardize value using CommonUtils
     * @param {string} fromUnit - Source unit
     * @param {number} value - Value to convert
     * @param {string} toUnit - Target unit
     * @returns {number} Converted value
     */
    static standardizeValue(fromUnit, value, toUnit) {
        if (typeof CommonUtils !== 'undefined' && CommonUtils.standardizeValue) {
            return CommonUtils.standardizeValue(fromUnit, value, toUnit);
        }
        // Fallback implementation
        if (!value && value !== 0) return 0;
        if (fromUnit === toUnit) return value;
        if (fromUnit === 'metric_ton' && toUnit === 'kilogram') return value * 1000;
        if (fromUnit === 'kilogram' && toUnit === 'metric_ton') return value / 1000;
        return value; // Default: no conversion
    }

    // ============ Modal Utilities ============

    /**
     * Show error modal
     * @param {string} message - Error message
     */
    static showErrorModal(message) {
        if (window.GlobalModalManager && typeof window.GlobalModalManager.alert === 'function') {
            window.GlobalModalManager.alert('錯誤', message, 'error');
        } else if (window.NotificationUtils && typeof window.NotificationUtils.showAlert === 'function') {
            window.NotificationUtils.showAlert('錯誤', message, 'error');
        } else if (window.ModalUtils && typeof window.ModalUtils.showAlert === 'function') {
            window.ModalUtils.showAlert('錯誤', message, 'error');
        } else {
            console.log('Modal systems not available, falling back to alert');
            alert(message);
        }
    }

    /**
     * Show success modal
     * @param {string} message - Success message
     */
    static showSuccessModal(message) {
        if (window.GlobalModalManager && typeof window.GlobalModalManager.alert === 'function') {
            window.GlobalModalManager.alert('成功', message, 'success');
        } else if (window.ModalUtils && typeof window.ModalUtils.showAlert === 'function') {
            window.ModalUtils.showAlert('成功', message, 'success');
        } else {
            console.log('Modal systems not available, falling back to alert');
            alert(message);
        }
    }

    // ============ UNIFIED CHART AND TABLE GENERATION ============
    
    /**
     * MASTER FUNCTION: Generate chart and table for both visualize and department systems
     * This is the single source of truth for chart generation across the entire application
     * @param {string} system - 'visualize' or 'department'
     * @param {Object} data - Chart data from backend API
     * @param {Object} config - Chart configuration
     * @param {HTMLElement} chartContainer - Chart container element
     * @param {HTMLElement} tableContainer - Table container element (optional)
     * @returns {Promise<Object>} - ApexCharts instance
     */
    static async generateChartAndTable(system, data, config, chartContainer, tableContainer = null) {
        console.log(`[VisualizeChartUtils] Generating ${system} chart with unified logic`);
        
        try {
            // Step 1: Clean up existing chart thoroughly
            this.thoroughChartCleanup(chartContainer);
            
            // Step 2: Generate chart using unified createChart
            const theme = config.theme || this.getCurrentSwitchTheme();
            const chart = await this.createChart(chartContainer, data, config, theme);
            
            // Step 3: Store chart references globally for both systems
            window.chart = chart;
            window.chartData = data;
            
            if (system === 'department') {
                window.departmentChart = chart;
                window.departmentChartData = data;
            }
            
            // Step 4: Generate table if container provided
            if (tableContainer) {
                this.generateUnifiedTable(tableContainer, data, config);
            }
            
            // Step 5: Update UI state for the specific system
            this.updateUIAfterGeneration(system, config);
            
            console.log(`[VisualizeChartUtils] ${system} chart generated successfully`);
            return chart;
            
        } catch (error) {
            console.error(`[VisualizeChartUtils] Error generating ${system} chart:`, error);
            this.showErrorModal(`圖表生成失敗：${error.message || '未知錯誤'}`);
            throw error;
        }
    }
    
    /**
     * UNIFIED TABLE GENERATION - Master function for both systems
     * Generates consistent table format across visualize and department systems
     * @param {HTMLElement} container - Table container element
     * @param {Object} data - Chart data
     * @param {Object} config - Chart configuration
     */
    static generateUnifiedTable(container, data, config) {
        try {
            if (!container || !data) return;
            
            // Determine table configuration
            const yAxis = config.y_axis || config.yAxis || 'metric_ton';
            const chartType = config.chart_type || config.chartType || 'bar';
            
            // Determine table unit type (not the display text)
            // For percentage modes, extract the base unit from the yAxis value
            const tableUnit = yAxis === 'weight_percentage_metric_ton' || yAxis === 'metric_ton' ? 'metric_ton' :
                yAxis === 'weight_percentage_kilogram' || yAxis === 'kilogram' ? 'kilogram' :
                yAxis === 'cost_percentage_new_taiwan_dollar' || yAxis === 'new_taiwan_dollar' ? 'new_taiwan_dollar' :
                'kilogram'; // Default fallback
            
            const isPercentageMode = yAxis.includes('percentage');
            const isPieOrDonut = ['pie', 'donut'].includes(chartType);
            
            // Calculate total for pie/donut charts with proper unit conversion
            let totalRawSum = 0;
            if (isPieOrDonut && data.series && data.series.length > 0) {
                // Sum all series with unit conversion for accurate percentage calculation
                data.series.forEach(s => {
                    const rawData = Array.isArray(s.raw_data) ? s.raw_data : (Array.isArray(s.data) ? s.data : []);
                    const seriesTotal = rawData.reduce((sum, val) => {
                        const standardizedVal = this.standardizeValue(s.unit || tableUnit, val || 0, tableUnit);
                        return sum + (parseFloat(standardizedVal) || 0);
                    }, 0);
                    totalRawSum += seriesTotal;
                });
            }
            
            // Generate table HTML using existing function
            const tableHtml = this.generateTableHtml(data, config, tableUnit, isPercentageMode, isPieOrDonut, totalRawSum);

            // Update container safely using DOM parsing
            DOMUtils.clearElement(container);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = tableHtml;
            while (tempDiv.firstChild) {
                container.appendChild(tempDiv.firstChild);
            }
            
            // Show/hide table based on configuration
            const shouldShowTable = config.includeTable || config.include_table;
            if (shouldShowTable) {
                container.classList.remove('has-hidden');
            } else {
                container.classList.add('has-hidden');
            }
            
        } catch (error) {
            console.error('[VisualizeChartUtils] Table generation error:', error);
        }
    }
    
    /**
     * Update UI state after chart generation
     * @param {string} system - 'visualize' or 'department'
     * @param {Object} config - Chart configuration
     */
    static updateUIAfterGeneration(system, config) {
        try {
            // Update chart configuration flags for tab system
            if (window.chartConfigurations && typeof window.activeTabIndex === 'number') {
                const activeConfig = window.chartConfigurations[window.activeTabIndex];
                if (activeConfig) {
                    activeConfig.hasGeneratedChart = true;
                    activeConfig.chartData = window.chartData;
                    activeConfig.chartOptions = window.chart ? window.chart.w.config : null;
                }
            }
            
            // System-specific UI updates
            if (system === 'visualize') {
                this.updateVisualizeUI(config);
            } else if (system === 'department') {
                this.updateDepartmentUI(config);
            }
            
        } catch (error) {
            console.error('[VisualizeChartUtils] UI update error:', error);
        }
    }
    
    /**
     * Visualize system specific UI updates
     * @param {Object} config - Chart configuration
     */
    static updateVisualizeUI(config) {
        try {
            // Show chart preview after generation
            const chartPreview = document.getElementById('chartPreview');
            if (chartPreview) {
                chartPreview.classList.remove('has-hidden');
            }

            // Update any visualize-specific UI elements
            console.log('[VisualizeChartUtils] Updated visualize UI');

            // Update background theme if needed
            this.updatePreviewBackground();

        } catch (error) {
            console.error('[VisualizeChartUtils] Visualize UI update error:', error);
        }
    }
    
    /**
     * Department system specific UI updates
     * @param {Object} config - Chart configuration  
     */
    static updateDepartmentUI(config) {
        try {
            // Show chart preview after generation
            const chartPreview = document.getElementById('chartPreview');
            if (chartPreview) {
                chartPreview.classList.remove('has-hidden');
            }

            // Update any department-specific UI elements
            console.log('[VisualizeChartUtils] Updated department UI');

            // Update background theme if needed
            this.updatePreviewBackground();

        } catch (error) {
            console.error('[VisualizeChartUtils] Department UI update error:', error);
        }
    }
    
    /**
     * Update preview background based on theme switching
     */
    static updatePreviewBackground() {
        try {
            const chartPreviewDisplayArea = document.getElementById('chartPreviewDisplayArea');
            if (!chartPreviewDisplayArea) return;
            
            // Get system theme
            const htmlRoot = document.documentElement;
            let systemTheme = 'light';
            if (htmlRoot.classList.contains('is-light')) systemTheme = 'light';
            else if (htmlRoot.classList.contains('is-dark')) systemTheme = 'dark';
            else systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            
            // Get switch theme
            const switchTheme = this.getCurrentSwitchTheme();
            
            // Apply inverted background if themes don't match
            if (systemTheme !== switchTheme) {
                chartPreviewDisplayArea.classList.add('has-inverted-preview-background');
            } else {
                chartPreviewDisplayArea.classList.remove('has-inverted-preview-background');
            }
            
            // Update table theme to match chart theme
            this.updateTableTheme();
            
        } catch (error) {
            console.error('[VisualizeChartUtils] Preview background update error:', error);
        }
    }
    
    /**
     * Update table theme to match chart theme switching
     */
    static updateTableTheme() {
        try {
            // Find dataTable and its DIRECT ts-box wrapper specifically
            const dataTable = document.getElementById('dataTable');
            const dataTableWrapper = document.querySelector('.ts-box:has(> #dataTable)');

            // Get current switch theme
            const currentTheme = this.getCurrentSwitchTheme();
            const isDark = currentTheme === 'dark';

            // Update dataTable element itself
            if (dataTable) {
                if (isDark) {
                    dataTable.classList.add('is-dark');
                    dataTable.classList.remove('is-light');
                } else {
                    dataTable.classList.add('is-light');
                    dataTable.classList.remove('is-dark');
                }
            }

            // Update dataTable DIRECT wrapper (ts-box) only
            if (dataTableWrapper) {
                if (isDark) {
                    dataTableWrapper.classList.add('is-dark');
                    dataTableWrapper.classList.remove('is-light');
                } else {
                    dataTableWrapper.classList.add('is-light');
                    dataTableWrapper.classList.remove('is-dark');
                }
            }

        } catch (error) {
            console.error('[VisualizeChartUtils] Table theme update error:', error);
        }
    }

    // ============ VISUALIZE PAGE THEME MANAGEMENT ============

    /**
     * Update export preview background based on export theme vs system theme
     */
    static updateExportPreviewBackground() {
        const systemTheme = this.getCurrentEffectiveTheme();
        const exportTheme = this.getCurrentExportTheme();
        const exportPreview = document.getElementById('exportPreview');

        if (exportPreview) {
            if (systemTheme !== exportTheme) {
                exportPreview.classList.add('is-inverted');
            } else {
                exportPreview.classList.remove('is-inverted');
            }
        }
    }

    /**
     * Initialize theme controls based on current theme
     */
    static initializeThemeControls() {
        const currentTheme = this.getCurrentEffectiveTheme();
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');
        const exportThemeSelect = document.getElementById('exportTheme');

        // Set switchTheme radio buttons to current theme
        if (currentTheme === 'dark') {
            if (darkRadio) darkRadio.checked = true;
        } else {
            if (lightRadio) lightRadio.checked = true;
        }

        // Set export theme to match switch theme
        if (exportThemeSelect) {
            exportThemeSelect.value = currentTheme;
        }

        // Apply initial background inversion if needed
        this.updatePreviewBackground();
        this.updateExportPreviewBackground();
    }

    /**
     * Handle theme radio button changes
     * @param {string} selectedTheme - 'light' or 'dark'
     */
    static handleThemeChange(selectedTheme) {
        this.updatePreviewBackground();

        // Update dataTable theme immediately
        this.updateTableTheme();

        // If chart exists, regenerate with new theme
        if (window.chartData && typeof window.regenerateChartWithTheme === 'function') {
            window.regenerateChartWithTheme();
        }
    }

    /**
     * Handle export theme changes
     */
    static handleExportThemeChange() {
        this.updateExportPreviewBackground();

        // Trigger complete export preview regeneration with new theme
        if (typeof window.regenerateExportPreview === 'function') {
            setTimeout(() => window.regenerateExportPreview(), 100);
        }
    }

    /**
     * Set up event listeners for theme controls
     */
    static setupThemeEventListeners() {
        // Switch theme radio buttons
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');

        if (lightRadio) {
            lightRadio.addEventListener('change', () => {
                if (lightRadio.checked) {
                    this.handleThemeChange('light');
                }
            });
        }

        if (darkRadio) {
            darkRadio.addEventListener('change', () => {
                if (darkRadio.checked) {
                    this.handleThemeChange('dark');
                }
            });
        }

        // Export theme select
        const exportThemeSelect = document.getElementById('exportTheme');
        if (exportThemeSelect) {
            exportThemeSelect.addEventListener('change', () => {
                this.handleExportThemeChange();
            });
        }
    }

    /**
     * Set up system theme change listener
     */
    static setupSystemThemeListener() {
        // Only listen for system theme changes if user is on system theme
        if (window.themeConfig && window.themeConfig.isSystemTheme) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                // Re-initialize theme controls when system theme changes
                this.initializeThemeControls();

                // Notify other components about theme change
                window.dispatchEvent(new CustomEvent('themeChanged', {
                    detail: { theme: this.getCurrentEffectiveTheme() }
                }));
            });
        }
    }

    /**
     * Initialize visualize theme management system
     */
    static initializeVisualizeTheme() {
        // Initialize theme controls
        this.initializeThemeControls();

        // Force initial background update after DOM is ready
        setTimeout(() => {
            this.updatePreviewBackground();
        }, 100);

        // Set up event listeners for theme controls
        this.setupThemeEventListeners();

        // Set up system theme change listener if on system theme
        this.setupSystemThemeListener();

        // Dispatch initial theme change event
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: this.getCurrentEffectiveTheme() }
            }));
        }, 100);
    }
}

// Configure pdfMake fonts for Chinese support
if (typeof pdfMake !== 'undefined') {
    pdfMake.fonts = {
        'NotoSansTC': {
            normal: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-400-normal.ttf',
            bold: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-700-normal.ttf'
        }
    };
}

// Export utility class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VisualizeChartUtils };
} else {
    window.VisualizeChartUtils = VisualizeChartUtils;
}