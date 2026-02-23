/**
 * Medical Waste Management System - Single Chart Export Module
 * Handles individual chart export functionality for both visualize and vis-department systems
 * Supports Excel, PNG, PDF, and direct printing exports
 */

class VisualizeExport {
    constructor() {
        this.isInitialized = false;
        this.isExporting = false;
        this.init();
    }

    /**
     * Initialize the export module
     */
    init() {
        if (this.isInitialized) return;

        this.bindEvents();
        this.isInitialized = true;
        console.log('VisualizeExport initialized');
    }

    /**
     * Bind event listeners to export buttons
     */
    bindEvents() {
        // Excel export button
        const excelBtn = document.getElementById('exportXlsxBtn');
        if (excelBtn) {
            excelBtn.addEventListener('click', () => this.exportToExcel());
        }

        // PNG export button
        const pngBtn = document.getElementById('exportPngBtn');
        if (pngBtn) {
            pngBtn.addEventListener('click', () => this.exportToPNG());
        }

        // PDF export button
        const pdfBtn = document.getElementById('exportPdfBtn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.exportToPDF());
        }

        // Print button
        const printBtn = document.getElementById('printChartBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printChart());
        }
    }

    /**
     * Export current chart data to Excel format
     * Special format: Units displayed in separate row for easy copying
     */
    async exportToExcel() {
        try {
            // Check if XLSX library is available
            if (typeof XLSX === 'undefined') {
                VisualizeChartUtils.showErrorModal('Excel匯出功能不可用，請檢查網路連線');
                return;
            }

            // Get current chart data from the preview area
            const chartData = this.getCurrentChartData();
            if (!chartData) {
                VisualizeChartUtils.showErrorModal('目前沒有可匯出的圖表資料');
                return;
            }

            // Create workbook
            const wb = XLSX.utils.book_new();

            // Generate worksheet data with special "units in separate row" format
            const wsData = this.generateExcelData(chartData);

            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set column widths
            ws['!cols'] = this.getExcelColumnWidths(chartData);

            // Add worksheet to workbook
            const sheetName = this.generateExcelSheetName(chartData);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Generate filename and save
            const filename = this.generateExcelFilename(chartData);
            XLSX.writeFile(wb, filename);

            VisualizeChartUtils.showSuccessModal('Excel匯出完成');

        } catch (error) {
            console.error('Excel export error:', error);
            VisualizeChartUtils.showErrorModal('Excel匯出失敗：' + error.message);
        }
    }

    /**
     * Export current chart to PNG format
     * Includes table if "顯示原始資料表格" is enabled
     */
    async exportToPNG() {
        if (this.isExporting) {
            return;
        }

        this.isExporting = true;

        try {
            // Check if html2canvas is available
            if (typeof html2canvas === 'undefined') {
                VisualizeChartUtils.showErrorModal('PNG匯出功能不可用，請檢查網路連線');
                this.isExporting = false;
                return;
            }

            // Get the element to capture
            const elementToCapture = this.getPNGCaptureElement();
            if (!elementToCapture) {
                VisualizeChartUtils.showErrorModal('找不到可匯出的圖表內容');
                this.isExporting = false;
                return;
            }

            // Store original styles to restore later
            const originalStyles = this.storeOriginalStyles(elementToCapture);

            try {
                // Apply current theme for export
                this.applyThemeForExport(elementToCapture);

                // Get element dimensions to ensure full capture
                const rect = elementToCapture.getBoundingClientRect();
                const width = Math.ceil(rect.width);
                const height = Math.ceil(rect.height);

                // Capture the element with explicit dimensions
                const canvas = await html2canvas(elementToCapture, {
                    backgroundColor: this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff',
                    useCORS: true,
                    allowTaint: true,
                    scale: 2,
                    width: width,
                    height: height,
                    windowWidth: width,
                    windowHeight: height
                });

                // Convert to blob and download
                canvas.toBlob((blob) => {
                    const filename = this.generatePNGFilename();
                    this.downloadBlob(blob, filename);
                    VisualizeChartUtils.showSuccessModal('PNG匯出完成');
                    this.isExporting = false;
                }, 'image/png');

            } finally {
                // Always restore original styles
                this.restoreOriginalStyles(elementToCapture, originalStyles);
            }

        } catch (error) {
            console.error('PNG export error:', error);
            VisualizeChartUtils.showErrorModal('PNG匯出失敗：' + error.message);
            this.isExporting = false;
        }
    }

