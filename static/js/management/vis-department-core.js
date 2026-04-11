/**
 * Department Waste Visualization Core Module
 * Enhanced to handle both Department Ranking and Transportation Data
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
    
    // ========== 新增：新的選擇器參考 ==========
    // 資料來源、計量單位、時間單位、顯示方法
    const dataSourceSelect = document.getElementById('dataSource');  // 資料來源
    const yAxisSelect = document.getElementById('yAxis');             // 計量單位
    const xAxisSelect = document.getElementById('xAxis');             // 時間單位
    const displayTypeSelect = document.getElementById('displayType');  // 顯示方法
    
    // Y-axis and time settings (保留用於向後相容)
    const showFullGridCheckbox = document.getElementById('showFullGrid');


    // Load configuration on page load
    async function loadDepartmentConfig() {
        try {
            const response = await fetch('/management/api/visualize_dept/config/', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('Failed to load configuration');

            const config = await response.json();
            if (config.success) {
                window.departmentConfig = config;
                console.log('[Department Visualization] Configuration loaded successfully');
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

    // 🌟 核心修改：生成圖表邏輯
    async function generateDepartmentChart() {
        try {
            console.log('[Department Visualization] Starting chart generation');

            if (!chartPreview) throw new Error('Chart preview element not found');

            const datasets = collectDepartmentDatasets();
            if (!datasets || datasets.length === 0) {
                VisualizeChartUtils.showErrorModal('請至少新增一條線段');
                return;
            }

            // 取得目前的資料來源 (部門 或 載運)
            const currentSource = dataSourceSelect ? dataSourceSelect.value : 'department';

            // Validate all datasets based on the source
            for (let i = 0; i < datasets.length; i++) {
                const validation = validateDepartmentDataset(datasets[i], currentSource);
                if (!validation.isValid) {
                    VisualizeChartUtils.showErrorModal(`資料線段 ${i + 1}: ${validation.error}`);
                    return;
                }
            }

            // Generate title
            const inputTitle = chartTitleInput.value.trim();
            const finalTitle = inputTitle || chartTitleInput.placeholder || generateDepartmentAutoTitle();

            // Prepare request data with new format
            const requestData = {
                // 新格式參數
                data_source: dataSourceSelect.value,      // 資料來源
                unit: yAxisSelect.value,                  // 計量單位
                time_unit: xAxisSelect.value,             // 時間單位
                display_method: displayTypeSelect.value,  // 顯示方法
                // 共通參數
                datasets: datasets,
                title: finalTitle,
                show_values: showValuesCheckbox.checked,
                // 保留舊格式參數用於向後相容
                y_axis: yAxisSelect.value,
                x_axis: xAxisSelect.value,
                display_type: displayTypeSelect.value === 'priority' ? 'separate' : 'combine'
            };

            console.log('[Department Visualization] Request data:', requestData);

            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
            
            // 🌟 核心修改：根據資料來源決定要打哪一支 API
            const apiEndpoint = currentSource === 'transportation' 
                ? '/management/api/visualize_transport/data/' // 載運紀錄的 API
                : '/management/api/visualize_dept/data/';     // 原本部門的 API

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const chartData = await response.json();
            console.log('[Department Visualization] Chart data received:', chartData);

            if (!chartData.success) throw new Error(chartData.error || 'Unknown server error');

            window.departmentChartData = chartData;
            window.chartData = chartData; 

            await createDepartmentChart(chartData);
            await new Promise(resolve => setTimeout(resolve, 100));
            await saveDepartmentChartContent(chartData);

            // Update configuration for export
            if (window.chartConfigurations && window.activeTabIndex !== undefined) {
                window.chartConfigurations[window.activeTabIndex] = {
                    ...window.chartConfigurations[window.activeTabIndex],
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
                    systemType: currentSource, // 紀錄是 department 還是 transportation
                    apiEndpoint: apiEndpoint,
                    chartOptions: {
                        chart_type: chartData.chart_type,
                        y_axis: chartData.y_axis,
                        title: chartData.title,
                        show_values: chartData.show_values
                    }
                };
            } else if (!window.chartConfigurations) {
                window.chartConfigurations = [{
                    title: chartData.title || '圖表分析',
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
                    systemType: currentSource,
                    apiEndpoint: apiEndpoint,
                    chartOptions: {
                        chart_type: chartData.chart_type,
                        y_axis: chartData.y_axis,
                        title: chartData.title,
                        show_values: chartData.show_values
                    }
                }];
                window.activeTabIndex = 0;
            }

            console.log('[Department Visualization] Chart generation completed successfully');

        } catch (error) {
            console.error('[Department Visualization] Chart generation error:', error);
            VisualizeChartUtils.showErrorModal('圖表生成失敗: ' + error.message);
        }
    }

    async function createDepartmentChart(chartData) {
        try {
            if (window.departmentChart) {
                window.departmentChart.destroy();
                window.departmentChart = null;
            }

            DOMUtils.clearElement(chartPreview);
            
            // 🌟 判斷資料來源，如果是載運紀錄，X 軸標籤行為要改變
            const currentSource = dataSourceSelect ? dataSourceSelect.value : 'department';

            const chartConfig = {
                chart_type: chartData.chart_type || 'bar',
                y_axis: chartData.y_axis,
                x_axis: currentSource === 'transportation' ? 'time_series' : 'department_ranking', 
                title: chartData.title,
                show_values: showValuesCheckbox ? showValuesCheckbox.checked : chartData.show_values,
                show_full_grid: showFullGridCheckbox ? showFullGridCheckbox.checked : false,
                includeTable: includeTableCheckbox ? includeTableCheckbox.checked : false
            };

            const chart = await window.VisualizeChartUtils.generateChartAndTable(
                currentSource, // Pass source to utils
                chartData,
                chartConfig,
                chartPreview,
                dataTable
            );

            const chartPreviewElement = document.getElementById('chartPreview');
            if (chartPreviewElement) chartPreviewElement.classList.remove('has-hidden');

        } catch (error) {
            console.error('[Department Visualization] Chart creation error:', error);
            throw error;
        }
    }

    async function saveDepartmentChartContent(chartData) {
        try {
            const configIndex = window.activeTabIndex !== undefined ? window.activeTabIndex : 0;
            if (!window.chartConfigurations) window.chartConfigurations = [];
            if (!window.chartConfigurations[configIndex]) window.chartConfigurations[configIndex] = {};

            const config = window.chartConfigurations[configIndex];

            if (chartPreview && !chartPreview.classList.contains('has-hidden')) {
                config.chartContent = config.chartContent || {};
                config.chartContent.chart = chartPreview.cloneNode(true);
            }

            if (dataTable && !dataTable.classList.contains('has-hidden')) {
                config.chartContent = config.chartContent || {};
                config.chartContent.table = dataTable.cloneNode(true);
            }

            config.displayTitle = chartData.title;
            config.title = chartData.title;
            config.chartTitle = chartData.title;
        } catch (error) {
            console.error('[Department Visualization] Error saving chart content:', error);
        }
    }

    // 🌟 更新：收集資料時也要考慮資料來源
    function collectDepartmentDatasets() {
        const datasets = [];
        const dataBoxes = document.querySelectorAll('#dataList .ts-box:not(#addChartBtnContainer)');
        const xAxisValue = xAxisSelect ? xAxisSelect.value : 'year_sum';

        dataBoxes.forEach((box, index) => {
            try {
                const nameInput = box.querySelector('.data-name');
                const colorInput = box.querySelector('.color-picker');
                
                // 只有部門模式才有這三個選項
                const wasteTypeSelect = box.querySelector('.waste-type-select');
                const rankingTypeSelect = box.querySelector('.ranking-type-select');
                const rankingCountInput = box.querySelector('.ranking-count-input');

                // 根據時間單位收集不同格式的日期
                let startDate = '';
                let endDate = '';

                if (xAxisValue.startsWith('quarter')) {
                    // 季度格式：YYYY-Q
                    const startYear = box.querySelector('.start-date-year');
                    const startQuarter = box.querySelector('.start-date-quarter');
                    const endYear = box.querySelector('.end-date-year');
                    const endQuarter = box.querySelector('.end-date-quarter');

                    if (startYear && startQuarter && endYear && endQuarter) {
                        startDate = `${startYear.value}-${startQuarter.value}`;
                        endDate = `${endYear.value}-${endQuarter.value}`;
                    }
                } else if (xAxisValue.startsWith('month')) {
                    // 月份格式：YYYY-MM
                    const startMonthInput = box.querySelector('.start-date');
                    const endMonthInput = box.querySelector('.end-date');

                    if (startMonthInput && endMonthInput) {
                        startDate = startMonthInput.value;
                        endDate = endMonthInput.value;
                    }
                } else {
                    // 年份格式：YYYY
                    const startYearInput = box.querySelector('.start-date');
                    const endYearInput = box.querySelector('.end-date');

                    if (startYearInput && endYearInput) {
                        startDate = startYearInput.value;
                        endDate = endYearInput.value;
                    }
                }

                if (!nameInput || !colorInput || !wasteTypeSelect || 
                    !rankingTypeSelect || !rankingCountInput || !startDate || !endDate) {
                    console.warn(`[Department Visualization] Missing elements in dataset ${index + 1}`);
                    return;
                }

                const customName = nameInput.value.trim();
                let defaultName = customName;

                if (customName) {
                    defaultName = customName;
                } else {
                    // Create default name based on waste type and date range
                    const wasteTypeName = wasteTypeSelect.options[wasteTypeSelect.selectedIndex]?.text || '廢棄物';

                    // Format similar to visualize system
                    if (startDate && endDate) {
                        defaultName = `${wasteTypeName} (${startDate} 至 ${endDate})`;
                    } else {
                        defaultName = startDate && endDate ? `載運紀錄 (${startDate} 至 ${endDate})` : `載運趨勢分析`;
                    }
                }

                const dataset = {
                    waste_type_id: wasteTypeSelect.value,
                    start_date: startDate,
                    end_date: endDate,
                    ranking_type: rankingTypeSelect.value,
                    ranking_count: rankingCountInput.value,
                    name: defaultName,
                    color: colorInput.value || '#007bff'
                };

                // 部門專屬欄位
                if (currentSource === 'department') {
                    dataset.waste_type_id = wasteTypeSelect?.value || '';
                    dataset.ranking_type = rankingTypeSelect?.value || 'most';
                    dataset.ranking_count = rankingCountInput?.value || '';
                }

                datasets.push(dataset);

            } catch (error) {
                console.error(`[Department Visualization] Error collecting dataset ${index + 1}:`, error);
            }
        });

        return datasets;
    }

    // 🌟 更新：驗證邏輯支援兩種模式
    function validateDepartmentDataset(dataset, source) {
        if (!dataset.start_date || !dataset.end_date) return { isValid: false, error: '請填寫完整的年份範圍' };

        const startYear = parseInt(dataset.start_date);
        const endYear = parseInt(dataset.end_date);
        if (startYear < 1970 || startYear > 9999) return { isValid: false, error: '開始年份必須在 1970-9999 之間' };
        if (endYear < 1970 || endYear > 9999) return { isValid: false, error: '結束年份必須在 1970-9999 之間' };
        if (startYear > endYear) return { isValid: false, error: '結束年份不能早於開始年份' };

        // 載運紀錄不需要檢查廢棄物種類和排名
        if (source === 'department') {
            if (!dataset.waste_type_id) return { isValid: false, error: '請選擇廢棄物種類' };
            if (!dataset.ranking_type) return { isValid: false, error: '請選擇排名類型（最多/最少）' };
            
            if (!dataset.ranking_count || isNaN(parseInt(dataset.ranking_count))) {
                const departmentCount = (window.departmentConfig && window.departmentConfig.departments) ? window.departmentConfig.departments.length : null;
                if (departmentCount) dataset.ranking_count = departmentCount.toString();
                else return { isValid: false, error: '請輸入有效的排名數量' };
            }

            if (parseInt(dataset.ranking_count) < 1) return { isValid: false, error: '排名數量必須大於 0' };
        }

        return { isValid: true };
    }

    function getCurrentDepartmentTheme() {
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');
        if (lightRadio && lightRadio.checked) return 'light';
        if (darkRadio && darkRadio.checked) return 'dark';
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) return 'light';
        if (htmlRoot.classList.contains('is-dark')) return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function updateDepartmentPreviewBackground() {
        if (!chartPreviewDisplayArea) return;
        const systemTheme = getCurrentSystemTheme();
        const switchTheme = getCurrentDepartmentTheme();
        if (systemTheme !== switchTheme) {
            chartPreviewDisplayArea.classList.add('has-inverted-preview-background');
        } else {
            chartPreviewDisplayArea.classList.remove('has-inverted-preview-background');
        }
    }

    function getCurrentSystemTheme() {
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) return 'light';
        if (htmlRoot.classList.contains('is-dark')) return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // 🌟 更新：標題自動生成邏輯加入資料來源判斷
    function generateDepartmentAutoTitle() {
        const yAxisText = yAxisSelect.options[yAxisSelect.selectedIndex].text;
        const xAxisText = xAxisSelect.options[xAxisSelect.selectedIndex].text;
        const displayTypeText = displayTypeSelect.options[displayTypeSelect.selectedIndex].text;
        const currentSource = dataSourceSelect ? dataSourceSelect.options[dataSourceSelect.selectedIndex].text : '部門';
        
        return `${currentSource} ${yAxisText} (${xAxisText}, ${displayTypeText})`;
    }

    function updateDepartmentPlaceholder() {
        if (chartTitleInput && !chartTitleInput.value.trim()) {
            chartTitleInput.placeholder = generateDepartmentAutoTitle();
        }
    }

    function setupDepartmentEventListeners() {
        if (generateChartBtn) generateChartBtn.addEventListener('click', generateDepartmentChart);

        const themeRadios = document.querySelectorAll('#switchTheme input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                updateDepartmentPreviewBackground();
                if (window.departmentChartData) createDepartmentChart(window.departmentChartData);
            });
        });

        if (yAxisSelect) yAxisSelect.addEventListener('change', updateDepartmentPlaceholder);
        if (xAxisSelect) xAxisSelect.addEventListener('change', updateDepartmentPlaceholder);
        if (displayTypeSelect) displayTypeSelect.addEventListener('change', updateDepartmentPlaceholder);
        
        // 🌟 當資料來源改變時，更新標題的 placeholder
        if (dataSourceSelect) dataSourceSelect.addEventListener('change', updateDepartmentPlaceholder);
    }

    function initializeDepartmentTheme() {
        const currentTheme = getCurrentSystemTheme();
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');
        if (currentTheme === 'dark' && darkRadio) darkRadio.checked = true;
        else if (lightRadio) lightRadio.checked = true;
        updateDepartmentPreviewBackground();
    }

    async function initializeDepartmentVisualization() {
        try {
            await loadDepartmentConfig();
            initializeDepartmentTheme();
            setupDepartmentEventListeners();
            updateDepartmentPlaceholder();
            if (window.VisualizeChartUtils && typeof window.VisualizeChartUtils.initializeThemeControls === 'function') {
                window.VisualizeChartUtils.initializeThemeControls();
            }
        } catch (error) {
            console.error('[Department Visualization] Initialization failed:', error);
            VisualizeChartUtils.showErrorModal('初始化失敗: ' + error.message);
        }
    }

    window.generateDepartmentChart = generateDepartmentChart;
    window.getDepartmentChartData = () => window.departmentChartData;
    window.getDepartmentConfig = () => window.departmentConfig;

    initializeDepartmentVisualization();
});