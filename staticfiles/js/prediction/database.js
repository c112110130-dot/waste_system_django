// Wait for the DOM to fully load before executing
document.addEventListener('DOMContentLoaded', () => {
    class DatabaseManager {
        constructor() {
            // Destructure configuration from global window object
            const { selectedTable, fields, fieldInfo, saveUrl, deleteUrl } = window.databaseConfig || {};
            if (!window.databaseConfig) {
                return;
            }

            this.selectedTable = selectedTable;
            this.fields = fields;
            this.fieldInfo = fieldInfo;
            this.saveUrl = saveUrl;
            this.deleteUrl = deleteUrl;

            // Get CSRF token from cookie via SecurityUtils
            this.csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';

            // References to table and containers
            this.tableContainer = document.getElementById('tableContainer');
            this.tableBody = document.getElementById('tableBody');
            this.noDataContainer = document.getElementById('noDataContainer');
            this.editingRow = null; // Track the currently edited row
            this.lastDeletedData = null; // Store deleted data for undo functionality
            this.currentSortField = 'date'; // Track current sort field
            this.currentSortDirection = 'asc'; // Track current sort direction

            // Unit display mapping dictionary for placeholders
            this.unitDisplayMap = {
                'percent': '百分比',
                'person_count': '人數',
                'person_times': '人次',
                'kilogram': '公斤'
            };

            // Set column widths dynamically based on fields length
            const table = document.getElementById('dataTable');
            table.style.setProperty('--field-count', this.fields.length);

            this.ui = new UIManager(this);
            this.dataHandler = new DataHandler(this);
            this.filterManager = new FilterManager(this);

            this.initialize();
        }

        initialize() {
            this.ui.bindInitialEvents();
            this.filterManager.loadFilterSettings();
            this.ui.updateDataDisplay();
            this.ui.updateButtonStates();
            this.dataHandler.sortTable('date', 'asc');
            if (sessionStorage.getItem(`filters_${this.selectedTable}`)) {
                this.filterManager.applyFilters();
            }
        }
    }

    class UIManager {
        constructor(manager) {
            this.manager = manager;
        }

        // Custom modal for displaying alerts
        showModal(message) {
            if (window.GlobalModalManager) {
                window.GlobalModalManager.alert('無法登錄資料', message, 'error');
            } else {
                alert(message);
            }
        }

        // Confirm delete modal with promise
        confirmDeleteModal(title, message) {
            if (window.GlobalModalManager) {
                return window.GlobalModalManager.confirm(title, message);
            } else {
                return Promise.resolve(confirm(message));
            }
        }

        // Bulk delete confirmation for 10+ items
        showBulkDeleteConfirmDialog(count) {
            if (window.GlobalModalManager) {
                return window.GlobalModalManager.bulkDeleteConfirm(count);
            } else {
                const requiredText = '我很清楚我目前正在做的事情，而我也願意承擔任何後果。';
                const input = prompt(`您正在刪除大量資料（${count} 筆資料），請輸入：${requiredText}`);
                return Promise.resolve(input === requiredText);
            }
        }

        // Snackbar for delete confirmation with undo option
        showSnackbar(onComplete) {
            const snackbar = document.createElement('div');
            snackbar.className = 'ts-snackbar';
            snackbar.innerHTML = `
                <div class="content">已成功刪除資料</div>
                <button class="action">撤回</button>
            `;
            document.body.appendChild(snackbar);

            snackbar.addEventListener('animationend', (event) => {
                if (event.animationName === 'fadeout') {
                    if (document.body.contains(snackbar)) {
                        document.body.removeChild(snackbar);
                    }
                    onComplete();
                }
            });

            const undoBtn = snackbar.querySelector('.action');
            undoBtn.addEventListener('click', () => {
                if (this.manager.lastDeletedData) {
                    // Use batch API requests for undo operations
                    const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                    const undoRequests = this.manager.lastDeletedData.map(data => ({
                        url: this.manager.saveUrl,
                        options: {
                            method: 'POST',
                            body: JSON.stringify(data),
                            headers: {
                                'X-CSRFToken': csrfToken
                            }
                        }
                    }));

                    window.APIUtils.batchRequest(undoRequests)
                        .then(results => {
                            const allSuccess = results.every(result => result.success);
                            if (allSuccess) {
                                // Remove snackbar first to avoid visual issues
                                if (document.body.contains(snackbar)) {
                                    document.body.removeChild(snackbar);
                                }
                                // Immediate page reload without waiting for other operations
                                window.location.reload();
                                return; // Stop execution here
                            } else {
                                const errorMsg = results.find(r => !r.success)?.error || "未知錯誤";
                                this.showModal(`撤回失敗：${errorMsg}`);
                                this.manager.lastDeletedData = null;
                            }
                        })
                        .catch(error => {
                            this.showModal("撤回過程中發生錯誤，請稍後再試");
                        })
                        .finally(() => {
                            if (document.body.contains(snackbar)) {
                                document.body.removeChild(snackbar);
                            }
                        });
                } else {
                    if (document.body.contains(snackbar)) {
                        document.body.removeChild(snackbar);
                    }
                }
            });
        }

        // Update button states based on editing mode
        updateButtonStates() {
            const actionButtons = document.querySelectorAll('.action-btn');
            const editButtons = document.querySelectorAll('.edit-btn');
            const deleteBtn = document.getElementById('deleteSelectedBtn');
            const addBtn = document.getElementById('addRowBtn');

            // Get a fresh list of checkboxes that currently exist in the DOM
            const checkboxes = document.querySelectorAll('.delete-checkbox');

            // Check if any visible checkboxes are checked
            const anyChecked = Array.from(checkboxes).some(ch =>
                ch.checked && ch.closest('tr').style.display !== 'none');

            // Check if there's any data at all
            const hasVisibleData = Array.from(this.manager.tableBody.querySelectorAll('tr:not(#newRow)'))
                .some(row => row.style.display !== 'none');

            actionButtons.forEach(btn => {
                if (btn.id !== 'deleteSelectedBtn' && btn.id !== 'addRowBtn') {
                    btn.classList.toggle('is-disabled', !!this.manager.editingRow);
                    btn.disabled = !!this.manager.editingRow;
                }
            });

            editButtons.forEach(btn => {
                btn.classList.toggle('is-disabled', !!this.manager.editingRow);
                btn.disabled = !!this.manager.editingRow;
            });

            if (this.manager.editingRow) {
                // If editing, hide both buttons
                deleteBtn.style.display = 'none';
                deleteBtn.disabled = true;
                addBtn.style.display = 'none';
                addBtn.disabled = true;
            } else {
                // Not editing - show appropriate button
                if (hasVisibleData && anyChecked) {
                    // Show delete button only if there's visible data and checkboxes checked
                    deleteBtn.style.display = 'inline-block';
                    deleteBtn.disabled = false;
                    addBtn.style.display = 'none';
                } else {
                    // Otherwise show add button
                    deleteBtn.style.display = 'none';
                    addBtn.style.display = 'inline-block';
                    addBtn.disabled = false;
                }
            }
        }

        // Update visibility of table and no data container
        updateDataDisplay(visibleRows = null) {
            const dataRows = this.manager.tableBody.querySelectorAll('tr:not(#newRow)');
            const visibleCount = visibleRows !== null ? visibleRows : Array.from(dataRows).filter(row => row.style.display !== 'none').length;
            if (visibleCount === 0 && !document.getElementById('newRow')) {
                this.manager.tableContainer.style.display = 'none';
                this.manager.noDataContainer.style.display = 'block';
            } else {
                this.manager.tableContainer.style.display = 'block';
                this.manager.noDataContainer.style.display = 'none';
            }
        }

        // Revert row to its original state
        revertRow(row) {
            const dateCell = row.querySelector('.date-cell');
            dateCell.textContent = dateCell.dataset.original || '';
            row.querySelectorAll('.data-cell').forEach(cell => {
                const field = cell.dataset.field;
                const originalValue = cell.dataset.original || '';
                let formattedValue = '';
                if (originalValue && !isNaN(parseFloat(originalValue))) {
                    if (this.manager.fieldInfo[field].unit === 'percent') {
                        formattedValue = originalValue;
                    } else {
                        formattedValue = parseFloat(originalValue).toString().replace(/\.0$/, '');
                    }
                } else {
                    formattedValue = originalValue;
                }
                cell.textContent = formattedValue;
            });
            row.querySelector('td:last-child').innerHTML = `
                <button type="button" class="ts-button is-warning is-start-icon edit-btn">
                    <span class="ts-icon is-pencil-icon"></span>
                    編輯
                </button>
            `;
            row.classList.remove('editing');
            this.bindEditButtonEvents(row.querySelector('.edit-btn'));
        }

        // Bind edit button events
        bindEditButtonEvents(btn) {
            btn.addEventListener('click', () => {
                const row = btn.closest('tr');
                if (!this.manager.editingRow && row && !row.classList.contains('editing')) {
                    this.manager.editingRow = row;
                    row.classList.add('editing');
                    const dateCell = row.querySelector('.date-cell');
                    const originalDate = dateCell.textContent.trim();
                    dateCell.dataset.original = originalDate;
                    dateCell.innerHTML = `<div class="ts-input is-basic"><input type="month" value="${originalDate}" placeholder="選擇月份"></div>`;
                    row.querySelectorAll('.data-cell').forEach(cell => {
                        const field = cell.dataset.field;
                        let value = cell.textContent.trim();
                        cell.dataset.original = value;
                        const unit = this.manager.fieldInfo[field].unit;
                        const inputType = 'number';
                        const displayUnit = this.manager.unitDisplayMap[unit] || unit;
                        let step = 'any';
                        if (unit === 'person_count' || unit === 'person_times') {
                            step = '1';
                        }
                        cell.innerHTML = `<div class="ts-input is-basic"><input type="${inputType}" step="${step}" value="${value || ''}" placeholder="${displayUnit}"></div>`;
                    });
                    btn.outerHTML = `
                        <button type="button" class="ts-button is-positive is-icon save-btn">
                            <span class="ts-icon is-check-icon"></span>
                        </button>
                        <button type="button" class="ts-button is-negative is-icon cancel-btn">
                            <span class="ts-icon is-xmark-icon"></span>
                        </button>
                    `;
                    this.manager.dataHandler.bindRowEvents(row);
                    this.updateButtonStates();
                }
            });
        }

        bindInitialEvents() {
            document.querySelectorAll('.edit-btn').forEach(btn => this.bindEditButtonEvents(btn));
            document.getElementById('addRowBtn').addEventListener('click', () => this.manager.dataHandler.addRow());
            const deleteBtn = document.getElementById('deleteSelectedBtn');
            const selectAll = document.getElementById('selectAll');
            const checkboxes = document.querySelectorAll('.delete-checkbox');

            selectAll.addEventListener('change', () => {
                const visibleCheckboxes = Array.from(checkboxes).filter(ch => ch.closest('tr').style.display !== 'none');
                visibleCheckboxes.forEach(checkbox => checkbox.checked = selectAll.checked);
                this.updateButtonStates();
            });

            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const visibleCheckboxes = Array.from(checkboxes).filter(ch => ch.closest('tr').style.display !== 'none');
                    selectAll.checked = visibleCheckboxes.every(ch => ch.checked);
                    this.updateButtonStates();
                });
            });

            deleteBtn.addEventListener('click', () => this.manager.dataHandler.handleDelete(checkboxes));
            document.querySelectorAll('.sortable').forEach(header => {
                header.addEventListener('click', () => this.manager.dataHandler.handleSort(header));
            });
            document.getElementById('clearFilterBtn').addEventListener('click', () => this.manager.filterManager.clearFilters());
        }
    }

    class DataHandler {
        constructor(manager) {
            this.manager = manager;
        }

        // Add row
        addRow() {
            if (!this.manager.editingRow && !document.getElementById('newRow')) {
                const newRow = document.createElement('tr');
                newRow.id = 'newRow';
                newRow.className = 'editing';
                this.manager.editingRow = newRow;
                let html = `
                    <td class="checkbox-cell">
                        <label class="ts-checkbox is-solo is-large">
                            <input type="checkbox" disabled>
                        </label>
                    </td>
                    <td class="date-cell"><div class="ts-input is-basic"><input type="month" id="new_date" placeholder="選擇月份"></div></td>
                `;
                this.manager.fields.forEach(field => {
                    const unit = this.manager.fieldInfo[field].unit;
                    const inputType = 'number';
                    let step = 'any';
                    if (unit === 'person_count' || unit === 'person_times') {
                        step = '1';
                    }
                    const displayUnit = this.manager.unitDisplayMap[unit] || unit;
                    html += `<td class="data-cell" data-field="${field}"><div class="ts-input is-basic"><input type="${inputType}" step="${step}" id="new_${field}" placeholder="${displayUnit}"></div></td>`;
                });
                html += `
                    <td class="action-cell">
                        <button type="button" class="ts-button is-positive is-icon save-btn">
                            <span class="ts-icon is-check-icon"></span>
                        </button>
                        <button type="button" class="ts-button is-negative is-icon cancel-btn">
                            <span class="ts-icon is-xmark-icon"></span>
                        </button>
                    </td>
                `;
                newRow.innerHTML = html;
                this.manager.tableBody.appendChild(newRow);
                this.manager.ui.updateDataDisplay();
                this.bindRowEvents(newRow);
                this.manager.ui.updateButtonStates();

                newRow.scrollIntoView({ behavior: 'smooth', block: 'end' });
                this.manager.tableContainer.scrollTop = this.manager.tableContainer.scrollHeight;
            }
        }

        // Bind save and cancel events to rows
        bindRowEvents(row) {
            const saveBtn = row.querySelector('.save-btn');
            const cancelBtn = row.querySelector('.cancel-btn');

            saveBtn.addEventListener('click', () => {
                const dateInput = row.querySelector('input[type="month"]');
                const date = dateInput.value;
                if (!date || !/^\d{4}-\d{2}$/.test(date)) {
                    this.manager.ui.showModal("請輸入有效的 YYYY-MM 日期");
                    return;
                }
                const originalDate = row.dataset.date || '';
                const data = {
                    date: date,
                    original_date: originalDate
                };
                let hasError = false;
                row.querySelectorAll('.data-cell input').forEach(input => {
                    const field = input.closest('td').dataset.field;
                    data[field] = input.value || '';

                    // Validate required fields (everything except medical_waste_total)
                    if (field !== 'medical_waste_total' && (!input.value || input.value.trim() === '')) {
                        const fieldName = this.manager.fieldInfo[field].name;
                        this.manager.ui.showModal(`必填欄位「${fieldName}」不可為空。除了「廢棄物總量」外，其他所有欄位都必須有值。`);
                        hasError = true;
                    }

                    // Validate unit-specific rules
                    if (input.value && input.value.trim() !== '') {
                        const fieldInfo = this.manager.fieldInfo[field];
                        const numValue = parseFloat(input.value);

                        if (isNaN(numValue)) {
                            this.manager.ui.showModal(`欄位「${fieldInfo.name}」必須是數字`);
                            hasError = true;
                        } else {
                            if (fieldInfo.unit === 'person_count' || fieldInfo.unit === 'person_times') {
                                if (!Number.isInteger(numValue) || numValue < 0) {
                                    this.manager.ui.showModal(`欄位「${fieldInfo.name}」必須是0或正整數`);
                                    hasError = true;
                                }
                            } else if (fieldInfo.unit === 'percent') {
                                if (numValue < 0 || numValue > 100) {
                                    this.manager.ui.showModal(`欄位「${fieldInfo.name}」必須是0-100之間的數字`);
                                    hasError = true;
                                }
                            }
                        }
                    }
                });

                if (hasError) return;

                // Use standardized API utilities for save operation
                const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                window.APIUtils.post(this.manager.saveUrl, data, csrfToken)
                    .then(result => {
                        if (result.success) {
                            location.reload();
                        } else {
                            this.manager.ui.showModal(result.error);
                        }
                    })
                    .catch(error => {
                        console.error('Save operation error:', error);
                        this.manager.ui.showModal('保存時發生錯誤，請稍後再試');
                    })
            });

            cancelBtn.addEventListener('click', () => {
                if (row.id === 'newRow') {
                    row.remove();
                    this.manager.editingRow = null;
                    this.manager.ui.updateDataDisplay();
                } else {
                    this.manager.ui.revertRow(row);
                    this.manager.editingRow = null;
                }
                this.manager.ui.updateButtonStates();
            });
        }

        // Handle deletion of selected rows with bulk delete protection
        async handleDelete(checkboxes) {
            if (!this.manager.editingRow) {
                const selectedDates = Array.from(checkboxes)
                    .filter(ch => ch.checked && ch.closest('tr').style.display !== 'none')
                    .map(ch => ch.value);
                if (selectedDates.length) {
                    let confirmed = false;

                    if (selectedDates.length >= 10) {
                        confirmed = await this.manager.ui.showBulkDeleteConfirmDialog(selectedDates.length);
                    } else {
                        confirmed = await this.manager.ui.confirmDeleteModal(
                            '確認刪除',
                            `確定要刪除 ${selectedDates.length} 筆資料嗎？`
                        );
                    }

                    if (!confirmed) return;

                    // Prepare deleted data for undo
                    this.manager.lastDeletedData = [];
                    selectedDates.forEach(date => {
                        const row = this.manager.tableBody.querySelector(`tr[data-date="${date}"]`);
                        if (row) {
                            const data = { date: date, original_date: '' };
                            row.querySelectorAll('.data-cell').forEach(cell => {
                                const field = cell.dataset.field;
                                let value = cell.textContent.trim();
                                data[field] = value || '';
                            });
                            this.manager.lastDeletedData.push(data);
                        }
                    });

                    // Use standardized API utilities for delete operation
                    const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                    window.APIUtils.post(
                        this.manager.deleteUrl,
                        { dates: selectedDates },
                        csrfToken
                    )
                        .then(result => {
                            if (result.success) {
                                // Remove rows from DOM
                                selectedDates.forEach(date => {
                                    const row = this.manager.tableBody.querySelector(`tr[data-date="${date}"]`);
                                    if (row) row.remove();
                                });

                                // Update UI state
                                this.manager.ui.updateDataDisplay();

                                // Force a thorough button state update AFTER rows are removed
                                setTimeout(() => {
                                    this.manager.ui.updateButtonStates();
                                }, 0);

                                // Trigger statistics refresh after successful bulk delete
                                if (window.StatisticsRefresher) {
                                    window.StatisticsRefresher.Helper.afterBatchDelete(
                                        'prediction',
                                        selectedDates
                                    );
                                }

                                this.manager.ui.showSnackbar(() => {
                                    // Update again after snackbar animation completes
                                    this.manager.ui.updateButtonStates();
                                });
                            } else {
                                this.manager.ui.showModal(result.error);
                                this.manager.lastDeletedData = null;
                            }
                        })
                        .catch(error => {
                            console.error('Delete operation error:', error);
                            this.manager.ui.showModal("刪除過程中發生錯誤，請稍後再試");
                            this.manager.lastDeletedData = null;
                        });
                } else {
                    this.manager.ui.showModal("請選擇至少一筆資料進行刪除");
                }
            }
        }

        // Update sort indicators
        updateSortIndicators(field, direction) {
            document.querySelectorAll('.sortable').forEach(th => {
                const iconSpan = th.querySelector('.ts-icon');
                if (th.dataset.field === field) {
                    th.dataset.sort = direction;
                    if (direction === 'asc') {
                        iconSpan.className = 'ts-icon is-sort-up-icon';
                    } else if (direction === 'desc') {
                        iconSpan.className = 'ts-icon is-sort-down-icon';
                    }
                } else {
                    th.dataset.sort = '';
                    iconSpan.className = 'ts-icon is-sort-icon';
                }
            });
        }

        // Sort table rows
        sortTable(field, direction) {
            const rows = Array.from(this.manager.tableBody.querySelectorAll('tr:not(.editing)'));

            rows.sort((a, b) => {
                if (field === 'date') {
                    const aValue = a.querySelector('.date-cell').textContent || '';
                    const bValue = b.querySelector('.date-cell').textContent || '';
                    return direction === 'asc'
                        ? aValue.localeCompare(bValue)
                        : bValue.localeCompare(aValue);
                } else {
                    const aCell = a.querySelector(`td[data-field="${field}"]`);
                    const bCell = b.querySelector(`td[data-field="${field}"]`);
                    let aValue = aCell.textContent.trim();
                    let bValue = bCell.textContent.trim();
                    aValue = parseFloat(aValue) || 0;
                    bValue = parseFloat(bValue) || 0;
                    return direction === 'asc' ? aValue - bValue : bValue - aValue;
                }
            });

            rows.forEach(row => this.manager.tableBody.appendChild(row));
            this.updateSortIndicators(field, direction);
            this.manager.currentSortField = field;
            this.manager.currentSortDirection = direction;
            this.manager.filterManager.applyFilters();
        }

        handleSort(header) {
            if (this.manager.editingRow) return;

            const field = header.dataset.field;
            let newDirection = this.manager.currentSortField === field
                ? (this.manager.currentSortDirection === 'asc' ? 'desc' : 'asc')
                : 'desc';

            this.sortTable(field, newDirection);
        }
    }

    class FilterManager {
        constructor(manager) {
            this.manager = manager;
            this.bindFilterEvents();
        }

        // Load filter settings from sessionStorage
        loadFilterSettings() {
            const savedFilters = sessionStorage.getItem(`filters_${this.manager.selectedTable}`);
            if (savedFilters) {
                const filters = JSON.parse(savedFilters);
                document.getElementById('startDate').value = filters.startDate || '';
                document.getElementById('endDate').value = filters.endDate || '';
                document.querySelector(`input[name="filterMode"][value="${filters.filterMode || 'all'}"]`).checked = true;
                this.manager.fields.forEach(field => {
                    document.getElementById(`min_${field}`).value = filters[`min_${field}`] || '';
                    document.getElementById(`max_${field}`).value = filters[`max_${field}`] || '';
                });
                this.applyFilters();
            }
            // Update filter button appearance initially
            this.updateFilterButtonAppearance();
        }

        // Save filter settings to sessionStorage
        saveFilterSettings() {
            const filters = {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                filterMode: document.querySelector('input[name="filterMode"]:checked').value
            };
            this.manager.fields.forEach(field => {
                filters[`min_${field}`] = document.getElementById(`min_${field}`).value;
                filters[`max_${field}`] = document.getElementById(`max_${field}`).value;
            });
            sessionStorage.setItem(`filters_${this.manager.selectedTable}`, JSON.stringify(filters));
        }

        // Check if any filters are active
        hasActiveFilters() {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (startDate || endDate) {
                return true;
            }

            // Check field filters
            for (const field of this.manager.fields) {
                const minValue = document.getElementById(`min_${field}`).value;
                const maxValue = document.getElementById(`max_${field}`).value;

                if (minValue || maxValue) {
                    return true;
                }
            }

            return false;
        }

        // Update filter button appearance based on filter values
        updateFilterButtonAppearance() {
            const filterButton = document.querySelector('.ts-button.is-filter');
            if (!filterButton) return;

            if (this.hasActiveFilters()) {
                filterButton.classList.add('has-filter-index');
            } else {
                filterButton.classList.remove('has-filter-index');
            }
        }

        // Apply dynamic filtering based on date and field values
        applyFilters() {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const filterMode = document.querySelector('input[name="filterMode"]:checked').value;
            const rows = this.manager.tableBody.querySelectorAll('tr:not(.editing)');

            let visibleRows = 0;
            rows.forEach(row => {
                const dateCell = row.querySelector('.date-cell');
                if (!dateCell) return;
                const date = dateCell.textContent;
                let dateMatch = true;
                if (startDate && date < startDate) dateMatch = false;
                if (endDate && date > endDate) dateMatch = false;

                const fieldMatches = this.manager.fields.map(field => {
                    const min = parseFloat(document.getElementById(`min_${field}`).value) || -Infinity;
                    const max = parseFloat(document.getElementById(`max_${field}`).value) || Infinity;
                    const cell = row.querySelector(`[data-field="${field}"]`);
                    let value = cell ? cell.textContent.trim() : '0';
                    value = parseFloat(value) || 0;
                    return value >= min && value <= max;
                });

                let show = filterMode === 'all'
                    ? dateMatch && fieldMatches.every(match => match)
                    : dateMatch && (fieldMatches.some(match => match) || fieldMatches.length === 0);

                row.style.display = show ? '' : 'none';
                if (show) visibleRows++;
            });

            this.manager.ui.updateDataDisplay(visibleRows);
            const checkboxes = document.querySelectorAll('.delete-checkbox');
            const visibleCheckboxes = Array.from(checkboxes).filter(ch => ch.closest('tr').style.display !== 'none');
            document.getElementById('selectAll').checked = visibleCheckboxes.every(ch => ch.checked);
            document.getElementById('deleteSelectedBtn').disabled = !visibleCheckboxes.some(ch => ch.checked);

            // Update filter button appearance
            this.updateFilterButtonAppearance();
        }

        // Bind filter input events
        bindFilterEvents() {
            const filterInputs = document.querySelectorAll('#filterMenu input');
            filterInputs.forEach(input => {
                input.addEventListener('input', () => {
                    if (!this.manager.editingRow) {
                        this.applyFilters();
                        this.saveFilterSettings();
                    }
                });
            });
        }

        // Clear all filters
        clearFilters() {
            if (!this.manager.editingRow) {
                const filterInputs = document.querySelectorAll('#filterMenu input');
                filterInputs.forEach(input => {
                    if (input.type !== 'radio') input.value = '';
                });
                document.querySelector('input[name="filterMode"][value="all"]').checked = true;
                const rows = this.manager.tableBody.querySelectorAll('tr:not(.editing)');
                rows.forEach(row => row.style.display = '');
                document.getElementById('selectAll').checked = false;
                document.getElementById('deleteSelectedBtn').disabled = true;
                this.manager.ui.updateDataDisplay(rows.length);
                this.saveFilterSettings();

                // Update filter button appearance after clearing
                this.updateFilterButtonAppearance();
            }
        }
    }

    new DatabaseManager();
});