    /**
     * Export current chart to PDF format
     * Includes table if "顯示原始資料表格" is enabled
     */
    async exportToPDF() {
        try {
            // Check if pdfMake is available
            if (typeof pdfMake === 'undefined') {
                VisualizeChartUtils.showErrorModal('PDF匯出功能不可用，請檢查網路連線');
                return;
            }

            const chartData = this.getCurrentChartData();
            if (!chartData) {
                VisualizeChartUtils.showErrorModal('目前沒有可匯出的圖表資料');
                return;
            }

            // Generate PDF content
            const pdfContent = await this.generatePDFContent(chartData);

            // Create and download PDF
            const docDefinition = {
                content: pdfContent,
                pageSize: 'A4',
                pageOrientation: 'portrait',
                background: this.getCurrentTheme() === 'dark' ? this.getDarkThemeBackground() : null,
                defaultStyle: {
                    fontSize: 10,
                    font: 'NotoSansTC',
                    color: this.getCurrentTheme() === 'dark' ? '#ffffff' : '#000000'
                },
                styles: {
                    header: {
                        fontSize: 18,
                        font: 'NotoSansTC',
                        bold: true,
                        margin: [0, 0, 0, 10]
                    }
                }
            };

            const filename = this.generatePDFFilename(chartData);
            pdfMake.createPdf(docDefinition).download(filename);

            VisualizeChartUtils.showSuccessModal('PDF匯出完成');

        } catch (error) {
            console.error('PDF export error:', error);
            VisualizeChartUtils.showErrorModal('PDF匯出失敗：' + error.message);
        }
    }

    /**
     * Print current chart directly
     * Uses existing PDF export logic but opens for printing instead of downloading
     */
    async printChart() {
        try {
            // Check if pdfMake is available
            if (typeof pdfMake === 'undefined') {
                VisualizeChartUtils.showErrorModal('列印功能不可用，請檢查網路連線');
                return;
            }

            const chartData = this.getCurrentChartData();
            if (!chartData) {
                VisualizeChartUtils.showErrorModal('目前沒有可列印的圖表資料');
                return;
            }

            // Call the existing PDF generation logic
            await this.generatePDFForPrint(chartData);

        } catch (error) {
            console.error('Print error:', error);
            VisualizeChartUtils.showErrorModal('列印失敗：' + error.message);
        }
    }

    /**
     * Generate PDF for printing (reuses exportToPDF logic)
     * @param {Object} chartData - Chart data object
     */
    async generatePDFForPrint(chartData) {
        // Reuse the exact same logic as exportToPDF, but open instead of download
        const pdfContent = await this.generatePDFContent(chartData);

        const docDefinition = {
            content: pdfContent,
            pageSize: 'A4',
            pageOrientation: 'portrait',
            background: this.getCurrentTheme() === 'dark' ? this.getDarkThemeBackground() : null,
            defaultStyle: {
                fontSize: 10,
                font: 'NotoSansTC',
                color: this.getCurrentTheme() === 'dark' ? '#ffffff' : '#000000'
            },
            styles: {
                header: {
                    fontSize: 18,
                    font: 'NotoSansTC',
                    bold: true,
                    margin: [0, 0, 0, 10]
                }
            }
        };

        // Open PDF in new window and trigger print dialog
        pdfMake.createPdf(docDefinition).print();
    }

