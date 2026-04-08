window.ImportHandler = class ImportHandler {
    constructor(manager) {
        this.manager = manager;
        this.importModal = document.getElementById('importModal');
        this.loadingModal = document.getElementById('loadingModal');
        this.overrideModal = document.getElementById('overrideModal');

        this.batchSize = 500;  // Increased from 250 due to backend optimization
        this.batchDelay = 200;  // Reduced from 300 due to faster backend processing
        this.maxConcurrent = 1;  // Keep at 1 due to SQLite database lock limitations

        this.currentConflicts = [];
        this.currentConflictIndex = 0;
        this.applyToAllOverride = false;
        this.skipAllConflicts = false;
        this.cancelUpload = false;

        // Define required headers for each manifest type
        this.requiredHeaders = {
            'disposal': [
                '聯單編號', '事業機構代碼', '事業機構名稱', '申報重量',
                '廢棄物代碼', '廢棄物名稱', '清除者代碼', '清除者名稱'
            ],
            'reuse': [
                '聯單編號', '事業機構代碼', '事業機構名稱', '申報重量',
                '物質代碼', '物質名稱', '清除者代碼', '清除者名稱'
            ]
        };

        this.bindImportEvents();
    }

    bindImportEvents() {
        document.getElementById('importCloseBtn').addEventListener('click', () => {
            this.hideImportModal();
        });

        document.getElementById('uploadManifestBtn').addEventListener('click', () => {
            this.handleFileUpload();
        });

        document.getElementById('loadingCloseBtn').addEventListener('click', () => {
            this.cancelUploadProcess();
        });

        document.getElementById('overrideDataBtn').addEventListener('click', () => {
            this.resolveConflict('override');
        });

        document.getElementById('skipDataBtn').addEventListener('click', () => {
            this.resolveConflict('skip');
        });

        document.getElementById('cancelUploadBtn').addEventListener('click', () => {
            this.resolveConflict('cancel');
        });
    }

    showImportModal() {
        this.updateImportExample();
        this.importModal.hidden = false;
        this.importModal.showModal();
    }

    updateImportExample() {
        const exampleElement = document.getElementById('importExample');
        if (!exampleElement) return;

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
        exampleElement.appendChild(createCommentSpan('// 範例：直接從環保署廢棄物管理平台下載的原始CSV檔案格式'));
        exampleElement.appendChild(createBreak());
        exampleElement.appendChild(document.createTextNode('聯單編號,事業機構代碼,事業機構名稱,申報重量,廢棄物代碼,廢棄物名稱,清除者代碼,清除者名稱,...'));
        exampleElement.appendChild(createBreak());

        exampleElement.appendChild(createCommentSpan('// 清除單範例（包含處理者資訊）'));
        exampleElement.appendChild(createBreak());
        exampleElement.appendChild(document.createTextNode('A1234567890,E0123456,某某醫院,150.5,C-0101,感染性廢棄物,G0987654,某某清運公司,...'));
        exampleElement.appendChild(createBreak());

        exampleElement.appendChild(createCommentSpan('// 再利用單範例（包含再利用者資訊）'));
        exampleElement.appendChild(createBreak());
        exampleElement.appendChild(document.createTextNode('R9876543210,E0123456,某某醫院,200.0,S-0201,廢紙類,G0987654,某某清運公司,...'));
        exampleElement.appendChild(createBreak());
    }

    hideImportModal() {
        this.importModal.close();
        this.importModal.hidden = true;
    }

    async handleFileUpload() {
        const fileInput = document.getElementById('manifestFileInput');
        const manifestType = document.getElementById('manifestTypeSelect').value;

        if (!fileInput.files[0]) {
            this.manager.ui.showAlert('請選擇一個 CSV 檔案');
            return;
        }

        if (!fileInput.files[0].name.endsWith('.csv')) {
            this.manager.ui.showAlert('請上傳 CSV 格式的檔案');
            return;
        }

        this.hideImportModal();

        const file = fileInput.files[0];
        
        // Validate file using CSV validator if available
        if (window.CSVValidator) {
            const validator = window.CSVValidator.createTransportationValidator();
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
                const validator = window.CSVValidator.createTransportationValidator();
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

            // Validate headers before processing
            if (!this.validateHeaders(headers, manifestType)) {
                return; // Error already shown in validateHeaders
            }

            this.validateAndUpload(headers, dataRows, manifestType);
        };

        reader.readAsText(file);
    }

    // Validate CSV headers match selected manifest type
    validateHeaders(headers, manifestType) {
        const requiredForType = this.requiredHeaders[manifestType];
        const missingHeaders = requiredForType.filter(required => !headers.includes(required));

        if (missingHeaders.length > 0) {
            const manifestTypeName = manifestType === 'disposal' ? '清除單' : '再利用單';
            this.manager.ui.showAlert(
                `所選擇的聯單類型為「${manifestTypeName}」，但CSV檔案缺少必要欄位：${missingHeaders.join(', ')}。請確認上傳的檔案類型與所選擇的聯單類型一致。`
            );
            return false;
        }

        // Check for wrong type headers
        const disposalSpecific = ['廢棄物代碼', '廢棄物名稱', '處理者代碼', '處理者名稱'];
        const reuseSpecific = ['物質代碼', '物質名稱', '再利用者代碼', '再利用者名稱'];

        if (manifestType === 'disposal') {
            const hasReuseHeaders = reuseSpecific.some(header => headers.includes(header));
            if (hasReuseHeaders) {
                this.manager.ui.showAlert(
                    '所選擇的聯單類型為「清除單」，但CSV檔案包含再利用單的欄位。請確認上傳的檔案類型與所選擇的聯單類型一致。'
                );
                return false;
            }
        } else if (manifestType === 'reuse') {
            const hasDisposalHeaders = disposalSpecific.some(header => headers.includes(header));
            if (hasDisposalHeaders) {
                this.manager.ui.showAlert(
                    '所選擇的聯單類型為「再利用單」，但CSV檔案包含清除單的欄位。請確認上傳的檔案類型與所選擇的聯單類型一致。'
                );
                return false;
            }
        }

        return true;
    }

    async validateAndUpload(headers, dataRows, manifestType) {
        this.applyToAllOverride = false;
        this.skipAllConflicts = false;
        this.cancelUpload = false;

        this.showLoadingModal();

        const formattedRows = this.formatRowsForBatch(headers, dataRows, manifestType);

        const results = {
            total: formattedRows.length,
            success: 0,
            skipped: 0,
            failed: []
        };

        // Start periodic progress update (every 500ms)
        this.processedCount = 0;
        this.totalCount = formattedRows.length;
        this.startProgressUpdater();

        await this.processBatches(formattedRows, manifestType, results);

        // Stop progress updater
        this.stopProgressUpdater();

        this.hideLoadingModal();
        this.showUploadResult(results);
    }

    startProgressUpdater() {
        this.progressUpdateInterval = setInterval(() => {
            this.manager.ui.updateProgress(this.processedCount, this.totalCount);
        }, 500);  // Update every 500ms
    }

    stopProgressUpdater() {
        if (this.progressUpdateInterval) {
            clearInterval(this.progressUpdateInterval);
            this.progressUpdateInterval = null;
        }
        // Final update to ensure 100% accuracy
        this.manager.ui.updateProgress(this.processedCount, this.totalCount);
    }

    // Simulate smooth progress for current batch
    simulateBatchProgress(batchStart, batchSize) {
        this.simulationStart = batchStart;
        this.simulationTarget = batchStart + batchSize;
        // Always use integer step to avoid floating point accumulation
        this.simulationStep = Math.max(1, Math.floor(batchSize / 20));  // Divide batch into 20 steps, minimum 1

        this.progressSimulationInterval = setInterval(() => {
            if (this.processedCount < this.simulationTarget - this.simulationStep) {
                // Ensure processedCount stays as integer
                this.processedCount = Math.floor(this.processedCount + this.simulationStep);
            }
        }, 100);  // Update every 100ms for smooth animation
    }

    stopProgressSimulation() {
        if (this.progressSimulationInterval) {
            clearInterval(this.progressSimulationInterval);
            this.progressSimulationInterval = null;
        }
    }

    formatRowsForBatch(headers, dataRows, manifestType) {
        const formattedRows = [];

        for (const row of dataRows) {
            const rowData = { manifestType: manifestType };

            headers.forEach((header, i) => {
                rowData[header] = row[i] || '';
            });

            if (rowData['聯單編號']) {
                formattedRows.push(rowData);
            }
        }

        return formattedRows;
    }

    async processBatches(formattedRows, manifestType, results) {
        const batches = [];
        for (let i = 0; i < formattedRows.length; i += this.batchSize) {
            batches.push(formattedRows.slice(i, i + this.batchSize));
        }

        for (let i = 0; i < batches.length; i += this.maxConcurrent) {
            if (this.cancelUpload) {
                results.skipped = formattedRows.length - results.success - results.failed.length;
                break;
            }

            const currentBatches = batches.slice(i, i + this.maxConcurrent);

            // Start simulating progress for this batch
            const batchStartIndex = i * this.batchSize;
            const currentBatchSize = currentBatches[0].length;
            this.simulateBatchProgress(batchStartIndex, currentBatchSize);

            const batchPromises = currentBatches.map(batch =>
                this.sendBatch(manifestType, batch, this.applyToAllOverride)
            );

            const batchResults = await Promise.all(batchPromises);

            // Stop simulation and set actual progress
            this.stopProgressSimulation();

            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                const batchStartIdx = (i + j) * this.batchSize;
                const currentBatchSz = currentBatches[j].length;

                // Update actual processed count for progress bar
                this.processedCount = batchStartIdx + currentBatchSz;

                // Add null check and validate result structure
                if (!result) {
                    console.error('Batch result is null/undefined:', j);
                    for (let k = 0; k < currentBatchSize; k++) {
                        results.failed.push({
                            row: batchStartIndex + k + 2,
                            reason: 'No response from server'
                        });
                    }
                    continue;
                }

                if (result.success && result.data) {
                    results.success += result.data.results?.success || 0;

                    if (result.data.results?.failed && result.data.results.failed.length) {
                        for (const failure of result.data.results.failed) {
                            results.failed.push({
                                row: batchStartIndex + failure.index + 2,
                                reason: failure.reason
                            });
                        }
                    }
                } else if (result.error === '資料衝突' || (result.data && result.data.error === '資料衝突')) {
                    const resultData = result.data || result;
                    if (!this.skipAllConflicts && resultData.results?.conflicts && resultData.results.conflicts.length > 0) {
                        const conflicts = resultData.results.conflicts.map(conflict => ({
                            ...conflict,
                            batchIndex: batchStartIndex + conflict.index
                        }));

                        await this.resolveConflicts(conflicts, results);
                    } else if (this.skipAllConflicts) {
                        if (resultData.results?.conflicts) {
                            results.skipped += resultData.results.conflicts.length;
                        }
                    }

                    if (resultData.results?.success) {
                        results.success += resultData.results.success;
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
        }

        const calculatedSkipped = formattedRows.length - results.success - results.failed.length;
        results.skipped = Math.max(0, calculatedSkipped);
    }

    async sendBatch(manifestType, rows, overrideConflicts = false, retryCount = 0) {
        const maxRetries = 3;
        const baseDelay = this.batchDelay;
        
        try {
            const startTime = performance.now();

            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
            const result = await APIUtils.post('/transportation/api/batch_import/', {
                manifestType: manifestType,
                rows: rows,
                override_conflicts: overrideConflicts
            }, csrfToken);
            
            // Check for database lock errors and retry if needed
            if (result.error && result.error.includes('database is locked') && retryCount < maxRetries) {
                console.warn(`Database locked, retrying in ${baseDelay * (retryCount + 2)}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, baseDelay * (retryCount + 2)));
                return this.sendBatch(manifestType, rows, overrideConflicts, retryCount + 1);
            }

            const elapsedTime = performance.now() - startTime;
            
            // Smart buffer mechanism - adjust delay based on batch size and performance
            let adaptiveDelay = baseDelay;
            if (rows.length > 100) {
                adaptiveDelay = baseDelay * 1.5; // Longer delay for larger batches
            } else if (elapsedTime > 2000) {
                adaptiveDelay = baseDelay * 2; // Server seems slow, increase delay
            }
            
            if (elapsedTime < adaptiveDelay) {
                await new Promise(resolve => setTimeout(resolve, adaptiveDelay - elapsedTime));
            }

            return result;
            
        } catch (error) {
            console.error('Batch processing error:', error);
            
            // Network error - retry with exponential backoff
            if (retryCount < maxRetries && (error.name === 'TypeError' || error.message.includes('fetch'))) {
                const retryDelay = baseDelay * Math.pow(2, retryCount + 1); // Exponential backoff
                console.warn(`Network error, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.sendBatch(manifestType, rows, overrideConflicts, retryCount + 1);
            }
            
            // Final failure after retries
            await new Promise(resolve => setTimeout(resolve, baseDelay * 3));

            return {
                success: false,
                error: retryCount >= maxRetries ? `Network error after ${maxRetries} retries` : 'Network error',
                results: {
                    total: rows.length,
                    success: 0,
                    failed: rows.map((row, idx) => ({
                        index: idx,
                        reason: retryCount >= maxRetries ? `Network error after ${maxRetries} retries` : 'Network error',
                        data: row
                    })),
                    conflicts: []
                }
            };
        }
    }

    async resolveConflicts(conflicts, results) {
        let processedConflicts = 0;

        for (const conflict of conflicts) {
            if (this.cancelUpload || this.skipAllConflicts) {
                results.skipped += conflicts.length - processedConflicts;
                return;
            }

            // If "apply to all override" was already set, batch process all remaining conflicts
            if (this.applyToAllOverride) {
                const remainingConflicts = conflicts.slice(processedConflicts);
                const conflictDataByType = {};

                // Group conflicts by manifestType for batch processing
                remainingConflicts.forEach(conf => {
                    const type = conf.data.manifestType || 'disposal';
                    if (!conflictDataByType[type]) {
                        conflictDataByType[type] = [];
                    }
                    conflictDataByType[type].push(conf);
                });

                // Process each type in batch
                for (const [type, confs] of Object.entries(conflictDataByType)) {
                    const batchData = confs.map(c => c.data);
                    const overrideResult = await this.sendBatch(type, batchData, true);

                    if (overrideResult.success) {
                        results.success += confs.length;
                    } else {
                        confs.forEach(conf => {
                            results.failed.push({
                                row: conf.batchIndex + 2,
                                reason: overrideResult.error || 'Override failed'
                            });
                        });
                    }
                }

                return;
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
                this.applyToAllOverride = true;

                // Collect all remaining conflicts for batch override
                const remainingConflicts = conflicts.slice(processedConflicts);
                const conflictDataByType = {};

                // Group conflicts by manifestType for batch processing
                remainingConflicts.forEach(conf => {
                    const type = conf.data.manifestType || 'disposal';
                    if (!conflictDataByType[type]) {
                        conflictDataByType[type] = [];
                    }
                    conflictDataByType[type].push(conf);
                });

                // Process each type in batch
                for (const [type, confs] of Object.entries(conflictDataByType)) {
                    const batchData = confs.map(c => c.data);
                    const overrideResult = await this.sendBatch(type, batchData, true);

                    if (overrideResult.success) {
                        results.success += confs.length;
                    } else {
                        confs.forEach(conf => {
                            results.failed.push({
                                row: conf.batchIndex + 2,
                                reason: overrideResult.error || 'Override failed'
                            });
                        });
                    }
                }

                // Skip remaining loop iterations since we've processed all
                return;
            } else if (resolution === 'skip_one') {
                results.skipped += 1;
            } else if (resolution === 'skip_all') {
                this.skipAllConflicts = true;
                results.skipped += conflicts.length - processedConflicts;
                return;
            } else if (resolution === 'cancel') {
                this.cancelUpload = true;
                results.skipped += conflicts.length - processedConflicts;
                return;
            }

            processedConflicts++;
        }
    }

    // override conflict method with proper single row handling
    async overrideConflict(conflict) {
        try {
            return await this.sendBatch(
                conflict.data.manifestType || 'disposal',
                [conflict.data],
                true  // override_conflicts = true
            );
        } catch (error) {
            console.error('Override conflict error:', error);
            return {
                success: false,
                error: error.message || 'Override failed'
            };
        }
    }

    async promptForConflictResolution(conflict) {
        return new Promise(resolve => {
            this.currentConflictResolve = resolve;
            this.currentConflict = conflict;

            this.overrideModal.hidden = false;
            this.overrideModal.showModal();

            // Show conflict information in header
            const manifestNumber = conflict.manifestNumber || 'N/A';
            const wasteSubstanceId = conflict.wasteSubstanceId || 'N/A';
            document.getElementById('overrideHeader').textContent =
                `聯單編號「${manifestNumber}」已存在於資料庫中`;

            this.buildConflictTable(conflict);
        });
    }

    resolveConflict(action) {
        if (!this.currentConflictResolve) return;

        const applyToAll = document.getElementById('applyToAllConflicts').checked;
        this.overrideModal.close();
        this.overrideModal.hidden = true;

        let resolution;
        if (action === 'override') {
            resolution = applyToAll ? 'override_all' : 'override_one';
        } else if (action === 'skip') {
            resolution = applyToAll ? 'skip_all' : 'skip_one';
        } else if (action === 'cancel') {
            resolution = 'cancel';
        }

        this.currentConflictResolve(resolution);
        this.currentConflictResolve = null;
    }

    // Build conflict table with proper manifest identification
    async buildConflictTable(conflict) {
        const tableBody = document.getElementById('conflictTableBody');
        tableBody.replaceChildren();

        try {
            // Get existing manifest data using manifest number AND process_code for accurate comparison
            const processCode = conflict.processCode || conflict.data?.['製程代碼'] || null;
            const existingData = await this.getExistingManifestDataFromServer(
                conflict.manifestNumber,
                processCode  // Pass process_code to get the exact matching manifest
            );
            const uploadedData = conflict.data;

            // Define comprehensive field mappings
            const fieldMappings = this.getFieldMappings(uploadedData.manifestType || 'disposal');

            // Build table rows with comparison
            fieldMappings.forEach(field => {
                const row = document.createElement('tr');

                const existingValue = this.getFieldValue(existingData, field.existingKey) || '';
                const uploadedValue = this.getFieldValue(uploadedData, field.uploadedKey) || '';

                // Normalize values for comparison
                const existingNormalized = String(existingValue).trim();
                const uploadedNormalized = String(uploadedValue).trim();

                // Check if values conflict (different and both non-empty)
                const isConflict = existingNormalized !== uploadedNormalized &&
                    uploadedNormalized !== '' &&
                    existingNormalized !== '';

                if (isConflict) {
                    row.className = 'is-conflicted';
                }

                // Use secure DOM manipulation instead of innerHTML
                const labelCell = document.createElement('td');
                const existingCell = document.createElement('td');
                const uploadedCell = document.createElement('td');
                
                labelCell.textContent = field.label;
                existingCell.textContent = existingNormalized;
                uploadedCell.textContent = uploadedNormalized;
                
                row.appendChild(labelCell);
                row.appendChild(existingCell);
                row.appendChild(uploadedCell);

                tableBody.appendChild(row);
            });

        } catch (error) {
            console.error('Error building conflict table:', error);

            // Fallback: show basic information using secure DOM manipulation
            const row = document.createElement('tr');
            row.className = 'is-conflicted';
            
            const labelCell = document.createElement('td');
            const errorCell = document.createElement('td');
            const numberCell = document.createElement('td');
            
            labelCell.textContent = '聯單編號';
            errorCell.textContent = '資料庫錯誤';
            numberCell.textContent = conflict.manifestNumber || 'N/A';
            
            row.appendChild(labelCell);
            row.appendChild(errorCell);
            row.appendChild(numberCell);
            tableBody.appendChild(row);
        }
    }

    // Get existing manifest data using manifest number AND process_code for accurate matching
    async getExistingManifestDataFromServer(manifestNumber, processCode = null) {
        try {
            let url = `/transportation/api/get_existing_manifest_data/?manifestNumber=${encodeURIComponent(manifestNumber)}`;

            // Include process_code if provided to get the exact matching manifest
            if (processCode) {
                url += `&processCode=${encodeURIComponent(processCode)}`;
            }

            const response = await APIUtils.get(url);

            if (response.success && response.data && response.data.manifestData) {
                return response.data.manifestData;
            } else {
                console.warn('Failed to get existing manifest data:', response.error || 'No data returned');
                // Return basic manifest structure for display
                return {
                    manifestNumber: manifestNumber,
                    manifestTypeDisplay: '未知類型',
                    vehicleNumber: '',
                    enterpriseCode: '',
                    enterpriseName: '',
                    declaredWeight: '',
                    transporterCode: '',
                    transporterName: ''
                };
            }
        } catch (error) {
            console.error('Error fetching existing manifest data:', error);
            // Return basic structure on error
            return {
                manifestNumber: manifestNumber,
                manifestTypeDisplay: '資料載入錯誤',
                vehicleNumber: '',
                enterpriseCode: '',
                enterpriseName: '',
                declaredWeight: '',
                transporterCode: '',
                transporterName: ''
            };
        }
    }

    // Get field mappings based on manifest type
    getFieldMappings(manifestType) {
        const commonFields = [
            { label: '聯單編號', existingKey: 'manifestNumber', uploadedKey: '聯單編號' },
            { label: '聯單類型', existingKey: 'manifestTypeDisplay', uploadedKey: 'manifestType' },
            { label: '運載車號', existingKey: 'vehicleNumber', uploadedKey: '運載車號' },
            { label: '事業機構代碼', existingKey: 'enterpriseCode', uploadedKey: '事業機構代碼' },
            { label: '事業機構名稱', existingKey: 'enterpriseName', uploadedKey: '事業機構名稱' },
            { label: '申報重量', existingKey: 'declaredWeight', uploadedKey: '申報重量' },
            { label: '清除者代碼', existingKey: 'transporterCode', uploadedKey: '清除者代碼' },
            { label: '清除者名稱', existingKey: 'transporterName', uploadedKey: '清除者名稱' },
        ];

        if (manifestType === 'disposal') {
            return [
                ...commonFields,
                { label: '廢棄物代碼', existingKey: 'wasteCode', uploadedKey: '廢棄物代碼' },
                { label: '廢棄物名稱', existingKey: 'wasteName', uploadedKey: '廢棄物名稱' },
                { label: '製程代碼', existingKey: 'processCode', uploadedKey: '製程代碼' },
                { label: '製程名稱', existingKey: 'processName', uploadedKey: '製程名稱' },
                { label: '處理者代碼', existingKey: 'treatmentFacilityCode', uploadedKey: '處理者代碼' },
                { label: '處理者名稱', existingKey: 'treatmentFacilityName', uploadedKey: '處理者名稱' },
                { label: '中間處理方式', existingKey: 'intermediateTreatmentMethod', uploadedKey: '中間處理方式' },
                { label: '最終處置方式', existingKey: 'finalDisposalMethod', uploadedKey: '最終處置方式' }
            ];
        } else {
            return [
                ...commonFields,
                { label: '物質代碼', existingKey: 'substanceCode', uploadedKey: '物質代碼' },
                { label: '物質名稱', existingKey: 'substanceName', uploadedKey: '物質名稱' },
                { label: '製程代碼', existingKey: 'processCode', uploadedKey: '製程代碼' },
                { label: '製程名稱', existingKey: 'processName', uploadedKey: '製程名稱' },
                { label: '再利用者代碼', existingKey: 'recyclerCode', uploadedKey: '再利用者代碼' },
                { label: '再利用者名稱', existingKey: 'recyclerName', uploadedKey: '再利用者名稱' },
                { label: '再利用用途', existingKey: 'recyclingPurpose', uploadedKey: '再利用用途' },
                { label: '再利用方式', existingKey: 'recyclingMethod', uploadedKey: '再利用方式' }
            ];
        }
    }

    // Get field value with fallback handling
    getFieldValue(data, key) {
        if (!data || !key) return '';

        // Handle nested keys
        if (key.includes('.')) {
            const keys = key.split('.');
            let value = data;
            for (const k of keys) {
                value = value?.[k];
                if (value === undefined || value === null) break;
            }
            return value;
        }

        // Handle special mapping for uploaded data
        if (key === 'manifestType' && data.manifestType) {
            return data.manifestType === 'disposal' ? '清除單' : '再利用單';
        }

        return data[key];
    }

    showLoadingModal() {
        this.loadingModal.hidden = false;
        this.loadingModal.showModal();
    }

    hideLoadingModal() {
        this.loadingModal.close();
        this.loadingModal.hidden = true;
    }

    cancelUploadProcess() {
        // Show confirmation dialog before cancelling
        if (window.NotificationUtils) {
            NotificationUtils.showConfirm('確認中斷', '確定要終止匯入嗎？', () => {
                this.cancelUpload = true;
                this.hideLoadingModal();
                this.manager.ui.showAlert('已終止匯入');
            });
        } else {
            // Fallback if NotificationUtils is not available
            if (confirm('確定要終止匯入嗎？')) {
                this.cancelUpload = true;
                this.hideLoadingModal();
                this.manager.ui.showAlert('已終止匯入');
            }
        }
    }

    showUploadResult(results) {
        // Final validation to ensure numbers add up correctly (like Management and Prediction)
        const total = results.total;
        const calculatedTotal = results.success + results.skipped + results.failed.length;

        // Adjust skipped count if needed to ensure totals match
        if (calculatedTotal !== total) {
            results.skipped = Math.max(0, total - results.success - results.failed.length);
        }

        // Trigger statistics refresh after successful import operations (like Management and Prediction)
        if (results.success > 0 && window.StatisticsRefresher) {
            window.StatisticsRefresher.Helper.afterBatchImport('transportation', results.success);
        }

        const modal = document.createElement('dialog');
        modal.className = 'ts-modal is-big';

        let failedDetails = results.failed && results.failed.length > 0 ? `
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
        modal.querySelector('.reload-btn').addEventListener('click', async () => {
            modal.close();
            document.body.removeChild(modal);

            // Update statistics and reload manifests after import
            await this.manager.ui.updateStatisticsWithFilters();
            await this.manager.loadManifests(this.manager.currentCategory);
        });
    }
}