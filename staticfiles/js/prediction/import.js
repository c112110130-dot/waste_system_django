document.addEventListener('DOMContentLoaded', () => {
    class ImportManager {
        constructor() {
            this.importBtn = document.getElementById('importDataBtn');
            this.importModal = document.getElementById('importModal');
            this.loadingModal = document.getElementById('loadingModal');
            this.overrideModal = document.getElementById('overrideModal');
            this.saveUrl = window.databaseConfig.saveUrl;
            this.batchUrl = '/prediction/api/batch_import/';
            this.getDataUrl = '/prediction/api/get_data/';
            this.selectedTable = window.databaseConfig.selectedTable;
            this.fieldInfo = window.databaseConfig.fieldInfo;

            // Flags for conflict resolution
            this.skipAllConflicts = false;
            this.overrideAllConflicts = false;
            this.isProcessing = false;
            this.cancelUpload = false;

            // Batch processing configuration
            this.batchSize = 10;
            this.batchDelay = 200;
            this.maxConcurrent = 1;

            // Conflict tracking
            this.currentConflicts = [];
            this.currentConflictIndex = 0;

            this.ui = new ImportUIManager(this);
            this.dataHandler = new ImportDataHandler(this);

            this.initialize();
        }

        initialize() {
            this.ui.bindEvents();
        }

        // Send batch data for processing
        async sendBatch(rows, overrideConflicts = false) {
            try {
                const startTime = performance.now();
                const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';

                const response = await fetch(this.batchUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        rows: rows,
                        override_conflicts: overrideConflicts
                    })
                });

                const result = await response.json();

                // Control request frequency
                const elapsedTime = performance.now() - startTime;
                if (elapsedTime < this.batchDelay) {
                    await new Promise(resolve => setTimeout(resolve, this.batchDelay - elapsedTime));
                }

                return result;
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));

                return {
                    success: false,
                    error: '批次處理失敗',
                    results: {
                        total: rows.length,
                        success: 0,
                        failed: rows.map((row, idx) => ({
                            index: idx,
                            reason: '網路錯誤',
                            data: row
                        })),
                        conflicts: []
                    }
                };
            }
        }

        // Override a single row
        async overrideSingleRow(data) {
            try {
                const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                const response = await fetch(this.saveUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        date: data.date,
                        original_date: data.date,
                        ...data
                    })
                });

                return await response.json();
            } catch (error) {
                return { success: false, error: '覆寫請求失敗' };
            }
        }
    }

    class ImportUIManager {
        constructor(manager) {
            this.manager = manager;
        }

        // Update import example
        updateImportExample() {
            const exampleElement = document.getElementById('importExample');

            // Generate field names (all fields since prediction has no auto-calculated fields)
            const fields = Object.values(this.manager.fieldInfo).map(info => info.name);

            // Generate example rows dynamically
            const exampleData = [
                ['2025-01', '85.5', '150', '45', '120', '450', '5000', '300', '200', '350.5'],
                ['2025-02', '60', '140', '48', '125', '470', '4800', '280', '180', ''],
                ['2025-03', '92.3', '162', '50', '130', '480', '5200', '320', '210', '380.25']
            ];

            // Clear previous content safely
            exampleElement.replaceChildren();

            // Create content using safe DOM methods
            const createCommentSpan = (text) => {
                const span = document.createElement('span');
                span.style.color = 'green';
                span.textContent = text;
                return span;
            };

            const createBreak = () => document.createElement('br');

            // Build content safely
            exampleElement.appendChild(createCommentSpan('// 範例：以下為廢棄物產出因子的上傳格式'));
            exampleElement.appendChild(createBreak());
            exampleElement.appendChild(document.createTextNode(`日期,${fields.join(',')}`));
            exampleElement.appendChild(createBreak());

            exampleElement.appendChild(createCommentSpan('// 完整資料，僅佔床率與本月廢棄物總量可使用小數，注意到佔床率是直接使用百分率。'));
            exampleElement.appendChild(createBreak());
            exampleElement.appendChild(document.createTextNode(exampleData[0].join(',')));
            exampleElement.appendChild(createBreak());

            exampleElement.appendChild(createCommentSpan('// 只有本月廢棄物總量可以留空'));
            exampleElement.appendChild(createBreak());
            exampleElement.appendChild(document.createTextNode(exampleData[1].join(',')));
            exampleElement.appendChild(createBreak());
            exampleElement.appendChild(document.createTextNode(exampleData[2].join(',')));
            exampleElement.appendChild(createBreak());
        }

        bindEvents() {
            this.manager.importBtn.addEventListener('click', () => {
                this.updateImportExample();
                this.manager.importModal.hidden = false;
                this.manager.importModal.showModal();
            });

            document.getElementById('importCloseBtn').addEventListener('click', () => {
                this.manager.importModal.close();
                this.manager.importModal.hidden = true;
            });

            document.getElementById('uploadBtn').addEventListener('click', () => {
                const file = document.getElementById('importFileInput').files[0];
                if (!file) {
                    this.showAlert('請選擇一個 CSV 檔案');
                    return;
                }
                if (!file.name.endsWith('.csv')) {
                    this.showAlert('請上傳 CSV 格式的檔案');
                    return;
                }
                this.manager.importModal.close();
                this.manager.importModal.hidden = true;
                this.manager.dataHandler.processFile(file);
            });

            document.getElementById('loadingCloseBtn').addEventListener('click', () => {
                let confirmCancel = false;
                ModalUtils.showConfirm('確認中斷', '確定要中斷上傳嗎？', () => {
                    confirmCancel = true;
                });
                if (confirmCancel) {
                    this.manager.cancelUpload = true;
                    this.manager.loadingModal.close();
                    this.manager.loadingModal.hidden = true;
                }
            });
        }

        // Show alert dialog
        showAlert(message, success = false) {
            const modal = document.createElement('dialog');
            modal.className = 'ts-modal';
            modal.innerHTML = `
                <div class="content">
                    <div class="ts-content is-center-aligned is-padded">
                        <div class="ts-header is-icon">
                            <span class="ts-icon ${success ? 'is-check-circle-icon' : 'is-triangle-exclamation-icon'}"></span>
                            ${success ? '上傳成功' : '上傳失敗'}
                        </div>
                        <p>${message}</p>
                    </div>
                    <div class="ts-divider"></div>
                    <div class="ts-content is-tertiary">
                        <button class="ts-button is-fluid close-modal">確定</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.showModal();
            modal.querySelector('.close-modal').addEventListener('click', () => {
                modal.close();
                document.body.removeChild(modal);
            });
        }

        // Show upload results with validation
        showUploadResult(results) {
            // Final validation to ensure numbers add up correctly
            const total = results.total;
            const calculatedTotal = results.success + results.skipped + results.failed.length;

            // Adjust skipped count if needed to ensure totals match
            if (calculatedTotal !== total) {
                results.skipped = Math.max(0, total - results.success - results.failed.length);
            }

            // Trigger statistics refresh after successful import operations
            if (results.success > 0 && window.StatisticsRefresher) {
                window.StatisticsRefresher.Helper.afterBatchImport('prediction', results.success);
            }


            const modal = document.createElement('dialog');
            modal.className = 'ts-modal is-big';
            let failedDetails = results.failed.length > 0 ? `
                <div class="ts-content"><h3>失敗詳情：</h3><ul>
                    ${results.failed.map(f => `<li>第 ${f.row} 行：${f.reason}</li>`).join('')}
                </ul></div><div class="ts-divider"></div>` : '';

            modal.innerHTML = `
                <div class="content">
                    <div class="ts-content is-center-aligned is-padded">
                        <div class="ts-header is-icon">
                            <span class="ts-icon ${results.failed.length === 0 && results.skipped === 0 ? 'is-check-circle-icon' : 'is-triangle-exclamation-icon'}"></span>
                            上傳結果
                        </div>
                        <p>總共 ${results.total} 筆資料，成功 ${results.success} 筆，略過 ${results.skipped} 筆，失敗 ${results.failed.length} 筆</p>
                    </div>
                    ${failedDetails}
                    <div class="ts-content is-tertiary">
                        <button class="ts-button is-fluid reload-btn">確認</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.showModal();
            modal.querySelector('.reload-btn').addEventListener('click', () => {
                modal.close();
                document.body.removeChild(modal);
                location.reload();
            });
        }

        // Update progress bar
        updateProgress(processed, total) {
            const percentage = ((processed / total) * 100).toFixed(2);
            const progressBar = this.manager.loadingModal.querySelector('.bar');
            const progressText = this.manager.loadingModal.querySelector('#progressText');

            progressBar.style.setProperty('--value', percentage);
            progressText.textContent = `${percentage}% (${processed}/${total})`;
        }
    }

    class ImportDataHandler {
        constructor(manager) {
            this.manager = manager;
            this.fieldMap = {
                '日期': 'date',
                '佔床率': 'bed_occupancy_rate',
                '手術人次': 'surgical_cases',
                '醫師人數': 'doctor_count',
                '護理人數': 'nurse_count',
                '全院員工數': 'total_staff_count',
                '門診人次': 'outpatient_visits',
                '急診人次': 'emergency_visits',
                '住院人次': 'inpatient_visits',
                '本月廢棄物總量': 'medical_waste_total'
            };
        }

        processFile(file) {
            // Validate file using CSV validator if available
            if (window.CSVValidator) {
                const validator = window.CSVValidator.createPredictionValidator();
                const validation = validator.validateFile(file);
                if (!validation.valid) {
                    this.manager.ui.showAlert(validation.error);
                    return;
                }
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                
                // Additional CSV parsing validation
                if (window.CSVValidator) {
                    const validator = window.CSVValidator.createPredictionValidator();
                    const parseResult = validator.parseCSV(text);
                    if (!parseResult.valid) {
                        this.manager.ui.showAlert(parseResult.error);
                        return;
                    }
                }
                
                const rows = text.split('\n').map(row => row.trim()).filter(row => row);
                if (rows.length <= 1) {
                    this.manager.ui.showAlert('檔案內容為空或缺少數據');
                    return;
                }
                const headers = rows[0].split(',').map(h => h.trim());
                const dataRows = rows.slice(1).map(row => row.split(',').map(v => v.trim()));
                this.validateAndUpload(headers, dataRows);
            };
            reader.readAsText(file);
        }

        async validateAndUpload(headers, dataRows) {
            // Validate headers
            const validHeaders = ['日期', ...Object.keys(this.manager.fieldInfo).map(f => this.manager.fieldInfo[f].name)];
            const invalidHeaders = headers.filter(h => !validHeaders.includes(h));
            if (invalidHeaders.length > 0) {
                this.manager.ui.showAlert(`上傳的 CSV 包含無效欄位：${invalidHeaders.join(', ')}，請確保欄位符合檔案上傳內容規範`);
                return;
            }
            if (!headers.includes('日期')) {
                this.manager.ui.showAlert('CSV 檔案必須包含「日期」欄位');
                return;
            }

            // Reset conflict resolution flags
            this.manager.skipAllConflicts = false;
            this.manager.overrideAllConflicts = false;
            this.manager.cancelUpload = false;

            // Show loading modal
            this.manager.loadingModal.hidden = false;
            this.manager.loadingModal.showModal();

            // Format data for batch processing
            const formattedRows = [];
            for (const row of dataRows) {
                const rowData = {};
                headers.forEach((header, i) => {
                    const fieldName = this.fieldMap[header];
                    if (fieldName) {
                        rowData[fieldName] = row[i] || '';
                    }
                });
                if (rowData.date) {
                    formattedRows.push(rowData);
                }
            }

            // Prepare results object
            const results = {
                total: formattedRows.length,
                success: 0,
                skipped: 0,
                failed: []
            };

            // Show initial progress
            this.manager.ui.updateProgress(0, formattedRows.length);

            // Process all data rows
            await this.processAllRows(formattedRows, results);

            // Close loading modal and show results
            this.manager.loadingModal.close();
            this.manager.loadingModal.hidden = true;
            this.manager.ui.showUploadResult(results);
        }

        // Process all data rows with improved tracking
        async processAllRows(formattedRows, results) {
            const batchSize = this.manager.batchSize;

            // Process data in batches
            let processedCount = 0;

            for (let i = 0; i < formattedRows.length && !this.manager.cancelUpload; i += batchSize) {
                // Get current batch
                const batch = formattedRows.slice(i, Math.min(i + batchSize, formattedRows.length));
                const currentBatchSize = batch.length;

                // Send batch with override flag if previously set
                const result = await this.manager.sendBatch(batch, this.manager.overrideAllConflicts);

                if (result.success) {
                    // Handle success case
                    results.success += result.results.success;

                    // Handle failures in successful batch
                    if (result.results.failed && result.results.failed.length > 0) {
                        for (const failure of result.results.failed) {
                            results.failed.push({
                                row: i + failure.index + 2, // +2 for header row and 0-based index
                                reason: failure.reason
                            });
                        }
                    }
                } else if (result.error === '資料衝突') {
                    // Handle conflicts
                    if (result.results && result.results.conflicts && result.results.conflicts.length > 0) {
                        const conflicts = result.results.conflicts;

                        // Process non-conflict successful items
                        if (result.results.success > 0) {
                            results.success += result.results.success;
                        }

                        // Process failures
                        if (result.results.failed && result.results.failed.length > 0) {
                            for (const failure of result.results.failed) {
                                results.failed.push({
                                    row: i + failure.index + 2,
                                    reason: failure.reason
                                });
                            }
                        }

                        // Skip all conflicts if that flag is set
                        if (this.manager.skipAllConflicts) {
                            results.skipped += conflicts.length;
                        } else {
                            // Store conflicts with batch indices for later processing
                            this.manager.currentConflicts = conflicts.map(c => ({
                                ...c,
                                batchIndex: i + c.index
                            }));

                            // Process conflicts one by one
                            await this.processConflictsOneByOne(results);
                        }
                    }
                } else {
                    // Handle general error
                    for (let j = 0; j < batch.length; j++) {
                        results.failed.push({
                            row: i + j + 2,
                            reason: result.error || '未知錯誤'
                        });
                    }
                }

                // Update processed count and progress
                processedCount += currentBatchSize;
                this.manager.ui.updateProgress(processedCount, formattedRows.length);
            }

            // If upload was canceled, count remaining rows as skipped
            if (this.manager.cancelUpload) {
                const remainingCount = formattedRows.length - processedCount;
                if (remainingCount > 0) {
                    results.skipped += remainingCount;
                }
            }

            // Final calculation to ensure we never have negative skipped values
            const calculatedSkipped = Math.max(0, formattedRows.length - results.success - results.failed.length);
            results.skipped = calculatedSkipped;
        }

        // Process conflicts one by one with proper tracking
        async processConflictsOneByOne(results) {
            let processedConflicts = 0;
            const totalConflicts = this.manager.currentConflicts.length;

            for (let i = 0; i < totalConflicts && !this.manager.cancelUpload; i++) {
                const conflict = this.manager.currentConflicts[i];

                // If global resolution flags are set, handle accordingly
                if (this.manager.skipAllConflicts) {
                    results.skipped += totalConflicts - processedConflicts;
                    return;
                } else if (this.manager.overrideAllConflicts) {
                    const overrideResult = await this.manager.overrideSingleRow(conflict.data);

                    if (overrideResult.success) {
                        results.success++;
                    } else {
                        results.failed.push({
                            row: conflict.batchIndex + 2,
                            reason: overrideResult.error || '覆寫失敗'
                        });
                    }
                    processedConflicts++;
                    continue;
                }

                // Otherwise, prompt user for resolution
                const resolution = await this.promptForConflictResolution(conflict);

                if (resolution === 'override_one') {
                    // Override single conflict
                    const overrideResult = await this.manager.overrideSingleRow(conflict.data);

                    if (overrideResult.success) {
                        results.success++;
                    } else {
                        results.failed.push({
                            row: conflict.batchIndex + 2,
                            reason: overrideResult.error || '覆寫失敗'
                        });
                    }
                    processedConflicts++;
                } else if (resolution === 'override_all') {
                    // Set flag to override all remaining conflicts
                    this.manager.overrideAllConflicts = true;

                    // Override current conflict
                    const overrideResult = await this.manager.overrideSingleRow(conflict.data);

                    if (overrideResult.success) {
                        results.success++;
                    } else {
                        results.failed.push({
                            row: conflict.batchIndex + 2,
                            reason: overrideResult.error || '覆寫失敗'
                        });
                    }
                    processedConflicts++;
                } else if (resolution === 'skip_one') {
                    // Skip this conflict
                    results.skipped++;
                    processedConflicts++;
                } else if (resolution === 'skip_all') {
                    // Set flag to skip all remaining conflicts
                    this.manager.skipAllConflicts = true;

                    // Skip all remaining conflicts
                    results.skipped += totalConflicts - processedConflicts;
                    return;
                } else if (resolution === 'cancel') {
                    // Cancel entire upload
                    this.manager.cancelUpload = true;

                    // Mark remaining conflicts as skipped
                    results.skipped += totalConflicts - processedConflicts;
                    return;
                }
            }
        }

        async promptForConflictResolution(conflict) {
            return new Promise(resolve => {
                this.manager.overrideModal.hidden = false;
                this.manager.overrideModal.showModal();

                document.getElementById('overrideHeader').textContent =
                    `「${conflict.date}」已存在於資料庫中`;

                // Build conflict tables
                this.buildConflictTables(conflict);

                // Set up event handlers
                document.getElementById('overrideBtn').onclick = () => {
                    const applyToAll = document.getElementById('applyToAll').checked;
                    this.manager.overrideModal.close();
                    this.manager.overrideModal.hidden = true;
                    resolve(applyToAll ? 'override_all' : 'override_one');
                };

                document.getElementById('skipBtn').onclick = () => {
                    const applyToAll = document.getElementById('applyToAll').checked;
                    this.manager.overrideModal.close();
                    this.manager.overrideModal.hidden = true;
                    resolve(applyToAll ? 'skip_all' : 'skip_one');
                };

                document.getElementById('cancelBtn').onclick = () => {
                    this.manager.overrideModal.close();
                    this.manager.overrideModal.hidden = true;
                    resolve('cancel');
                };
            });
        }

        buildConflictTables(conflict) {
            const existingTable = document.getElementById('existingDataTable');
            const newTable = document.getElementById('newDataTable');

            // Clear tables
            existingTable.replaceChildren();
            newTable.replaceChildren();

            // Get existing data for comparison
            fetch(`${this.manager.getDataUrl}?date=${conflict.date}`)
                .then(response => response.json())
                .then(existingData => {
                    // Create table headers
                    const headers = ['日期', ...Object.keys(this.manager.fieldInfo).map(f => this.manager.fieldInfo[f].name)];

                    // Add proper thead and tbody structure
                    const existingThead = document.createElement('thead');
                    const existingHeaderRow = document.createElement('tr');
                    headers.forEach(h => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        existingHeaderRow.appendChild(th);
                    });
                    existingThead.appendChild(existingHeaderRow);
                    existingTable.appendChild(existingThead);
                    existingTable.appendChild(document.createElement('tbody'));

                    const newThead = document.createElement('thead');
                    const newHeaderRow = document.createElement('tr');
                    headers.forEach(h => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        newHeaderRow.appendChild(th);
                    });
                    newThead.appendChild(newHeaderRow);
                    newTable.appendChild(newThead);
                    newTable.appendChild(document.createElement('tbody'));

                    const existingTbody = existingTable.querySelector('tbody');
                    const newTbody = newTable.querySelector('tbody');

                    // Create data rows
                    const existingValues = [existingData.date];
                    const newValues = [conflict.data.date];

                    // Map field names to values
                    Object.keys(this.manager.fieldInfo).forEach(field => {
                        // Handle existing data
                        existingValues.push(existingData[field] !== null && existingData[field] !== undefined ?
                            existingData[field].toString() : '');

                        // Handle new data
                        newValues.push(conflict.data[field] !== undefined ? conflict.data[field].toString() : '');
                    });

                    // Add rows to tables
                    const existingRow = document.createElement('tr');
                    existingValues.forEach(v => {
                        const td = document.createElement('td');
                        td.textContent = v;
                        existingRow.appendChild(td);
                    });
                    existingTbody.appendChild(existingRow);

                    const newRow = document.createElement('tr');
                    newValues.forEach(v => {
                        const td = document.createElement('td');
                        td.textContent = v;
                        newRow.appendChild(td);
                    });
                    newTbody.appendChild(newRow);
                })
                .catch(error => {

                    // Fallback display if fetch fails
                    const headers = ['日期', ...Object.keys(this.manager.fieldInfo).map(f => this.manager.fieldInfo[f].name)];

                    // Build existing table with error message
                    const existingThead = document.createElement('thead');
                    const existingHeaderRow = document.createElement('tr');
                    headers.forEach(h => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        existingHeaderRow.appendChild(th);
                    });
                    existingThead.appendChild(existingHeaderRow);
                    const existingTbody = document.createElement('tbody');
                    const existingErrorRow = document.createElement('tr');
                    const existingErrorCell = document.createElement('td');
                    existingErrorCell.colSpan = headers.length;
                    existingErrorCell.textContent = '無法載入現有資料';
                    existingErrorRow.appendChild(existingErrorCell);
                    existingTbody.appendChild(existingErrorRow);
                    existingTable.appendChild(existingThead);
                    existingTable.appendChild(existingTbody);

                    // Build new table with conflict data
                    const newThead = document.createElement('thead');
                    const newHeaderRow = document.createElement('tr');
                    headers.forEach(h => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        newHeaderRow.appendChild(th);
                    });
                    newThead.appendChild(newHeaderRow);
                    const newTbody = document.createElement('tbody');
                    const newDataRow = document.createElement('tr');

                    const dateTd = document.createElement('td');
                    dateTd.textContent = conflict.data.date;
                    newDataRow.appendChild(dateTd);

                    Object.keys(this.manager.fieldInfo).forEach(field => {
                        const td = document.createElement('td');
                        td.textContent = conflict.data[field] || '';
                        newDataRow.appendChild(td);
                    });

                    newTbody.appendChild(newDataRow);
                    newTable.appendChild(newThead);
                    newTable.appendChild(newTbody);
                });
        }

        validateDateFormat(date_str) {
            // Use DateValidator if available, fallback to basic validation
            if (window.DateValidator) {
                return window.DateValidator.validateYearMonth(date_str);
            }
            
            if (!date_str || typeof date_str !== 'string') return false;
            const regex = /^\d{4}-\d{2}$/;
            if (!regex.test(date_str)) return false;
            const [year, month] = date_str.split('-').map(Number);
            return year >= 1970 && year <= 9999 && month >= 1 && month <= 12;
        }
    }

    new ImportManager();
});