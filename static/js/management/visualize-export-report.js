/**
 * Medical Waste Management System - Multi-Report Export Module
 * Complete implementation based on Linus Torvalds software engineering philosophy
 * - Good Taste: Eliminates special cases through unified data structures
 * - Never Break Userspace: Reuses existing mechanisms without breaking compatibility
 * - Pragmatism: Solves real problems with minimal complexity
 * - Simplicity: Clean, flat logic without deep nesting
 */

class VisualizeExportReport {
    constructor() {
        this.isInitialized = false;
        this.currentPreviewContent = null;
        this.exportStrategies = this.initializeExportStrategies();
        this.init();
    }

    /**
     * Initialize the export report module
     */
    init() {
        if (this.isInitialized) return;

        this.bindEvents();
        this.initializeDefaultSettings();
        this.isInitialized = true;
        console.log('[ExportReport] Initialized with Linus philosophy approach');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Main generate report button
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.openExportModal());
        }

        // Export preview modal events
        this.bindModalEvents();
    }

    /**
     * Bind modal-specific events
     */
    bindModalEvents() {
        // Theme selection
        const exportTheme = document.getElementById('exportTheme');
        if (exportTheme) {
            exportTheme.addEventListener('change', () => this.regeneratePreview());
        }

        // File type selection
        const exportFileType = document.getElementById('exportFileType');
        if (exportFileType) {
            exportFileType.addEventListener('change', () => this.handleFileTypeChange());
        }

        // Layout option selections - CRITICAL: Bind all layout dropdown events
        this.bindLayoutOptionEvents();

        // Export button - corrected ID
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.executeExport());
        }

        // Close button
        const closeBtn = document.querySelector('#exportPreviewModal .close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
    }

    /**
     * Bind layout option change events for all format types
     */
    bindLayoutOptionEvents() {
        // Excel layout options
        const xlsxLayoutSelect = document.querySelector('#exportLayoutXlsx select');
        if (xlsxLayoutSelect) {
            xlsxLayoutSelect.addEventListener('change', () => this.regeneratePreview());
        }

        // PNG layout options
        const pngLayoutSelect = document.querySelector('#exportLayoutPng select');
        if (pngLayoutSelect) {
            pngLayoutSelect.addEventListener('change', () => this.regeneratePreview());
        }

        // PDF layout options (also used by print)
        const pdfLayoutSelect = document.querySelector('#exportLayoutPdf select');
        if (pdfLayoutSelect) {
            pdfLayoutSelect.addEventListener('change', () => this.regeneratePreview());
        }

        console.log('[ExportReport] Layout option events bound');
    }

    // ==================== STRATEGY PATTERN: Eliminate Special Cases ====================

    /**
     * Initialize export strategies - unified interface for all export types
     */
    initializeExportStrategies() {
        return {
            xlsx: {
                separate: this.exportExcelSeparate.bind(this),
                multiple_sheets: this.exportExcelMultipleSheets.bind(this),
                single_sheet: this.exportExcelSingleSheet.bind(this)
            },
            png: {
                separate: this.exportPngSeparate.bind(this),
                chart_with_table: this.exportPngChartWithTable.bind(this),
                charts_and_tables: this.exportPngChartsAndTables.bind(this),
                all_in_one: this.exportPngAllInOne.bind(this)
            },
            pdf: {
                page_break: this.exportPdfPageBreak.bind(this),
                no_page_break: this.exportPdfNoPageBreak.bind(this),
                charts_tables_separate_break: this.exportPdfSeparateBreak.bind(this),
                charts_tables_separate_no_break: this.exportPdfSeparateNoBreak.bind(this)
            },
            print: {
                page_break: this.printPdfPageBreak.bind(this),
                no_page_break: this.printPdfNoPageBreak.bind(this),
                charts_tables_separate_break: this.printPdfSeparateBreak.bind(this),
                charts_tables_separate_no_break: this.printPdfSeparateNoBreak.bind(this)
            }
        };
    }

    // ==================== CONTENT ACQUISITION: Trust Existing Mechanisms ====================

    /**
     * Get valid chart configurations - core logic
     * UNIFIED: Works with both visualize and vis-department systems
     */
    getValidChartConfigurations() {
        if (!window.chartConfigurations || !Array.isArray(window.chartConfigurations)) {
            console.warn('[ExportReport] No chart configurations found');
            return [];
        }

        console.log(`[ExportReport] Total chart configurations: ${window.chartConfigurations.length}`);

        const validCharts = [];

        for (let i = 0; i < window.chartConfigurations.length; i++) {
            const config = window.chartConfigurations[i];

            console.log(`[ExportReport] Checking config ${i}:`, {
                hasGeneratedChart: config.hasGeneratedChart,
                hasChartContent: !!config.chartContent,
                hasChart: !!(config.chartContent && config.chartContent.chart),
                title: config.displayTitle || config.title || config.chartTitle
            });

            // Include ALL charts that have been generated, regardless of chartContent
            // visualize-tabs.js guarantees hasGeneratedChart means there's valid content
            if (config.hasGeneratedChart) {
                validCharts.push({
                    id: `chart-${i}`,
                    originalIndex: i,
                    title: config.displayTitle || config.title || config.chartTitle || `圖表 ${i + 1}`,

                    // Trust saved chartContent from visualize-tabs.js
                    chartElement: this.getChartElementForConfig(config, i),
                    tableElement: this.getTableElementForConfig(config, i),

                    // Configuration information
                    showTable: config.includeTable,
                    configuration: config,

                    // Additional information needed for export
                    chartData: config.chartData,
                    chartOptions: config.chartOptions
                });
            }
        }

        console.log(`[ExportReport] Found ${validCharts.length} valid charts`);
        return validCharts;
    }

    /**
     * Get chart element for configuration
     */
    getChartElementForConfig(config, index) {
        console.log(`[ExportReport] Getting chart element for config ${index}:`);
        console.log('  - config.chartContent exists:', !!config.chartContent);
        console.log('  - config.chartContent.chart exists:', !!(config.chartContent && config.chartContent.chart));

        // Use saved chartContent from visualize-tabs.js
        if (config.chartContent && config.chartContent.chart) {
            console.log('  - Using saved chartContent.chart');
            const chartElement = config.chartContent.chart;
            console.log('  - Chart element tag:', chartElement.tagName);
            console.log('  - Chart element has content:', chartElement.children.length > 0);
            return chartElement;
        }

        // Fallback: try to get from current DOM (only for active tab)
        if (window.activeTabIndex === index) {
            const chartPreview = document.getElementById('chartPreview');
            if (chartPreview) {
                console.log('  - Using current DOM chartPreview');
                const clone = chartPreview.cloneNode(true);
                console.log('  - Cloned element has content:', clone.children.length > 0);
                return clone;
            }
        }

        // Last resort: create placeholder with debug info (這個DEBUG已經沒用了)
        console.warn(`[ExportReport] No chart content found for config ${index}, creating placeholder`);
        const placeholder = document.createElement('div');
        placeholder.className = 'chart-placeholder ts-box has-padded';

        const h3 = document.createElement('h3');
        h3.textContent = `圖表 ${index + 1}: ${config.title || 'Unknown'}`;
        placeholder.appendChild(h3);

        const errorP = document.createElement('p');
        errorP.style.color = 'red';
        errorP.textContent = '圖表內容無法獲取';
        placeholder.appendChild(errorP);

        return placeholder;
    }

    /**
     * Get table element for configuration
     */
    getTableElementForConfig(config, index) {
        // First try to get from saved chartContent
        if (config.chartContent && config.chartContent.table) {
            return config.chartContent.table;
        }

        // Fallback: try to get from current DOM
        const dataTable = document.getElementById('dataTable');
        if (dataTable && window.activeTabIndex === index && !dataTable.classList.contains('has-hidden')) {
            return dataTable.cloneNode(true);
        }

        return null;
    }

    // ==================== MODAL AND PREVIEW: Simple but Complete ====================

    /**
     * Open export modal
     */
    async openExportModal() {
        try {
            console.log('[ExportReport] Opening export modal');

            // Check if there are charts to export
            const validCharts = this.getValidChartConfigurations();
            if (validCharts.length === 0) {
                VisualizeChartUtils.showErrorModal('目前沒有可匯出的圖表。請先生成圖表後再嘗試匯出。');
                return;
            }

            // Set default report title with timestamp
            this.setDefaultReportTitle();

            // Generate preview
            await this.generatePreview();

            // Show modal using HTML5 dialog
            const modal = document.getElementById('exportPreviewModal');
            if (modal) {
                modal.showModal();
                console.log('[ExportReport] Modal opened successfully');
            } else {
                console.error('[ExportReport] Modal element not found');
            }

        } catch (error) {
            console.error('[ExportReport] Error opening export modal:', error);
            VisualizeChartUtils.showErrorModal('無法開啟匯出預覽：' + error.message);
        }
    }

    /**
     * Generate preview content - core preview logic
     */
    async generatePreview() {
        try {
            const validCharts = this.getValidChartConfigurations();
            const fileType = this.getCurrentFileType();
            const layoutOption = this.getCurrentLayoutOption();
            const theme = this.getCurrentTheme();

            console.log(`[ExportReport] Generating preview: ${fileType}/${layoutOption}, ${validCharts.length} charts`);

            // Get preview container
            const previewContainer = document.querySelector('#exportPreviewModal .ts-content[style*="max-height"]');
            if (!previewContainer) {
                throw new Error('Preview container not found');
            }

            // Clear container
            previewContainer.replaceChildren();

            // Apply theme
            this.applyThemeToContainer(previewContainer, theme);

            // Generate preview content based on file type
            const previewContent = await this.generatePreviewByFileType(validCharts, fileType, layoutOption);

            // Render preview content
            this.renderPreviewContent(previewContainer, previewContent, fileType, layoutOption);

            // Store current preview content for export use
            this.currentPreviewContent = previewContent;

            console.log('[ExportReport] Preview generated successfully');

        } catch (error) {
            console.error('[ExportReport] Error generating preview:', error);
            throw error;
        }
    }

    /**
     * Generate preview content by file type
     */
    async generatePreviewByFileType(charts, fileType, layoutOption) {
        switch (fileType) {
            case 'xlsx':
                return this.generateExcelPreview(charts, layoutOption);
            case 'png':
                return await this.generatePngPreview(charts, layoutOption);
            case 'pdf':
            case 'print':
                return await this.generatePdfPreview(charts, layoutOption);
            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    }

    // ==================== EXCEL PREVIEW LOGIC ====================

    generateExcelPreview(charts, layoutOption) {
        const previewItems = [];

        for (const [index, chart] of charts.entries()) {
            // Excel preview shows ACTUAL Excel-format table, not HTML table
            const excelTablePreview = this.createExcelFormatTableElement(chart);

            previewItems.push({
                type: 'excel_table',
                element: excelTablePreview,
                chart: chart,
                dividerText: this.getExcelDividerText(chart, index, charts.length, layoutOption),
                dividerColor: layoutOption === 'separate' ? 'red' : 'normal'
            });
        }

        return {
            items: previewItems,
            description: this.getExcelDescription(layoutOption, charts.length)
        };
    }

    getExcelDividerText(chart, index, total, layoutOption) {
        switch (layoutOption) {
            case 'separate':
                return `${chart.title}.xlsx (第 ${index + 1} 項，共 ${total} 項)`;
            case 'multiple_sheets':
            case 'single_sheet':
                return `${chart.title} (第 ${index + 1} 項，共 ${total} 項)`;
            default:
                return `${chart.title} (第 ${index + 1} 項，共 ${total} 項)`;
        }
    }

    getExcelDescription(layoutOption, chartCount) {
        switch (layoutOption) {
            case 'separate':
                return `將產生 ${chartCount} 個 Excel 文件，打包成 ZIP 下載`;
            case 'multiple_sheets':
                return `將產生 1 個 Excel 文件，包含 ${chartCount} 個工作表`;
            case 'single_sheet':
                return `將產生 1 個 Excel 文件，所有表格合併在同一工作表中`;
            default:
                return `Excel 匯出預覽 (${chartCount} 個圖表)`;
        }
    }

    // ==================== PNG PREVIEW LOGIC ====================

    async generatePngPreview(charts, layoutOption) {
        switch (layoutOption) {
            case 'separate':
                return await this.generatePngSeparatePreview(charts);
            case 'chart_with_table':
                return await this.generatePngChartWithTablePreview(charts);
            case 'charts_and_tables':
                return await this.generatePngChartsAndTablesPreview(charts);
            case 'all_in_one':
                return await this.generatePngAllInOnePreview(charts);
            default:
                throw new Error(`Unknown PNG layout option: ${layoutOption}`);
        }
    }

    async generatePngSeparatePreview(charts) {
        const previewItems = [];
        let pngIndex = 0;

        // Calculate total PNG files
        let totalPngs = 0;
        for (const chart of charts) {
            totalPngs++; // Chart PNG
            if (chart.showTable) {
                totalPngs++; // Table PNG
            }
        }

        for (const chart of charts) {
            // Chart item - RED divider (separate file)
            const chartPreview = await this.createChartPreviewElement(chart);
            previewItems.push({
                type: 'chart',
                element: chartPreview,
                chart: chart,
                dividerText: `${chart.title}.png (第 ${++pngIndex} 張，共 ${totalPngs} 張)`,
                dividerColor: 'red'  // File boundary
            });

            // Table item (if exists) - RED divider (separate file)
            if (chart.showTable) {
                const tablePreview = this.createTablePreviewElement(chart, true); // true = add title
                previewItems.push({
                    type: 'table',
                    element: tablePreview,
                    chart: chart,
                    dividerText: `${chart.title}_table.png (第 ${++pngIndex} 張，共 ${totalPngs} 張)`,
                    dividerColor: 'red'  // File boundary
                });
            }
        }

        return {
            items: previewItems,
            description: `將產生 ${pngIndex} 個 PNG 檔案，打包成 ZIP 下載`
        };
    }

    async generatePngChartWithTablePreview(charts) {
        const previewItems = [];

        for (const [index, chart] of charts.entries()) {
            // Combine chart and table in one preview
            const combinedPreview = await this.createCombinedPreviewElement(chart);
            previewItems.push({
                type: 'combined',
                element: combinedPreview,
                chart: chart,
                dividerText: `${chart.title}.png (第 ${index + 1} 張，共 ${charts.length} 張)`,
                dividerColor: 'red'
            });
        }

        return {
            items: previewItems,
            description: `將產生 ${charts.length} 個 PNG 檔案，每個包含圖表和表格，打包成 ZIP 下載`
        };
    }

    async generatePngChartsAndTablesPreview(charts) {
        const previewItems = [];
        const tablesWithData = charts.filter(chart => chart.showTable);
        const totalPngs = tablesWithData.length > 0 ? 2 : 1;

        // Calculate total items: all charts + tables with data
        const totalItems = charts.length + tablesWithData.length;

        // First add all charts - RED divider (separate PNG file)
        const chartsPreview = document.createElement('div');
        chartsPreview.className = 'charts-group';
        for (const [index, chart] of charts.entries()) {
            const chartElement = await this.createChartPreviewElement(chart);
            chartsPreview.appendChild(chartElement);

            // Add normal divider between charts within same PNG (except last)
            if (index < charts.length - 1) {
                const divider = this.createDividerElement(
                    `${chart.title} (第 ${index + 1} 項，共 ${totalItems} 項)`,
                    'normal'
                );
                chartsPreview.appendChild(divider);
            }
        }

        previewItems.push({
            type: 'charts_group',
            element: chartsPreview,
            dividerText: `所有圖表.png (第 1 張，共 ${totalPngs} 張)`,
            dividerColor: 'red'  // File boundary
        });

        // Then add all tables (if any) - RED divider (separate PNG file)
        if (tablesWithData.length > 0) {
            const tablesPreview = document.createElement('div');
            tablesPreview.className = 'tables-group';
            tablesWithData.forEach((chart, index) => {
                const tableElement = this.createTablePreviewElement(chart, true);
                tablesPreview.appendChild(tableElement);

                // Add normal divider between tables within same PNG (except last)
                // Table items continue counting from where charts left off
                if (index < tablesWithData.length - 1) {
                    const divider = this.createDividerElement(
                        `${chart.title} - 資料表格 (第 ${charts.length + index + 1} 項，共 ${totalItems} 項)`,
                        'normal'
                    );
                    tablesPreview.appendChild(divider);
                }
            });

            previewItems.push({
                type: 'tables_group',
                element: tablesPreview,
                dividerText: `所有表格.png (第 2 張，共 ${totalPngs} 張)`,
                dividerColor: 'red'  // File boundary
            });
        }

        return {
            items: previewItems,
            description: `將產生 ${totalPngs} 個 PNG 檔案`
        };
    }

    async generatePngAllInOnePreview(charts) {
        const allInOnePreview = document.createElement('div');
        allInOnePreview.className = 'all-in-one-preview';

        for (const [index, chart] of charts.entries()) {
            const chartElement = await this.createChartPreviewElement(chart);
            allInOnePreview.appendChild(chartElement);

            if (chart.showTable) {
                const tableElement = this.createTablePreviewElement(chart, true);
                allInOnePreview.appendChild(tableElement);
            }

            // Add normal divider between chart sections within same PNG (except last)
            if (index < charts.length - 1) {
                const divider = this.createDividerElement(
                    `${chart.title} (第 ${index + 1} 項，共 ${charts.length} 項)`,
                    'normal'  // Content separator within same PNG
                );
                allInOnePreview.appendChild(divider);
            }
        }

        return {
            items: [{
                type: 'all_in_one',
                element: allInOnePreview,
                dividerText: '完整報表.png (第 1 張，共 1 張)',
                dividerColor: 'red'  // File boundary
            }],
            description: '將產生 1 個 PNG 檔案，包含所有圖表和表格'
        };
    }

    // ==================== PDF PREVIEW LOGIC ====================

    async generatePdfPreview(charts, layoutOption) {
        switch (layoutOption) {
            case 'page_break':
                return await this.generatePdfPageBreakPreview(charts);
            case 'no_page_break':
                return await this.generatePdfNoPageBreakPreview(charts);
            case 'charts_tables_separate_break':
                return await this.generatePdfSeparateBreakPreview(charts);
            case 'charts_tables_separate_no_break':
                return await this.generatePdfSeparateNoBreakPreview(charts);
            default:
                throw new Error(`Unknown PDF layout option: ${layoutOption}`);
        }
    }

    async generatePdfPageBreakPreview(charts) {
        const previewItems = [];

        for (const [index, chart] of charts.entries()) {
            const combinedPreview = await this.createCombinedPreviewElement(chart);
            previewItems.push({
                type: 'combined_page',
                element: combinedPreview,
                chart: chart,
                dividerText: `${chart.title} (第 ${index + 1} 頁面，共 ${charts.length} 頁面)`,
                dividerColor: 'red'
            });
        }

        return {
            items: previewItems,
            description: `將產生 ${charts.length} 頁 PDF 文件，每個圖表獨立一頁`
        };
    }

    async generatePdfSeparateBreakPreview(charts) {
        const previewItems = [];
        let pageIndex = 1;

        // Add charts section
        for (const chart of charts) {
            const chartPreview = await this.createChartPreviewElement(chart);
            previewItems.push({
                type: 'chart_page',
                element: chartPreview,
                chart: chart,
                dividerText: `${chart.title} (第 ${pageIndex++} 頁面)`,
                dividerColor: 'red'
            });
        }

        // Add tables section
        const chartsWithTable = charts.filter(chart => chart.showTable);
        for (const chart of chartsWithTable) {
            const tablePreview = this.createTablePreviewElement(chart, true);
            previewItems.push({
                type: 'table_page',
                element: tablePreview,
                chart: chart,
                dividerText: `${chart.title} - 資料表格 (第 ${pageIndex++} 頁面)`,
                dividerColor: 'red'
            });
        }

        return {
            items: previewItems,
            description: `將產生 ${pageIndex - 1} 頁 PDF 文件，圖表與表格分開列印`
        };
    }

    async generatePdfNoPageBreakPreview(charts) {
        const allContentPreview = document.createElement('div');
        allContentPreview.className = 'continuous-content';

        for (const chart of charts) {
            const combinedElement = await this.createCombinedPreviewElement(chart);
            allContentPreview.appendChild(combinedElement);
        }

        return {
            items: [{
                type: 'continuous',
                element: allContentPreview,
                dividerText: '連續內容 (第 1 頁面，共 1 頁面)',
                dividerColor: 'red'
            }],
            description: '將產生 1 頁 PDF 文件，所有內容連續排列'
        };
    }

    async generatePdfSeparateNoBreakPreview(charts) {
        const previewItems = [];
        const chartsWithTable = charts.filter(chart => chart.showTable);
        const totalPages = chartsWithTable.length > 0 ? 2 : 1;

        // Calculate total items: all charts + tables with data
        const totalItems = charts.length + chartsWithTable.length;

        // Charts section with dual divider system
        const chartsGroup = document.createElement('div');
        chartsGroup.className = 'charts-section';

        for (const [index, chart] of charts.entries()) {
            const chartElement = await this.createChartPreviewElement(chart);
            chartsGroup.appendChild(chartElement);

            // Add normal divider between charts (content separation within same page)
            if (index < charts.length - 1) {
                const divider = this.createDividerElement(
                    `${chart.title} (第 ${index + 1} 項，共 ${totalItems} 項)`,
                    'normal'
                );
                chartsGroup.appendChild(divider);
            }
        }

        // Red divider for page boundary
        previewItems.push({
            type: 'charts_section',
            element: chartsGroup,
            dividerText: `圖表部分 (第 1 頁面，共 ${totalPages} 頁面)`,
            dividerColor: 'red'  // Page boundary
        });

        // Tables section with continuing item count
        if (chartsWithTable.length > 0) {
            const tablesGroup = document.createElement('div');
            tablesGroup.className = 'tables-section';

            chartsWithTable.forEach((chart, index) => {
                const tableElement = this.createTablePreviewElement(chart, true);
                tablesGroup.appendChild(tableElement);

                // Add normal divider between tables (content separation within same page)
                // Table items continue counting from where charts left off
                if (index < chartsWithTable.length - 1) {
                    const divider = this.createDividerElement(
                        `${chart.title} - 資料表格 (第 ${charts.length + index + 1} 項，共 ${totalItems} 項)`,
                        'normal'
                    );
                    tablesGroup.appendChild(divider);
                }
            });

            // Red divider for page boundary
            previewItems.push({
                type: 'tables_section',
                element: tablesGroup,
                dividerText: `表格部分 (第 2 頁面，共 ${totalPages} 頁面)`,
                dividerColor: 'red'  // Page boundary
            });
        }

        return {
            items: previewItems,
            description: `將產生 ${totalPages} 頁 PDF 文件，圖表與表格分開但連續排列`
        };
    }

    // ==================== DOM MANIPULATION: Safe and Efficient ====================

    /**
     * Create chart preview element
     * Simple and effective: use saved chartContent DOM directly with theme applied
     */
    async createChartPreviewElement(chart) {
        console.log(`[ExportReport] Creating chart preview for: ${chart.title}`);

        // Use visualize-export approach - trust saved DOM content
        if (chart.chartElement) {
            // Clone the saved chart element
            const chartClone = chart.chartElement.cloneNode(true);

            // Remove IDs to avoid conflicts
            this.removeIdsFromElement(chartClone);
            chartClone.classList.remove('has-hidden');

            // Apply current export theme (same as visualize-export)
            this.applyThemeToChartElement(chartClone, this.getCurrentTheme());

            // Ensure proper display
            chartClone.style.visibility = 'visible';
            chartClone.style.display = 'block';
            chartClone.style.position = 'static';
            chartClone.style.width = '100%';
            chartClone.style.height = 'auto';

            console.log(`[ExportReport] Using saved chart content for: ${chart.title}`);
            return chartClone;
        }

        // Fallback: create placeholder
        console.warn(`[ExportReport] No saved chart content for: ${chart.title}`);
        return this.createFallbackChartElement(chart);
    }

    /**
     * Create fallback chart element when chart-utils method fails
     */
    createFallbackChartElement(chart) {
        console.log(`[ExportReport] Creating fallback chart element for: ${chart.title}`);

        // If we have saved chart element, use it with theme applied
        if (chart.chartElement) {
            const fallback = chart.chartElement.cloneNode(true);
            this.removeIdsFromElement(fallback);
            fallback.classList.remove('has-hidden');

            // Apply current theme
            const theme = this.getCurrentTheme();
            this.applyThemeToChartElement(fallback, theme);

            return fallback;
        }

        // Last resort: create placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'ts-box has-padded';

        const h3 = document.createElement('h3');
        h3.textContent = chart.title;
        placeholder.appendChild(h3);

        const descP = document.createElement('p');
        descP.className = 'ts-text is-description';
        descP.textContent = '圖表暫時無法顯示';
        placeholder.appendChild(descP);

        const configP = document.createElement('p');
        configP.className = 'ts-text is-small';
        configP.textContent = `配置: ${chart.configuration ? '存在' : '缺失'}`;
        placeholder.appendChild(configP);

        return placeholder;
    }

    /**
     * Create animation-safe chart clone - waits for ApexChart animations to complete
     */
    async createAnimationSafeChartClone(chartElement) {
        // Wait for ApexChart animations to complete before cloning
        await this.waitForApexChartComplete(chartElement);

        // Clone the element AFTER animation is complete
        const clone = chartElement.cloneNode(true);

        // Remove any ApexCharts animation-related classes and styles
        const apexElements = clone.querySelectorAll('[class*="apexcharts"]');
        apexElements.forEach(el => {
            // Remove animation classes
            el.classList.remove('apexcharts-animating');

            // Force complete opacity on all chart elements
            if (el.style.opacity !== '' && parseFloat(el.style.opacity) < 1) {
                el.style.opacity = '1';
            }

            // Remove any transform animations
            if (el.style.transform && el.style.transform.includes('translate')) {
                el.style.transform = el.style.transform.replace(/translate[XY]?\([^)]*\)/g, '');
            }
        });

        // Ensure all SVG elements are fully visible
        const svgElements = clone.querySelectorAll('svg');
        svgElements.forEach(svg => {
            svg.style.opacity = '1';
            svg.style.transform = 'translateZ(0)';
        });

        return clone;
    }

    /**
     * Wait for ApexChart animations to complete
     */
    async waitForApexChartComplete(chartElement) {
        return new Promise((resolve) => {
            // Check if there are any animating elements
            const checkAnimations = () => {
                const animatingElements = chartElement.querySelectorAll('.apexcharts-animating');
                const incompleteElements = chartElement.querySelectorAll('[style*="opacity: 0"]');

                if (animatingElements.length === 0 && incompleteElements.length === 0) {
                    // Wait additional time for any remaining transitions
                    setTimeout(resolve, 100);
                } else {
                    // Check again after a short delay
                    setTimeout(checkAnimations, 50);
                }
            };

            // Start checking
            checkAnimations();
        });
    }

    /**
     * Create table preview element
     */
    createTablePreviewElement(chart, addTitle = false) {
        if (!chart.tableElement) {
            // No table, create empty notification
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'ts-box has-padded';

            const textDiv = document.createElement('div');
            textDiv.className = 'ts-text is-description';
            textDiv.textContent = '此圖表無對應資料表格';
            emptyDiv.appendChild(textDiv);

            return emptyDiv;
        }

        // Clone table DOM
        const tableClone = chart.tableElement.cloneNode(true);

        // Remove IDs
        this.removeIdsFromElement(tableClone);

        // Ensure table is visible
        tableClone.classList.remove('has-hidden');

        // Apply theme
        const theme = this.getCurrentTheme();
        this.applyThemeToTableElement(tableClone, theme);

        // Add title if needed
        if (addTitle) {
            const titleElement = document.createElement('h4');
            titleElement.textContent = `${chart.title} - 資料表格`;
            titleElement.style.marginBottom = '1rem';
            titleElement.style.color = theme === 'dark' ? '#ffffff' : '#000000';

            const wrapper = document.createElement('div');
            wrapper.appendChild(titleElement);
            wrapper.appendChild(tableClone);
            return wrapper;
        }

        return tableClone;
    }

    /**
     * Create Excel-format table element - shows actual Excel output format with TocasUI styling
     * Uses the same visual style as dataTable but with Excel export content structure
     */
    createExcelFormatTableElement(chart) {
        const theme = this.getCurrentTheme();
        const isDark = theme === 'dark';

        // Extract and format data exactly as it will be in Excel
        const tableData = this.extractTableDataFromChart(chart);
        const excelData = this.formatTableDataForExcel(tableData, chart);

        // Create TocasUI-styled container (same as original dataTable)
        const wrapper = document.createElement('div');
        wrapper.className = 'ts-box has-padded';
        if (isDark) {
            wrapper.classList.add('is-dark');
        } else {
            wrapper.classList.add('is-light');
        }

        // Create table with TocasUI styling
        const table = document.createElement('table');
        table.className = 'ts-table is-striped is-celled';
        if (isDark) {
            table.classList.add('is-dark');
        } else {
            table.classList.add('is-light');
        }

        // Create table body (no thead for Excel format)
        const tbody = document.createElement('tbody');

        excelData.forEach((rowData, rowIndex) => {
            // Skip completely empty rows
            if (rowData.length === 0) return;

            const row = document.createElement('tr');

            // Determine row type for special styling
            const isTitle = rowIndex === 0;
            const isHeader = rowIndex === 2;
            const isUnit = rowIndex === 3;

            rowData.forEach((cellData, colIndex) => {
                const cell = document.createElement('td');
                cell.textContent = cellData || '';

                // Apply special styling for different row types
                if (isTitle && colIndex === 0) {
                    // Title row - span across all columns
                    cell.setAttribute('colspan', Math.max(tableData.headers.length, 2));
                    cell.style.fontWeight = 'bold';
                    cell.style.textAlign = 'center';
                    cell.style.backgroundColor = isDark ? '#404040' : '#f6f8fa';
                } else if (isTitle && colIndex > 0) {
                    // Skip additional title cells due to colspan
                    return;
                } else if (isHeader) {
                    // Header row styling
                    cell.style.fontWeight = 'bold';
                    cell.style.backgroundColor = isDark ? '#4a4a4a' : '#e6f3ff';
                    cell.style.textAlign = 'center';
                } else if (isUnit) {
                    // Unit row styling - special highlight as per Req-250921.txt
                    cell.style.fontStyle = 'italic';
                    cell.style.backgroundColor = isDark ? '#3a3a3a' : '#fff3cd';
                    cell.style.color = isDark ? '#ffc107' : '#856404';
                    cell.style.textAlign = 'center';
                } else {
                    // Data rows - normal styling
                    if (colIndex > 0 && !isNaN(parseFloat(cellData))) {
                        cell.style.textAlign = 'right';
                    }
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        wrapper.appendChild(table);

        return wrapper;
    }

    /**
     * Create combined preview element (chart + table)
     */
    async createCombinedPreviewElement(chart) {
        const wrapper = document.createElement('div');
        wrapper.className = 'combined-preview';

        // Add chart
        const chartElement = await this.createChartPreviewElement(chart);
        wrapper.appendChild(chartElement);

        // Add table if exists
        if (chart.showTable && chart.tableElement) {
            const tableElement = this.createTablePreviewElement(chart, false);
            wrapper.appendChild(tableElement);
        }

        return wrapper;
    }

    /**
     * Remove all ID attributes from element and its children
     */
    removeIdsFromElement(element) {
        if (element.removeAttribute) {
            element.removeAttribute('id');
        }

        const children = element.querySelectorAll('*[id]');
        children.forEach(child => {
            child.removeAttribute('id');
        });
    }

    /**
     * Render preview content to container
     */
    renderPreviewContent(container, previewContent, fileType, layoutOption) {
        // Add description text
        if (previewContent.description) {
            const descriptionDiv = document.createElement('div');
            descriptionDiv.className = 'ts-box is-secondary has-padded';

            const textDiv = document.createElement('div');
            textDiv.className = 'ts-text';
            textDiv.textContent = previewContent.description;
            descriptionDiv.appendChild(textDiv);

            container.appendChild(descriptionDiv);
        }

        // Render preview items - Show divider BEFORE each item, not after
        previewContent.items.forEach((item, index) => {
            // Add divider BEFORE each item (shows the item description)
            const divider = this.createDividerElement(item.dividerText, item.dividerColor);
            container.appendChild(divider);

            // Add content element AFTER divider
            container.appendChild(item.element);
        });
    }

    /**
     * Create divider element
     */
    createDividerElement(text, color = 'normal') {
        const divider = document.createElement('div');
        divider.className = 'ts-divider is-center-text has-vertically-spaced-large monospace';
        divider.textContent = text;

        if (color === 'red') {
            divider.style.color = '#dc3545';
        }

        return divider;
    }

    // ==================== EXPORT EXECUTION: Strategy Pattern Application ====================

    /**
     * Execute export using strategy pattern
     */
    async executeExport() {
        try {
            const fileType = this.getCurrentFileType();
            const layoutOption = this.getCurrentLayoutOption();

            console.log(`[ExportReport] Executing export: ${fileType}/${layoutOption}`);

            // Get strategy function
            const strategy = this.exportStrategies[fileType]?.[layoutOption];
            if (!strategy) {
                throw new Error(`Export strategy not found: ${fileType}/${layoutOption}`);
            }

            // Execute export strategy
            await strategy();

            // Show success message
            const fileTypeText = {
                'xlsx': 'Excel',
                'png': 'PNG',
                'pdf': 'PDF',
                'print': '列印'
            }[fileType] || fileType.toUpperCase();

            VisualizeChartUtils.showSuccessModal(`${fileTypeText} 報表匯出完成`);

        } catch (error) {
            console.error('[ExportReport] Export failed:', error);
            VisualizeChartUtils.showErrorModal(`報表匯出失敗：${error.message}`);
        }
    }

    // ==================== EXCEL EXPORT STRATEGIES ====================

    async exportExcelSeparate() {
        const charts = this.getValidChartConfigurations();

        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const workbooks = [];

        for (const chart of charts) {
            const workbook = XLSX.utils.book_new();
            const tableData = this.extractTableDataFromChart(chart);
            const wsData = this.formatTableDataForExcel(tableData, chart);
            const worksheet = XLSX.utils.aoa_to_sheet(wsData);

            XLSX.utils.book_append_sheet(workbook, worksheet, '資料');

            const filename = `${chart.title.replace(/[<>:"/\\|?*]/g, '_')}.xlsx`;
            workbooks.push({ filename, workbook });
        }

        // Download files
        if (workbooks.length === 1) {
            XLSX.writeFile(workbooks[0].workbook, workbooks[0].filename);
        } else {
            await this.downloadWorkbooksAsZip(workbooks);
        }
    }

    async exportExcelMultipleSheets() {
        const charts = this.getValidChartConfigurations();

        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const workbook = XLSX.utils.book_new();

        for (const chart of charts) {
            const tableData = this.extractTableDataFromChart(chart);
            const wsData = this.formatTableDataForExcel(tableData, chart);
            const worksheet = XLSX.utils.aoa_to_sheet(wsData);

            const sheetName = this.sanitizeSheetName(chart.title);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }

        const reportTitle = this.getReportTitle();
        const filename = `${reportTitle}_${this.getTimestamp()}.xlsx`;
        XLSX.writeFile(workbook, filename);
    }

    async exportExcelSingleSheet() {
        const charts = this.getValidChartConfigurations();

        if (typeof XLSX === 'undefined') {
            throw new Error('XLSX library not loaded');
        }

        const combinedData = [];

        for (const [index, chart] of charts.entries()) {
            // Add chart title
            combinedData.push([chart.title]);
            combinedData.push([]); // Empty row

            // Add table data
            const tableData = this.extractTableDataFromChart(chart);
            const formattedData = this.formatTableDataForExcel(tableData, chart);
            combinedData.push(...formattedData.slice(2)); // Skip title and empty row

            // Add separator empty rows (except for last chart)
            if (index < charts.length - 1) {
                combinedData.push([]);
                combinedData.push([]);
            }
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet(combinedData);
        XLSX.utils.book_append_sheet(workbook, worksheet, '合併報表');

        const reportTitle = this.getReportTitle();
        const filename = `${reportTitle}_合併_${this.getTimestamp()}.xlsx`;
        XLSX.writeFile(workbook, filename);
    }

    // ==================== PNG EXPORT STRATEGIES ====================

    async exportPngSeparate() {
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library not loaded');
        }

        const charts = this.getValidChartConfigurations();
        const files = [];

        for (const chart of charts) {
            // Export chart
            const chartBlob = await this.captureElementAsPng(chart.chartElement, `${chart.title}_圖表`);
            files.push({
                filename: `${chart.title}_chart.png`,
                blob: chartBlob
            });

            // Export table if exists
            if (chart.showTable && chart.tableElement) {
                const tableBlob = await this.captureElementAsPng(chart.tableElement, `${chart.title}_表格`);
                files.push({
                    filename: `${chart.title}_table.png`,
                    blob: tableBlob
                });
            }
        }

        await this.downloadFilesAsZip(files, 'png');
    }

    async exportPngChartWithTable() {
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library not loaded');
        }

        const charts = this.getValidChartConfigurations();
        const files = [];

        for (const chart of charts) {
            const combinedElement = await this.createTemporaryCombinedElement(chart);
            const blob = await this.captureElementAsPng(combinedElement, chart.title);

            files.push({
                filename: `${chart.title}.png`,
                blob: blob
            });

            // Clean up temporary element
            if (combinedElement.parentNode) {
                combinedElement.parentNode.removeChild(combinedElement);
            }
        }

        await this.downloadFilesAsZip(files, 'png');
    }

    async exportPngChartsAndTables() {
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library not loaded');
        }

        const charts = this.getValidChartConfigurations();
        const files = [];

        // Export all charts as one image
        const chartsContainer = await this.createTemporaryChartsContainer(charts);
        const chartsBlob = await this.captureElementAsPng(chartsContainer, '所有圖表');
        files.push({
            filename: '所有圖表.png',
            blob: chartsBlob
        });

        // Export all tables as one image (if any)
        const chartsWithTable = charts.filter(chart => chart.showTable);
        if (chartsWithTable.length > 0) {
            const tablesContainer = this.createTemporaryTablesContainer(chartsWithTable);
            const tablesBlob = await this.captureElementAsPng(tablesContainer, '所有表格');
            files.push({
                filename: '所有表格.png',
                blob: tablesBlob
            });
        }

        // Clean up
        if (chartsContainer.parentNode) chartsContainer.parentNode.removeChild(chartsContainer);
        if (chartsWithTable.length > 0) {
            const tablesContainer = document.querySelector('.temp-tables-container');
            if (tablesContainer && tablesContainer.parentNode) {
                tablesContainer.parentNode.removeChild(tablesContainer);
            }
        }

        await this.downloadFilesAsZip(files, 'png');
    }

    async exportPngAllInOne() {
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library not loaded');
        }

        const charts = this.getValidChartConfigurations();
        const allInOneContainer = await this.createTemporaryAllInOneContainer(charts);

        const blob = await this.captureElementAsPng(allInOneContainer, '完整報表');

        // Clean up
        if (allInOneContainer.parentNode) {
            allInOneContainer.parentNode.removeChild(allInOneContainer);
        }

        // Download single file
        this.downloadBlob(blob, '完整報表.png');
    }

    // ==================== PDF EXPORT STRATEGIES ====================

    async exportPdfPageBreak() {
        await this.exportPdf('page_break');
    }

    async exportPdfNoPageBreak() {
        await this.exportPdf('no_page_break');
    }

    async exportPdfSeparateBreak() {
        await this.exportPdf('charts_tables_separate_break');
    }

    async exportPdfSeparateNoBreak() {
        await this.exportPdf('charts_tables_separate_no_break');
    }

    async exportPdf(layoutType) {
        if (typeof pdfMake === 'undefined') {
            throw new Error('pdfMake library not loaded');
        }

        const charts = this.getValidChartConfigurations();
        const reportTitle = this.getReportTitle();
        const theme = this.getCurrentTheme();

        const content = await this.generatePdfContent(charts, layoutType, theme);

        const docDefinition = {
            content: content,
            pageSize: 'A4',
            pageOrientation: 'portrait',
            background: theme === 'dark' ? this.getDarkThemeBackground() : null,
            defaultStyle: {
                fontSize: 10,
                font: 'NotoSansTC',
                color: theme === 'dark' ? '#ffffff' : '#000000'
            },
            styles: {
                title: { fontSize: 18, bold: true, margin: [0, 0, 0, 20], alignment: 'center' },
                header: { fontSize: 14, bold: true, margin: [0, 20, 0, 10] },
                section: { fontSize: 16, bold: true, margin: [0, 30, 0, 20], alignment: 'center' }
            },
            footer: function(currentPage, pageCount) {
                return {
                    columns: [
                        {
                            text: `匯出時間: ${this.getFormattedTimestamp()}`,
                            alignment: 'left',
                            fontSize: 8,
                            color: theme === 'dark' ? '#ffffff' : '#000000',
                            margin: [40, 10, 0, 0]
                        },
                        {
                            text: `${currentPage} / ${pageCount}`,
                            alignment: 'right',
                            fontSize: 8,
                            color: theme === 'dark' ? '#ffffff' : '#000000',
                            margin: [0, 10, 40, 0]
                        }
                    ]
                };
            }.bind(this)
        };

        const filename = `${reportTitle}_${this.getTimestamp()}.pdf`;
        pdfMake.createPdf(docDefinition).download(filename);
    }

    // ==================== PRINT STRATEGIES ====================

    async printPdfPageBreak() {
        await this.printPdf('page_break');
    }

    async printPdfNoPageBreak() {
        await this.printPdf('no_page_break');
    }

    async printPdfSeparateBreak() {
        await this.printPdf('charts_tables_separate_break');
    }

    async printPdfSeparateNoBreak() {
        await this.printPdf('charts_tables_separate_no_break');
    }

    async printPdf(layoutType) {
        if (typeof pdfMake === 'undefined') {
            throw new Error('pdfMake library not loaded');
        }

        const charts = this.getValidChartConfigurations();
        const reportTitle = this.getReportTitle();
        const theme = this.getCurrentTheme();

        const content = await this.generatePdfContent(charts, layoutType, theme);

        const docDefinition = {
            content: content,
            pageSize: 'A4',
            pageOrientation: 'portrait',
            background: theme === 'dark' ? this.getDarkThemeBackground() : null,
            defaultStyle: {
                fontSize: 10,
                font: 'NotoSansTC',
                color: theme === 'dark' ? '#ffffff' : '#000000'
            },
            styles: {
                title: { fontSize: 18, bold: true, margin: [0, 0, 0, 20], alignment: 'center' },
                header: { fontSize: 14, bold: true, margin: [0, 20, 0, 10] },
                section: { fontSize: 16, bold: true, margin: [0, 30, 0, 20], alignment: 'center' }
            },
            footer: function(currentPage, pageCount) {
                return {
                    columns: [
                        {
                            text: `匯出時間: ${this.getFormattedTimestamp()}`,
                            alignment: 'left',
                            fontSize: 8,
                            color: theme === 'dark' ? '#ffffff' : '#000000',
                            margin: [40, 10, 0, 0]
                        },
                        {
                            text: `${currentPage} / ${pageCount}`,
                            alignment: 'right',
                            fontSize: 8,
                            color: theme === 'dark' ? '#ffffff' : '#000000',
                            margin: [0, 10, 40, 0]
                        }
                    ]
                };
            }.bind(this)
        };

        pdfMake.createPdf(docDefinition).print();
    }

    // ==================== UTILITY METHODS: Simple but Complete ====================

    /**
     * Initialize default settings
     */
    initializeDefaultSettings() {
        // Set default file type
        const fileTypeSelect = document.getElementById('exportFileType');
        if (fileTypeSelect && !fileTypeSelect.value) {
            fileTypeSelect.value = 'xlsx';
        }

        // Set default theme
        const themeSelect = document.getElementById('exportTheme');
        if (themeSelect && !themeSelect.value) {
            themeSelect.value = VisualizeChartUtils.getCurrentSwitchTheme();
        }

        // Initialize layout options
        this.toggleLayoutOptions();
    }

    /**
     * Set default report title with timestamp
     */
    setDefaultReportTitle() {
        const input = document.getElementById('reportTitle');
        if (input && !input.value.trim()) {
            const timestamp = this.getFormattedTimestamp();
            input.placeholder = `廢棄物管理報表 - ${timestamp}`;
        }
    }

    /**
     * Get current file type
     */
    getCurrentFileType() {
        const select = document.getElementById('exportFileType');
        return select ? select.value : 'xlsx';
    }

    /**
     * Get current layout option
     */
    getCurrentLayoutOption() {
        const fileType = this.getCurrentFileType();

        // Map file types to their corresponding HTML element IDs
        const layoutElementIds = {
            'xlsx': 'exportLayoutXlsx',
            'png': 'exportLayoutPng',
            'pdf': 'exportLayoutPdf',
            'print': 'exportLayoutPdf'  // Print uses PDF layout options
        };

        const layoutElementId = layoutElementIds[fileType];
        if (!layoutElementId) {
            console.warn(`[ExportReport] Unknown file type: ${fileType}`);
            return this.getDefaultLayoutOption(fileType);
        }

        const layoutElement = document.getElementById(layoutElementId);
        if (!layoutElement) {
            console.warn(`[ExportReport] Layout element not found: ${layoutElementId}`);
            return this.getDefaultLayoutOption(fileType);
        }

        const layoutSelect = layoutElement.querySelector('select');
        if (!layoutSelect) {
            console.warn(`[ExportReport] Layout select not found in: ${layoutElementId}`);
            return this.getDefaultLayoutOption(fileType);
        }

        const value = layoutSelect.value || this.getDefaultLayoutOption(fileType);
        console.log(`[ExportReport] Layout option: ${fileType} => ${value}`);
        return value;
    }

    getDefaultLayoutOption(fileType) {
        const defaults = {
            'xlsx': 'multiple_sheets',
            'png': 'chart_with_table',
            'pdf': 'page_break',
            'print': 'page_break'
        };
        return defaults[fileType] || 'separate';
    }

    /**
     * Get current theme - use chart-utils unified method
     */
    getCurrentTheme() {
        return VisualizeChartUtils.getCurrentExportTheme();
    }

    /**
     * Get report title
     */
    getReportTitle() {
        const input = document.getElementById('reportTitle');
        if (input && input.value.trim()) {
            return input.value.trim();
        }
        return input ? input.placeholder : '廢棄物管理報表';
    }

    /**
     * Get timestamp
     */
    getTimestamp() {
        const now = new Date();
        return now.toISOString().slice(0, 19).replace(/[:-]/g, '');
    }

    /**
     * Get formatted timestamp (Chinese format)
     */
    getFormattedTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }

    // ==================== EVENT HANDLING: Responsive Design ====================

    handleFileTypeChange() {
        // Show/hide corresponding layout options
        this.toggleLayoutOptions();

        // Regenerate preview
        this.regeneratePreview();
    }

    toggleLayoutOptions() {
        const fileType = this.getCurrentFileType();
        const layoutSelectors = ['Xlsx', 'Png', 'Pdf'];

        layoutSelectors.forEach(suffix => {
            const element = document.getElementById(`exportLayout${suffix}`);
            if (element) {
                const shouldShow = (fileType === 'xlsx' && suffix === 'Xlsx') ||
                                  (fileType === 'png' && suffix === 'Png') ||
                                  (['pdf', 'print'].includes(fileType) && suffix === 'Pdf');

                element.style.display = shouldShow ? 'block' : 'none';
            }
        });

        // Special handling: Show report title input for PDF/Print
        const reportTitleContainer = document.getElementById('reportTitleContainer');
        if (reportTitleContainer) {
            reportTitleContainer.style.display = ['pdf', 'print'].includes(fileType) ? 'block' : 'none';
        }
    }

    async regeneratePreview() {
        try {
            // Completely clear preview content first
            // This ensures theme changes are applied to fresh content, not cached elements
            this.currentPreviewContent = null;

            // Clear the modal preview container completely
            const modalContainer = document.querySelector('#exportPreviewModal .ts-content[style*="max-height"]');
            if (modalContainer) {
                modalContainer.replaceChildren();

                // Force remove any cached styling
                modalContainer.removeAttribute('class');
                modalContainer.className = 'ts-content';
                modalContainer.style.cssText = 'max-height: 47.5em; overflow-y: auto';
            }

            // Wait a tick to ensure DOM is cleared
            await new Promise(resolve => setTimeout(resolve, 10));

            // Generate completely fresh preview
            await this.generatePreview();
        } catch (error) {
            console.error('[ExportReport] Error regenerating preview:', error);
            // Don't show error message to avoid frequent popups
        }
    }

    closeModal() {
        const modal = document.getElementById('exportPreviewModal');
        if (modal) {
            modal.close();
        }

        // Clean up preview content
        this.currentPreviewContent = null;
    }

    // ==================== THEME MANAGEMENT: Consistent Visual Experience ====================

    applyThemeToContainer(container, theme) {
        const isDark = theme === 'dark';

        if (isDark) {
            container.style.backgroundColor = '#1a1a1a';
            container.style.color = '#ffffff';
        } else {
            container.style.backgroundColor = '#ffffff';
            container.style.color = '#333333';
        }
    }

    applyThemeToChartElement(element, theme) {
        const isDark = theme === 'dark';

        // Apply background color
        if (isDark) {
            element.style.backgroundColor = '#1a1a1a';
        } else {
            element.style.backgroundColor = '#ffffff';
        }

        // Update ApexCharts related text colors
        const textElements = element.querySelectorAll('.apexcharts-text, .apexcharts-legend-text, .apexcharts-datalabel');
        textElements.forEach(textEl => {
            textEl.style.fill = isDark ? '#ffffff' : '#374151';
        });

        // Ensure all ApexCharts elements are properly styled for html2canvas
        const apexElements = element.querySelectorAll('.apexcharts-canvas, .apexcharts-svg, .apexcharts-inner, .apexcharts-graphical');
        apexElements.forEach(el => {
            el.style.visibility = 'visible';
            el.style.opacity = '1';
            el.style.display = 'block';
            el.style.position = 'relative';

            // Remove any problematic transforms that might cause iframe issues
            if (el.style.transform && el.style.transform.includes('translate')) {
                el.style.transform = 'none';
            }
        });

        // Fix any SVG elements that might be causing iframe issues
        const svgElements = element.querySelectorAll('svg');
        svgElements.forEach(svg => {
            svg.style.visibility = 'visible';
            svg.style.opacity = '1';
            svg.style.display = 'block';

            // Ensure SVG has proper dimensions
            if (!svg.getAttribute('width') || !svg.getAttribute('height')) {
                const rect = svg.getBoundingClientRect();
                if (rect.width && rect.height) {
                    svg.setAttribute('width', rect.width);
                    svg.setAttribute('height', rect.height);
                }
            }
        });
    }

    applyThemeToTableElement(element, theme) {
        const isDark = theme === 'dark';

        // Find table element
        const table = element.querySelector('table') || element;

        if (isDark) {
            table.classList.add('is-dark');
            table.classList.remove('is-light');
        } else {
            table.classList.add('is-light');
            table.classList.remove('is-dark');
        }

        // Find wrapper ts-box
        const box = element.querySelector('.ts-box') || (element.classList.contains('ts-box') ? element : null);
        if (box) {
            if (isDark) {
                box.classList.add('is-dark');
                box.classList.remove('is-light');
            } else {
                box.classList.add('is-light');
                box.classList.remove('is-dark');
            }
        }
    }

    // ==================== HELPER METHODS FOR EXPORT ====================

    /**
     * Extract table data from chart configuration
     * For Excel export, always try to extract data from chart configuration
     * even if table display is disabled (vis-department compatibility)
     */
    extractTableDataFromChart(chart) {
        // First, try to extract from existing table element (normal case)
        if (chart.tableElement) {
            const table = chart.tableElement.querySelector('table');
            if (table) {
                const result = this.extractTableFromDOM(table);
                if (result && result.rows.length > 0 && result.rows[0][0] !== '無資料') {
                    return {
                        title: chart.title,
                        headers: result.headers,
                        rows: result.rows
                    };
                }
            }
        }

        // For Excel export, try to extract from chart configuration directly
        // This handles vis-department case where table may not be displayed but data exists
        if (chart.configuration) {
            const configData = this.extractTableFromConfiguration(chart.configuration, chart.title);
            if (configData && configData.rows.length > 0 && configData.rows[0][0] !== '無資料') {
                return configData;
            }
        }

        // FALLBACK: Try to extract from chart data if available
        if (chart.chartData || (chart.chart && chart.chart.w && chart.chart.w.config)) {
            const chartDataResult = this.extractTableFromChartData(chart);
            if (chartDataResult && chartDataResult.rows.length > 0 && chartDataResult.rows[0][0] !== '無資料') {
                return chartDataResult;
            }
        }

        // Last resort: return no data placeholder
        return {
            title: chart.title,
            headers: ['日期', chart.title],
            rows: [['無資料', '無資料']]
        };
    }

    /**
     * Extract table data from DOM table element
     */
    extractTableFromDOM(table) {
        const headers = [];
        const rows = [];

        // Extract headers
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            headerRow.querySelectorAll('th').forEach(th => {
                headers.push(th.textContent.trim());
            });
        }

        // Extract data rows
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('td').forEach(td => {
                    row.push(td.textContent.trim());
                });
                if (row.length > 0) {
                    rows.push(row);
                }
            });
        }

        return {
            headers: headers.length > 0 ? headers : ['日期', '數值'],
            rows: rows.length > 0 ? rows : [['無資料', '無資料']]
        };
    }

    /**
     * Extract table data from chart configuration (vis-department compatibility)
     */
    extractTableFromConfiguration(config, title) {
        // Check if configuration has data that can be used for table
        if (config.chartData && config.chartData.datasets && config.chartData.datasets.length > 0) {
            const dataset = config.chartData.datasets[0];

            if (dataset.data && dataset.data.length > 0 && config.chartData.labels) {
                const headers = ['日期', dataset.label || title];
                const rows = [];

                for (let i = 0; i < config.chartData.labels.length && i < dataset.data.length; i++) {
                    rows.push([
                        config.chartData.labels[i].toString(),
                        dataset.data[i].toString()
                    ]);
                }

                return {
                    title: title,
                    headers: headers,
                    rows: rows
                };
            }
        }

        // Try different chart data structures (ApexCharts format)
        if (config.chartOptions && config.chartOptions.series && config.chartOptions.series.length > 0) {
            const series = config.chartOptions.series[0];
            if (series.data && series.data.length > 0) {
                const headers = ['日期', series.name || title];
                const rows = [];

                series.data.forEach(point => {
                    if (point.x !== undefined && point.y !== undefined) {
                        rows.push([point.x.toString(), point.y.toString()]);
                    }
                });

                if (rows.length > 0) {
                    return {
                        title: title,
                        headers: headers,
                        rows: rows
                    };
                }
            }
        }

        return null;
    }

    /**
     * Extract table data from chart data structure
     */
    extractTableFromChartData(chart) {
        let chartConfig = null;

        // Get chart configuration from various sources
        if (chart.chartData) {
            chartConfig = chart.chartData;
        } else if (chart.chart && chart.chart.w && chart.chart.w.config) {
            chartConfig = chart.chart.w.config;
        }

        if (!chartConfig) return null;

        // Handle ApexCharts series data
        if (chartConfig.series && chartConfig.series.length > 0) {
            const series = chartConfig.series[0];
            const categories = chartConfig.xaxis && chartConfig.xaxis.categories ? chartConfig.xaxis.categories : [];

            if (series.data && series.data.length > 0) {
                const headers = ['日期', series.name || chart.title];
                const rows = [];

                // Handle different data formats
                if (Array.isArray(series.data[0])) {
                    // [[x, y], [x, y], ...] format
                    series.data.forEach(point => {
                        if (point.length >= 2) {
                            rows.push([point[0].toString(), point[1].toString()]);
                        }
                    });
                } else if (typeof series.data[0] === 'object' && series.data[0].x !== undefined) {
                    // [{x: val, y: val}, ...] format
                    series.data.forEach(point => {
                        rows.push([point.x.toString(), point.y.toString()]);
                    });
                } else if (categories.length > 0) {
                    // categories with data values
                    for (let i = 0; i < Math.min(categories.length, series.data.length); i++) {
                        rows.push([categories[i].toString(), series.data[i].toString()]);
                    }
                } else {
                    // Simple data array, generate indices
                    series.data.forEach((value, index) => {
                        rows.push([`項目 ${index + 1}`, value.toString()]);
                    });
                }

                if (rows.length > 0) {
                    return {
                        title: chart.title,
                        headers: headers,
                        rows: rows
                    };
                }
            }
        }

        return null;
    }

    /**
     * Format table data for Excel with special unit row format
     */
    formatTableDataForExcel(tableData, chart) {
        const yAxis = chart.configuration?.yAxis || 'metric_ton';
        const unit = yAxis === 'metric_ton' ? '公噸' :
                     yAxis === 'kilogram' ? '公斤' :
                     yAxis === 'new_taiwan_dollar' ? '新台幣' : '公噸';

        return [
            [tableData.title],  // Title row
            [],  // Empty row
            tableData.headers,  // Headers
            ['單位', ...Array(tableData.headers.length - 1).fill(unit)],  // Unit row
            [],  // Empty row
            ...tableData.rows  // Data rows
        ];
    }

    /**
     * Sanitize sheet name for Excel
     */
    sanitizeSheetName(title) {
        // Excel sheet names can't exceed 31 characters and can't contain certain characters
        return title.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31);
    }

    /**
     * Download workbooks as ZIP
     */
    async downloadWorkbooksAsZip(workbooks) {
        // Create ZIP with JSZip or similar library
        // For now, download individually
        for (const wb of workbooks) {
            XLSX.writeFile(wb.workbook, wb.filename);
            // Add small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    /**
     * Capture element as PNG
     */
    async captureElementAsPng(element, title) {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.backgroundColor = this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff';

        const clone = element.cloneNode(true);
        this.removeIdsFromElement(clone);
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);

        try {
            // Get element dimensions to ensure full capture
            const rect = tempContainer.getBoundingClientRect();
            const width = Math.ceil(rect.width);
            const height = Math.ceil(rect.height);

            const canvas = await html2canvas(tempContainer, {
                backgroundColor: this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: width,
                height: height,
                windowWidth: width,
                windowHeight: height
            });

            return new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });
        } finally {
            if (tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
        }
    }

    /**
     * Create temporary combined element
     */
    async createTemporaryCombinedElement(chart) {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.backgroundColor = this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff';

        // Add chart
        const chartClone = await this.createChartPreviewElement(chart);
        container.appendChild(chartClone);

        // Add table if exists
        if (chart.showTable && chart.tableElement) {
            const tableClone = this.createTablePreviewElement(chart);
            container.appendChild(tableClone);
        }

        document.body.appendChild(container);
        return container;
    }

    /**
     * Create temporary charts container
     */
    async createTemporaryChartsContainer(charts) {
        const container = document.createElement('div');
        container.className = 'temp-charts-container';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.backgroundColor = this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff';

        for (const chart of charts) {
            const chartClone = await this.createChartPreviewElement(chart);
            container.appendChild(chartClone);
        }

        document.body.appendChild(container);
        return container;
    }

    /**
     * Create temporary tables container
     */
    createTemporaryTablesContainer(charts) {
        const container = document.createElement('div');
        container.className = 'temp-tables-container';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.backgroundColor = this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff';

        charts.forEach(chart => {
            const tableClone = this.createTablePreviewElement(chart, true);
            container.appendChild(tableClone);
        });

        document.body.appendChild(container);
        return container;
    }

    /**
     * Create temporary all-in-one container
     */
    async createTemporaryAllInOneContainer(charts) {
        const container = document.createElement('div');
        container.className = 'temp-all-in-one-container';
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.backgroundColor = this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff';

        for (const chart of charts) {
            const chartClone = await this.createChartPreviewElement(chart);
            container.appendChild(chartClone);

            if (chart.showTable && chart.tableElement) {
                const tableClone = this.createTablePreviewElement(chart, true);
                container.appendChild(tableClone);
            }
        }

        document.body.appendChild(container);
        return container;
    }

    /**
     * Generate PDF content based on layout type
     */
    async generatePdfContent(charts, layoutType, theme) {
        const content = [];

        // Add title
        const reportTitle = this.getReportTitle();
        content.push({
            text: reportTitle,
            style: 'title'
        });

        switch (layoutType) {
            case 'page_break':
                for (const [index, chart] of charts.entries()) {
                    // Generate fresh chart for PDF export using chart-utils
                    const chartPreviewElement = await this.createChartPreviewElement(chart);
                    const chartImage = await this.convertChartToBase64(chartPreviewElement);
                    if (chartImage) {
                        content.push({
                            text: chart.title,
                            style: 'header'
                        });
                        content.push({
                            image: chartImage,
                            width: 500,
                            alignment: 'center',
                            margin: [0, 0, 0, 20]
                        });
                    }

                    // Table if exists
                    if (chart.showTable && chart.tableElement) {
                        const tableData = this.extractPdfTableData(chart.tableElement);
                        if (tableData && tableData.length > 0) {
                            // Calculate column count and create widths array
                            const columnCount = tableData[0].length || 2;
                            const widths = Array(columnCount).fill('*');  // Fill entire width evenly
                            const lineColor = theme === 'dark' ? '#ffffff' : '#000000';

                            content.push({
                                table: {
                                    headerRows: 1,
                                    widths: widths,
                                    body: tableData
                                },
                                layout: {
                                    hLineWidth: function(i, node) {
                                        return (i === 0 || i === node.table.body.length) ? 0 : 1;
                                    },
                                    vLineWidth: function(i) {
                                        return 0;
                                    },
                                    hLineColor: function(i) {
                                        return lineColor;
                                    },
                                    paddingLeft: function(i) { return 4; },
                                    paddingRight: function(i) { return 4; },
                                    paddingTop: function(i) { return 2; },
                                    paddingBottom: function(i) { return 2; }
                                },
                                margin: [0, 0, 0, 20]
                            });
                        }
                    }

                    // Page break (except for last chart)
                    if (index < charts.length - 1) {
                        content[content.length - 1].pageBreak = 'after';
                    }
                }
                break;

            case 'charts_tables_separate_break':
                // All charts first - CRITICAL: Generate fresh charts for PDF export
                for (const chart of charts) {
                    const chartPreviewElement = await this.createChartPreviewElement(chart);
                    const chartImage = await this.convertChartToBase64(chartPreviewElement);
                    if (chartImage) {
                        content.push({
                            text: chart.title,
                            style: 'header'
                        });
                        content.push({
                            image: chartImage,
                            width: 500,
                            alignment: 'center',
                            pageBreak: 'after'
                        });
                    }
                }

                // Section separator
                content.push({
                    text: '資料表格',
                    style: 'section',
                    pageBreak: 'before'
                });

                // All tables
                const chartsWithTable = charts.filter(chart => chart.showTable);
                for (const [index, chart] of chartsWithTable.entries()) {
                    content.push({
                        text: `${chart.title} - 詳細資料`,
                        style: 'header'
                    });

                    const tableData = this.extractPdfTableData(chart.tableElement);
                    if (tableData && tableData.length > 0) {
                        // Calculate column count and create widths array
                        const columnCount = tableData[0].length || 2;
                        const widths = Array(columnCount).fill('*');  // Fill entire width evenly
                        const lineColor = theme === 'dark' ? '#ffffff' : '#000000';

                        const tableObj = {
                            table: {
                                headerRows: 1,
                                widths: widths,
                                body: tableData
                            },
                            layout: {
                                hLineWidth: function(i, node) {
                                    return (i === 0 || i === node.table.body.length) ? 0 : 1;
                                },
                                vLineWidth: function(i) {
                                    return 0;
                                },
                                hLineColor: function(i) {
                                    return lineColor;
                                },
                                paddingLeft: function(i) { return 4; },
                                paddingRight: function(i) { return 4; },
                                paddingTop: function(i) { return 2; },
                                paddingBottom: function(i) { return 2; }
                            },
                            margin: [0, 0, 0, 20]
                        };

                        if (index < chartsWithTable.length - 1) {
                            tableObj.pageBreak = 'after';
                        }

                        content.push(tableObj);
                    }
                }
                break;

            // Add other layout types as needed...
            default:
                // Default: simple layout
                for (const chart of charts) {
                    const chartImage = await this.convertChartToBase64(chart.chartElement);
                    if (chartImage) {
                        content.push({
                            text: chart.title,
                            style: 'header'
                        });
                        content.push({
                            image: chartImage,
                            width: 500,
                            alignment: 'center',
                            margin: [0, 0, 0, 20]
                        });
                    }
                }
        }

        return content;
    }

    /**
     * Convert chart element to base64 for PDF
     */
    async convertChartToBase64(chartElement) {
        if (typeof html2canvas === 'undefined') {
            console.error('[ExportReport] html2canvas not available');
            return null;
        }

        console.log('[ExportReport] Starting chart to base64 conversion');
        console.log('[ExportReport] Chart element info:', {
            tagName: chartElement.tagName,
            className: chartElement.className,
            childrenCount: chartElement.children.length,
            hasApexCharts: chartElement.querySelectorAll('.apexcharts-canvas').length > 0,
            hasSVG: chartElement.querySelectorAll('svg').length > 0,
            offsetWidth: chartElement.offsetWidth,
            offsetHeight: chartElement.offsetHeight
        });

        // Create temporary container with auto sizing
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.backgroundColor = this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff';

        // Clone and prepare the chart element
        const clone = chartElement.cloneNode(true);
        this.removeIdsFromElement(clone);

        // Apply theme
        this.applyThemeToChartElement(clone, this.getCurrentTheme());

        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);

        try {
            // SIMPLIFIED: No need to wait for animations since they're disabled
            console.log('[ExportReport] Starting chart capture (animations disabled)...');
            await new Promise(resolve => setTimeout(resolve, 100)); // Minimal wait for DOM

            // Get element dimensions to ensure full capture
            const rect = tempContainer.getBoundingClientRect();
            const width = Math.ceil(rect.width);
            const height = Math.ceil(rect.height);

            console.log('[ExportReport] Starting html2canvas capture');
            console.log('[ExportReport] Container dimensions:', { width, height });

            const canvas = await html2canvas(tempContainer, {
                backgroundColor: this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                width: width,
                height: height,
                windowWidth: width,
                windowHeight: height
            });

            console.log('[ExportReport] html2canvas capture completed');
            console.log('[ExportReport] Canvas dimensions:', { width: canvas.width, height: canvas.height });

            // Hide the temporary container after capture
            tempContainer.style.display = 'none';

            const dataUrl = canvas.toDataURL('image/png');
            console.log('[ExportReport] Generated data URL length:', dataUrl.length);

            // Debug: Check if the image actually contains data
            if (dataUrl.length < 1000) {
                console.warn('[ExportReport] Generated image seems too small, may be empty');
            }

            return dataUrl;

        } catch (error) {
            console.error('[ExportReport] Error converting chart to image:', error);
            console.error('[ExportReport] Chart element structure:', {
                tagName: chartElement.tagName,
                innerHTML: chartElement.innerHTML.substring(0, 500) + '...'
            });
            return null;
        } finally {
            // Always clean up temporary container
            if (tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
        }
    }

    /**
     * Extract table data for PDF
     */
    extractPdfTableData(tableElement) {
        if (!tableElement) return null;

        const table = tableElement.querySelector('table');
        if (!table) return null;

        const tableData = [];

        // Extract headers
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const headers = [];
            headerRow.querySelectorAll('th').forEach(th => {
                headers.push({ text: th.textContent.trim(), style: 'tableHeader' });
            });
            tableData.push(headers);
        }

        // Extract data rows
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('td').forEach(td => {
                    row.push(td.textContent.trim());
                });
                if (row.length > 0) {
                    tableData.push(row);
                }
            });
        }

        return tableData.length > 0 ? tableData : null;
    }

    /**
     * Get dark theme background for PDF
     */
    getDarkThemeBackground() {
        return {
            canvas: [
                {
                    type: 'rect',
                    x: 0,
                    y: 0,
                    w: 595.28, // A4 width in points
                    h: 841.89, // A4 height in points
                    color: '#1a1a1a'
                }
            ]
        };
    }

    /**
     * Download files as ZIP
     */
    async downloadFilesAsZip(files, type) {
        if (files.length <= 1) {
            // Single file, download directly
            if (files.length === 1) {
                this.downloadBlob(files[0].blob, files[0].filename);
            }
            return;
        }

        // Multiple files, create ZIP
        try {
            if (typeof JSZip === 'undefined') {
                console.warn('[ExportReport] JSZip not available, downloading files individually');
                await this.downloadFilesIndividually(files);
                return;
            }

            console.log(`[ExportReport] Creating ZIP with ${files.length} files`);

            const zip = new JSZip();
            const reportTitle = this.getReportTitle();
            const timestamp = this.getTimestamp();

            // Add all files to ZIP
            for (const file of files) {
                console.log(`[ExportReport] Adding file to ZIP: ${file.filename}`);
                zip.file(file.filename, file.blob);
            }

            // Generate ZIP
            console.log('[ExportReport] Generating ZIP file');
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 6
                }
            });

            // Download ZIP file
            const zipFilename = `${reportTitle.replace(/[<>:"/\\|?*]/g, '_')}_${type.toUpperCase()}_${timestamp}.zip`;
            console.log(`[ExportReport] Downloading ZIP: ${zipFilename}`);
            this.downloadBlob(zipBlob, zipFilename);

            // Show success message
            VisualizeChartUtils.showSuccessModal(`已成功打包 ${files.length} 個檔案為 ZIP`);

        } catch (error) {
            console.error('[ExportReport] Error creating ZIP:', error);
            console.log('[ExportReport] Falling back to individual downloads');
            await this.downloadFilesIndividually(files);
        }
    }

    /**
     * Download files individually as fallback
     */
    async downloadFilesIndividually(files) {
        for (const [index, file] of files.entries()) {
            this.downloadBlob(file.blob, file.filename);
            // Add delay between downloads
            if (index < files.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Show info about multiple files
        if (files.length > 1) {
            setTimeout(() => {
                VisualizeChartUtils.showSuccessModal(`已開始下載 ${files.length} 個檔案`);
            }, 1000);
        }
    }

    /**
     * Download blob as file
     */
    downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// ==================== INITIALIZATION ====================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on a page with export buttons
    if (document.getElementById('exportPreviewModal') &&
        document.getElementById('generateReportBtn')) {

        console.log('[ExportReport] Initializing with Linus philosophy approach');
        window.visualizeExportReport = new VisualizeExportReport();

        // Register callback for chart-utils theme change system
        window.regenerateExportPreview = () => {
            if (window.visualizeExportReport && typeof window.visualizeExportReport.regeneratePreview === 'function') {
                window.visualizeExportReport.regeneratePreview();
            }
        };
    }
});

// Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizeExportReport;
}