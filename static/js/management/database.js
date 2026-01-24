document.addEventListener('DOMContentLoaded', () => {
    class DatabaseManager {
        constructor() {
            // Get configuration from server
            const config = window.databaseConfig || {};
            if (!window.databaseConfig) {
                return;
            }

            // Initialize properties from server configuration
            this.selectedTable = config.selectedTable;
            this.fields = config.fields;
            this.fieldInfo = config.fieldInfo;
            this.saveUrl = config.saveUrl;
            this.deleteUrl = config.deleteUrl;

            // Get CSRF token from cookie via SecurityUtils
            this.csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';

            // Use configuration manager
            this.config = window.ConfigManager;

            // State management
            this.tableContainer = document.getElementById('tableContainer');
            this.tableBody = document.getElementById('tableBody');
            this.noDataContainer = document.getElementById('noDataContainer');
            this.editingRow = null;
            this.lastDeletedData = null;
            this.currentSortField = 'date';
            this.currentSortDirection = 'asc';

            // Dynamic column width based on field count
            const table = document.getElementById('dataTable');
            table.style.setProperty('--field-count', this.fields.length);

            // Initialize managers
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

        // Show modal dialog
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

        // Show snackbar with undo option
        showSnackbar(onComplete) {
            const snackbar = document.createElement('div');
            snackbar.className = 'ts-snackbar';
            DOMUtils.replaceContent(snackbar, (parent) => {
                DOMUtils.createElement(parent, 'div', { class: 'content' }, '已成功刪除資料');
                DOMUtils.createElement(parent, 'button', { class: 'action' }, '撤回');
            });
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
                    const undoRequests = this.manager.lastDeletedData.map(data => ({
                        url: this.manager.saveUrl,
                        options: {
                            method: 'POST',
                            body: JSON.stringify(data),
                            headers: {
                                'X-CSRFToken': this.manager.csrfToken
                            }
                        }
                    }));

                    window.APIUtils.batchRequest(undoRequests)
                        .then(results => {
                            const allSuccess = results.every(result => result.success);
                            if (allSuccess) {
                                if (document.body.contains(snackbar)) {
                                    document.body.removeChild(snackbar);
                                }
                                window.location.reload();
                                return;
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

        // Update button states dynamically
        updateButtonStates() {
            const actionButtons = document.querySelectorAll('.action-btn');
            const editButtons = document.querySelectorAll('.edit-btn');
            const deleteBtn = document.getElementById('deleteSelectedBtn');
            const addBtn = document.getElementById('addRowBtn');

            const checkboxes = document.querySelectorAll('.delete-checkbox');
            const anyChecked = Array.from(checkboxes).some(ch =>
                ch.checked && ch.closest('tr').style.display !== 'none');

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
                deleteBtn.style.display = 'none';
                deleteBtn.disabled = true;
                addBtn.style.display = 'none';
                addBtn.disabled = true;
            } else {
                if (hasVisibleData && anyChecked) {
                    deleteBtn.style.display = 'inline-block';
                    deleteBtn.disabled = false;
                    addBtn.style.display = 'none';
                } else {
                    deleteBtn.style.display = 'none';
                    addBtn.style.display = 'inline-block';
                    addBtn.disabled = false;
                }
            }
        }

        // Update data display visibility
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

        // Revert row to original state using dynamic configuration
        revertRow(row) {
            // Re-enable ALL checkboxes after edit mode
            const selectAll = document.getElementById('selectAll');
            if (selectAll) {
                selectAll.disabled = false;
            }
            document.querySelectorAll('.delete-checkbox').forEach(cb => {
                cb.disabled = false;
            });

            const dateCell = row.querySelector('.date-cell');
            dateCell.textContent = dateCell.dataset.original || '';

            row.querySelectorAll('.data-cell').forEach(cell => {
                const field = cell.dataset.field;
                const originalValue = cell.dataset.original || '';
                const fieldInfo = this.manager.fieldInfo[field];

                // Use dynamic formatter
                let formattedValue = '';
                if (originalValue && !isNaN(parseFloat(originalValue))) {
                    formattedValue = this.manager.config.formatValue(originalValue, fieldInfo.unit);
                }

                cell.textContent = formattedValue;
            });

            // Use safe DOM manipulation instead of innerHTML
            const lastCell = row.querySelector('td:last-child');
            DOMUtils.replaceContent(lastCell, (parent) => {
                const editButton = DOMUtils.createButton('編輯', 'ts-button is-warning is-start-icon edit-btn');
                const icon = DOMUtils.createIcon('is-pencil-icon');
                editButton.insertBefore(icon, editButton.firstChild);
                parent.appendChild(editButton);
            });
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

                    // Disable ALL checkboxes during edit mode
                    const selectAll = document.getElementById('selectAll');
                    if (selectAll) {
                        selectAll.disabled = true;
                    }
                    document.querySelectorAll('.delete-checkbox').forEach(cb => {
                        cb.disabled = true;
                    });

                    // Edit date cell safely using DOM API
                    const dateCell = row.querySelector('.date-cell');
                    const originalDate = dateCell.textContent.trim();
                    dateCell.dataset.original = originalDate;

                    const dateInputWrapper = document.createElement('div');
                    dateInputWrapper.className = 'ts-input is-basic';
                    const dateInput = document.createElement('input');
                    dateInput.type = 'month';
                    dateInput.value = originalDate;
                    dateInput.placeholder = '選擇月份';
                    dateInputWrapper.appendChild(dateInput);
                    dateCell.textContent = '';
                    dateCell.appendChild(dateInputWrapper);

                    // Edit data cells using dynamic configuration
                    row.querySelectorAll('.data-cell').forEach(cell => {
                        const field = cell.dataset.field;

                        // Get original value from dataset or text content
                        const value = cell.dataset.original || cell.textContent.trim().replace(/,/g, '');
                        cell.dataset.original = value;

                        // Use dynamic input creation (returns DOM element)
                        const inputElement = this.manager.config.createInput(
                            field,
                            this.manager.fieldInfo,
                            value,
                            false
                        );

                        // Remove is-empty class before adding input
                        cell.classList.remove('is-empty');

                        if (inputElement) {
                            cell.replaceChildren(inputElement);
                        } else {
                            // For auto-calculated fields, show placeholder text
                            const placeholder = document.createElement('span');
                            placeholder.className = 'auto-calculated-placeholder';
                            placeholder.textContent = '<<自動統計>>';
                            cell.replaceChildren(placeholder);
                        }
                    });

                    // Update action buttons safely using DOM API
                    const actionCell = btn.parentElement;
                    DOMUtils.replaceContent(actionCell, (parent) => {
                        const saveBtn = DOMUtils.createButton('儲存', 'ts-button is-positive is-start-icon save-btn');
                        const saveIcon = DOMUtils.createIcon('is-check-icon');
                        saveBtn.insertBefore(saveIcon, saveBtn.firstChild);

                        const cancelBtn = DOMUtils.createButton('取消', 'ts-button is-negative is-start-icon cancel-btn');
                        const cancelIcon = DOMUtils.createIcon('is-xmark-icon');
                        cancelBtn.insertBefore(cancelIcon, cancelBtn.firstChild);

                        parent.appendChild(saveBtn);
                        parent.appendChild(cancelBtn);
                    });

                    this.manager.dataHandler.bindRowEvents(row);
                    this.updateButtonStates();
                }
            });
        }

        // Bind initial events
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

            deleteBtn.addEventListener('click', () => this.manager.dataHandler.handleDelete());
            document.querySelectorAll('.sortable').forEach(header => {
                header.addEventListener('click', () => this.manager.dataHandler.handleSort(header));
            });
            document.getElementById('clearFilterBtn').addEventListener('click', () => this.manager.filterManager.clearFilters());
            document.getElementById('tableSelect').addEventListener('change', (event) => {
                // Show loading indicator with fallback
                if (window.LoadingManager && typeof window.LoadingManager.show === 'function') {
                    try {
                        window.LoadingManager.show('tableSwitch', document.body, {
                            type: 'progress',
                            message: '切換資料表中...',
                            progress: 0
                        });
                        
                        // Simulate progress
                        let progress = 0;
                        const progressInterval = setInterval(() => {
                            progress += 10;
                            if (window.LoadingManager && typeof window.LoadingManager.updateProgress === 'function') {
                                window.LoadingManager.updateProgress('tableSwitch', progress);
                            }
                            if (progress >= 90) {
                                clearInterval(progressInterval);
                            }
                        }, 100);
                    } catch (error) {
                        console.warn('LoadingManager error:', error);
                    }
                }
                
                // Clear filters for previous table
                sessionStorage.removeItem(`filters_${this.manager.selectedTable}`);
                
                // Submit the form to change table
                const form = document.getElementById('dataForm');
                if (form) {
                    form.submit();
                } else {
                    console.error('Form not found with id "dataForm"');
                }
            });
        }
    }

    class DataHandler {
        constructor(manager) {
            this.manager = manager;
        }

        // Add row with dynamic field handling (safe DOM construction)
        addRow() {
            if (!this.manager.editingRow && !document.getElementById('newRow')) {
                const newRow = document.createElement('tr');
                newRow.id = 'newRow';
                newRow.className = 'editing';
                this.manager.editingRow = newRow;

                // Disable ALL checkboxes during add mode
                const selectAll = document.getElementById('selectAll');
                if (selectAll) {
                    selectAll.disabled = true;
                }
                document.querySelectorAll('.delete-checkbox').forEach(cb => {
                    cb.disabled = true;
                });

                // Create checkbox cell
                const checkboxCell = document.createElement('td');
                checkboxCell.className = 'checkbox-cell';
                const label = document.createElement('label');
                label.className = 'ts-checkbox is-solo is-large';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.disabled = true;
                label.appendChild(checkbox);
                checkboxCell.appendChild(label);
                newRow.appendChild(checkboxCell);

                // Create date cell
                const dateCell = document.createElement('td');
                dateCell.className = 'date-cell';
                const dateInputWrapper = document.createElement('div');
                dateInputWrapper.className = 'ts-input is-basic';
                const dateInput = document.createElement('input');
                dateInput.type = 'month';
                dateInput.id = 'new_date';
                dateInput.placeholder = '選擇月份';
                dateInputWrapper.appendChild(dateInput);
                dateCell.appendChild(dateInputWrapper);
                newRow.appendChild(dateCell);

                // Generate data cells dynamically based on field configuration
                this.manager.fields.forEach(field => {
                    const dataCell = document.createElement('td');
                    dataCell.className = 'data-cell';
                    dataCell.dataset.field = field;

                    const inputElement = this.manager.config.createInput(field, this.manager.fieldInfo, '', true);
                    if (inputElement) {
                        dataCell.appendChild(inputElement);
                    } else {
                        // For auto-calculated fields, show placeholder text
                        const placeholder = document.createElement('span');
                        placeholder.className = 'auto-calculated-placeholder';
                        placeholder.textContent = '<<自動統計>>';
                        dataCell.appendChild(placeholder);
                    }

                    newRow.appendChild(dataCell);
                });

                // Create action cell with buttons
                const actionCell = document.createElement('td');
                actionCell.className = 'action-cell';

                const saveBtn = document.createElement('button');
                saveBtn.type = 'button';
                saveBtn.className = 'ts-button is-positive is-start-icon save-btn';
                const saveIcon = document.createElement('span');
                saveIcon.className = 'ts-icon is-check-icon';
                saveBtn.appendChild(saveIcon);
                saveBtn.appendChild(document.createTextNode('儲存'));

                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'ts-button is-negative is-start-icon cancel-btn';
                const cancelIcon = document.createElement('span');
                cancelIcon.className = 'ts-icon is-xmark-icon';
                cancelBtn.appendChild(cancelIcon);
                cancelBtn.appendChild(document.createTextNode('取消'));

                actionCell.appendChild(saveBtn);
                actionCell.appendChild(cancelBtn);
                newRow.appendChild(actionCell);

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

                // Use dynamic date validation
                if (!this.manager.config.validateDate(date)) {
                    this.manager.ui.showModal("請輸入有效的 YYYY-MM 日期");
                    return;
                }

                const originalDate = row.dataset.date || '';
                const data = {
                    table: this.manager.selectedTable,
                    date: date,
                    original_date: originalDate
                };

                // Collect field data dynamically
                row.querySelectorAll('.data-cell input').forEach(input => {
                    const field = input.closest('td').dataset.field;
                    data[field] = input.value || '';
                });

                // Use standardized API utilities for save operation
                window.APIUtils.post(this.manager.saveUrl, data, this.manager.csrfToken)
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

                    // Re-enable ALL checkboxes after canceling add mode
                    const selectAll = document.getElementById('selectAll');
                    if (selectAll) {
                        selectAll.disabled = false;
                    }
                    document.querySelectorAll('.delete-checkbox').forEach(cb => {
                        cb.disabled = false;
                    });

                    this.manager.ui.updateDataDisplay();
                } else {
                    this.manager.ui.revertRow(row);
                    this.manager.editingRow = null;
                }
                this.manager.ui.updateButtonStates();
            });
        }

        // Handle deletion with bulk delete protection
        async handleDelete() {
            if (!this.manager.editingRow) {
                const checkboxes = document.querySelectorAll('.delete-checkbox');
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
                            const data = { table: this.manager.selectedTable, date: date, original_date: '' };
                            row.querySelectorAll('.data-cell').forEach(cell => {
                                const field = cell.dataset.field;
                                const value = cell.textContent.trim().replace(/,/g, '');
                                data[field] = value || '';
                            });
                            this.manager.lastDeletedData.push(data);
                        }
                    });

                    // Use standardized API utilities for delete operation
                    window.APIUtils.post(
                        this.manager.deleteUrl,
                        { table: this.manager.selectedTable, dates: selectedDates },
                        this.manager.csrfToken
                    )
                        .then(result => {
                            if (result.success) {
                                selectedDates.forEach(date => {
                                    const row = this.manager.tableBody.querySelector(`tr[data-date="${date}"]`);
                                    if (row) row.remove();
                                });

                                // Clear ALL checkbox states after deletion
                                const selectAll = document.getElementById('selectAll');
                                if (selectAll) {
                                    selectAll.checked = false;
                                }

                                // Clear all remaining row checkboxes
                                const remainingCheckboxes = document.querySelectorAll('.delete-checkbox');
                                remainingCheckboxes.forEach(cb => {
                                    cb.checked = false;
                                });

                                this.manager.ui.updateDataDisplay();
                                setTimeout(() => {
                                    this.manager.ui.updateButtonStates();
                                }, 0);

                                // Trigger statistics refresh after successful bulk delete
                                if (window.StatisticsRefresher) {
                                    window.StatisticsRefresher.Helper.afterBatchDelete(
                                        'management',
                                        selectedDates
                                    );
                                }

                                this.manager.ui.showSnackbar(() => {
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
                    const aValue = parseFloat(aCell.textContent.replace(/,/g, '')) || 0;
                    const bValue = parseFloat(bCell.textContent.replace(/,/g, '')) || 0;
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

                // Load field filters dynamically
                this.manager.fields.forEach(field => {
                    const minInput = document.getElementById(`min_${field}`);
                    const maxInput = document.getElementById(`max_${field}`);
                    if (minInput) minInput.value = filters[`min_${field}`] || '';
                    if (maxInput) maxInput.value = filters[`max_${field}`] || '';
                });

                this.applyFilters();
            }
            this.updateFilterButtonAppearance();
        }

        // Save filter settings to sessionStorage
        saveFilterSettings() {
            const filters = {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                filterMode: document.querySelector('input[name="filterMode"]:checked').value
            };

            // Save field filters dynamically
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

            // Check field filters dynamically
            for (const field of this.manager.fields) {
                const minValue = document.getElementById(`min_${field}`).value;
                const maxValue = document.getElementById(`max_${field}`).value;

                if (minValue || maxValue) {
                    return true;
                }
            }

            return false;
        }

        // Update filter button appearance
        updateFilterButtonAppearance() {
            const filterButton = document.querySelector('.ts-button.is-filter');
            if (!filterButton) return;

            if (this.hasActiveFilters()) {
                filterButton.classList.add('has-filter-index');
            } else {
                filterButton.classList.remove('has-filter-index');
            }
        }

        // Apply filters dynamically
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

                // Check field filters dynamically
                const fieldMatches = this.manager.fields.map(field => {
                    const min = parseFloat(document.getElementById(`min_${field}`).value) || -Infinity;
                    const max = parseFloat(document.getElementById(`max_${field}`).value) || Infinity;
                    const cell = row.querySelector(`[data-field="${field}"]`);
                    const value = cell ? parseFloat(cell.textContent.replace(/,/g, '')) || 0 : 0;
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
                this.updateFilterButtonAppearance();
            }
        }
    }

    new DatabaseManager();
});