// Initialize chart generation logic when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Configuration and DOM elements
    const fields = window.visualizeConfig ? window.visualizeConfig.fields : {};
    const chartTypeSelect = document.getElementById('chartType');
    const yAxisSelect = document.getElementById('yAxis');
    const xAxisSelect = document.getElementById('xAxis');
    const generateChartBtn = document.getElementById('generateChartBtn');
    const chartPreview = document.getElementById('chartPreview');
    const showValuesCheckbox = document.getElementById('showValues');
    const showFullGridCheckbox = document.getElementById('showFullGrid');
    const includeTableCheckbox = document.getElementById('includeTable');
    let chart = null;

    // Get system theme from HTML root element or system preference
    function getSystemTheme() {
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) {
            return 'light';
        } else if (htmlRoot.classList.contains('is-dark')) {
            return 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Get current switchTheme setting from radio buttons - avoid infinite recursion
    function getCurrentSwitchTheme() {
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');

        if (lightRadio && lightRadio.checked) {
            return 'light';
        } else if (darkRadio && darkRadio.checked) {
            return 'dark';
        }

        // Fallback to system theme detection directly
        return getSystemTheme();
    }

    // Dynamic theme detection - returns the effective theme that should be used
    function getEffectiveTheme() {
        const systemTheme = getSystemTheme();
        const switchTheme = getCurrentSwitchTheme();
        
        // If switch theme differs from system theme, use switch theme
        if (systemTheme !== switchTheme) {
            return switchTheme;
        }
        
        return systemTheme;
    }

    // Watch for system theme changes
    function watchSystemThemeChanges() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        mediaQuery.addEventListener('change', (e) => {
            console.log('DEBUG: System theme changed to:', e.matches ? 'dark' : 'light');
            updateDataTableTheme();
            // Regenerate chart with new theme if needed
            if (window.chartData && typeof regenerateChartWithTheme === 'function') {
                regenerateChartWithTheme();
            }
        });
        
        // Also watch for HTML class changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    console.log('DEBUG: HTML root class changed');
                    updateDataTableTheme();
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // Update dataTable theme to match current effective theme
    function updateDataTableTheme() {
        const dataTable = document.getElementById('dataTable');
        if (!dataTable) return;
        
        const effectiveTheme = getEffectiveTheme();
        const tableWrapper = dataTable.querySelector('.ts-box');
        const table = dataTable.querySelector('.ts-table');
        
        console.log('DEBUG: Updating dataTable theme to:', effectiveTheme);
        
        if (tableWrapper) {
            if (effectiveTheme === 'dark') {
                tableWrapper.classList.add('is-dark');
                tableWrapper.classList.remove('is-light');
            } else {
                tableWrapper.classList.add('is-light'); 
                tableWrapper.classList.remove('is-dark');
            }
        }
        
        if (table) {
            if (effectiveTheme === 'dark') {
                table.classList.add('is-dark');
                table.classList.remove('is-light');
            } else {
                table.classList.add('is-light');
                table.classList.remove('is-dark'); 
            }
        }
    }

    // chart cleanup using unified utils
    function thoroughChartCleanup() {
        if (window.VisualizeChartUtils) {
            VisualizeChartUtils.thoroughChartCleanup(chartPreview, window.chart);
        } else {
            // Fallback implementation
            try {
                if (window.chart) {
                    window.chart.destroy();
                    window.chart = null;
                }
                DOMUtils.clearElement(chartPreview);
                window.chartData = null;
            } catch (e) {
                DOMUtils.clearElement(chartPreview);
            }
        }
    }

    // Regenerate chart with current theme - Complete regeneration approach
    function regenerateChartWithTheme() {
        if (!window.chartData) return;


        // Simply trigger a complete chart regeneration
        setTimeout(() => {
            if (typeof generateChart === 'function') {
                generateChart();
            }
        }, 100);
    }

    // Make regenerateChartWithTheme available globally
    window.regenerateChartWithTheme = regenerateChartWithTheme;

    // Define Y-axis options with new percentage options
    const yAxisOptions = [
        { value: 'metric_ton', text: '以重量劃分 - 公噸' },
        { value: 'kilogram', text: '以重量劃分 - 公斤' },
        { value: 'weight_percentage_metric_ton', text: '以重量劃分 - 百分比(公噸)' },
        { value: 'weight_percentage_kilogram', text: '以重量劃分 - 百分比(公斤)' },
        { value: 'new_taiwan_dollar', text: '以金額劃分 - 新台幣' },
        { value: 'cost_percentage_new_taiwan_dollar', text: '以金額劃分 - 百分比(新台幣)' },
    ];

    // Generate auto title based on current axis selections
    function generateAutoTitle() {
        const yAxisSelect = document.getElementById('yAxis');
        const xAxisSelect = document.getElementById('xAxis');
        return `${yAxisSelect.options[yAxisSelect.selectedIndex].text} vs. ${xAxisSelect.options[xAxisSelect.selectedIndex].text}`;
    }

    // Function to update the chart icon based on selected chart type
    function updateChartIcon() {
        const chartTypeIcon = document.querySelector('#chartTypeIcon');
        if (chartTypeIcon) {
            chartTypeIcon.classList.remove('is-chart-simple-icon', 'is-chart-column-icon', 'is-chart-pie-icon', 'is-chart-line-icon');

            const selectedChartType = chartTypeSelect.value;
            switch (selectedChartType) {
                case 'bar':
                case 'stacked_bar':
                    chartTypeIcon.classList.add('is-chart-column-icon');
                    break;
                case 'pie':
                case 'donut':
                    chartTypeIcon.classList.add('is-chart-pie-icon');
                    break;
                case 'line':
                    chartTypeIcon.classList.add('is-chart-line-icon');
                    break;
                default:
                    chartTypeIcon.classList.add('is-chart-simple-icon');
            }
        }
    }

    // cleanup function - make it globally available
    if (!window.cleanupChart) {
        window.cleanupChart = thoroughChartCleanup;
    }

    // Preserve original handlers for tabs functionality
    if (!window.originalGenerateChartClick) {
        window.originalGenerateChartClick = function() {
            generateChart();
        };
    }

    // Update Y-axis options based on chart type
    function updateYAxisOptions() {
        const percentageCharts = ['stacked_bar'];
        const selectedChartType = chartTypeSelect.value;
        let filteredOptions = yAxisOptions;

        if (['pie', 'donut'].includes(selectedChartType)) {
            filteredOptions = yAxisOptions.filter(opt =>
                ['metric_ton', 'kilogram', 'new_taiwan_dollar'].includes(opt.value));
        } else if (!percentageCharts.includes(selectedChartType)) {
            filteredOptions = yAxisOptions.filter(opt => !opt.value.includes('percentage'));
        }

        const previousValue = yAxisSelect.value;

        DOMUtils.clearElement(yAxisSelect);
        filteredOptions.forEach(opt => {
            const option = DOMUtils.createElement(yAxisSelect, 'option', { value: opt.value }, opt.text);
            yAxisSelect.appendChild(option);
        });

        const availableValues = filteredOptions.map(opt => opt.value);
        if (previousValue && availableValues.includes(previousValue)) {
            yAxisSelect.value = previousValue;
        } else {
            yAxisSelect.value = filteredOptions[0].value;
        }
    }

    // Update placeholder when Y-axis or X-axis changes
    function updatePlaceholder() {
        const chartTitleInput = document.getElementById('chartTitle');
        if (!chartTitleInput.value.trim()) {
            const autoTitle = generateAutoTitle();
            chartTitleInput.placeholder = autoTitle;
            if (typeof window.updateTabDisplayTitle === 'function' && typeof window.activeTabIndex === 'number') {
                window.updateTabDisplayTitle(window.activeTabIndex, autoTitle);
            }
        }
    }

    // Add event listeners for chart type changes
    chartTypeSelect.addEventListener('change', () => {
        updateYAxisOptions();
        updateChartIcon();
        updatePlaceholder();
    });

    yAxisSelect.addEventListener('change', () => {
        updatePlaceholder();
        // Update dataTable display immediately to reflect unit changes
        if (window.chartData && typeof window.updateCurrentChartTable === 'function') {
            window.updateCurrentChartTable();
        }
    });
    xAxisSelect.addEventListener('change', () => {
        updatePlaceholder();
        // Update dataTable display immediately to reflect X-axis changes
        if (window.chartData && typeof window.updateCurrentChartTable === 'function') {
            window.updateCurrentChartTable();
        }
    });

    // Initialize theme controls and other components
    updateYAxisOptions();
    updateChartIcon();

    // Add event listeners for theme radio buttons to update table theme
    const lightRadio = document.getElementById('light');
    const darkRadio = document.getElementById('dark');
    
    if (lightRadio) {
        lightRadio.addEventListener('change', () => {
            if (lightRadio.checked) {
                console.log('DEBUG: Light theme selected via radio button');
                updateDataTableTheme();
                // Regenerate chart with new theme if chart exists
                if (window.chartData && typeof regenerateChartWithTheme === 'function') {
                    regenerateChartWithTheme();
                }
            }
        });
    }
    
    if (darkRadio) {
        darkRadio.addEventListener('change', () => {
            if (darkRadio.checked) {
                console.log('DEBUG: Dark theme selected via radio button');
                updateDataTableTheme();
                // Regenerate chart with new theme if chart exists
                if (window.chartData && typeof regenerateChartWithTheme === 'function') {
                    regenerateChartWithTheme();
                }
            }
        });
    }

    // Initialize theme monitoring
    watchSystemThemeChanges();
    updateDataTableTheme(); // Initial theme update

    // Show error modal with a custom message using a TS-styled dialog
    function showErrorModal(message) {
        const modal = document.createElement('dialog');
        modal.className = 'ts-modal';

        DOMUtils.replaceContent(modal, (parent) => {
            const content = DOMUtils.createElement(parent, 'div', { class: 'content' });
            
            const tsContent = DOMUtils.createElement(content, 'div', { class: 'ts-content is-center-aligned is-padded' });
            const header = DOMUtils.createElement(tsContent, 'div', { class: 'ts-header is-icon' });
            DOMUtils.createElement(header, 'span', { class: 'ts-icon is-triangle-exclamation-icon' });
            DOMUtils.setText(header.appendChild(document.createTextNode(' 錯誤')), '');
            header.appendChild(document.createTextNode(' 錯誤'));
            
            DOMUtils.createElement(tsContent, 'p', {}, message);
            
            DOMUtils.createElement(content, 'div', { class: 'ts-divider' });
            
            const tertiaryContent = DOMUtils.createElement(content, 'div', { class: 'ts-content is-tertiary' });
            DOMUtils.createElement(tertiaryContent, 'button', { class: 'ts-button is-fluid close-modal' }, '確定');
            
            parent.appendChild(content);
        });

        document.body.appendChild(modal);
        modal.showModal();
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.close();
            document.body.removeChild(modal);
        });
    }

    // Common yAxis configuration with dynamic max value and theme support
    function getYAxisConfig(showFullGridChecked, seriesData, overrideTheme = null) {
        const theme = overrideTheme || getCurrentSwitchTheme();
        const textColor = theme === 'dark' ? '#ffffff' : '#374151';
        const isPercentage = yAxisSelect.value.includes('percentage');
        const isPieOrDonut = ['pie', 'donut'].includes(chartTypeSelect.value);
        let maxValue = 0;

        // Calculate highest value from data
        if (!isPercentage && !isPieOrDonut && seriesData && seriesData.length > 0) {
            try {
                const isStackedChart = chartTypeSelect.value === 'stacked_bar';

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
            tickAmount = showFullGridChecked ? 11 : 6;
            interval = showFullGridChecked ? 10 : 20;
        } else if (maxValue > 0) {
            // Use optimal scale calculation from VisualizeChartUtils
            const idealTickCount = showFullGridChecked ? 10 : 5;
            if (window.VisualizeChartUtils) {
                const scale = window.VisualizeChartUtils.calculateOptimalScale(maxValue, idealTickCount);
                calculatedMax = scale.max;
                tickAmount = scale.tickAmount;
                interval = scale.interval;
            } else {
                // Fallback
                calculatedMax = Math.ceil(maxValue / 5) * 5;
                tickAmount = idealTickCount + 1;
                interval = 5;
            }
        } else {
            // No data: use reasonable defaults
            calculatedMax = showFullGridChecked ? 10 : 5;
            tickAmount = showFullGridChecked ? 11 : 6;
            interval = 1;
        }

        return {
            title: {
                text: yAxisSelect.value === 'metric_ton' ? '公噸' :
                    yAxisSelect.value === 'kilogram' ? '公斤' :
                        yAxisSelect.value === 'new_taiwan_dollar' ? '新台幣' : '百分比',
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                    color: textColor
                },
            },
            min: 0,
            max: calculatedMax,
            tickAmount: Math.max(2, tickAmount),
            forceNiceScale: false,
            labels: {
                formatter: (val) => {
                    // Excel-style conditional formatting based on value magnitude
                    const cleanedVal = window.VisualizeChartUtils ?
                        window.VisualizeChartUtils.formatAxisTick(val, interval) :
                        Number(val).toFixed(2).replace(/\.?0+$/, '');

                    if (yAxisSelect.value === 'new_taiwan_dollar') {
                        const num = parseFloat(cleanedVal);
                        return num.toLocaleString ? num.toLocaleString('zh-TW') : cleanedVal;
                    }
                    if (yAxisSelect.value.includes('percentage')) return `${cleanedVal}%`;
                    return cleanedVal;
                },
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                    colors: [textColor]
                },
            }
        };
    }

    // Common grid configuration
    function getGridConfig(showFullGridChecked) {
        return {
            xaxis: {
                lines: {
                    show: showFullGridChecked
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

    // Fixed pie chart percentage formatter function - 修復百分比計算邏輯
    function getPieChartPercentageFormatter() {
        return function(val, opts) {
            try {
                // Fixed percentage calculation logic for pie charts:
                // For pie charts, val already represents the percentage value calculated by ApexCharts
                // We just need to format it properly with 2 decimal places

                // ApexCharts automatically calculates percentages for pie charts
                // val is already the percentage (0-100), not the raw data value
                const percentage = parseFloat(val) || 0;
                return `${percentage.toFixed(2)}%`;

            } catch (e) {
                return `${(parseFloat(val) || 0).toFixed(2)}%`;
            }
        };
    }

    // Generate chart function with corrected theme support and fixed pie chart percentage calculation
    async function generateChart() {
        console.log('DEBUG: generateChart function called');
        const dataBoxes = document.querySelectorAll('#dataList .ts-box');
        console.log('DEBUG: Found dataBoxes:', dataBoxes.length);
        if (dataBoxes.length === 0) {
            showErrorModal('請至少新增一條線段');
            return;
        }

        const datasets = Array.from(dataBoxes).map(box => {
            const fieldSelect = box.querySelector('.data-field');
            if (!fieldSelect || !fieldSelect.value) {
                showErrorModal('請為所有線段選擇欄位');
                throw new Error('Missing field');
            }
            const [table, field] = fieldSelect.value.split(':');
            let startDate, endDate;
            if (xAxisSelect.value.startsWith('quarter')) {
                const startYear = box.querySelector('.start-date-year')?.value;
                const startQuarter = box.querySelector('.start-date-quarter')?.value;
                const endYear = box.querySelector('.end-date-year')?.value;
                const endQuarter = box.querySelector('.end-date-quarter')?.value;
                if (!startYear || !startQuarter || !endYear || !endQuarter) {
                    showErrorModal('請填寫完整的季度日期');
                    throw new Error('Incomplete quarter dates');
                }
                startDate = `${startYear}-${(startQuarter * 3 - 2).toString().padStart(2, '0')}-01`;
                endDate = `${endYear}-${(endQuarter * 3).toString().padStart(2, '0')}-01`;
                if (new Date(startDate) > new Date(endDate)) {
                    showErrorModal('結束日期不能早於開始日期');
                    throw new Error('Invalid date range');
                }
            } else if (xAxisSelect.value.startsWith('year')) {
                startDate = box.querySelector('.start-date')?.value;
                endDate = box.querySelector('.end-date')?.value;
                if (!startDate || !startDate) {
                    showErrorModal('請填寫完整的年份範圍');
                    throw new Error('Incomplete year dates');
                }
                if (parseInt(startDate) > parseInt(endDate)) {
                    showErrorModal('結束年份不能早於開始年份');
                    throw new Error('Invalid date range');
                }
                startDate = `${startDate}-01-01`;
                endDate = `${endDate}-12-31`;
            } else {
                startDate = box.querySelector('.start-date')?.value;
                endDate = box.querySelector('.end-date')?.value;
                if (!startDate || !endDate) {
                    showErrorModal('請填寫完整的日期範圍');
                    throw new Error('Incomplete dates');
                }
                if (new Date(startDate) > new Date(endDate)) {
                    showErrorModal('結束日期不能早於開始日期');
                    throw new Error('Invalid date range');
                }
                startDate += '-01';
                endDate += '-01';
            }
            const customName = box.querySelector('.data-name')?.value.trim();
            const defaultName = customName || `${fields[table][field].name} (${startDate.slice(0, 7)} 至 ${endDate.slice(0, 7)} 總計)`;
            const name = ['pie', 'donut'].includes(chartTypeSelect.value) ? defaultName : (customName || `${fields[table][field].name} (${startDate.slice(0, 7)} 至 ${endDate.slice(0, 7)})`);
            const colorInput = box.querySelector('.color-picker');
            const color = colorInput ? (colorInput.value || '#000000') : '#000000';
            return { table, field, start_date: startDate, end_date: endDate, name, color };
        });

        const chartTitleInput = document.getElementById('chartTitle');
        const inputTitle = chartTitleInput.value.trim();
        let finalTitle;

        if (inputTitle) {
            finalTitle = inputTitle;
        } else {
            finalTitle = generateAutoTitle();
        }

        const payload = {
            chart_type: chartTypeSelect.value,
            y_axis: yAxisSelect.value,
            x_axis: xAxisSelect.value,
            datasets: datasets,
            title: finalTitle,
            show_values: showValuesCheckbox.checked,
        };


        // cleanup before generating new chart - use thorough cleanup
        thoroughChartCleanup();

        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'ts-loading is-notched';
        loadingIndicator.style.position = 'absolute';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.top = '50%';
        loadingIndicator.style.transform = 'translate(-50%, -50%)';

        const loadingText = document.createElement('div');
        loadingText.className = 'ts-text is-label';
        loadingText.textContent = '製作中...';
        loadingText.style.marginTop = '20px';
        loadingText.style.textAlign = 'center';

        const loadingContainer = document.createElement('div');
        loadingContainer.style.position = 'relative';
        loadingContainer.style.height = '300px';
        loadingContainer.appendChild(loadingIndicator);
        loadingContainer.appendChild(loadingText);

        chartPreview.appendChild(loadingContainer);

        // Use standardized API handling with CSRF token from cookie
        const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
        const result = await APIUtils.post('/management/visualize/', payload, csrfToken);

        // Clear loading indicator immediately using safe method
        DOMUtils.clearElement(chartPreview);

        if (result.success && result.data && result.data.success) {
            const data = result.data;
                    const showFullGridChecked = showFullGridCheckbox.checked;
                    const currentTheme = getCurrentSwitchTheme();
                    const textColor = currentTheme === 'dark' ? '#ffffff' : '#374151';

                    let chartOptions = {
                        chart: {
                            type: chartTypeSelect.value === 'stacked_bar' ? 'bar' : chartTypeSelect.value,
                            height: 600,
                            toolbar: { show: true },
                            zoom: {
                                enabled: true,
                                type: 'x',
                                autoScaleYaxis: false,
                                allowMouseWheelZoom: true
                            },
                            stacked: chartTypeSelect.value === 'stacked_bar',
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
                            mode: currentTheme
                        },
                        series: data.series,
                        xaxis: {
                            categories: data.x_axis_labels,
                            tickAmount: 24,
                            labels: {
                                style: {
                                    fontSize: '14px',
                                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                                    colors: [textColor]
                                }
                            },
                            title: {
                                text: xAxisSelect.value.startsWith('year') ? '年度' : xAxisSelect.value.startsWith('quarter') ? '季度' : xAxisSelect.value === 'only_month' ? '月份' : '年月份',
                                style: {
                                    fontSize: '14px',
                                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                                    color: textColor
                                },
                            },
                        },
                        yaxis: getYAxisConfig(showFullGridChecked, data.series, currentTheme),
                        title: {
                            text: data.title,
                            align: 'center',
                            style: {
                                fontSize: '18px',
                                fontFamily: 'Sarasa Mono TC Bold, sans-serif',
                                color: textColor
                            }
                        },
                        dataLabels: {
                            enabled: showValuesCheckbox.checked,
                            dropShadow: {
                                enabled: true,
                                left: 2,
                                top: 2,
                                opacity: 0.25
                            },
                            style: {
                                fontSize: '15px',
                                fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                                // Remove colors setting, let ApexCharts theme handle it
                            },
                            formatter: function(val, opts) {
                                if (['pie', 'donut'].includes(chartTypeSelect.value)) {
                                    // Use fixed pie chart percentage calculation
                                    return getPieChartPercentageFormatter()(val, opts);
                                }
                                return yAxisSelect.value.includes('percentage') ? `${val.toFixed(2)}%` : val;
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
                            theme: currentTheme,
                            y: {
                                formatter: function(value, { seriesIndex, dataPointIndex, w }) {
                                    // For pie/donut charts, show both percentage and original value with unit
                                    if (['pie', 'donut'].includes(chartTypeSelect.value)) {
                                        // Safe check for w and w.globals
                                        if (w && w.globals && w.globals.series && Array.isArray(w.globals.series)) {
                                            const series = w.globals.series;
                                            const total = series.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
                                            const percent = total > 0 ? ((parseFloat(value) || 0) / total * 100).toFixed(2) : '0.00';

                                            // Get unit from yAxis selection
                                            const unit = yAxisSelect.value === 'metric_ton' ? '公噸' :
                                                        yAxisSelect.value === 'kilogram' ? '公斤' :
                                                        yAxisSelect.value === 'new_taiwan_dollar' ? '元' : '';

                                            return `${percent}% (${value.toLocaleString('zh-TW')} ${unit})`;
                                        }
                                        // Safe fallback if no globals data
                                        const unit = yAxisSelect.value === 'metric_ton' ? '公噸' :
                                                    yAxisSelect.value === 'kilogram' ? '公斤' :
                                                    yAxisSelect.value === 'new_taiwan_dollar' ? '元' : '';
                                        return `${value.toLocaleString('zh-TW')} ${unit}`;
                                    }

                                    // For other charts
                                    if (yAxisSelect.value === 'new_taiwan_dollar') return value.toLocaleString('zh-TW') + ' 元';
                                    if (yAxisSelect.value.includes('percentage')) return `${value.toFixed(2)}%`;
                                    if (yAxisSelect.value === 'metric_ton') return `${value} 公噸`;
                                    if (yAxisSelect.value === 'kilogram') return `${value} 公斤`;
                                    return value;
                                }
                            }
                        },
                        grid: getGridConfig(showFullGridChecked),
                        colors: data.series.map(s => s.color || '#000000'),
                    };

                    if (['pie', 'donut'].includes(data.chart_type)) {
                        chartOptions.labels = data.series.map(s => s.name);
                        chartOptions.series = data.series.map(s => {
                            const total = (s.data || []).reduce((a, b) => a + (b || 0), 0);
                            return total;
                        });
                        chartOptions.yaxis = {
                            title: {
                                text: yAxisSelect.value === 'metric_ton' ? '公噸' :
                                    yAxisSelect.value === 'kilogram' ? '公斤' : '新台幣',
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
                            formatter: getPieChartPercentageFormatter()
                        };

                        delete chartOptions.xaxis;
                    }

                    // Use unified chart and table generation (replaces all the complex ApexCharts setup above)
                    try {
                        const chartConfig = {
                            chart_type: chartTypeSelect.value,
                            y_axis: yAxisSelect.value,
                            x_axis: xAxisSelect.value,
                            title: data.title,
                            show_values: showValuesCheckbox.checked,
                            show_full_grid: showFullGridCheckbox.checked,
                            includeTable: includeTableCheckbox.checked
                        };

                        const dataTable = document.getElementById('dataTable');
                        chart = await window.VisualizeChartUtils.generateChartAndTable(
                            'visualize',
                            data,
                            chartConfig,
                            chartPreview,
                            dataTable
                        );

                        // Double-check chart preview is visible after generation
                        const chartPreviewElement = document.getElementById('chartPreview');
                        if (chartPreviewElement) {
                            chartPreviewElement.classList.remove('has-hidden');
                            console.log('DEBUG: Force-ensured chartPreview is visible after generation');
                        }

                        // Store chart options for tab switching (simplified)
                        if (window.chartConfigurations && window.chartConfigurations.length > 0) {
                            const activeIndex = window.activeTabIndex || 0;
                            if (activeIndex >= 0 && activeIndex < window.chartConfigurations.length) {
                                window.chartConfigurations[activeIndex].chartOptions = chart ? chart.w.config : null;
                                window.chartConfigurations[activeIndex].chartData = data;
                                window.chartConfigurations[activeIndex].datasets = datasets;
                                window.chartConfigurations[activeIndex].yAxis = yAxisSelect.value;
                                window.chartConfigurations[activeIndex].xAxis = xAxisSelect.value;
                                window.chartConfigurations[activeIndex].chartType = chartTypeSelect.value;
                                window.chartConfigurations[activeIndex].groupBy = '';
                                window.chartConfigurations[activeIndex].showValues = showValuesCheckbox.checked;
                                window.chartConfigurations[activeIndex].showFullGrid = showFullGridCheckbox.checked;
                                window.chartConfigurations[activeIndex].includeTable = includeTableCheckbox.checked;
                                window.chartConfigurations[activeIndex].systemType = 'visualize';
                                window.chartConfigurations[activeIndex].apiEndpoint = '/management/visualize/';
                            }
                        }

                    } catch (e) {
                        showErrorModal('圖表創建失敗：' + e.message);
                    }
        } else {
            showErrorModal('生成圖表失敗：' + (result.error || '未知錯誤'));
        }
    }

    // Attach event listener to generate chart button with background update
    generateChartBtn.addEventListener('click', () => {
        // Call tab configuration save function first
        if (typeof window.saveConfigurationOnChartGeneration === 'function') {
            window.saveConfigurationOnChartGeneration();
        }

        // Ensure chart preview is visible before generation
        const chartPreview = document.getElementById('chartPreview');
        if (chartPreview) {
            chartPreview.classList.remove('has-hidden');
        }

        // Update background when generating chart (static update)
        if (typeof window.updatePreviewBackground === 'function') {
            console.log('DEBUG: Updating chartPreviewDisplayArea background...');
            window.updatePreviewBackground();
        }

        generateChart();
    });

    // Make functions globally available for tabs with safe names
    window.generateChart = generateChart;
    window.generateAutoTitle = generateAutoTitle;
    window.getCoreCurrentPreviewTheme = getCurrentSwitchTheme; // Use switchTheme for preview
    window.updateTabDisplayTitle = function(index, displayTitle) {
        if (typeof window.chartConfigurations !== 'undefined' &&
            index >= 0 && index < window.chartConfigurations.length) {
            const tabs = document.querySelectorAll('#sortableTabs .column.ts-box');
            const targetTab = tabs[index];
            if (targetTab) {
                const titleElement = targetTab.querySelector('.tab-title');
                if (titleElement) {
                    titleElement.textContent = displayTitle;
                }
            }
        }
    };
    window.setActiveTab = function(index) {
        if (window.chartConfigurations &&
            typeof index === 'number' &&
            index >= 0 &&
            index < window.chartConfigurations.length) {
            if (typeof window.setActiveTab === 'function') {
                window.setActiveTab(index);
            } else {
                window.activeTabIndex = index;
            }
        }
    };

    // Export updateYAxisOptions for use by other modules (e.g., visualize-tabs.js)
    window.updateYAxisOptions = updateYAxisOptions;

    // Table management removed - now handled by generate chart button (static update)
});

// Safe table generation function according to Prompt-25-09-10.txt requirements
function generateTableSafely(container, data, chartConfig = null) {
    DOMUtils.clearElement(container);
    
    if (!data || !data.series || !data.x_axis_labels) {
        return;
    }

    // Use unified table generation from VisualizeChartUtils
    if (window.VisualizeChartUtils) {
        // Determine table unit from chart config or current Y-axis setting
        const yAxisValue = chartConfig?.yAxis || document.getElementById('yAxis').value;
        let tableUnit = 'metric_ton'; // Default
        
        if (yAxisValue === 'kilogram' || yAxisValue === 'weight_percentage_kilogram') {
            tableUnit = 'kilogram';
        } else if (yAxisValue === 'new_taiwan_dollar' || yAxisValue === 'cost_percentage_new_taiwan_dollar') {
            tableUnit = 'new_taiwan_dollar';
        }
        
        const tableHtml = window.VisualizeChartUtils.generateTableHtml(data, chartConfig, tableUnit,
            yAxisValue?.includes('percentage') || false,
            ['pie', 'donut'].includes(data?.chart_type),
            null);
        DOMUtils.clearElement(container);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tableHtml;
        while (tempDiv.firstChild) {
            container.appendChild(tempDiv.firstChild);
        }
        return;
    }
    
    // Fallback: use generateTableHtml function if available
    if (typeof window.generateTableHtml === 'function') {
        const tableHtml = window.generateTableHtml(data, chartConfig);
        DOMUtils.clearElement(container);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = tableHtml;
        while (tempDiv.firstChild) {
            container.appendChild(tempDiv.firstChild);
        }
        return;
    }

    // Fallback logic if generateTableHtml is not available
    // Use chartConfig's yAxis if available, otherwise fallback to current selection
    const yAxis = chartConfig?.yAxis || document.getElementById('yAxis').value;
    const chartType = data.chart_type;
    
    const isPercentageMode = yAxis.includes('percentage');
    const isPieOrDonut = ['pie', 'donut'].includes(chartType);
    const isStackedBar = chartType === 'stacked_bar';
    const isBarOrLine = ['bar', 'line'].includes(chartType);
    
    // Helper function to format value with proper formatting
    function formatValue(rawValue) {
        const numValue = parseFloat(rawValue) || 0;
        
        if (yAxis === 'new_taiwan_dollar') {
            return numValue.toLocaleString('zh-TW', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + ' 元';
        } else if (yAxis === 'metric_ton') {
            return numValue.toFixed(2) + ' 公噸';
        } else if (yAxis === 'kilogram') {
            return numValue.toFixed(2) + ' 公斤';
        }
        return numValue.toFixed(2);
    }
    
    // Create table structure with ts-box wrapper and theme-aware styling
    const currentTheme = window.VisualizeChartUtils ? 
        VisualizeChartUtils.getCurrentSwitchTheme() : getCurrentSwitchTheme();
    const tableWrapper = DOMUtils.createElement(container, 'div', { 
        class: currentTheme === 'dark' ? 'ts-box is-dark' : 'ts-box' 
    });
    const table = DOMUtils.createElement(tableWrapper, 'table', { 
        class: currentTheme === 'dark' ? 'ts-table is-celled is-dark' : 'ts-table is-celled' 
    });
    const thead = DOMUtils.createElement(table, 'thead');
    const tbody = DOMUtils.createElement(table, 'tbody');
    
    // Create header row based on chart type requirements
    const headerRow = DOMUtils.createElement(thead, 'tr');
    
    if (isPieOrDonut) {
        // 圓餅圖、空心圓餅圖: 日期 | 線段A(A百分比例) | 線段B(B百分比例) | ...
        DOMUtils.createElement(headerRow, 'th', {}, '日期');
        
        data.series.forEach(series => {
            DOMUtils.createElement(headerRow, 'th', {}, `${series.name}(${series.name}百分比例)`);
        });
    } else if (isStackedBar) {
        if (isPercentageMode) {
            // 堆疊直條圖 Y軸百分比: 日期 | 線段A(A百分比例) | 線段B(B百分比例) | ...
            DOMUtils.createElement(headerRow, 'th', {}, '日期');
            
            data.series.forEach(series => {
                DOMUtils.createElement(headerRow, 'th', {}, `${series.name}(${series.name}百分比例)`);
            });
        } else {
            // 堆疊直條圖 Y軸非百分比: 日期 | 線段A | 線段B | ...
            DOMUtils.createElement(headerRow, 'th', {}, '日期');
            
            data.series.forEach(series => {
                DOMUtils.createElement(headerRow, 'th', {}, series.name);
            });
        }
    } else if (isBarOrLine) {
        // 長條圖、折線圖: 日期 | 線段A | 線段B | ...
        DOMUtils.createElement(headerRow, 'th', {}, '日期');
        
        data.series.forEach(series => {
            DOMUtils.createElement(headerRow, 'th', {}, series.name);
        });
    }
    
    // Create data rows
    if (isPieOrDonut) {
        // 圓餅圖、空心圓餅圖處理 - 範圍內各期間數據 + 總計
        
        // Calculate total sum for percentage calculation
        const totalSum = data.series.reduce((sum, series) => {
            const seriesTotal = (series.raw_data || series.data || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            return sum + seriesTotal;
        }, 0);
        
        // First, show individual period data
        data.x_axis_labels.forEach((label, index) => {
            const row = DOMUtils.createElement(tbody, 'tr');
            DOMUtils.createElement(row, 'td', {}, label);
            
            // Calculate period total for this time period
            const periodTotal = data.series.reduce((sum, series) => {
                const value = (series.raw_data && series.raw_data[index]) || (series.data && series.data[index]) || 0;
                return sum + (parseFloat(value) || 0);
            }, 0);
            
            data.series.forEach(series => {
                const rawValue = (series.raw_data && series.raw_data[index]) || (series.data && series.data[index]) || 0;
                const percentage = periodTotal > 0 ? Math.round((rawValue / periodTotal) * 100) : 0;
                
                // 線段A(A百分比例) format: 數值 (百分比)
                const valueText = formatValue(rawValue);
                const percentageText = `${percentage} %`;
                
                DOMUtils.createElement(row, 'td', {}, `${valueText} (${percentageText})`);
            });
        });
        
        // Then, show total summary row
        const totalRow = DOMUtils.createElement(tbody, 'tr');
        
        // Generate total date label
        const totalDateLabel = data.x_axis_labels && data.x_axis_labels.length > 0 
            ? `${data.x_axis_labels[0]} 至 ${data.x_axis_labels[data.x_axis_labels.length - 1]} (總計)`
            : '總計';
        DOMUtils.createElement(totalRow, 'td', {}, totalDateLabel);
        
        data.series.forEach(series => {
            const seriesTotal = (series.raw_data || series.data || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
            const percentage = totalSum > 0 ? Math.round((seriesTotal / totalSum) * 100) : 0;
            
            // 線段A(A百分比例) format: 數值 (百分比)
            const valueText = formatValue(seriesTotal);
            const percentageText = `${percentage} %`;
            
            DOMUtils.createElement(totalRow, 'td', {}, `${valueText} (${percentageText})`);
        });
    } else {
        // 長條圖、折線圖、堆疊直條圖處理
        data.x_axis_labels.forEach((label, index) => {
            const row = DOMUtils.createElement(tbody, 'tr');
            DOMUtils.createElement(row, 'td', {}, label);
            
            if (isStackedBar && isPercentageMode) {
                // 堆疊直條圖 Y軸百分比模式: 線段A(A百分比例) format
                const totalAtIndex = data.series.reduce((sum, series) => {
                    const rawValue = (series.raw_data && series.raw_data[index]) || (series.data && series.data[index]) || 0;
                    return sum + (parseFloat(rawValue) || 0);
                }, 0);
                
                data.series.forEach(series => {
                    const rawValue = (series.raw_data && series.raw_data[index]) || (series.data && series.data[index]) || 0;
                    const percentage = totalAtIndex > 0 ? Math.round((rawValue / totalAtIndex) * 100) : 0;
                    
                    const valueText = formatValue(rawValue);
                    const percentageText = `${percentage} %`;
                    
                    DOMUtils.createElement(row, 'td', {}, `${valueText} (${percentageText})`);
                });
            } else {
                // 一般長條圖、折線圖、堆疊直條圖(非百分比)
                data.series.forEach(series => {
                    const rawValue = (series.raw_data && series.raw_data[index]) || (series.data && series.data[index]) || 0;
                    
                    if (isPercentageMode && !isStackedBar) {
                        // Y軸是百分比模式 (非堆疊圖)
                        const displayValue = (series.data && series.data[index]) || 0;
                        DOMUtils.createElement(row, 'td', {}, `${parseFloat(displayValue).toFixed(2)} %`);
                    } else {
                        // 一般數值模式
                        const valueText = formatValue(rawValue);
                        DOMUtils.createElement(row, 'td', {}, valueText);
                    }
                });
            }
        });
    }
    
    // Note: tableWrapper already contains table, no need to append table separately
}

// Global function to update current chart table with proper configuration
window.updateCurrentChartTable = function() {
    const dataTable = document.getElementById('dataTable');
    const includeTableCheckbox = document.getElementById('includeTable');

    if (window.chartData && includeTableCheckbox && includeTableCheckbox.checked) {
        const currentChartConfig = window.chartConfigurations &&
            typeof window.activeTabIndex === 'number' &&
            window.activeTabIndex >= 0 &&
            window.activeTabIndex < window.chartConfigurations.length ?
            window.chartConfigurations[window.activeTabIndex] : null;

        generateTableSafely(dataTable, window.chartData, currentChartConfig);
        dataTable.classList.remove('has-hidden');
    } else {
        DOMUtils.clearElement(dataTable);
        dataTable.classList.add('has-hidden');
    }
};