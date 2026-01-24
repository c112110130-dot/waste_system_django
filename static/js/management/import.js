document.addEventListener('DOMContentLoaded', () => {
    class ImportManager {
        constructor() {
            this.importBtn = document.getElementById('importDataBtn');
            this.importModal = document.getElementById('importModal');
            this.loadingModal = document.getElementById('loadingModal');
            this.overrideModal = document.getElementById('overrideModal');

            // Get configuration from server
            this.saveUrl = window.databaseConfig.saveUrl;
            this.batchUrl = '/management/api/batch_import/';
            this.selectedTable = window.databaseConfig.selectedTable;
            this.fieldInfo = window.databaseConfig.fieldInfo;

            // Use configuration manager
            this.config = window.ConfigManager;

            // Import state management
            this.applyToAllOverride = false;
            this.skipAllConflicts = false;
            this.isProcessing = false;
            this.cancelUpload = false;

            // Batch processing configuration
            this.batchSize = 15;
            this.batchDelay = 100;
            this.maxConcurrent = 2;

            // Conflict handling
            this.currentConflicts = [];
            this.currentConflictIndex = 0;

            this.ui = new ImportUIManager(this);
            this.dataHandler = new ImportDataHandler(this);

            this.initialize();
        }

        initialize() {
            this.ui.bindEvents();
        }

        // Send batch with optimized speed
        async sendBatch(table, rows, overrideConflicts = false) {
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
                        table: table,
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
                await new Promise(resolve => setTimeout(resolve, this.batchDelay * 3));

                return {
                    success: false,
                    error: 'Batch processing failed',
                    results: {
                        total: rows.length,
                        success: 0,
                        failed: rows.map((row, idx) => ({
                            index: idx,
                            reason: 'Network error',
                            data: row
                        })),
                        conflicts: []
                    }
                };
            }
        }

        // Override single row with standardized API handling
        async overrideSingleRow(data) {
            const requestData = {
                table: this.selectedTable,
                date: data.date,
                original_date: data.date,
                ...data
            };

            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
            const result = await APIUtils.post(this.saveUrl, requestData, csrfToken);

            if (result.success) {
                return result.data;
            } else {
                return {
                    success: false,
                    error: result.error || '覆寫請求失敗'
                };
            }
        }

        // Helper function to get existing data with standardized API handling
        async getExistingData(date) {
            const result = await APIUtils.get('/management/api/get_data/', {
                table: this.selectedTable,
                date: date
            });
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to load existing data');
            }
        }
    }

    class ImportUIManager {
        constructor(manager) {
            this.manager = manager;
        }

        // Update import example dynamically based on current table
        updateImportExample() {
            const exampleElement = document.getElementById('importExample');
            const tableName = window.tableNames[this.manager.selectedTable];

            // Detect auto-calculated fields (like 'total')
            const autoCalcFields = [];
            const editableFields = [];

            Object.entries(this.manager.fieldInfo).forEach(([fieldKey, info]) => {
                if (info.auto_calculated === true || info.editable === false) {
                    autoCalcFields.push(info.name);
                } else {
                    editableFields.push(info.name);
                }
            });

            // Generate example data using configuration manager
            const exampleData = this.manager.config.generateExampleData(this.manager.fieldInfo);

            // Clear previous content safely
            exampleElement.replaceChildren();

            // Create content using safe DOM methods
            const createCommentSpan = (text, color = 'green') => {
                const span = document.createElement('span');
                span.style.color = color;
                DOMUtils.setText(span, text);
                return span;
            };

            const createBreak = () => document.createElement('br');

            // Build content safely
            exampleElement.appendChild(createCommentSpan(`// 範例：以下為「${tableName}」的上傳格式`));
            exampleElement.appendChild(createBreak());

            // Show warning if there are auto-calculated fields
            if (autoCalcFields.length > 0) {
                exampleElement.appendChild(createCommentSpan(`// 注意：${autoCalcFields.join('、')} 欄位會自動計算，無需填寫`, 'darkorange'));
                exampleElement.appendChild(createBreak());
            }

            // Show header with only editable fields
            exampleElement.appendChild(document.createTextNode(`日期,${editableFields.join(',')}`));
            exampleElement.appendChild(createBreak());

            exampleElement.appendChild(createCommentSpan('// 完整資料：所有欄位都有值'));
            exampleElement.appendChild(createBreak());
            exampleElement.appendChild(document.createTextNode(exampleData[0].join(',')));
            exampleElement.appendChild(createBreak());

            exampleElement.appendChild(createCommentSpan('// 部分空值：某些欄位留空'));
            exampleElement.appendChild(createBreak());
            exampleElement.appendChild(document.createTextNode(exampleData[1].join(',')));
            exampleElement.appendChild(createBreak());

            exampleElement.appendChild(createCommentSpan('// 小數點位數不限：可使用任意小數'));
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

        // Show alert modal
        showAlert(message, success = false) {
            // Use safe NotificationUtils instead of innerHTML
            NotificationUtils.showAlert(
                success ? '上傳成功' : '上傳失敗',
                message,
                success ? 'success' : 'error'
            );
        }

        // Show upload result modal (safe DOM construction)
        showUploadResult(results) {
            const total = results.total;
            const calculatedTotal = results.success + results.skipped + results.failed.length;

            if (calculatedTotal !== total) {
                results.skipped = Math.max(0, total - results.success - results.failed.length);
            }

            // Trigger statistics refresh after successful import operations
            if (results.success > 0 && window.StatisticsRefresher) {
                window.StatisticsRefresher.Helper.afterBatchImport('management', results.success);
            }

            const modal = document.createElement('dialog');
            modal.className = 'ts-modal is-big';

            const content = document.createElement('div');
            content.className = 'content';

            // Header section
            const headerSection = document.createElement('div');
            headerSection.className = 'ts-content is-center-aligned is-padded';

            const header = document.createElement('div');
            header.className = 'ts-header is-icon';

            const icon = document.createElement('span');
            icon.className = `ts-icon ${results.failed.length === 0 && results.skipped === 0 ? 'is-check-circle-icon' : 'is-triangle-exclamation-icon'}`;
            header.appendChild(icon);
            header.appendChild(document.createTextNode('上傳結果'));

            const summary = document.createElement('p');
            summary.textContent = `總共 ${results.total} 筆資料，成功 ${results.success} 筆，略過 ${results.skipped} 筆，失敗 ${results.failed.length} 筆`;

            headerSection.appendChild(header);
            headerSection.appendChild(summary);
            content.appendChild(headerSection);

            // Failed details section
            if (results.failed.length > 0) {
                const detailsSection = document.createElement('div');
                detailsSection.className = 'ts-content';

                const detailsTitle = document.createElement('h3');
                detailsTitle.textContent = '失敗詳情：';
                detailsSection.appendChild(detailsTitle);

                const failedList = document.createElement('ul');
                results.failed.forEach(f => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `第 ${f.row} 行：${f.reason}`;
                    failedList.appendChild(listItem);
                });
                detailsSection.appendChild(failedList);
                content.appendChild(detailsSection);

                const divider = document.createElement('div');
                divider.className = 'ts-divider';
                content.appendChild(divider);
            }

            // Footer section
            const footer = document.createElement('div');
            footer.className = 'ts-content is-tertiary';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'ts-button is-fluid reload-btn';
            confirmBtn.textContent = '確認';

            footer.appendChild(confirmBtn);
            content.appendChild(footer);
            modal.appendChild(content);

            document.body.appendChild(modal);
            modal.showModal();

            confirmBtn.addEventListener('click', () => {
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
            // Generate field map dynamically from configuration
            this.fieldMap = this.generateFieldMap();
        }

        // Generate field mapping dynamically
        generateFieldMap() {
            return this.manager.config.generateFieldMapping(this.manager.fieldInfo);
        }

        processFile(file) {
            // Validate file using CSV validator if available
            if (window.CSVValidator) {
                const validator = window.CSVValidator.createDepartmentValidator();
                const validation = validator.validateFile(file);
                if (!validation.valid) {
                    this.manager.ui.showAlert(validation.error, false);
                    return;
                }
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                
                // Additional CSV parsing validation
                if (window.CSVValidator) {
                    const validator = window.CSVValidator.createDepartmentValidator();
                    const parseResult = validator.parseCSV(text);
                    if (!parseResult.valid) {
                        this.manager.ui.showAlert(parseResult.error, false);
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
            // Build valid headers dynamically
            const validHeaders = ['日期'];
            Object.values(this.manager.fieldInfo).forEach(info => {
                validHeaders.push(info.name);
            });

            const invalidHeaders = headers.filter(h => !validHeaders.includes(h));
            if (invalidHeaders.length > 0) {
                this.manager.ui.showAlert(`上傳的 CSV 包含無效欄位：${invalidHeaders.join(', ')}，請確保欄位與「${window.tableNames[this.manager.selectedTable]}」一致`);
                return;
            }
            if (!headers.includes('日期')) {
                this.manager.ui.showAlert('CSV 檔案必須包含「日期」欄位');
                return;
            }

            // Reset flags and show loading
            this.manager.applyToAllOverride = false;
            this.manager.skipAllConflicts = false;
            this.manager.cancelUpload = false;

            this.manager.loadingModal.hidden = false;
            this.manager.loadingModal.showModal();

            // Convert CSV data to JSON format dynamically
            const formattedRows = [];
            for (const row of dataRows) {
                const rowData = { date: '' };
                headers.forEach((header, i) => {
                    if (header === '日期') {
                        rowData.date = row[i] || '';
                    } else {
                        const mapping = this.fieldMap[header];
                        if (mapping && mapping.field) {
                            rowData[mapping.field] = row[i] || '';
                        }
                    }
                });
                if (rowData.date) {
                    formattedRows.push(rowData);
                }
            }

            // Process in batches
            const batchSize = this.manager.batchSize;
            const batches = [];

            for (let i = 0; i < formattedRows.length; i += batchSize) {
                batches.push(formattedRows.slice(i, i + batchSize));
            }

            const results = {
                total: formattedRows.length,
                success: 0,
                skipped: 0,
                failed: []
            };

            this.manager.ui.updateProgress(0, formattedRows.length);

            await this.processBatches(batches, formattedRows, results);

            this.manager.loadingModal.close();
            this.manager.loadingModal.hidden = true;
            this.manager.ui.showUploadResult(results);
        }

        async processBatches(batches, formattedRows, results) {
            let processedCount = 0;

            for (let i = 0; i < batches.length; i += this.manager.maxConcurrent) {
                if (this.manager.cancelUpload) {
                    results.skipped = formattedRows.length - results.success - results.failed.length;
                    break;
                }

                const currentBatches = batches.slice(i, i + this.manager.maxConcurrent);
                const batchPromises = currentBatches.map(batch =>
                    this.manager.sendBatch(
                        this.manager.selectedTable,
                        batch,
                        this.manager.applyToAllOverride
                    )
                );

                const batchResults = await Promise.all(batchPromises);

                for (let j = 0; j < batchResults.length; j++) {
                    const result = batchResults[j];
                    const batchStartIndex = (i + j) * this.manager.batchSize;
                    const currentBatchSize = currentBatches[j].length;

                    processedCount += currentBatchSize;

                    if (result.success) {
                        results.success += result.results.success;

                        if (result.results.failed && result.results.failed.length) {
                            for (const failure of result.results.failed) {
                                results.failed.push({
                                    row: batchStartIndex + failure.index + 2,
                                    reason: failure.reason
                                });
                            }
                        }
                    } else if (result.error === '資料衝突') {
                        if (!this.manager.skipAllConflicts && result.results.conflicts && result.results.conflicts.length > 0) {
                            const conflicts = result.results.conflicts.map(conflict => ({
                                ...conflict,
                                batchIndex: batchStartIndex + conflict.index
                            }));

                            await this.resolveConflicts(conflicts, results);
                        } else if (this.manager.skipAllConflicts) {
                            if (result.results.conflicts) {
                                results.skipped += result.results.conflicts.length;
                            }
                        }

                        if (result.results.success) {
                            results.success += result.results.success;
                        }

                        if (result.results.failed && result.results.failed.length) {
                            for (const failure of result.results.failed) {
                                results.failed.push({
                                    row: batchStartIndex + failure.index + 2,
                                    reason: failure.reason
                                });
                            }
                        }
                    } else {
                        const batch = currentBatches[j];
                        for (let k = 0; k < batch.length; k++) {
                            results.failed.push({
                                row: batchStartIndex + k + 2,
                                reason: result.error || 'Unknown error'
                            });
                        }
                    }
                }

                this.manager.ui.updateProgress(processedCount, formattedRows.length);
            }

            const calculatedSkipped = formattedRows.length - results.success - results.failed.length;
            results.skipped = Math.max(0, calculatedSkipped);
        }

        async resolveConflicts(conflicts, results) {
            let processedConflicts = 0;

            for (const conflict of conflicts) {
                if (this.manager.cancelUpload || this.manager.skipAllConflicts) {
                    results.skipped += conflicts.length - processedConflicts;
                    return;
                }

                if (this.manager.applyToAllOverride) {
                    const overrideResult = await this.overrideConflict(conflict);
                    if (overrideResult.success) {
                        results.success += 1;
                    } else {
                        results.failed.push({
                            row: conflict.batchIndex + 2,
                            reason: overrideResult.error || 'Override failed'
                        });
                    }
                    processedConflicts++;
                    continue;
                }

                const resolution = await this.promptForConflictResolution(conflict);

                if (resolution === 'override_one') {
                    const overrideResult = await this.overrideConflict(conflict);
                    if (overrideResult.success) {
                        results.success += 1;
                    } else {
                        results.failed.push({
                            row: conflict.batchIndex + 2,
                            reason: overrideResult.error || 'Override failed'
                        });
                    }
                } else if (resolution === 'override_all') {
                    this.manager.applyToAllOverride = true;
                    const overrideResult = await this.overrideConflict(conflict);
                    if (overrideResult.success) {
                        results.success += 1;
                    } else {
                        results.failed.push({
                            row: conflict.batchIndex + 2,
                            reason: overrideResult.error || 'Override failed'
                        });
                    }
                } else if (resolution === 'skip_one') {
                    results.skipped += 1;
                } else if (resolution === 'skip_all') {
                    this.manager.skipAllConflicts = true;
                    results.skipped += conflicts.length - processedConflicts;
                    return;
                } else if (resolution === 'cancel') {
                    this.manager.cancelUpload = true;
                    results.skipped += conflicts.length - processedConflicts;
                    return;
                }

                processedConflicts++;
            }
        }

        async overrideConflict(conflict) {
            return await this.manager.sendBatch(
                this.manager.selectedTable,
                [conflict.data],
                true
            );
        }

        async promptForConflictResolution(conflict) {
            return new Promise(resolve => {
                this.manager.overrideModal.hidden = false;
                this.manager.overrideModal.showModal();

                document.getElementById('overrideHeader').textContent =
                    `「${conflict.data?.date || 'undefined'}」已存在於「${window.tableNames[this.manager.selectedTable]}」中`;

                this.buildConflictTables(conflict);

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

            existingTable.replaceChildren();
            newTable.replaceChildren();

            // Build headers dynamically
            const headers = ['日期'];
            Object.values(this.manager.fieldInfo).forEach(info => {
                headers.push(info.name);
            });

            // Build existing table structure
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

            // Build new table structure
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

            // Fetch existing data using standardized API handling
            const conflictDate = conflict.data?.date || 'unknown';
            this.manager.getExistingData(conflictDate).then(existingData => {
                    // Build existing data row safely
                    const existingRow = document.createElement('tr');

                    const existingDateCell = document.createElement('td');
                    existingDateCell.textContent = conflictDate;
                    existingRow.appendChild(existingDateCell);

                    for (const [field, info] of Object.entries(this.manager.fieldInfo)) {
                        const value = existingData[field];
                        const td = document.createElement('td');
                        if (value === null || value === '') {
                            td.className = 'is-empty';
                        }
                        td.textContent = value !== null && value !== '' ?
                            this.manager.config.formatValue(value, info.unit) : '';
                        existingRow.appendChild(td);
                    }

                    existingTbody.appendChild(existingRow);

                    // Build new data row safely
                    const newRow = document.createElement('tr');

                    const newDateCell = document.createElement('td');
                    newDateCell.textContent = conflictDate;
                    newRow.appendChild(newDateCell);

                    for (const [field, info] of Object.entries(this.manager.fieldInfo)) {
                        const value = conflict.data[field] || '';
                        const td = document.createElement('td');
                        if (value === '') {
                            td.className = 'is-empty';
                        }
                        td.textContent = value !== '' ?
                            this.manager.config.formatValue(value, info.unit) : '';
                        newRow.appendChild(td);
                    }

                    newTbody.appendChild(newRow);
                })
                .catch(error => {
                    // Build error row safely
                    const errorRow = document.createElement('tr');
                    const errorCell = document.createElement('td');
                    errorCell.colSpan = headers.length;
                    errorCell.textContent = '無法載入現有資料';
                    errorRow.appendChild(errorCell);
                    existingTbody.appendChild(errorRow);

                    // Build new data row safely
                    const newRow = document.createElement('tr');

                    const newDateCell = document.createElement('td');
                    newDateCell.textContent = conflictDate;
                    newRow.appendChild(newDateCell);

                    for (const [field, info] of Object.entries(this.manager.fieldInfo)) {
                        const value = conflict.data[field] || '';
                        const td = document.createElement('td');
                        if (value === '') {
                            td.className = 'is-empty';
                        }
                        td.textContent = value !== '' ?
                            this.manager.config.formatValue(value, info.unit) : '';
                        newRow.appendChild(td);
                    }

                    newTbody.appendChild(newRow);
                });
        }
    }

    new ImportManager();
});