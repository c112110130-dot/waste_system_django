document.addEventListener('DOMContentLoaded', () => {
    class DepartmentImportManager {
        constructor() {
            // Get DOM elements with null checks
            this.uploadBtn = document.getElementById('uploadBtn');
            this.fileInput = document.getElementById('importFileInput');
            this.loadingModal = document.getElementById('loadingModal');

            // Use correct conflict modal ID from HTML
            this.overrideModal = document.getElementById('conflictModal');

            // Get configuration from global scope
            this.config = window.departmentConfig || {};
            this.departmentMapping = this.config.departmentMapping || {};

            // Reference to main departmentManager for accessing currentWasteTypeId
            this.manager = window.departmentManager;

            // Get CSRF token from cookie via SecurityUtils
            this.csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';

            // Import state management
            this.conflictQueue = [];
            this.currentConflictIndex = 0;
            this.applyToAllOverride = false;
            this.skipAllConflicts = false;
            this.cancelImport = false;

            // For conflict resolution promise
            this.currentConflictResolve = null;

            this.initialize();
        }

        initialize() {
            this.bindEvents();
            this.updateImportExample();
        }

        bindEvents() {
            // Upload button - check if exists
            if (this.uploadBtn) {
                this.uploadBtn.addEventListener('click', () => {
                    this.handleFileUpload();
                });
            }

            // Use correct button IDs from HTML
            const overrideConflictBtn = document.getElementById('overrideConflictBtn');
            if (overrideConflictBtn) {
                overrideConflictBtn.addEventListener('click', () => {
                    this.resolveConflict('override');
                });
            }

            const skipConflictBtn = document.getElementById('skipConflictBtn');
            if (skipConflictBtn) {
                skipConflictBtn.addEventListener('click', () => {
                    this.resolveConflict('skip');
                });
            }

            const cancelImportBtn = document.getElementById('cancelImportBtn');
            if (cancelImportBtn) {
                cancelImportBtn.addEventListener('click', () => {
                    this.resolveConflict('cancel');
                });
            }

            // Loading modal close button
            const loadingCloseBtn = document.getElementById('loadingCloseBtn');
            if (loadingCloseBtn) {
                loadingCloseBtn.addEventListener('click', () => {
                    this.cancelImport = true;
                    this.hideLoadingModal();
                });
            }
        }

        async handleFileUpload() {
            if (!this.fileInput) {
                this.showAlert('找不到檔案輸入欄位');
                return;
            }

            const file = this.fileInput.files[0];
            if (!file) {
                this.showAlert('請選擇一個 CSV 檔案');
                return;
            }

            if (!file.name.endsWith('.csv')) {
                this.showAlert('請上傳 CSV 格式的檔案');
                return;
            }

            // Hide import modal
            const importModal = document.getElementById('importModal');
            if (importModal) importModal.close();

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                this.processCSVText(text);
            };
            reader.readAsText(file, 'UTF-8');
        }

        processCSVText(csvText) {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                this.showAlert('CSV 檔案內容為空或缺少數據');
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const dataRows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));

            // Validate CSV format
            if (!this.validateCSVFormat(headers)) {
                return;
            }

            // Format data correctly for backend API
            const formattedRows = this.formatRowsForBatch(headers, dataRows);
            if (formattedRows.length === 0) {
                this.showAlert('CSV 檔案中沒有找到有效資料');
                return;
            }

            this.validateAndUpload(formattedRows);
        }

        validateCSVFormat(headers) {
            if (!headers.includes('日期')) {
                this.showAlert('CSV 檔案必須包含「日期」欄位');
                return false;
            }

            // Check if department names exist in system
            const departments = Object.keys(this.departmentMapping);
            const unknownDepts = headers.filter(h =>
                h !== '日期' && !departments.includes(h)
            );

            if (unknownDepts.length > 0) {
                this.showAlert(`未知部門：${unknownDepts.join(', ')}`);
                return false;
            }

            return true;
        }

        formatRowsForBatch(headers, dataRows) {
            // Backend expects exact format: {"date": "2025-01", "部門A": "1.5", "部門B": "2.3"}
            const formattedRows = [];

            dataRows.forEach((row, rowIndex) => {
                if (row.length === 0 || !row[0]) return;

                const date = row[0];
                if (!this.isValidDateFormat(date)) return;

                // Create row object in exact format backend expects
                const rowData = { date: date };

                // Add department data - backend expects string values
                headers.forEach((header, index) => {
                    if (header !== '日期' && index < row.length) {
                        const value = row[index];
                        if (value && value.trim() !== '') {
                            const amount = parseFloat(value);
                            if (!isNaN(amount) && amount > 0) {
                                // Keep as string format for backend .strip() method
                                rowData[header] = amount.toString();
                            }
                        }
                    }
                });

                // Only add rows that have at least one department with data
                if (Object.keys(rowData).length > 1) {
                    formattedRows.push(rowData);
                }
            });

            return formattedRows;
        }

        async validateAndUpload(formattedRows) {
            // Reset state
            this.applyToAllOverride = false;
            this.skipAllConflicts = false;
            this.cancelImport = false;

            // Show loading modal with progress
            this.showLoadingModal();

            // Calculate total entries for real progress tracking
            const totalEntries = this.calculateProcessedEntries(formattedRows);
            this.updateProgress(0, totalEntries);

            try {
                await this.batchImportDataWithRealProgress(formattedRows, totalEntries);
            } catch (error) {
                this.hideLoadingModal();
                this.showErrorModal('匯入過程中發生錯誤');
            }
        }

        // New method for real progress tracking
        async batchImportDataWithRealProgress(rows, totalEntries) {
            const batchSize = 5; // Process in smaller batches for more granular progress
            const results = {
                total: totalEntries,
                success: 0,
                failed: [],
                conflicts: [],
                skipped: 0
            };

            let processedEntries = 0;

            // Process rows in batches
            for (let i = 0; i < rows.length; i += batchSize) {
                // Stop processing if user cancelled or chose to skip all
                if (this.cancelImport || this.skipAllConflicts) break;

                const batchRows = rows.slice(i, i + batchSize);
                const batchEntries = this.calculateProcessedEntries(batchRows);

                try {
                    const requestBody = {
                        rows: batchRows,
                        override_conflicts: this.applyToAllOverride
                    };

                    // Add waste_type_id from manager
                    if (this.manager && this.manager.currentWasteTypeId) {
                        requestBody.waste_type_id = this.manager.currentWasteTypeId;
                    }

                    const response = await fetch('/management/api/department/batch_import/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': this.csrfToken
                        },
                        body: JSON.stringify(requestBody)
                    });

                    const result = await response.json();

                    if (result.success) {
                        results.success += result.results.success || 0;
                        results.skipped += result.results.skipped || 0;
                        if (result.results.failed) {
                            results.failed.push(...result.results.failed);
                        }

                        processedEntries += batchEntries;
                        this.updateProgress(processedEntries, totalEntries);

                    } else if (result.error === '資料衝突') {
                        // Handle conflicts - must process ALL conflicts in this batch
                        if (result.results.conflicts && result.results.conflicts.length > 0 && !this.applyToAllOverride && !this.skipAllConflicts) {
                            this.hideLoadingModal();

                            // Process each conflict in the batch one by one
                            for (let conflictIdx = 0; conflictIdx < result.results.conflicts.length; conflictIdx++) {
                                const conflict = result.results.conflicts[conflictIdx];

                                // Show conflict modal and wait for resolution
                                const conflictResolution = await this.handleSingleConflict(conflict);

                                if (conflictResolution === 'cancel') {
                                    this.showImportResult(results);
                                    return;
                                }

                                // If user chose "apply to all", break the loop and handle all remaining
                                if (this.applyToAllOverride || this.skipAllConflicts) {
                                    break;
                                }
                            }

                            this.showLoadingModal();

                            // If override was selected, retry this batch with override flag
                            if (this.applyToAllOverride) {
                                // Retry the same batch with override enabled
                                const retryBody = {
                                    rows: batchRows,
                                    override_conflicts: true
                                };

                                // Add waste_type_id from manager
                                if (this.manager && this.manager.currentWasteTypeId) {
                                    retryBody.waste_type_id = this.manager.currentWasteTypeId;
                                }

                                const retryResponse = await fetch('/management/api/department/batch_import/', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRFToken': this.csrfToken
                                    },
                                    body: JSON.stringify(retryBody)
                                });

                                const retryResult = await retryResponse.json();
                                results.success += retryResult.results.success || 0;
                                results.skipped += retryResult.results.skipped || 0;
                                if (retryResult.results.failed) {
                                    results.failed.push(...retryResult.results.failed);
                                }
                            } else if (this.skipAllConflicts) {
                                // Count skipped entries - actual department data count from conflicts
                                if (result.results.conflicts && result.results.conflicts.length > 0) {
                                    // Count actual conflicting departments in this batch
                                    let conflictedDeptCount = 0;
                                    result.results.conflicts.forEach(conflictGroup => {
                                        if (conflictGroup.conflicts && Array.isArray(conflictGroup.conflicts)) {
                                            conflictedDeptCount += conflictGroup.conflicts.length;
                                        }
                                    });
                                    results.skipped += conflictedDeptCount;
                                }
                            }
                        } else if (this.skipAllConflicts) {
                            // Already set to skip all - count as skipped
                            if (result.results.conflicts && result.results.conflicts.length > 0) {
                                // Count actual conflicting departments in this batch
                                let conflictedDeptCount = 0;
                                result.results.conflicts.forEach(conflictGroup => {
                                    if (conflictGroup.conflicts && Array.isArray(conflictGroup.conflicts)) {
                                        conflictedDeptCount += conflictGroup.conflicts.length;
                                    }
                                });
                                results.skipped += conflictedDeptCount;
                            }
                        } else if (this.applyToAllOverride) {
                            // Already set to override all - retry this batch
                            const retryBody = {
                                rows: batchRows,
                                override_conflicts: true
                            };

                            // Add waste_type_id from manager
                            if (this.manager && this.manager.currentWasteTypeId) {
                                retryBody.waste_type_id = this.manager.currentWasteTypeId;
                            }

                            const retryResponse = await fetch('/management/api/department/batch_import/', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRFToken': this.csrfToken
                                },
                                body: JSON.stringify(retryBody)
                            });

                            const retryResult = await retryResponse.json();
                            results.success += retryResult.results.success || 0;
                            results.skipped += retryResult.results.skipped || 0;
                            if (retryResult.results.failed) {
                                results.failed.push(...retryResult.results.failed);
                            }
                        }

                        processedEntries += batchEntries;
                        this.updateProgress(processedEntries, totalEntries);

                    } else {
                        // Handle errors
                        batchRows.forEach((row, idx) => {
                            const entryCount = Object.keys(row).filter(key => key !== 'date').length;
                            for (let j = 0; j < entryCount; j++) {
                                results.failed.push({
                                    index: i + idx,
                                    reason: result.error || '批次處理失敗'
                                });
                            }
                        });

                        processedEntries += batchEntries;
                        this.updateProgress(processedEntries, totalEntries);
                    }

                    // Small delay to show progress
                    await new Promise(resolve => setTimeout(resolve, 100));

                } catch (error) {

                    // Mark batch as failed
                    batchRows.forEach((row, idx) => {
                        const entryCount = Object.keys(row).filter(key => key !== 'date').length;
                        for (let j = 0; j < entryCount; j++) {
                            results.failed.push({
                                index: i + idx,
                                reason: '網路錯誤'
                            });
                        }
                    });

                    processedEntries += batchEntries;
                    this.updateProgress(processedEntries, totalEntries);
                }
            }

            // Complete progress
            this.updateProgress(totalEntries, totalEntries);

            setTimeout(() => {
                this.hideLoadingModal();
                results.totalProcessed = totalEntries;
                this.showImportResult(results);
            }, 500);
        }

        // Handle single conflict
        async handleSingleConflict(conflict) {
            return new Promise((resolve) => {
                this.currentConflictResolve = resolve;

                if (!this.overrideModal) {
                    resolve('cancel');
                    return;
                }

                const header = document.getElementById('conflictHeader');
                if (header) {
                    header.textContent = `「${conflict.date}」已存在於資料庫中`;
                }

                this.buildConflictTable(conflict);
                this.overrideModal.showModal();
            });
        }

        async batchImportData(rows) {
            try {
                // Initialize progress tracking
                this.updateProgress(0, 100); // Start with 0%

                const requestBody = {
                    rows: rows,
                    override_conflicts: this.applyToAllOverride
                };

                // Add waste_type_id from manager
                if (this.manager && this.manager.currentWasteTypeId) {
                    requestBody.waste_type_id = this.manager.currentWasteTypeId;
                }

                const response = await fetch('/management/api/department/batch_import/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    body: JSON.stringify(requestBody)
                });

                // Update progress during processing
                this.updateProgress(50, 100); // 50% when request sent

                const result = await response.json();

                // Update progress when response received
                this.updateProgress(90, 100); // 90% when processing response

                if (result.success) {
                    // Complete progress before showing result
                    this.updateProgress(100, 100); // 100% when successful

                    setTimeout(() => { // Small delay to show 100%
                        this.hideLoadingModal();
                        const processedCount = this.calculateProcessedEntries(rows);
                        const finalResults = {
                            ...result.results,
                            totalProcessed: processedCount
                        };
                        this.showImportResult(finalResults);
                    }, 500);

                } else if (result.error === '資料衝突') {
                    this.updateProgress(100, 100); // Complete progress

                    setTimeout(() => {
                        this.hideLoadingModal();

                        if (result.results.conflicts && result.results.conflicts.length > 0) {
                            this.conflictQueue = result.results.conflicts;
                            this.currentConflictIndex = 0;
                            this.handleConflicts(result.results, rows);
                        } else {
                            const processedCount = this.calculateProcessedEntries(rows);
                            const finalResults = {
                                ...result.results,
                                totalProcessed: processedCount
                            };
                            this.showImportResult(finalResults);
                        }
                    }, 500);

                } else {
                    this.updateProgress(100, 100); // Complete even on error
                    setTimeout(() => {
                        this.hideLoadingModal();
                        this.showErrorModal(result.error || '匯入失敗');
                    }, 500);
                }
            } catch (error) {
                this.updateProgress(100, 100); // Complete on error
                setTimeout(() => {
                    this.hideLoadingModal();
                    this.showErrorModal('匯入請求失敗');
                }, 500);
            }
        }

        // Calculate actual processed entries (department data entries, not CSV rows)
        calculateProcessedEntries(rows) {
            let totalEntries = 0;
            rows.forEach(row => {
                // Count non-date fields that have data
                const departments = Object.keys(row).filter(key => key !== 'date');
                totalEntries += departments.length;
            });
            return totalEntries;
        }

        async handleConflicts(results, originalRows) {
            while (this.currentConflictIndex < this.conflictQueue.length && !this.cancelImport) {
                if (this.skipAllConflicts || this.applyToAllOverride) {
                    break;
                }

                const conflict = this.conflictQueue[this.currentConflictIndex];
                const resolution = await this.showConflictModal(conflict);

                if (resolution === 'cancel') {
                    this.cancelImport = true;
                    break;
                }

                this.currentConflictIndex++;
            }

            if (!this.cancelImport && (this.skipAllConflicts || this.applyToAllOverride || this.currentConflictIndex >= this.conflictQueue.length)) {
                // Retry import with resolution
                this.showLoadingModal();
                const loadingTitle = document.querySelector('#loadingModal .ts-header');
                if (loadingTitle) loadingTitle.textContent = '重新匯入';

                const loadingMessage = document.getElementById('loadingMessage');
                if (loadingMessage) loadingMessage.textContent = '正在處理衝突解決...';

                const remainingRows = this.conflictQueue.slice(this.currentConflictIndex).map(c => c.data);
                await this.batchImportData(remainingRows);
            } else {
                // Show partial results with correct count
                const processedCount = this.calculateProcessedEntries(originalRows);
                const finalResults = {
                    ...results,
                    totalProcessed: processedCount
                };
                this.showImportResult(finalResults);
            }
        }

        showConflictModal(conflict) {
            return new Promise((resolve) => {
                this.currentConflictResolve = resolve;

                if (!this.overrideModal) {
                    resolve('cancel');
                    return;
                }

                // Use existing conflictModal structure
                const header = document.getElementById('conflictHeader');
                if (header) {
                    header.textContent = `「${conflict.date}」已存在於資料庫中`;
                }

                // Build conflict table using corrected implementation
                this.buildConflictTable(conflict);
                this.overrideModal.showModal();
            });
        }

        // Build conflict table with proper comparison and highlighting
        async buildConflictTable(conflict) {
            const conflictContent = document.getElementById('conflictContent');
            if (!conflictContent) return;

            try {
                // Clear existing content safely
                conflictContent.replaceChildren();

                // Create table structure
                const tableContainer = document.createElement('div');
                tableContainer.className = 'ts-box has-spaced';

                const table = document.createElement('table');
                table.className = 'ts-table is-celled';
                table.id = 'conflictTable';

                // Create table header safely
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');

                const th1 = document.createElement('th');
                th1.textContent = '部門名稱';
                const th2 = document.createElement('th');
                th2.textContent = '現有資料';
                const th3 = document.createElement('th');
                th3.textContent = '新上傳資料';

                headerRow.appendChild(th1);
                headerRow.appendChild(th2);
                headerRow.appendChild(th3);
                thead.appendChild(headerRow);
                table.appendChild(thead);

                // Create table body
                const tbody = document.createElement('tbody');
                tbody.id = 'conflictTableBody';
                table.appendChild(tbody);

                tableContainer.appendChild(table);
                conflictContent.appendChild(tableContainer);

                // Get existing data from server for comparison
                const existingData = await this.getExistingDepartmentData(conflict.date);
                console.log('Existing data from server:', existingData);

                const existingMap = {};
                existingData.forEach(dept => {
                    // Always add department to map
                    // Store amount if has_data is true, otherwise null
                    existingMap[dept.name] = dept.has_data ? dept.amount : null;
                    console.log(`Department ${dept.name}: has_data=${dept.has_data}, amount=${dept.amount}`);
                });

                // Build new data map from conflict
                const newDataMap = {};
                if (conflict.conflicts && Array.isArray(conflict.conflicts) && conflict.conflicts.length > 0) {
                    conflict.conflicts.forEach(c => {
                        newDataMap[c.department] = c.new_amount;
                    });
                } else if (conflict.data) {
                    Object.keys(conflict.data).forEach(key => {
                        if (key !== 'date') {
                            newDataMap[key] = parseFloat(conflict.data[key]) || null;
                        }
                    });
                }

                // Get all department names (union of existing and new data)
                const allDepartments = new Set([...Object.keys(existingMap), ...Object.keys(newDataMap)]);

                // Build table rows for ALL departments
                allDepartments.forEach(deptName => {
                    const row = document.createElement('tr');

                    const existingAmount = existingMap.hasOwnProperty(deptName) ? existingMap[deptName] : null;
                    const newAmount = newDataMap.hasOwnProperty(deptName) ? newDataMap[deptName] : null;

                    // Format display values using ConfigManager
                    const existingDisplay = existingAmount !== null
                        ? (window.ConfigManager ? window.ConfigManager.formatValue(existingAmount, 'NTD') : existingAmount.toLocaleString())
                        : '';
                    const newDisplay = newAmount !== null
                        ? (window.ConfigManager ? window.ConfigManager.formatValue(newAmount, 'NTD') : newAmount.toLocaleString())
                        : '';

                    // Mark as conflict if existing data is present (regardless of value difference)
                    const isConflict = existingAmount !== null;

                    // Apply conflict styling - always mark if data exists
                    if (isConflict) {
                        row.className = 'is-conflicted';
                    }

                    // Build row safely using DOM API
                    const deptNameCell = document.createElement('td');
                    deptNameCell.textContent = deptName;
                    row.appendChild(deptNameCell);

                    const existingCell = document.createElement('td');
                    if (existingAmount === null) {
                        existingCell.className = 'is-empty';
                    }
                    existingCell.textContent = existingDisplay;
                    row.appendChild(existingCell);

                    const newCell = document.createElement('td');
                    if (newAmount === null) {
                        newCell.className = 'is-empty';
                    }
                    newCell.textContent = newDisplay;
                    row.appendChild(newCell);

                    tbody.appendChild(row);
                });

            } catch (error) {

                // Fallback display on error - build safely
                conflictContent.replaceChildren();

                const errorBox = document.createElement('div');
                errorBox.className = 'ts-box is-negative';

                const content = document.createElement('div');
                content.className = 'ts-content';

                const header = document.createElement('div');
                header.className = 'ts-header';
                header.textContent = '無法載入衝突資料';

                const message = document.createElement('p');
                message.textContent = '發生錯誤，無法顯示詳細衝突資訊';

                content.appendChild(header);
                content.appendChild(message);
                errorBox.appendChild(content);
                conflictContent.appendChild(errorBox);
            }
        }

        async getExistingDepartmentData(date) {
            try {
                const [year, month] = date.split('-');
                // Ensure month is zero-padded (e.g., "01" instead of "1")
                const paddedMonth = month.padStart(2, '0');

                // Get waste type ID from manager's state
                const wasteTypeId = this.manager.currentWasteTypeId || '';

                const wasteTypeParam = wasteTypeId ? `&waste_type_id=${wasteTypeId}` : '';

                console.log(`Fetching data for ${year}-${paddedMonth}, waste_type_id: ${wasteTypeId || 'none'}`);

                const response = await fetch(`/management/api/department/data/?year=${year}&month=${paddedMonth}${wasteTypeParam}`);
                const data = await response.json();

                console.log('API response:', data);

                return data.success ? data.departments : [];
            } catch (error) {
                console.error('Error fetching existing department data:', error);
                return [];
            }
        }

        resolveConflict(action) {
            if (!this.currentConflictResolve) return;

            const applyToAllCheckbox = document.getElementById('applyToAllConflicts');
            const applyToAll = applyToAllCheckbox ? applyToAllCheckbox.checked : false;

            if (this.overrideModal) this.overrideModal.close();

            let resolution;
            if (action === 'override') {
                resolution = applyToAll ? 'override_all' : 'override_one';
                if (applyToAll) {
                    this.applyToAllOverride = true;
                }
            } else if (action === 'skip') {
                resolution = applyToAll ? 'skip_all' : 'skip_one';
                if (applyToAll) {
                    this.skipAllConflicts = true;
                }
            } else if (action === 'cancel') {
                resolution = 'cancel';
            }

            // Reset checkbox
            if (applyToAllCheckbox) applyToAllCheckbox.checked = false;

            this.currentConflictResolve(resolution);
            this.currentConflictResolve = null;
        }

        // Use existing loadingModal with proper implementation
        showLoadingModal() {
            if (!this.loadingModal) return;

            const loadingTitle = document.querySelector('#loadingModal .ts-header');
            const loadingMessage = document.getElementById('loadingMessage');

            if (loadingTitle) loadingTitle.textContent = '上傳中';
            if (loadingMessage) loadingMessage.textContent = '正在處理資料，請稍候...';

            this.loadingModal.hidden = false;
            this.loadingModal.showModal();
        }

        hideLoadingModal() {
            if (this.loadingModal) {
                this.loadingModal.close();
                this.loadingModal.hidden = true;
            }
        }

        // Implement proper progress bar using ts-progress component
        updateProgress(processed, total) {
            const percentage = total > 0 ? ((processed / total) * 100).toFixed(2) : 0;

            const progressBar = document.querySelector('#loadingModal .ts-progress .bar');
            const progressText = document.getElementById('progressText');

            if (progressBar) {
                progressBar.style.setProperty('--value', percentage);
            }

            if (progressText) {
                progressText.textContent = `${percentage}% (${processed}/${total})`;
            }
        }

        showImportResult(results) {
            const totalProcessed = results.totalProcessed || results.total || 0;
            const successCount = results.success || 0;
            const skippedCount = results.skipped || 0;
            const failedCount = results.failed ? results.failed.length : 0;

            // Create modal with is-big class (following import.js pattern)
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
            icon.className = `ts-icon ${failedCount === 0 ? 'is-check-circle-icon' : 'is-triangle-exclamation-icon'}`;
            header.appendChild(icon);
            header.appendChild(document.createTextNode('匯入結果'));

            const summary = document.createElement('p');
            summary.textContent = `總共 ${totalProcessed} 筆資料，成功 ${successCount} 筆，略過 ${skippedCount} 筆，失敗 ${failedCount} 筆`;

            headerSection.appendChild(header);
            headerSection.appendChild(summary);
            content.appendChild(headerSection);

            // Failed details section
            if (failedCount > 0) {
                const detailsSection = document.createElement('div');
                detailsSection.className = 'ts-content';

                const detailsTitle = document.createElement('h3');
                detailsTitle.textContent = '失敗詳情：';
                detailsSection.appendChild(detailsTitle);

                const failedList = document.createElement('ul');
                results.failed.forEach(f => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `第 ${f.index + 1} 行：${f.reason}`;
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
            confirmBtn.className = 'ts-button is-fluid';
            confirmBtn.textContent = '確認';

            footer.appendChild(confirmBtn);
            content.appendChild(footer);
            modal.appendChild(content);

            document.body.appendChild(modal);
            modal.showModal();

            // Handle confirm button click
            confirmBtn.addEventListener('click', async () => {
                modal.close();
                document.body.removeChild(modal);

                // Reload data after import
                if (window.departmentManager) {
                    await window.departmentManager.loadYearStatus();
                    if (window.departmentManager.currentMonth) {
                        await window.departmentManager.dataHandler.loadDepartmentData(
                            window.departmentManager.currentYear,
                            window.departmentManager.currentMonth
                        );

                        // Restore sort and filter state after import
                        window.departmentManager.filterManager.restoreSortState();
                        window.departmentManager.filterManager.applyFilters();
                    }
                }
            });
        }

        showErrorModal(message) {
            const modal = document.createElement('dialog');
            modal.className = 'ts-modal';

            const content = document.createElement('div');
            content.className = 'content';

            const headerSection = document.createElement('div');
            headerSection.className = 'ts-content is-center-aligned is-padded';

            const header = document.createElement('div');
            header.className = 'ts-header is-icon';

            const icon = document.createElement('span');
            icon.className = 'ts-icon is-triangle-exclamation-icon';
            header.appendChild(icon);
            header.appendChild(document.createTextNode('上傳失敗'));

            const messageEl = document.createElement('p');
            messageEl.textContent = message;

            headerSection.appendChild(header);
            headerSection.appendChild(messageEl);

            const divider = document.createElement('div');
            divider.className = 'ts-divider';

            const footer = document.createElement('div');
            footer.className = 'ts-content is-tertiary';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'ts-button is-fluid';
            closeBtn.textContent = '確定';

            footer.appendChild(closeBtn);

            content.appendChild(headerSection);
            content.appendChild(divider);
            content.appendChild(footer);
            modal.appendChild(content);

            document.body.appendChild(modal);
            modal.showModal();

            closeBtn.addEventListener('click', () => {
                modal.close();
                document.body.removeChild(modal);
            });
        }

        isValidDateFormat(dateStr) {
            if (!dateStr || dateStr.length !== 7) return false;
            if (dateStr[4] !== '-') return false;

            try {
                const [year, month] = dateStr.split('-');
                const y = parseInt(year);
                const m = parseInt(month);
                return y >= 1970 && y <= 9999 && m >= 1 && m <= 12;
            } catch {
                return false;
            }
        }

        showAlert(message) {
            const modal = document.createElement('dialog');
            modal.className = 'ts-modal';

            const content = document.createElement('div');
            content.className = 'content';

            const headerSection = document.createElement('div');
            headerSection.className = 'ts-content is-center-aligned is-padded';

            const header = document.createElement('div');
            header.className = 'ts-header is-icon';

            const icon = document.createElement('span');
            icon.className = 'ts-icon is-triangle-exclamation-icon';
            header.appendChild(icon);
            header.appendChild(document.createTextNode('警告'));

            const messageEl = document.createElement('p');
            messageEl.textContent = message;

            headerSection.appendChild(header);
            headerSection.appendChild(messageEl);

            const divider = document.createElement('div');
            divider.className = 'ts-divider';

            const footer = document.createElement('div');
            footer.className = 'ts-content is-tertiary';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'ts-button is-fluid';
            closeBtn.textContent = '確定';

            footer.appendChild(closeBtn);

            content.appendChild(headerSection);
            content.appendChild(divider);
            content.appendChild(footer);
            modal.appendChild(content);

            document.body.appendChild(modal);
            modal.showModal();

            closeBtn.addEventListener('click', () => {
                modal.close();
                document.body.removeChild(modal);
            });
        }

        updateImportExample() {
            // Update import example safely without innerHTML
            const exampleContainer = document.getElementById('importExample');
            if (exampleContainer && this.departmentMapping) {
                exampleContainer.replaceChildren();

                const departments = Object.keys(this.departmentMapping).slice(0, 3);

                // Line 1: Example title (green)
                const line1 = document.createElement('span');
                line1.style.color = 'green';
                line1.textContent = '// 範例：以下為「部門感染性廢棄物產出表」的上傳格式';
                exampleContainer.appendChild(line1);
                exampleContainer.appendChild(document.createElement('br'));

                // Line 2: Warning (red)
                const line2 = document.createElement('span');
                line2.className = 'ts-text is-negative is-bold';
                line2.style.color = 'red';
                line2.textContent = '// 由於部門重疊性較高，因此請確認目前的資料表與要上傳的檔案是否正確，防止資料遭到覆蓋！';
                exampleContainer.appendChild(line2);
                exampleContainer.appendChild(document.createElement('br'));

                // Line 3: CSV header
                const line3 = document.createElement('span');
                line3.textContent = `日期,${departments.join(',')}`;
                exampleContainer.appendChild(line3);
                exampleContainer.appendChild(document.createElement('br'));

                // Line 4: Example data 1
                const line4Text = document.createTextNode('2025-01,1.5,2.3,1.7 ');
                const line4Comment = document.createElement('span');
                line4Comment.style.color = 'green';
                line4Comment.textContent = '// 完整資料';
                exampleContainer.appendChild(line4Text);
                exampleContainer.appendChild(line4Comment);
                exampleContainer.appendChild(document.createElement('br'));

                // Line 5: Example data 2
                const line5Text = document.createTextNode('2025-02,,4.0,9.0 ');
                const line5Comment = document.createElement('span');
                line5Comment.style.color = 'green';
                line5Comment.textContent = '// 部分欄位留空';
                exampleContainer.appendChild(line5Text);
                exampleContainer.appendChild(line5Comment);
                exampleContainer.appendChild(document.createElement('br'));

                // Line 6: Example data 3
                const line6Text = document.createTextNode('2025-03,2.99,4.2,4 ');
                const line6Comment = document.createElement('span');
                line6Comment.style.color = 'green';
                line6Comment.textContent = '// 小數點任意位數';
                exampleContainer.appendChild(line6Text);
                exampleContainer.appendChild(line6Comment);
                exampleContainer.appendChild(document.createElement('br'));
            }
        }
    }

    // Initialize the import manager and make it globally available
    window.departmentImportManager = new DepartmentImportManager();
});