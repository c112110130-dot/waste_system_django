// static/js/management/db-department.js - Main Department Management Logic
document.addEventListener('DOMContentLoaded', () => {
    class DepartmentManager {
        constructor() {
            // Get configuration from Django backend
            this.config = window.departmentConfig || {};
            this.departments = this.config.departments || [];
            this.wasteTypes = this.config.wasteTypes || [];
            this.unitTranslations = this.config.unitTranslations || {};
            this.departmentMapping = this.config.departmentMapping || {};

            // Get CSRF token from cookie via SecurityUtils
            this.csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';

            // State management
            this.currentYear = new Date().getFullYear();
            this.currentMonth = null;
            this.currentWasteTypeId = null;
            this.departmentData = [];
            this.selectedDepartments = new Set();
            this.monthStatus = {};

            // Initialize managers
            this.ui = new DepartmentUIManager(this);
            this.dataHandler = new DepartmentDataHandler(this);
            this.filterManager = new DepartmentFilterManager(this);
            this.exportManager = new DepartmentExportManager(this);

            this.initialize();
        }

        async initialize() {
            this.ui.initializeInterface();
            await this.loadYearStatus();
            this.bindEvents();
            this.ui.updateYearDisplay();

            // Auto-select latest data
            await this.autoSelectLatestData();
        }

        async autoSelectLatestData() {
            // Find the latest month with data for current year
            let latestMonth = null;

            // Check current year first
            for (let month = 12; month >= 1; month--) {
                const monthKey = `${this.currentYear}-${month.toString().padStart(2, '0')}`;
                if (this.monthStatus[monthKey] && this.monthStatus[monthKey].has_data) {
                    latestMonth = month;
                    break;
                }
            }

            // If no data in current year, find the latest year with data
            if (!latestMonth) {
                // Check previous years (up to 5 years back)
                let foundYear = null;
                let foundMonth = null;

                for (let year = this.currentYear - 1; year >= this.currentYear - 5; year--) {
                    try {
                        const response = await fetch(`/management/api/department/month_status/?year=${year}`);
                        const data = await response.json();

                        if (data.success) {
                            // Find latest month in this year
                            for (let month = 12; month >= 1; month--) {
                                const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
                                if (data.status[monthKey] && data.status[monthKey].has_data) {
                                    foundYear = year;
                                    foundMonth = month;
                                    break;
                                }
                            }
                            if (foundYear) break;
                        }
                    } catch (error) {
                    }
                }

                if (foundYear) {
                    this.currentYear = foundYear;
                    latestMonth = foundMonth;
                    this.ui.updateYearDisplay();
                    await this.loadYearStatus();
                }
            }

            // Select the latest month or default to month 1 if no data found
            const monthToSelect = latestMonth || 1;
            await this.selectMonth(monthToSelect);
        }

        async loadYearStatus() {
            try {
                // Add waste_type_id parameter if available
                const wasteTypeParam = this.currentWasteTypeId ? `&waste_type_id=${this.currentWasteTypeId}` : '';
                const response = await fetch(`/management/api/department/month_status/?year=${this.currentYear}${wasteTypeParam}`);
                const data = await response.json();

                if (data.success) {
                    this.monthStatus = data.status;
                    this.ui.updateMonthSelector(this.monthStatus);

                    // Ensure current month selection is maintained after updating status
                    if (this.currentMonth) {
                        this.ui.updateMonthSelection(this.currentMonth);
                    }
                } else {
                }
            } catch (error) {
                this.ui.showErrorModal('載入年份資料失敗');
            }
        }

        bindEvents() {
            // Year navigation
            const yearMinus10 = document.getElementById('yearMinus10');
            const yearMinus1 = document.getElementById('yearMinus1');
            const yearPlus1 = document.getElementById('yearPlus1');
            const yearPlus10 = document.getElementById('yearPlus10');

            if (yearMinus10) yearMinus10.addEventListener('click', () => this.changeYear(-10));
            if (yearMinus1) yearMinus1.addEventListener('click', () => this.changeYear(-1));
            if (yearPlus1) yearPlus1.addEventListener('click', () => this.changeYear(1));
            if (yearPlus10) yearPlus10.addEventListener('click', () => this.changeYear(10));

            // Month selection
            document.querySelectorAll('.month-select').forEach(monthCard => {
                monthCard.addEventListener('click', () => {
                    const month = parseInt(monthCard.dataset.month);
                    this.selectMonth(month);
                });
            });

            // Add/Edit modal buttons
            const confirmAddBtn = document.getElementById('confirmAddBtn');
            const confirmEditBtn = document.getElementById('confirmEditBtn');

            if (confirmAddBtn) confirmAddBtn.addEventListener('click', () => this.dataHandler.saveData(false));
            if (confirmEditBtn) confirmEditBtn.addEventListener('click', () => this.dataHandler.saveData(true));

            // Delete functionality
            const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
            if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', () => this.dataHandler.handleBulkDelete());

            // Export functionality
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) exportBtn.addEventListener('click', () => this.exportManager.handleExport());

            // Waste type selection
            const wasteTypeSelect = document.getElementById('wasteTypeSelect');
            if (wasteTypeSelect) {
                wasteTypeSelect.addEventListener('change', async () => {
                    // Update current waste type ID
                    this.currentWasteTypeId = wasteTypeSelect.value;

                    // Reload year status to update month indicators for new waste type
                    await this.loadYearStatus();

                    // Reload data for current month when waste type changes
                    if (this.currentMonth) {
                        await this.dataHandler.loadDepartmentData(this.currentYear, this.currentMonth);

                        // Restore all UI states: sort, filter, search, and show empty toggle
                        this.filterManager.restoreSortState();
                        this.filterManager.applyFilters();
                    }
                });
            }

            // Search and filter
            this.filterManager.bindEvents();

            // Show Empty Data Toggle
            const showEmptyToggle = document.getElementById('showEmptyDataToggle');
            if (showEmptyToggle) {
                showEmptyToggle.addEventListener('change', () => {
                    // Re-render department cards when toggle state changes
                    if (Array.isArray(this.departmentData) && this.departmentData.length > 0) {
                        // First re-render based on current sort state
                        this.filterManager.restoreSortState();
                        // Then apply all existing filters
                        this.filterManager.applyFilters();
                    }
                });
            }
        }

        async changeYear(delta) {
            const newYear = this.currentYear + delta;
            if (newYear < 1970 || newYear > 9999) return;

            this.currentYear = newYear;
            this.currentMonth = null;
            this.departmentData = [];

            this.ui.updateYearDisplay();
            await this.loadYearStatus();
            this.ui.clearDepartmentCards();

            // Auto-select latest month for new year
            await this.autoSelectLatestMonthForYear(newYear);
        }

        async autoSelectLatestMonthForYear(year) {
            // Find latest month with data in this year
            let latestMonth = null;

            for (let month = 12; month >= 1; month--) {
                const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
                if (this.monthStatus[monthKey] && this.monthStatus[monthKey].has_data) {
                    latestMonth = month;
                    break;
                }
            }

            // Select latest month with data, or January if no data
            const monthToSelect = latestMonth || 1;
            await this.selectMonth(monthToSelect);
        }

        async selectMonth(month) {
            if (this.currentMonth === month) return;

            this.currentMonth = month;
            this.ui.updateMonthSelection(month);
            await this.dataHandler.loadDepartmentData(this.currentYear, month);

            // Restore sort state if exists
            this.filterManager.restoreSortState();
        }
    }

    class DepartmentUIManager {
        constructor(manager) {
            this.manager = manager;
        }

        initializeInterface() {
            // Initialize any UI elements that need setup
            this.initializeWasteTypeSelect();
            this.clearDepartmentCards();
        }

        initializeWasteTypeSelect() {
            const wasteTypeSelect = document.getElementById('wasteTypeSelect');
            if (!wasteTypeSelect || !this.manager.wasteTypes) return;

            // Clear existing options
            wasteTypeSelect.replaceChildren();

            // Add waste type options
            this.manager.wasteTypes.forEach(wasteType => {
                const option = document.createElement('option');
                option.value = wasteType.id;
                option.textContent = wasteType.name;
                wasteTypeSelect.appendChild(option);
            });

            // Set default selection to first waste type if available
            if (this.manager.wasteTypes.length > 0) {
                wasteTypeSelect.value = this.manager.wasteTypes[0].id;
                // Initialize manager's currentWasteTypeId with default selection
                this.manager.currentWasteTypeId = this.manager.wasteTypes[0].id;
            }
        }

        updateYearDisplay() {
            const currentYear = document.getElementById('currentYear');
            if (currentYear) {
                currentYear.textContent = this.manager.currentYear;
            }
        }

        updateMonthSelector(monthStatus) {
            document.querySelectorAll('.month-select').forEach(monthCard => {
                const month = parseInt(monthCard.dataset.month);
                const monthKey = `${this.manager.currentYear}-${month.toString().padStart(2, '0')}`;
                const status = monthStatus[monthKey];

                // Only reset data-related classes, keep selection state
                monthCard.classList.remove('has-no-data');
                // Note: Don't remove 'background-tertiary' here as it indicates current selection

                if (status && status.has_data) {
                    // Has data - normal appearance
                } else {
                    // No data - hollowed appearance
                    monthCard.classList.add('has-no-data');
                }
            });
        }

        updateMonthSelection(selectedMonth) {
            document.querySelectorAll('.month-select').forEach(monthCard => {
                const month = parseInt(monthCard.dataset.month);
                if (month === selectedMonth) {
                    monthCard.classList.add('background-tertiary');
                } else {
                    monthCard.classList.remove('background-tertiary');
                }
            });
        }

        renderDepartmentCards(departmentData) {
            const grid = document.getElementById('departmentGrid');
            if (!grid) return;

            grid.replaceChildren();

            // Check if "Show Empty Data" toggle is enabled
            const showEmptyToggle = document.getElementById('showEmptyDataToggle');
            const showEmptyData = !showEmptyToggle || showEmptyToggle.checked;

            // Filter departments based on toggle state
            const filteredData = showEmptyData 
                ? departmentData  // Show all departments
                : departmentData.filter(dept => dept.has_data === true);  // Only show departments with data

            filteredData.forEach(dept => {
                const card = this.createDepartmentCard(dept);
                grid.appendChild(card);
            });

            // Bind events after rendering
            this.bindCardEvents();
        }

        createDepartmentCard(dept) {
            // Use exact template structure - Use has_data from backend
            const hasData = dept.has_data === true;
            const displayAmount = hasData && dept.amount !== null ?
                (dept.amount % 1 === 0 ? dept.amount.toFixed(0) : dept.amount.toFixed(2)) :
                '無資料';

            const unitText = this.manager.unitTranslations[dept.unit]?.display || '公噸';

            const card = document.createElement('div');
            // Use EXACT template structure from HTML
            card.className = hasData ? 'column ts-box is-raised' : 'column ts-box is-hollowed';
            card.dataset.deptId = dept.id;
            card.dataset.deptName = dept.name; // Ensure dataset is set
            card.dataset.amount = dept.amount || 0;

            if (hasData) {
                // Create has-data template safely using DOMUtils
                const headerContent = DOMUtils.createElement(card, 'div', { class: 'ts-content is-dense' });
                const headerGrid = DOMUtils.createElement(headerContent, 'div', { class: 'ts-grid' });
                
                const titleColumn = DOMUtils.createElement(headerGrid, 'div', { class: 'column is-fluid' });
                const titleDiv = DOMUtils.createElement(titleColumn, 'div', { class: 'ts-header is-truncated has-bottom-spaced-small' });
                titleDiv.textContent = DOMUtils.escapeHtml(dept.name);
                
                const buttonColumn = DOMUtils.createElement(headerGrid, 'div', { class: 'column' });
                const buttonWrap = DOMUtils.createElement(buttonColumn, 'div', { class: 'ts-wrap' });
                
                // Edit button with safe attributes
                const editBtn = DOMUtils.createElement(buttonWrap, 'button', {
                    class: 'is-end-aligned ts-button is-warning is-icon is-small dept-edit-btn',
                    'data-action': 'edit',
                    'data-dept-id': String(dept.id),
                    'data-dept-name': DOMUtils.escapeHtml(dept.name)
                });
                DOMUtils.createElement(editBtn, 'span', { class: 'ts-icon is-pencil-icon' });
                
                // Delete button with safe attributes
                const deleteBtn = DOMUtils.createElement(buttonWrap, 'button', {
                    class: 'is-end-aligned ts-button is-negative is-icon is-small dept-delete-btn',
                    'data-action': 'delete',
                    'data-dept-id': String(dept.id),
                    'data-dept-name': DOMUtils.escapeHtml(dept.name)
                });
                DOMUtils.createElement(deleteBtn, 'span', { class: 'ts-icon is-trash-can-icon' });
                
                // Amount display content
                const amountContent = DOMUtils.createElement(card, 'div', { class: 'ts-content is-center-aligned is-vertically-fitted' });
                const amountGrid = DOMUtils.createElement(amountContent, 'div', { class: 'ts-grid is-center-aligned is-middle-aligned' });
                
                const amountColumn = DOMUtils.createElement(amountGrid, 'div', { class: 'column' });
                const amountDiv = DOMUtils.createElement(amountColumn, 'div', { class: 'ts-text is-massive monospace-medium' });
                amountDiv.textContent = DOMUtils.escapeHtml(String(displayAmount));
                
                const unitColumn = DOMUtils.createElement(amountGrid, 'div', { class: 'column' });
                const unitDiv = DOMUtils.createElement(unitColumn, 'div', { class: 'ts-text is-large monospace-medium' });
                unitDiv.textContent = DOMUtils.escapeHtml(unitText);
            } else {
                // Create no-data template safely using DOMUtils
                const headerContent = DOMUtils.createElement(card, 'div', { class: 'ts-content is-dense' });
                const headerGrid = DOMUtils.createElement(headerContent, 'div', { class: 'ts-grid' });

                const titleColumn = DOMUtils.createElement(headerGrid, 'div', { class: 'column is-fluid' });
                const titleDiv = DOMUtils.createElement(titleColumn, 'div', { class: 'ts-header is-truncated has-bottom-spaced-small' });
                titleDiv.textContent = DOMUtils.escapeHtml(dept.name);
                titleDiv.style.color = 'var(--ts-gray-400)';

                const buttonColumn = DOMUtils.createElement(headerGrid, 'div', { class: 'column' });
                const buttonWrap = DOMUtils.createElement(buttonColumn, 'div', { class: 'ts-wrap' });

                // Add button with safe attributes
                const addBtn = DOMUtils.createElement(buttonWrap, 'button', {
                    class: 'is-end-aligned ts-button is-positive is-icon is-small dept-add-btn',
                    'data-action': 'add',
                    'data-dept-id': String(dept.id),
                    'data-dept-name': DOMUtils.escapeHtml(dept.name)
                });
                DOMUtils.createElement(addBtn, 'span', { class: 'ts-icon is-plus-icon' });

                // Disabled delete button
                const disabledBtn = DOMUtils.createElement(buttonWrap, 'button', {
                    class: 'is-end-aligned ts-button is-negative is-icon is-small is-disabled'
                });
                DOMUtils.createElement(disabledBtn, 'span', { class: 'ts-icon is-trash-can-icon' });

                // No data display content
                const noDataContent = DOMUtils.createElement(card, 'div', { class: 'ts-content is-center-aligned is-vertically-fitted' });
                const noDataGrid = DOMUtils.createElement(noDataContent, 'div', { class: 'ts-grid is-center-aligned is-middle-aligned' });

                const noDataColumn = DOMUtils.createElement(noDataGrid, 'div', { class: 'column' });
                const noDataDiv = DOMUtils.createElement(noDataColumn, 'div', { class: 'ts-text is-massive monospace-medium' });
                noDataDiv.textContent = '無資料';
                noDataDiv.style.color = 'var(--ts-gray-400)';
            }

            return card;
        }

        // Bind card events with proper event delegation using unique class names
        bindCardEvents() {
            // Use event delegation to handle button clicks
            const departmentGrid = document.getElementById('departmentGrid');
            if (!departmentGrid) return;

            // Remove existing delegated listeners
            if (this.cardEventHandler) {
                departmentGrid.removeEventListener('click', this.cardEventHandler);
            }

            // Add single delegated event listener
            this.cardEventHandler = (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                e.preventDefault();
                e.stopPropagation();

                const deptId = target.dataset.deptId;
                const deptName = target.dataset.deptName;
                const action = target.dataset.action;

                if (!deptId || !deptName || !action) return;

                if (action === 'add') {
                    this.prepareAddModal(deptId, deptName);
                } else if (action === 'edit') {
                    const card = target.closest('.column');
                    const amount = card ? card.dataset.amount : '';
                    this.prepareEditModal(deptId, deptName, amount);
                } else if (action === 'delete') {
                    this.manager.dataHandler.deleteSingleDepartment(deptId, deptName);
                }
            };

            departmentGrid.addEventListener('click', this.cardEventHandler);
        }

        prepareAddModal(deptId, deptName) {
            const addModalTitle = document.getElementById('addModalTitle');
            const addModalDeptName = document.getElementById('addModalDeptName');
            const addAmountInput = document.getElementById('addAmountInput');

            if (addModalTitle) addModalTitle.textContent = `新增 ${deptName} 資料`;
            if (addModalDeptName) addModalDeptName.textContent = deptName; // Display department name
            if (addAmountInput) {
                addAmountInput.value = '';
                // Update placeholder based on current waste type
                const placeholder = this.getCurrentWasteTypeUnit();
                addAmountInput.placeholder = placeholder;
            }

            // Store department info for saving
            const addModal = document.getElementById('addDataModal');
            if (addModal) {
                addModal.dataset.deptId = deptId;
                addModal.dataset.deptName = deptName;
                addModal.hidden = false;
                addModal.showModal();
            }
        }

        prepareEditModal(deptId, deptName, currentAmount) {
            const editModalTitle = document.getElementById('editModalTitle');
            const editModalDeptName = document.getElementById('editModalDeptName');
            const editAmountInput = document.getElementById('editAmountInput');

            if (editModalTitle) editModalTitle.textContent = `編輯 ${deptName} 資料`;
            if (editModalDeptName) editModalDeptName.textContent = deptName; // Display department name
            if (editAmountInput) {
                editAmountInput.value = currentAmount || '';
                // Update placeholder based on current waste type
                const placeholder = this.getCurrentWasteTypeUnit();
                editAmountInput.placeholder = placeholder;
            }

            // Store department info for saving
            const editModal = document.getElementById('editDataModal');
            if (editModal) {
                editModal.dataset.deptId = deptId;
                editModal.dataset.deptName = deptName;
                editModal.hidden = false;
                editModal.showModal();
            }
        }

        clearDepartmentCards() {
            const grid = document.getElementById('departmentGrid');
            if (grid) {
                grid.replaceChildren();
            }
        }

        // Get current waste type unit for placeholder text
        getCurrentWasteTypeUnit() {
            const wasteTypeSelect = document.getElementById('wasteTypeSelect');
            if (!wasteTypeSelect || !wasteTypeSelect.value) return '公噸'; // Default fallback
            
            const selectedWasteTypeId = parseInt(wasteTypeSelect.value);
            const wasteType = this.manager.wasteTypes.find(wt => wt.id === selectedWasteTypeId);
            
            if (wasteType && wasteType.unit) {
                // Use unit translations if available
                const translatedUnit = this.manager.unitTranslations[wasteType.unit];
                return translatedUnit && translatedUnit.display ? translatedUnit.display : wasteType.unit;
            }
            
            return '公噸'; // Default fallback
        }

        // Replace showLoadingModal with proper implementation
        showLoadingModal(title = '處理中', message = '正在處理資料，請稍候...') {
            const modal = document.getElementById('loadingModal');
            if (!modal) return;

            const loadingTitle = modal.querySelector('.ts-header');
            const loadingMessage = document.getElementById('loadingMessage');

            if (loadingTitle) loadingTitle.textContent = title;
            if (loadingMessage) loadingMessage.textContent = message;

            modal.hidden = false;
            modal.showModal();
        }

        hideLoadingModal() {
            const modal = document.getElementById('loadingModal');
            if (modal) {
                modal.close();
                modal.hidden = true;
            }
        }

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

        showErrorModal(message) {
            if (window.GlobalModalManager) {
                window.GlobalModalManager.alert('錯誤', message, 'error');
            } else {
                alert(message);
            }
        }

        showSuccessModal(message) {
            if (window.GlobalModalManager) {
                window.GlobalModalManager.alert('成功', message, 'success');
            } else {
                alert(message);
            }
        }

        showConfirmDialog(message) {
            if (window.GlobalModalManager) {
                return window.GlobalModalManager.confirm('確認', message);
            } else {
                return Promise.resolve(confirm(message));
            }
        }
    }

    class DepartmentDataHandler {
        constructor(manager) {
            this.manager = manager;
        }

        async loadDepartmentData(year, month) {
            try {
                this.manager.ui.showLoadingModal('載入中', '正在載入部門資料...');

                // Get selected waste type
                const wasteTypeSelect = document.getElementById('wasteTypeSelect');
                const wasteTypeId = wasteTypeSelect ? wasteTypeSelect.value : null;

                let url = `/management/api/department/data/?year=${year}&month=${month.toString().padStart(2, '0')}`;
                if (wasteTypeId) {
                    url += `&waste_type_id=${wasteTypeId}`;
                }

                const response = await fetch(url);
                const data = await response.json();

                this.manager.ui.hideLoadingModal();

                if (data.success) {
                    // Ensure departments is an array
                    this.manager.departmentData = Array.isArray(data.departments) ? data.departments : [];
                    
                    if (this.manager.departmentData.length === 0) {
                        // Show helpful message when no departments exist
                        this.manager.ui.showErrorModal('目前沒有部門資料。請先到「資料庫管理 (/account/database/)」設定部門和廢棄物類型。');
                    } else {
                        this.manager.ui.renderDepartmentCards(this.manager.departmentData);
                        this.manager.filterManager.applyFilters(); // Apply any active filters
                    }
                } else {
                    this.manager.ui.showErrorModal(data.error || '載入部門資料失敗');
                }
            } catch (error) {
                this.manager.ui.hideLoadingModal();
                this.manager.ui.showErrorModal('載入部門資料時發生錯誤');
            }
        }

        async saveData(isEdit) {
            const modal = isEdit ? document.getElementById('editDataModal') : document.getElementById('addDataModal');
            const input = isEdit ? document.getElementById('editAmountInput') : document.getElementById('addAmountInput');

            if (!modal || !input) {
                this.manager.ui.showErrorModal('找不到必要的表單元素');
                return;
            }

            // Validate input value
            const amountStr = input.value.trim();
            if (!amountStr) {
                this.manager.ui.showErrorModal('請輸入數量');
                return;
            }

            const amount = parseFloat(amountStr);
            if (isNaN(amount) || amount < 0) {
                this.manager.ui.showErrorModal('請輸入有效的數量');
                return;
            }

            // Get data from modal dataset
            const deptId = parseInt(modal.dataset.deptId);
            const deptName = modal.dataset.deptName;

            if (!deptId || !deptName) {
                this.manager.ui.showErrorModal('找不到部門資訊');
                return;
            }

            // Validate current year and month
            if (!this.manager.currentYear || !this.manager.currentMonth) {
                this.manager.ui.showErrorModal('請先選擇年份和月份');
                return;
            }

            const date = `${this.manager.currentYear}-${this.manager.currentMonth.toString().padStart(2, '0')}`;

            // Show loading
            this.manager.ui.showLoadingModal('儲存中', `正在${isEdit ? '更新' : '新增'}資料...`);

            try {
                // Get selected waste type
                const wasteTypeSelect = document.getElementById('wasteTypeSelect');
                const wasteTypeId = wasteTypeSelect ? wasteTypeSelect.value : null;

                const requestBody = {
                    date: date,
                    department_id: deptId,
                    amount: amount
                };

                if (wasteTypeId) {
                    requestBody.waste_type_id = wasteTypeId;
                }

                const response = await fetch('/management/api/department/save/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.manager.csrfToken
                    },
                    body: JSON.stringify(requestBody)
                });

                const result = await response.json();

                this.manager.ui.hideLoadingModal();
                modal.close();
                modal.hidden = true;

                if (result.success) {
                    this.manager.ui.showSuccessModal(`${isEdit ? '更新' : '新增'}資料成功`);

                    // Reload department data
                    await this.loadDepartmentData(this.manager.currentYear, this.manager.currentMonth);

                    // Refresh month status
                    await this.manager.loadYearStatus();

                    // Ensure current month selection is maintained
                    this.manager.ui.updateMonthSelection(this.manager.currentMonth);

                    // Restore sort and filter state after data reload
                    this.manager.filterManager.restoreSortState();
                    this.manager.filterManager.applyFilters();
                } else {
                    this.manager.ui.showErrorModal(result.error || '儲存失敗');
                }
            } catch (error) {
                this.manager.ui.hideLoadingModal();
                this.manager.ui.showErrorModal('儲存資料時發生錯誤');
            }
        }

        async deleteSingleDepartment(deptId, deptName) {
            // Use new parameter structure
            const confirmed = await this.manager.ui.showConfirmDialog(`確定要刪除 ${deptName} 的資料嗎？`);

            if (!confirmed) return;

            if (!this.manager.currentYear || !this.manager.currentMonth) {
                this.manager.ui.showErrorModal('請先選擇年份和月份');
                return;
            }

            const date = `${this.manager.currentYear}-${this.manager.currentMonth.toString().padStart(2, '0')}`;

            // Show loading
            this.manager.ui.showLoadingModal('刪除中', '正在刪除資料...');

            try {
                const response = await fetch('/management/api/department/delete/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.manager.csrfToken
                    },
                    body: JSON.stringify({
                        start_date: date,
                        end_date: date,
                        department_ids: [parseInt(deptId)]
                    })
                });

                const result = await response.json();

                this.manager.ui.hideLoadingModal();

                if (result.success) {
                    this.manager.ui.showSuccessModal('刪除資料成功');

                    // Reload department data
                    await this.loadDepartmentData(this.manager.currentYear, this.manager.currentMonth);

                    // Refresh month status
                    await this.manager.loadYearStatus();

                    // Ensure current month selection is maintained
                    this.manager.ui.updateMonthSelection(this.manager.currentMonth);

                    // Restore sort and filter state after data reload
                    this.manager.filterManager.restoreSortState();
                    this.manager.filterManager.applyFilters();
                } else {
                    this.manager.ui.showErrorModal(result.error || '刪除失敗');
                }
            } catch (error) {
                this.manager.ui.hideLoadingModal();
                this.manager.ui.showErrorModal('刪除資料時發生錯誤');
            }
        }

        async handleBulkDelete() {
            const startDate = document.getElementById('deleteStartDate');
            const endDate = document.getElementById('deleteEndDate');
            const confirmText = document.getElementById('bulkDeleteConfirmInput');

            if (!startDate || !endDate || !confirmText) {
                this.manager.ui.showErrorModal('找不到必要的輸入欄位');
                return;
            }

            const requiredText = '我很清楚我目前正在做的事情，而我也願意承擔任何後果。';

            if (!startDate.value || !endDate.value) {
                this.manager.ui.showErrorModal('請輸入刪除日期範圍');
                return;
            }

            if (confirmText.value.trim() !== requiredText) {
                this.manager.ui.showErrorModal('確認文字輸入錯誤');
                return;
            }

            // Show loading
            this.manager.ui.showLoadingModal('刪除中', '正在執行批次刪除...');

            try {
                const requestBody = {
                    start_date: startDate.value,
                    end_date: endDate.value,
                    department_ids: this.manager.selectedDepartments ? Array.from(this.manager.selectedDepartments) : null
                };

                // Add waste_type_id if available
                if (this.manager.currentWasteTypeId) {
                    requestBody.waste_type_id = this.manager.currentWasteTypeId;
                }

                const response = await fetch('/management/api/department/delete/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.manager.csrfToken
                    },
                    body: JSON.stringify(requestBody)
                });

                const result = await response.json();

                this.manager.ui.hideLoadingModal();

                const deleteModal = document.getElementById('deleteModal');
                if (deleteModal) {
                    deleteModal.close();
                    deleteModal.hidden = true;
                }

                if (result.success) {
                    this.manager.ui.showSuccessModal(`成功刪除 ${result.deleted_count} 筆記錄`);

                    // Reload data
                    if (this.manager.currentMonth) {
                        await this.loadDepartmentData(this.manager.currentYear, this.manager.currentMonth);
                    }
                    await this.manager.loadYearStatus();

                    // Ensure current month selection is maintained
                    if (this.manager.currentMonth) {
                        this.manager.ui.updateMonthSelection(this.manager.currentMonth);
                    }

                    // Restore sort and filter state after data reload
                    this.manager.filterManager.restoreSortState();
                    this.manager.filterManager.applyFilters();
                } else {
                    this.manager.ui.showErrorModal(result.error || '刪除失敗');
                }
            } catch (error) {
                this.manager.ui.hideLoadingModal();
                this.manager.ui.showErrorModal('批次刪除時發生錯誤');
            }
        }
    }

    class DepartmentFilterManager {
        constructor(manager) {
            this.manager = manager;
            this.activeSort = 'desc'; // Default to descending order
            this.hasActiveFilters = false;
        }

        bindEvents() {
            // Search input with real-time update
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', this.debounce(() => {
                    this.applyFilters();
                    this.updateFilterStatus();
                }, 300));
            }

            // Range filters with real-time update
            const minRange = document.getElementById('minRange');
            const maxRange = document.getElementById('maxRange');

            if (minRange) {
                minRange.addEventListener('input', () => {
                    this.applyFilters();
                    this.updateFilterStatus();
                });
            }

            if (maxRange) {
                maxRange.addEventListener('input', () => {
                    this.applyFilters();
                    this.updateFilterStatus();
                });
            }

            // Clear filters
            const clearBtn = document.getElementById('clearFiltersBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearFilters());
            }

            // Sort buttons
            const sortAscBtn = document.getElementById('sortAscBtn');
            const sortDescBtn = document.getElementById('sortDescBtn');

            if (sortAscBtn) {
                sortAscBtn.addEventListener('click', () => this.sortDepartments('asc'));
            }

            if (sortDescBtn) {
                sortDescBtn.addEventListener('click', () => this.sortDepartments('desc'));
            }

            // Set initial sort state to descending
            this.updateSortButtons();
        }

        updateSortButtons() {
            const sortAscBtn = document.getElementById('sortAscBtn');
            const sortDescBtn = document.getElementById('sortDescBtn');

            if (sortAscBtn) sortAscBtn.classList.remove('has-filter-index');
            if (sortDescBtn) sortDescBtn.classList.remove('has-filter-index');

            if (this.activeSort === 'asc' && sortAscBtn) {
                sortAscBtn.classList.add('has-filter-index');
            } else if (this.activeSort === 'desc' && sortDescBtn) {
                sortDescBtn.classList.add('has-filter-index');
            }
        }

        restoreSortState() {
            if (this.activeSort) {
                this.sortDepartments(this.activeSort, false); // Don't toggle, just apply
            }
        }

        applyFilters() {
            const searchInput = document.getElementById('searchInput');
            const minRangeInput = document.getElementById('minRange');
            const maxRangeInput = document.getElementById('maxRange');

            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const minRange = minRangeInput ? parseFloat(minRangeInput.value) || 0 : 0;
            const maxRange = maxRangeInput ? parseFloat(maxRangeInput.value) || Infinity : Infinity;

            const cards = document.querySelectorAll('#departmentGrid .column');
            let visibleCount = 0;

            cards.forEach(card => {
                // Check if deptName exists before using toLowerCase
                const deptName = card.dataset.deptName;
                if (!deptName) {
                    // card.style.display = 'none';
                    return;
                }

                const deptNameLower = deptName.toLowerCase();
                const amount = parseFloat(card.dataset.amount) || 0;

                const matchesSearch = !searchTerm || deptNameLower.includes(searchTerm);
                const matchesRange = amount >= minRange && amount <= maxRange;

                if (matchesSearch && matchesRange) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });
        }

        updateFilterStatus() {
            const searchInput = document.getElementById('searchInput');
            const minRangeInput = document.getElementById('minRange');
            const maxRangeInput = document.getElementById('maxRange');

            const searchTerm = searchInput ? searchInput.value.trim() : '';
            const minRange = minRangeInput ? minRangeInput.value.trim() : '';
            const maxRange = maxRangeInput ? maxRangeInput.value.trim() : '';

            this.hasActiveFilters = searchTerm || minRange || maxRange;

            // Update filter button appearance
            const filterBtn = document.querySelector('.ts-button.is-filter[data-dropdown="filterDropdown"]');
            if (filterBtn) {
                if (this.hasActiveFilters) {
                    filterBtn.classList.add('has-filter-index');
                } else {
                    filterBtn.classList.remove('has-filter-index');
                }
            }
        }

        clearFilters() {
            const searchInput = document.getElementById('searchInput');
            const minRangeInput = document.getElementById('minRange');
            const maxRangeInput = document.getElementById('maxRange');

            if (searchInput) searchInput.value = '';
            if (minRangeInput) minRangeInput.value = '';
            if (maxRangeInput) maxRangeInput.value = '';

            // Don't reset sort when clearing filters - preserve sort state
            // Show all cards
            const cards = document.querySelectorAll('#departmentGrid .column');
            cards.forEach(card => {
                card.style.display = '';
            });

            this.updateFilterStatus();

            // Reapply current sort
            if (this.activeSort) {
                this.sortDepartments(this.activeSort, false);
            }
        }

        sortDepartments(direction, toggle = true) {
            const sortBtn = document.getElementById(`sort${direction === 'asc' ? 'Asc' : 'Desc'}Btn`);
            if (!sortBtn) return;

            // Always set the requested sort direction
            this.activeSort = direction;
            this.updateSortButtons();

            // Ensure departmentData is an array before sorting
            if (!Array.isArray(this.manager.departmentData)) {
                console.warn('departmentData is not an array, cannot sort');
                return;
            }

            // Sort departments
            const sortedData = [...this.manager.departmentData].sort((a, b) => {
                const amountA = parseFloat(a.amount) || 0;
                const amountB = parseFloat(b.amount) || 0;
                return direction === 'asc' ? amountA - amountB : amountB - amountA;
            });

            this.manager.ui.renderDepartmentCards(sortedData);
            this.applyFilters();
        }

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    }

    class DepartmentExportManager {
        constructor(manager) {
            this.manager = manager;
        }

        handleExport() {
            if (!this.manager.currentMonth) {
                this.manager.ui.showErrorModal('請先選擇月份');
                return;
            }

            const exportTypeSelect = document.querySelector('#exportCurrentDate .export-type-select');
            const exportFormatSelect = document.querySelector('#exportCurrentDate .export-format-select');

            const exportType = exportTypeSelect ? exportTypeSelect.value : '前10筆';
            const exportFormat = exportFormatSelect ? exportFormatSelect.value : 'Excel';

            // Get filtered and sorted data based on current user settings
            let dataToExport = this.getFilteredAndSortedData();

            // Apply export type selection
            if (exportType === '前10筆') {
                dataToExport = dataToExport.slice(0, 10);
            }
            // For '全部資料', use all filtered data

            if (dataToExport.length === 0) {
                this.manager.ui.showErrorModal('目前篩選條件下沒有資料可匯出');
                return;
            }

            if (exportFormat === 'Excel') {
                this.exportToExcel(dataToExport, exportType);
            } else if (exportFormat === 'PDF') {
                this.exportToPDF(dataToExport, exportType);
            }

            // Properly close export dropdown after successful export
            const exportDropdown = document.getElementById('exportCurrentDateDropdown');
            if (exportDropdown) {
                // Force close dropdown by removing focus and triggering blur
                document.activeElement.blur();
                exportDropdown.style.display = 'none';

                // Reset dropdown state after a short delay
                setTimeout(() => {
                    exportDropdown.style.display = '';
                }, 100);
            }
        }

        // Get data that matches current filter and sort settings including "Show Empty Data" toggle
        getFilteredAndSortedData() {
            const searchInput = document.getElementById('searchInput');
            const minRangeInput = document.getElementById('minRange');
            const maxRangeInput = document.getElementById('maxRange');
            const showEmptyToggle = document.getElementById('showEmptyDataToggle');

            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            const minRange = minRangeInput ? parseFloat(minRangeInput.value) || 0 : 0;
            const maxRange = maxRangeInput ? parseFloat(maxRangeInput.value) || Infinity : Infinity;
            const showEmptyData = !showEmptyToggle || showEmptyToggle.checked;

            // Ensure departmentData is an array before filtering
            if (!Array.isArray(this.manager.departmentData)) {
                console.warn('departmentData is not an array, cannot filter');
                return [];
            }

            // Start with data based on "Show Empty Data" toggle
            let filteredData = showEmptyData 
                ? this.manager.departmentData  // Show all departments
                : this.manager.departmentData.filter(dept => dept.has_data);  // Only departments with data

            // Apply search filter
            if (searchTerm) {
                filteredData = filteredData.filter(dept =>
                    dept.name.toLowerCase().includes(searchTerm)
                );
            }

            // Apply range filter
            filteredData = filteredData.filter(dept => {
                const amount = parseFloat(dept.amount) || 0;
                return amount >= minRange && amount <= maxRange;
            });

            // Apply current sort order
            const activeSort = this.manager.filterManager.activeSort;
            if (activeSort) {
                filteredData.sort((a, b) => {
                    const amountA = parseFloat(a.amount) || 0;
                    const amountB = parseFloat(b.amount) || 0;
                    return activeSort === 'asc' ? amountA - amountB : amountB - amountA;
                });
            }

            return filteredData;
        }

        exportToExcel(data, exportType) {
            // Use SheetJS from base.html - Proper implementation
            if (typeof XLSX === 'undefined') {
                this.manager.ui.showErrorModal('Excel匯出功能不可用');
                return;
            }

            const wb = XLSX.utils.book_new();

            // Prepare data for worksheet - Revert to original format
            const wsData = [];

            // Add headers - Back to original three columns
            wsData.push(['部門名稱', '數量', '單位']);

            // Add data rows - Show "無資料" for departments without data
            data.forEach(dept => {
                const hasData = dept.has_data === true;
                const displayAmount = hasData && dept.amount !== null ? dept.amount : '無資料';
                
                wsData.push([
                    dept.name,
                    displayAmount,
                    this.manager.unitTranslations[dept.unit]?.display || '公噸'
                ]);
            });

            // Create worksheet
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Set column widths
            ws['!cols'] = [
                { width: 30 }, // Department name
                { width: 15 }, // Amount
                { width: 10 }  // Unit
            ];

            // Add worksheet to workbook
            const sheetName = `${this.manager.currentYear}年${this.manager.currentMonth}月_${exportType}`;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            // Generate filename
            const filename = `部門廢棄物_${this.manager.currentYear}年${this.manager.currentMonth}月_${exportType}.xlsx`;

            // Save file
            XLSX.writeFile(wb, filename);

            this.manager.ui.showSuccessModal('Excel匯出完成');
        }

        exportToPDF(data, exportType) {
            // Use pdfmake from base.html - Proper implementation with correct font
            if (typeof pdfMake === 'undefined') {
                this.manager.ui.showErrorModal('PDF匯出功能不可用');
                return;
            }

            // Configure pdfMake fonts with Noto Sans TC
            pdfMake.fonts = {
                'NotoSansTC': {
                    normal: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-400-normal.ttf',
                    bold: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-tc@latest/chinese-traditional-700-normal.ttf'
                }
            };

            // Prepare table body - Revert to original three columns
            const tableBody = [
                ['部門名稱', '數量', '單位'] // Back to original headers
            ];

            data.forEach(dept => {
                const hasData = dept.has_data === true;
                const displayAmount = hasData && dept.amount !== null ? dept.amount.toString() : '無資料';
                
                tableBody.push([
                    dept.name,
                    displayAmount,
                    this.manager.unitTranslations[dept.unit]?.display || '公噸'
                ]);
            });

            const docDefinition = {
                content: [
                    {
                        text: `部門廢棄物資料 - ${this.manager.currentYear}年${this.manager.currentMonth}月 (${exportType})`,
                        style: 'header',
                        alignment: 'center',
                        margin: [0, 0, 0, 20]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['*', 'auto', 'auto'],
                            body: tableBody
                        },
                        style: 'table'
                    }
                ],
                styles: {
                    header: {
                        fontSize: 16,
                        bold: true
                    },
                    table: {
                        margin: [0, 5, 0, 15],
                        fontSize: 10
                    }
                },
                defaultStyle: {
                    font: 'NotoSansTC' // Use correct font name
                }
            };

            const filename = `部門廢棄物_${this.manager.currentYear}年${this.manager.currentMonth}月_${exportType}.pdf`;
            pdfMake.createPdf(docDefinition).download(filename);

            this.manager.ui.showSuccessModal('PDF匯出完成');
        }
    }

    // Initialize the main manager and make it globally available
    window.departmentManager = new DepartmentManager();
});