/**
 * Department Waste Visualization Core Module
 * Specialized chart generation logic for department analysis
 * Similar to visualize-core.js but adapted for department ranking data
 */

document.addEventListener('DOMContentLoaded', () => {
    // Ensure common utilities are available
    if (!window.DOMUtils || !window.ModalUtils || !window.APIUtils) {
        console.error('[Department Visualization] Common utilities not loaded');
        return;
    }
    if (!window.VisualizeChartUtils) {
        console.error('[Department Visualization] Chart utilities not loaded');
        return;
    }

    // Global variables
    window.departmentChartData = null;
    window.departmentChart = null;
    window.departmentConfig = null;

    // Helper function to get cookie value
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // DOM element references
    const chartPreview = document.getElementById('chartPreview');
    const dataTable = document.getElementById('dataTable');
    const generateChartBtn = document.getElementById('generateChartBtn');
    const chartPreviewDisplayArea = document.getElementById('chartPreviewDisplayArea');
    const chartTitleInput = document.getElementById('chartTitle');
    const showValuesCheckbox = document.getElementById('showValues');
    const includeTableCheckbox = document.getElementById('includeTable');
    
    // Y-axis and time settings
    const yAxisSelect = document.getElementById('yAxis');
    const xAxisSelect = document.getElementById('xAxis');
    const displayTypeSelect = document.getElementById('displayType');
    const showFullGridCheckbox = document.getElementById('showFullGrid');

    // Load department configuration on page load
    async function loadDepartmentConfig() {
        try {
            const response = await fetch('/management/api/visualize_dept/config/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load configuration');
            }

            const config = await response.json();
            if (config.success) {
                window.departmentConfig = config;
                console.log('[Department Visualization] Configuration loaded successfully');
                
                // Fire event to notify other modules that configuration is loaded
                window.dispatchEvent(new CustomEvent('departmentConfigLoaded'));
                
                return config;
            } else {
                throw new Error(config.error || 'Unknown configuration error');
            }
        } catch (error) {
            console.error('[Department Visualization] Configuration loading failed:', error);
            VisualizeChartUtils.showErrorModal('配置載入失敗: ' + error.message);
            return null;
        }
    }

    // Generate chart function - main chart generation logic
    async function generateDepartmentChart() {
        try {
            console.log('[Department Visualization] Starting chart generation');

            // Validate required elements
            if (!chartPreview) {
                throw new Error('Chart preview element not found');
            }

            // Collect dataset configurations from data rows
            const datasets = collectDepartmentDatasets();
            if (!datasets || datasets.length === 0) {
                VisualizeChartUtils.showErrorModal('請至少新增一條線段');
                return;
            }

            // Validate all datasets
            for (let i = 0; i < datasets.length; i++) {
                const validation = validateDepartmentDataset(datasets[i]);
                if (!validation.isValid) {
                    VisualizeChartUtils.showErrorModal(`資料線段 ${i + 1}: ${validation.error}`);
                    return;
                }
            }

            // Generate title using same logic as visualize system
            const inputTitle = chartTitleInput.value.trim();
            let finalTitle;
            
            if (inputTitle) {
                finalTitle = inputTitle;
            } else {
                // When input is empty, use placeholder content like visualize does
                finalTitle = chartTitleInput.placeholder || generateDepartmentAutoTitle();
            }

            // Prepare request data
            const requestData = {
                y_axis: yAxisSelect.value,
                x_axis: xAxisSelect.value,
                display_type: displayTypeSelect.value,
                datasets: datasets,
                title: finalTitle,
                show_values: showValuesCheckbox.checked
            };

            console.log('[Department Visualization] Request data:', requestData);

            // Send request to backend - use SecurityUtils for CSRF token
            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';

            console.log('[Department Visualization] Using CSRF token:', csrfToken ? 'present' : 'missing');
            
            const response = await fetch('/management/api/visualize_dept/data/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const chartData = await response.json();
            console.log('[Department Visualization] Chart data received:', chartData);

            if (!chartData.success) {
                throw new Error(chartData.error || 'Unknown server error');
            }

            // Store chart data globally (both department-specific and global for export compatibility)
            window.departmentChartData = chartData;
            window.chartData = chartData;  // Set global chartData for export compatibility

            // Generate chart using unified chart utilities
            await createDepartmentChart(chartData);

            // Note: Table generation is now handled by the unified generateChartAndTable function

            // Wait for ApexCharts to fully render before saving DOM content
            // This matches the timing used in visualize-tabs.js saveConfigurationOnChartGeneration
            await new Promise(resolve => setTimeout(resolve, 100));

            // Save chart and table content for export functionality (like visualize-tabs.js)
            await saveDepartmentChartContent(chartData);

            // Update chart configuration to mark as generated (for export functionality)
            console.log('[Department Visualization] Updating chart configuration for export...');
            console.log('[Department Visualization] window.chartConfigurations:', window.chartConfigurations);
            console.log('[Department Visualization] window.activeTabIndex:', window.activeTabIndex);

            if (window.chartConfigurations && window.activeTabIndex !== undefined) {
                window.chartConfigurations[window.activeTabIndex].hasGeneratedChart = true;
                window.chartConfigurations[window.activeTabIndex].chartData = chartData;
                window.chartConfigurations[window.activeTabIndex].datasets = datasets;
                window.chartConfigurations[window.activeTabIndex].yAxis = yAxisSelect.value;
                window.chartConfigurations[window.activeTabIndex].xAxis = xAxisSelect.value;
                window.chartConfigurations[window.activeTabIndex].chartType = chartData.chart_type;
                window.chartConfigurations[window.activeTabIndex].groupBy = displayTypeSelect.value;
                window.chartConfigurations[window.activeTabIndex].showValues = showValuesCheckbox.checked;
                window.chartConfigurations[window.activeTabIndex].showFullGrid = showFullGridCheckbox.checked;
                window.chartConfigurations[window.activeTabIndex].includeTable = includeTableCheckbox.checked;
                window.chartConfigurations[window.activeTabIndex].systemType = 'department';
                window.chartConfigurations[window.activeTabIndex].apiEndpoint = '/management/api/visualize_dept/data/';
                window.chartConfigurations[window.activeTabIndex].chartOptions = {
                    chart_type: chartData.chart_type,
                    y_axis: chartData.y_axis,
                    title: chartData.title,
                    show_values: chartData.show_values
                };
                console.log('[Department Visualization] Chart configuration updated successfully');
            } else {
                console.warn('[Department Visualization] chartConfigurations or activeTabIndex not available - initializing fallback');
                
                // Fallback: Initialize minimal chart configurations for export functionality
                if (!window.chartConfigurations) {
                    window.chartConfigurations = [{
                        title: chartData.title || '部門廢棄物分析',
                        hasGeneratedChart: true,
                        chartData: chartData,
                        datasets: datasets,
                        yAxis: yAxisSelect.value,
                        xAxis: xAxisSelect.value,
                        chartType: chartData.chart_type,
                        groupBy: displayTypeSelect.value,
                        showValues: showValuesCheckbox.checked,
                        showFullGrid: showFullGridCheckbox.checked,
                        includeTable: includeTableCheckbox.checked,
                        systemType: 'department',
                        apiEndpoint: '/management/api/visualize_dept/data/',
                        chartOptions: {
                            chart_type: chartData.chart_type,
                            y_axis: chartData.y_axis,
                            title: chartData.title,
                            show_values: chartData.show_values
                        }
                    }];
                    window.activeTabIndex = 0;
                    console.log('[Department Visualization] Fallback chart configuration created');
                } else if (window.chartConfigurations.length > 0) {
                    // Update first configuration as fallback
                    const index = window.activeTabIndex !== undefined ? window.activeTabIndex : 0;
                    window.chartConfigurations[index].hasGeneratedChart = true;
                    window.chartConfigurations[index].chartData = chartData;
                    window.chartConfigurations[index].datasets = datasets;
                    window.chartConfigurations[index].yAxis = yAxisSelect.value;
                    window.chartConfigurations[index].xAxis = xAxisSelect.value;
                    window.chartConfigurations[index].chartType = chartData.chart_type;
                    window.chartConfigurations[index].groupBy = displayTypeSelect.value;
                    window.chartConfigurations[index].showValues = showValuesCheckbox.checked;
                    window.chartConfigurations[index].showFullGrid = showFullGridCheckbox.checked;
                    window.chartConfigurations[index].includeTable = includeTableCheckbox.checked;
                    window.chartConfigurations[index].systemType = 'department';
                    window.chartConfigurations[index].apiEndpoint = '/management/api/visualize_dept/data/';
                    window.chartConfigurations[index].chartOptions = {
                        chart_type: chartData.chart_type,
                        y_axis: chartData.y_axis,
                        title: chartData.title,
                        show_values: chartData.show_values
                    };
                    console.log('[Department Visualization] Updated existing chart configuration as fallback');
                }
            }

            console.log('[Department Visualization] Chart generation completed successfully');

        } catch (error) {
            console.error('[Department Visualization] Chart generation error:', error);
            VisualizeChartUtils.showErrorModal('圖表生成失敗: ' + error.message);
        }
    }

    // Create chart using VisualizeChartUtils
    async function createDepartmentChart(chartData) {
        try {
            // Clean up existing chart
            if (window.departmentChart) {
                window.departmentChart.destroy();
                window.departmentChart = null;
            }

            // Clear chart preview container
            DOMUtils.clearElement(chartPreview);

            // Get current theme
            const currentTheme = getCurrentDepartmentTheme();

            // Create chart configuration matching the standard format
            const chartConfig = {
                chart_type: chartData.chart_type || 'bar',
                y_axis: chartData.y_axis,
                x_axis: 'department_ranking', // Special indicator for department analysis
                title: chartData.title,
                show_values: showValuesCheckbox ? showValuesCheckbox.checked : chartData.show_values,
                show_full_grid: showFullGridCheckbox ? showFullGridCheckbox.checked : false,
                includeTable: includeTableCheckbox ? includeTableCheckbox.checked : false
            };

            // Use unified chart and table generation
            const chart = await window.VisualizeChartUtils.generateChartAndTable(
                'department',
                chartData,
                chartConfig,
                chartPreview,
                dataTable
            );

            // Double-check chart preview is visible after generation
            const chartPreviewElement = document.getElementById('chartPreview');
            if (chartPreviewElement) {
                chartPreviewElement.classList.remove('has-hidden');
                console.log('DEBUG: Department chart preview ensured visible after generation');
            }

            console.log('[Department Visualization] Chart and table created successfully using unified system');

        } catch (error) {
            console.error('[Department Visualization] Chart creation error:', error);
            throw error;
        }
    }

    // NOTE: generateDepartmentTable function removed - now handled by unified VisualizeChartUtils.generateChartAndTable

    /**
     * Save chart and table content for export functionality (like visualize-tabs.js)
     * CRITICAL: This enables multi-chart export by preserving DOM content
     */
    async function saveDepartmentChartContent(chartData) {
        try {
            console.log('[Department Visualization] Saving chart content for export...');

            // Get current configuration index
            const configIndex = window.activeTabIndex !== undefined ? window.activeTabIndex : 0;

            // Ensure chartConfigurations exists
            if (!window.chartConfigurations) {
                window.chartConfigurations = [];
            }

            // Ensure configuration exists
            if (!window.chartConfigurations[configIndex]) {
                window.chartConfigurations[configIndex] = {};
            }

            const config = window.chartConfigurations[configIndex];

            // Save chart content - clone the current chart preview
            if (chartPreview && !chartPreview.classList.contains('has-hidden')) {
                config.chartContent = config.chartContent || {};
                config.chartContent.chart = chartPreview.cloneNode(true);
                console.log('[Department Visualization] Chart content saved');
            }

            // Save table content - clone the current data table
            if (dataTable && !dataTable.classList.contains('has-hidden')) {
                config.chartContent = config.chartContent || {};
                config.chartContent.table = dataTable.cloneNode(true);
                console.log('[Department Visualization] Table content saved');
            }

            // Update title for display
            config.displayTitle = chartData.title;
            config.title = chartData.title;
            config.chartTitle = chartData.title;

            console.log('[Department Visualization] Chart content saved successfully for export');

        } catch (error) {
            console.error('[Department Visualization] Error saving chart content:', error);
        }
    }

    // Collect dataset configurations from DOM
    function collectDepartmentDatasets() {
        const datasets = [];
        const dataBoxes = document.querySelectorAll('#dataList .ts-box:not(#addChartBtnContainer)');

        dataBoxes.forEach((box, index) => {
            try {
                const startDateInput = box.querySelector('.start-date');
                const endDateInput = box.querySelector('.end-date');
                const nameInput = box.querySelector('.data-name');
                const colorInput = box.querySelector('.color-picker');
                const wasteTypeSelect = box.querySelector('.waste-type-select');
                const rankingTypeSelect = box.querySelector('.ranking-type-select');
                const rankingCountInput = box.querySelector('.ranking-count-input');

                if (!startDateInput || !endDateInput || !nameInput || !colorInput || 
                    !wasteTypeSelect || !rankingTypeSelect || !rankingCountInput) {
                    console.warn(`[Department Visualization] Missing elements in dataset ${index + 1}`);
                    return;
                }

                // Generate intelligent default name like visualize system
                const customName = nameInput.value.trim();
                let defaultName;

                if (customName) {
                    defaultName = customName;
                } else {
                    // Create default name based on waste type and date range
                    const wasteTypeName = wasteTypeSelect.options[wasteTypeSelect.selectedIndex]?.text || '廢棄物';
                    const startDate = startDateInput.value;
                    const endDate = endDateInput.value;

                    // Format similar to visualize system
                    if (startDate && endDate) {
                        defaultName = `${wasteTypeName} (${startDate} 至 ${endDate})`;
                    } else {
                        defaultName = `${wasteTypeName} 排名分析`;
                    }
                }

                const dataset = {
                    waste_type_id: wasteTypeSelect.value,
                    start_date: startDateInput.value,
                    end_date: endDateInput.value,
                    ranking_type: rankingTypeSelect.value,
                    ranking_count: rankingCountInput.value,
                    name: defaultName,
                    color: colorInput.value || '#007bff'
                };

                datasets.push(dataset);

            } catch (error) {
                console.error(`[Department Visualization] Error collecting dataset ${index + 1}:`, error);
            }
        });

        return datasets;
    }

    // Validate department dataset
    function validateDepartmentDataset(dataset) {
        // Check required fields
        if (!dataset.waste_type_id) {
            return { isValid: false, error: '請選擇廢棄物種類' };
        }

        if (!dataset.start_date) {
            return { isValid: false, error: '請填寫完整的年份範圍' };
        }

        if (!dataset.end_date) {
            return { isValid: false, error: '請填寫完整的年份範圍' };
        }

        if (!dataset.ranking_type) {
            return { isValid: false, error: '請選擇排名類型（最多/最少）' };
        }

        if (!dataset.ranking_count || isNaN(parseInt(dataset.ranking_count))) {
            // Auto-set to department count if empty
            const departmentCount = (window.departmentConfig && window.departmentConfig.departments) 
                ? window.departmentConfig.departments.length 
                : null;
            if (departmentCount) {
                dataset.ranking_count = departmentCount.toString();
            } else {
                return { isValid: false, error: '請輸入有效的排名數量' };
            }
        }

        // Validate year format
        const startYear = parseInt(dataset.start_date);
        const endYear = parseInt(dataset.end_date);

        if (startYear < 1970 || startYear > 9999) {
            return { isValid: false, error: '開始年份必須在 1970-9999 之間' };
        }

        if (endYear < 1970 || endYear > 9999) {
            return { isValid: false, error: '結束年份必須在 1970-9999 之間' };
        }

        if (startYear > endYear) {
            return { isValid: false, error: '結束年份不能早於開始年份' };
        }

        // Validate ranking count
        const rankingCount = parseInt(dataset.ranking_count);
        if (rankingCount < 1) {
            return { isValid: false, error: '排名數量必須大於 0' };
        }

        return { isValid: true };
    }

    // Get current theme for department charts
    function getCurrentDepartmentTheme() {
        // Check theme switch state
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');
        
        if (lightRadio && lightRadio.checked) {
            return 'light';
        } else if (darkRadio && darkRadio.checked) {
            return 'dark';
        }
        
        // Fallback to system theme detection
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) return 'light';
        if (htmlRoot.classList.contains('is-dark')) return 'dark';
        
        // Final fallback to browser preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Update chart preview background based on theme (matching visualize system logic)
    function updateDepartmentPreviewBackground() {
        if (!chartPreviewDisplayArea) return;

        const systemTheme = getCurrentSystemTheme();
        const switchTheme = getCurrentDepartmentTheme();
        
        // Apply inverted background if themes don't match (using same class as visualize system)
        if (systemTheme !== switchTheme) {
            chartPreviewDisplayArea.classList.add('has-inverted-preview-background');
        } else {
            chartPreviewDisplayArea.classList.remove('has-inverted-preview-background');
        }
    }

    // Get system theme
    function getCurrentSystemTheme() {
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) return 'light';
        if (htmlRoot.classList.contains('is-dark')) return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Generate automatic title for department charts (similar to visualize system)
    function generateDepartmentAutoTitle() {
        const yAxisText = yAxisSelect.options[yAxisSelect.selectedIndex].text;
        const xAxisText = xAxisSelect.options[xAxisSelect.selectedIndex].text;
        const displayTypeText = displayTypeSelect.options[displayTypeSelect.selectedIndex].text;
        return `部門 ${yAxisText} (${xAxisText}, ${displayTypeText})`;
    }

    // Update placeholder when axis selections change
    function updateDepartmentPlaceholder() {
        if (chartTitleInput && !chartTitleInput.value.trim()) {
            const autoTitle = generateDepartmentAutoTitle();
            chartTitleInput.placeholder = autoTitle;
        }
    }

    // Event listeners setup
    function setupDepartmentEventListeners() {
        // Generate chart button
        if (generateChartBtn) {
            generateChartBtn.addEventListener('click', () => {
                // Ensure chart preview is visible before generation
                const chartPreview = document.getElementById('chartPreview');
                if (chartPreview) {
                    chartPreview.classList.remove('has-hidden');
                    console.log('DEBUG: Department chart preview made visible before generation');
                }

                generateDepartmentChart();
            });
        }

        // Theme switching
        const themeRadios = document.querySelectorAll('#switchTheme input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                updateDepartmentPreviewBackground();
                // Regenerate chart with new theme if chart data exists
                if (window.departmentChartData) {
                    createDepartmentChart(window.departmentChartData);
                }
            });
        });

        // Update placeholder when axis or display options change
        if (yAxisSelect) {
            yAxisSelect.addEventListener('change', updateDepartmentPlaceholder);
        }
        
        if (xAxisSelect) {
            xAxisSelect.addEventListener('change', updateDepartmentPlaceholder);
        }
        
        if (displayTypeSelect) {
            displayTypeSelect.addEventListener('change', updateDepartmentPlaceholder);
        }

        // NOTE: Dynamic ts-switch updates removed per user request
        // Switches (showValues, showFullGrid, includeTable) will only take effect 
        // when chart is generated, not on real-time change events
    }

    // Initialize theme radio buttons to match current system theme
    function initializeDepartmentTheme() {
        const currentTheme = getCurrentSystemTheme();
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');

        // Set switchTheme radio buttons to current theme
        if (currentTheme === 'dark') {
            if (darkRadio) darkRadio.checked = true;
        } else {
            if (lightRadio) lightRadio.checked = true;
        }

        // Apply initial background inversion if needed
        updateDepartmentPreviewBackground();

        console.log('[Department Visualization] Theme initialized:', currentTheme);
    }

    // Initialize department visualization
    async function initializeDepartmentVisualization() {
        try {
            console.log('[Department Visualization] Initializing...');

            // Load configuration
            const config = await loadDepartmentConfig();
            if (!config) {
                throw new Error('Failed to load department configuration');
            }

            // Initialize theme settings
            initializeDepartmentTheme();

            // Setup event listeners
            setupDepartmentEventListeners();

            // Set initial placeholder for chart title
            updateDepartmentPlaceholder();

            // Initialize exportTheme to match current system theme
            if (window.VisualizeChartUtils && typeof window.VisualizeChartUtils.initializeThemeControls === 'function') {
                window.VisualizeChartUtils.initializeThemeControls();
                console.log('[Department Visualization] Export theme initialized to match system theme');
            }

            console.log('[Department Visualization] Initialization completed successfully');

        } catch (error) {
            console.error('[Department Visualization] Initialization failed:', error);
            VisualizeChartUtils.showErrorModal('初始化失敗: ' + error.message);
        }
    }

    // Global functions for external access
    window.generateDepartmentChart = generateDepartmentChart;
    window.getDepartmentChartData = () => window.departmentChartData;
    window.getDepartmentConfig = () => window.departmentConfig;

    // Initialize when document is ready
    initializeDepartmentVisualization();

    console.log('[Department Visualization Core] Module loaded successfully');
});