    /**
     * Get current chart data from the preview area
     * @returns {Object} Chart data object or null
     */
    getCurrentChartData() {
        // Check if we have an active tab and chart configurations
        if (typeof window.activeTabIndex !== 'number' || !window.chartConfigurations) {
            console.log('[Export] No active tab index or chart configurations');
            return null;
        }

        const activeIndex = window.activeTabIndex;
        if (activeIndex < 0 || activeIndex >= window.chartConfigurations.length) {
            console.log('[Export] Invalid active tab index:', activeIndex);
            return null;
        }

        const config = window.chartConfigurations[activeIndex];
        if (!config) {
            console.log('[Export] No configuration for tab:', activeIndex);
            return null;
        }

        // Get chart instance and configuration
        const chartContainer = document.getElementById('chartPreview');
        const tableContainer = document.getElementById('dataTable');

        if (!chartContainer) {
            console.log('[Export] No chart container found');
            return null;
        }

        // Check if there's actually a chart - be more lenient
        const hasChart = window.chart ||
                         chartContainer.querySelector('.apexcharts-canvas') ||
                         chartContainer.querySelector('canvas') ||
                         config.chartContent ||
                         chartContainer.children.length > 0;

        if (!hasChart) {
            console.log('[Export] No chart found in preview area');
            return null;
        }

        return {
            tabId: `tab-${activeIndex}`,
            title: config.displayTitle || config.title || `圖表 ${activeIndex + 1}`,
            chartElement: chartContainer,
            tableElement: tableContainer,
            hasTable: tableContainer && !tableContainer.classList.contains('has-hidden') && tableContainer.children.length > 0,
            configuration: config,
            chartData: window.chartData || config.chartData,
            chart: window.chart
        };
    }

    /**
     * Generate Excel data in special format (units in separate row)
     * @param {Object} chartData - Chart data object
     * @returns {Array} Array of arrays for Excel worksheet
     */
    generateExcelData(chartData) {
        // Get table data from dataTable element
        const tableElement = chartData.tableElement;
        if (!tableElement) {
            throw new Error('找不到表格資料');
        }

        const table = tableElement.querySelector('table');
        if (!table) {
            throw new Error('找不到表格內容');
        }

        const wsData = [];

        // Add title row
        wsData.push([chartData.title || '圖表資料']);
        wsData.push([]); // Empty row

        // Extract headers and expand for percentage format
        const headers = [];
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            headerRow.querySelectorAll('th').forEach((th, index) => {
                const headerText = th.textContent.trim();
                if (index === 0) {
                    // First column (date/label)
                    headers.push(headerText);
                } else {
                    // Check if this column contains percentage data
                    const hasPercentageInColumn = this.checkColumnHasPercentage(table, index);
                    if (hasPercentageInColumn) {
                        // Add two headers for percentage format
                        headers.push(headerText); // Series name (same for both)
                        headers.push(''); // Empty for second column
                    } else {
                        headers.push(headerText);
                    }
                }
            });
        }

        // Extract data rows - expand percentage columns side by side
        const dataRows = [];
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('td').forEach((td, cellIndex) => {
                    let cellText = td.textContent.trim();

                    if (cellIndex === 0) {
                        // First column is date/label, keep as is
                        row.push(cellText);
                    } else {
                        // Data columns: extract clean values per requirements
                        const extractedValues = this.extractNumberFromCell(cellText);
                        if (Array.isArray(extractedValues)) {
                            // If percentage format, add both values side by side
                            row.push(extractedValues[0]); // Percentage value first
                            row.push(extractedValues[1]); // Original value second
                        } else {
                            // Non-percentage: add the value
                            row.push(extractedValues);
                        }
                    }
                });
                dataRows.push(row);
            });
        }

        // Special format: Units in separate row
        if (headers.length > 0) {
            // Add headers
            wsData.push(headers);

            // Add unit row (extract from data or configuration)
            const unitRow = this.generateUnitRow(headers, chartData);
            wsData.push(unitRow);

            // Add empty row for separation
            wsData.push([]);

            // Add data rows
            dataRows.forEach(row => {
                wsData.push(row);
            });
        }

        return wsData;
    }

    /**
     * Check if a column contains percentage data
     * @param {HTMLElement} table - Table element
     * @param {number} columnIndex - Column index to check
     * @returns {boolean} Whether column contains percentage
     */
    checkColumnHasPercentage(table, columnIndex) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return false;

        const rows = tbody.querySelectorAll('tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells[columnIndex]) {
                const cellText = cells[columnIndex].textContent.trim();
                if (this.isPercentageFormat(cellText)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Generate unit row for Excel export with percentage format support
     * @param {Array} headers - Table headers (expanded for percentage columns)
     * @param {Object} chartData - Chart data object
     * @returns {Array} Unit row array
     */
    generateUnitRow(headers, chartData) {
        const unitRow = [];
        const config = chartData.configuration;
        const yAxis = config?.yAxis || config?.y_axis || 'metric_ton';

        const unit = yAxis === 'metric_ton' ? '公噸' :
                    yAxis === 'kilogram' ? '公斤' :
                    yAxis === 'new_taiwan_dollar' ? '新台幣' : '公噸';

        headers.forEach((header, index) => {
            if (index === 0) {
                unitRow.push('單位');
            } else if (header === '') {
                // This is the second column of a percentage pair (original value)
                unitRow.push(unit);
            } else {
                // Check if this is a percentage column by looking at the next header
                const nextHeader = headers[index + 1];
                if (nextHeader === '') {
                    // This is the first column of a percentage pair (percentage value)
                    unitRow.push('百分比');
                } else {
                    // Regular column
                    unitRow.push(unit);
                }
            }
        });

        return unitRow;
    }

    /**
     * Check if cell text is in percentage format
     * @param {string} cellText - Cell text content
     * @returns {boolean} Whether text contains percentage
     */
    isPercentageFormat(cellText) {
        return /[0-9,]+(?:\.[0-9]+)?%/.test(cellText);
    }

    /**
     * Extract number from table cell for Excel export
     * For percentage format like "50% (123.45 公噸)", return array [percentage, originalValue]
     * @param {string} cellText - Cell text content
     * @returns {string|Array} Clean value or array for percentage format
     */
    extractNumberFromCell(cellText) {
        // Check if this is a percentage format with parentheses: "50% (123.45 公噸)"
        const percentageWithValueMatch = cellText.match(/([0-9,]+(?:\.[0-9]+)?)%\s*\(([0-9,]+(?:\.[0-9]+)?)/);
        if (percentageWithValueMatch) {
            const percentage = percentageWithValueMatch[1].replace(/,/g, '');  // No % symbol
            const value = percentageWithValueMatch[2].replace(/,/g, '');      // No unit
            return [percentage, value];  // Return array for separate rows
        }

        // Regular percentage format: "50%"
        const percentageMatch = cellText.match(/([0-9,]+(?:\.[0-9]+)?)%/);
        if (percentageMatch) {
            return percentageMatch[1].replace(/,/g, '');  // No % symbol
        }

        // Extract number before unit (公噸, 公斤, 新台幣, 元)
        const unitMatch = cellText.match(/([0-9,]+(?:\.[0-9]+)?)\s*(?:公噸|公斤|新台幣|元)/);
        if (unitMatch) {
            return unitMatch[1].replace(/,/g, '');
        }

        // Extract number from parentheses
        const parenthesesMatch = cellText.match(/\(([0-9,]+(?:\.[0-9]+)?)/);
        if (parenthesesMatch) {
            return parenthesesMatch[1].replace(/,/g, '');
        }

        // Fallback: extract any number (remove commas)
        const numberMatch = cellText.match(/([0-9,]+(?:\.[0-9]+)?)/);
        if (numberMatch) {
            return numberMatch[1].replace(/,/g, '');
        }

        // If no number found, return the original text
        return cellText;
    }

    /**
     * Extract unit from header text
     * @param {string} header - Header text
     * @returns {string} Unit or null
     */
    extractUnitFromHeader(header) {
        // Common unit patterns
        const unitPatterns = [
            /\((.+?)\)/, // (公噸)
            /（(.+?)）/, // （公噸）
            /單位[：:]\s*(.+)/, // 單位：公噸
        ];

        for (const pattern of unitPatterns) {
            const match = header.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Get current theme setting
     * @returns {string} 'light' or 'dark'
     */
    getCurrentTheme() {
        return VisualizeChartUtils.getCurrentSwitchTheme();
    }

    /**
     * Get element to capture for PNG export
     * @returns {HTMLElement} Element to capture
     */
    getPNGCaptureElement() {
        const dataTable = document.getElementById('dataTable');
        const showTable = dataTable && !dataTable.classList.contains('has-hidden') && dataTable.children.length > 0;

        if (showTable) {
            // Capture both chart and table
            const displayArea = document.getElementById('chartPreviewDisplayArea');
            return displayArea || document.getElementById('chartPreview');
        } else {
            // Capture only chart
            return document.getElementById('chartPreview');
        }
    }

    /**
     * Store original styles before applying theme for export
     * @param {HTMLElement} element - Element to store styles for
     * @returns {Object} Original style properties
     */
    storeOriginalStyles(element) {
        return {
            backgroundColor: element.style.backgroundColor,
            color: element.style.color
        };
    }

    /**
     * Restore original styles after export
     * @param {HTMLElement} element - Element to restore styles for
     * @param {Object} originalStyles - Original style properties
     */
    restoreOriginalStyles(element, originalStyles) {
        element.style.backgroundColor = originalStyles.backgroundColor;
        element.style.color = originalStyles.color;
    }

    /**
     * Apply theme for export
     * @param {HTMLElement} element - Element to apply theme to
     */
    applyThemeForExport(element) {
        const theme = this.getCurrentTheme();

        if (theme === 'dark') {
            element.style.backgroundColor = '#1a1a1a';
            element.style.color = '#ffffff';
        } else {
            element.style.backgroundColor = '#ffffff';
            element.style.color = '#000000';
        }
    }

    /**
     * Generate PDF content
     * @param {Object} chartData - Chart data object
     * @returns {Array} PDF content array
     */
    async generatePDFContent(chartData) {
        const content = [];

        // Add title
        content.push({
            text: chartData.title || '圖表報表',
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20]
        });

        // Add chart image
        const chartImage = await this.getChartImageForPDF(chartData.chartElement);
        if (chartImage) {
            content.push({
                image: chartImage,
                width: 500,
                alignment: 'center',
                margin: [0, 0, 0, 20]
            });
        }

        // Add table if enabled
        if (chartData.hasTable && chartData.tableElement) {
            const tableData = this.getTableDataForPDF(chartData.tableElement);
            if (tableData) {
                const theme = this.getCurrentTheme();
                const borderColor = theme === 'dark' ? '#ffffff' : '#000000';

                content.push({
                    table: tableData,
                    layout: {
                        hLineWidth: function(i, node) {
                            return (i === 0 || i === node.table.body.length) ? 0 : 1;
                        },
                        vLineWidth: function(i) {
                            return 0;
                        },
                        hLineColor: function(i) {
                            return borderColor;
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

        return content;
    }

    /**
     * Get chart image for PDF
     * @param {HTMLElement} chartElement - Chart container element
     * @returns {string} Base64 image data
     */
    async getChartImageForPDF(chartElement) {
        try {
            // Get element dimensions to ensure full capture
            const rect = chartElement.getBoundingClientRect();
            const width = Math.ceil(rect.width);
            const height = Math.ceil(rect.height);

            const canvas = await html2canvas(chartElement, {
                backgroundColor: this.getCurrentTheme() === 'dark' ? '#1a1a1a' : '#ffffff',
                useCORS: true,
                allowTaint: true,
                scale: 2,
                width: width,
                height: height,
                windowWidth: width,
                windowHeight: height
            });

            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Error generating chart image for PDF:', error);
            return null;
        }
    }

    /**
     * Get table data for PDF
     * @param {HTMLElement} tableElement - Table container element
     * @returns {Object} PDF table object
     */
    getTableDataForPDF(tableElement) {
        const table = tableElement.querySelector('table');
        if (!table) return null;

        const tableData = {
            headerRows: 1,
            body: []
        };

        // Extract headers
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const headers = [];
            headerRow.querySelectorAll('th').forEach(th => {
                headers.push(th.textContent.trim());
            });
            tableData.body.push(headers);
        }

        // Extract data rows
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const row = [];
                tr.querySelectorAll('td').forEach(td => {
                    row.push(td.textContent.trim());
                });
                tableData.body.push(row);
            });
        }

        // Add widths array to fill entire page width
        if (tableData.body.length > 0) {
            const columnCount = tableData.body[0].length || 2;
            tableData.widths = Array(columnCount).fill('*');
        }

        return tableData;
    }

    /**
     * Get dark theme background for PDF
     * @returns {Object} Background definition
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
     * Generate printable HTML content
     * @param {Object} chartData - Chart data object
     * @returns {string} HTML content for printing
     */
    async generatePrintContent(chartData) {
        const theme = this.getCurrentTheme();
        const backgroundColor = theme === 'dark' ? '#1a1a1a' : '#ffffff';
        const textColor = theme === 'dark' ? '#ffffff' : '#000000';

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${chartData.title || '圖表列印'}</title>
            <style>
                body {
                    font-family: 'Noto Sans TC', sans-serif;
                    margin: 20px;
                    background-color: ${backgroundColor};
                    color: ${textColor};
                }
                .chart-container {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .table-container {
                    margin-top: 30px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 0 auto;
                }
                th, td {
                    border: 1px solid ${theme === 'dark' ? '#666' : '#ccc'};
                    padding: 8px;
                    text-align: center;
                }
                th {
                    background-color: ${theme === 'dark' ? '#333' : '#f5f5f5'};
                    font-weight: bold;
                }
                h1 {
                    text-align: center;
                    margin-bottom: 30px;
                }
                @media print {
                    body {
                        background-color: ${backgroundColor};
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <h1>${chartData.title || '圖表列印'}</h1>
        `;

        // Add chart image
        const chartImage = await this.getChartImageForPDF(chartData.chartElement);
        if (chartImage) {
            html += `
            <div class="chart-container">
                <img src="${chartImage}" style="max-width: 100%; height: auto;" />
            </div>
            `;
        }

        // Add table if enabled
        if (chartData.hasTable && chartData.tableElement) {
            const tableHtml = chartData.tableElement.outerHTML;
            html += `
            <div class="table-container">
                ${tableHtml}
            </div>
            `;
        }

        html += `
        </body>
        </html>
        `;

        return html;
    }

    /**
     * Download blob as file
     * @param {Blob} blob - Blob to download
     * @param {string} filename - Filename
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

    /**
     * Generate Excel filename
     * @param {Object} chartData - Chart data object
     * @returns {string} Filename
     */
    generateExcelFilename(chartData) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const title = (chartData.title || '圖表').replace(/[<>:"/\\|?*]/g, '_');
        return `${title}_${timestamp}.xlsx`;
    }

    /**
     * Generate PNG filename
     * @returns {string} Filename
     */
    generatePNGFilename() {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');

        // Get current chart data for title
        const chartData = this.getCurrentChartData();
        const title = chartData ? chartData.title : '圖表';
        const cleanTitle = title.replace(/[<>:"/\\|?*]/g, '_');
        return `${cleanTitle}_${timestamp}.png`;
    }

    /**
     * Generate PDF filename
     * @param {Object} chartData - Chart data object
     * @returns {string} Filename
     */
    generatePDFFilename(chartData) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        const title = (chartData.title || '圖表').replace(/[<>:"/\\|?*]/g, '_');
        return `${title}_${timestamp}.pdf`;
    }

    /**
     * Generate Excel sheet name
     * @param {Object} chartData - Chart data object
     * @returns {string} Sheet name
     */
    generateExcelSheetName(chartData) {
        const title = chartData.title || '圖表';
        // Excel sheet names can't exceed 31 characters and can't contain certain characters
        return title.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31);
    }

    /**
     * Get Excel column widths
     * @param {Object} chartData - Chart data object
     * @returns {Array} Array of column width objects
     */
    getExcelColumnWidths(chartData) {
        // Default widths, can be customized based on data
        return [
            { width: 25 }, // First column (usually labels)
            { width: 15 }, // Data columns
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];
    }

    /**
     * Get chart title from tab element
     * @param {HTMLElement} tabElement - Tab element
     * @returns {string} Chart title
     */
    getChartTitle(tabElement) {
        const titleElement = tabElement.querySelector('.chart-title');
        return titleElement ? titleElement.textContent.trim() : '圖表';
    }

    /**
     * Get chart configuration from tab element
     * @param {HTMLElement} tabElement - Tab element
     * @returns {Object} Chart configuration
     */
    getChartConfiguration(tabElement) {
        // This would extract the chart configuration stored in the tab
        // Implementation depends on how chart configuration is stored
        return {
            type: 'line', // Default, should be extracted from actual config
            xAxis: '',
            yAxis: '',
            groupBy: ''
        };
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on a page with export buttons
    if (document.getElementById('exportXlsxBtn') ||
        document.getElementById('exportPngBtn') ||
        document.getElementById('exportPdfBtn') ||
        document.getElementById('printChartBtn')) {
        window.visualizeExport = new VisualizeExport();
    }
});