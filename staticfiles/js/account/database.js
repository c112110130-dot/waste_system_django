// Database Management JavaScript - Following project design patterns
document.addEventListener('DOMContentLoaded', () => {
    window.databaseManager = new DatabaseManager();
    window.databaseManager.initialize();
});

class DatabaseManager {
    constructor() {
        this.wasteTypes = [];
        this.departments = [];
        this.editingWasteTypeId = null;
        this.editingDepartmentId = null;
    }
    
    async initialize() {
        try {
            await this.loadData();
            this.bindEvents();
            console.log('Database management initialized');
        } catch (error) {
            console.error('Failed to initialize:', error);
            NotificationUtils.showAlert('錯誤', '系統初始化失敗，請重新整理頁面', 'error');
        }
    }
    
    async loadData() {
        try {
            const response = await fetch('/account/api/database/data/');
            const result = await response.json();
            
            if (result.success) {
                this.wasteTypes = result.data.waste_types;
                this.departments = result.data.departments;
                this.renderWasteTypes();
                this.renderDepartments();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            NotificationUtils.showAlert('錯誤', `載入資料失敗: ${error.message}`, 'error');
        }
    }
    
    async refreshWasteTypeData() {
        try {
            const response = await fetch('/account/api/database/data/');
            const result = await response.json();
            
            if (result.success) {
                // Store current UI state
                const selectedCheckboxes = Array.from(document.querySelectorAll('.waste-type-table tbody input[type="checkbox"]:checked')).map(cb => cb.value);
                
                // Update data
                this.wasteTypes = result.data.waste_types;
                this.departments = result.data.departments;
                
                // Re-render
                this.renderWasteTypes();
                this.renderDepartments();
                
                // Restore checkbox selections
                selectedCheckboxes.forEach(value => {
                    const checkbox = document.querySelector(`.waste-type-table tbody input[value="${value}"]`);
                    if (checkbox) checkbox.checked = true;
                });
                
                this.updateWasteTypeButtons();
                
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            NotificationUtils.showAlert('錯誤', `更新資料失敗: ${error.message}`, 'error');
        }
    }
    
    renderWasteTypes() {
        const tbody = document.querySelector('.waste-type-table tbody');
        if (!tbody) return;

        tbody.replaceChildren();
        
        if (this.wasteTypes.length === 0) {
            this.showWasteTypeEmptyState();
            return;
        }
        
        this.hideWasteTypeEmptyState();
        
        this.wasteTypes.forEach(wasteType => {
            const row = this.createWasteTypeRow(wasteType);
            tbody.appendChild(row);
        });
        
        this.updateWasteTypeButtons();
        this.bindWasteTypeMasterCheckbox();
    }
    
    createWasteTypeRow(wasteType) {
        const row = document.createElement('tr');
        row.dataset.id = wasteType.id;
        
        if (this.editingWasteTypeId === wasteType.id) {
            row.innerHTML = this.createEditingWasteTypeRowHTML(wasteType);
        } else {
            row.innerHTML = this.createNormalWasteTypeRowHTML(wasteType);
        }
        
        return row;
    }
    
    createNormalWasteTypeRowHTML(wasteType) {
        return `
            <td class="checkbox-cell">
                <label class="ts-checkbox is-solo is-large">
                    <input type="checkbox" value="${wasteType.id}">
                </label>
            </td>
            <td>${DOMUtils.escapeHtml(wasteType.name)}</td>
            <td class="unit-cell">${wasteType.unit_display}</td>
            <td class="action-cell">
                <button class="ts-button is-warning is-start-icon btn-edit-waste-type" data-id="${wasteType.id}">
                    <span class="ts-icon is-pencil-icon"></span>
                    編輯
                </button>
            </td>
        `;
    }
    
    createEditingWasteTypeRowHTML(wasteType) {
        return `
            <td class="checkbox-cell">
                <label class="ts-checkbox is-solo is-large">
                    <input type="checkbox" disabled>
                </label>
            </td>
            <td>
                <div class="ts-input is-solid is-fluid">
                    <input type="text" class="edit-name" value="${DOMUtils.escapeHtml(wasteType.name)}" 
                           placeholder="輸入廢棄物種類名稱，用 ; 分隔可以一次新增多個">
                </div>
            </td>
            <td>
                <div class="ts-select is-solid is-fluid">
                    <select class="edit-unit">
                        <option value="metric_ton" ${wasteType.unit === 'metric_ton' ? 'selected' : ''}>公噸</option>
                        <option value="kilogram" ${wasteType.unit === 'kilogram' ? 'selected' : ''}>公斤</option>
                    </select>
                </div>
            </td>
            <td class="ts-wrap">
                <button type="button" class="ts-button is-positive is-icon btn-save-waste-type">
                    <span class="ts-icon is-check-icon"></span>
                </button>
                <button type="button" class="ts-button is-negative is-icon btn-cancel-waste-type">
                    <span class="ts-icon is-xmark-icon"></span>
                </button>
            </td>
        `;
    }
    
    renderDepartments() {
        const tbody = document.querySelector('.department-table tbody');
        if (!tbody) return;
        
        console.log('renderDepartments called with departments:', this.departments.length, this.departments);

        tbody.replaceChildren();
        
        if (this.departments.length === 0) {
            this.showDepartmentEmptyState();
            this.updateDepartmentButtons();
            return;
        }
        
        this.hideDepartmentEmptyStates();
        
        this.departments.forEach((department, index) => {
            console.log(`Adding department row ${index + 1}:`, department.name, `(ID: ${department.id})`);
            const row = this.createDepartmentRow(department);
            tbody.appendChild(row);
        });
        
        // Verify how many rows were actually added
        const actualRows = tbody.querySelectorAll('tr').length;
        console.log(`Rendered ${actualRows} department rows, expected ${this.departments.length}`);
        
        this.updateDepartmentButtons();
        this.bindDepartmentMasterCheckbox();
    }
    
    createDepartmentRow(department) {
        const row = document.createElement('tr');
        row.dataset.id = department.id;
        
        if (this.editingDepartmentId === department.id) {
            row.innerHTML = this.createEditingDepartmentRowHTML(department);
        } else {
            row.innerHTML = this.createNormalDepartmentRowHTML(department);
        }
        
        return row;
    }
    
    createNormalDepartmentRowHTML(department) {
        return `
            <td class="checkbox-cell">
                <label class="ts-checkbox is-solo is-large">
                    <input type="checkbox" value="${department.id}">
                </label>
            </td>
            <td>${DOMUtils.escapeHtml(department.name)}</td>
            <td class="action-cell">
                <button class="ts-button is-warning is-start-icon btn-edit-department" data-id="${department.id}">
                    <span class="ts-icon is-pencil-icon"></span>
                    編輯
                </button>
            </td>
        `;
    }
    
    createEditingDepartmentRowHTML(department) {
        return `
            <td class="checkbox-cell">
                <label class="ts-checkbox is-solo is-large">
                    <input type="checkbox" disabled>
                </label>
            </td>
            <td>
                <div class="ts-input is-solid is-fluid">
                    <input type="text" class="edit-name" value="${DOMUtils.escapeHtml(department.name)}" 
                           placeholder="輸入部門名稱，用 ; 分隔可以一次新增多個部門">
                </div>
            </td>
            <td class="ts-wrap">
                <button type="button" class="ts-button is-positive is-icon btn-save-department">
                    <span class="ts-icon is-check-icon"></span>
                </button>
                <button type="button" class="ts-button is-negative is-icon btn-cancel-department">
                    <span class="ts-icon is-xmark-icon"></span>
                </button>
            </td>
        `;
    }
    
    bindEvents() {
        // Waste type events
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-add-waste-type')) {
                this.startAddWasteType();
            } else if (e.target.closest('.btn-delete-waste-types')) {
                this.deleteSelectedWasteTypes();
            } else if (e.target.closest('.btn-edit-waste-type')) {
                const id = parseInt(e.target.closest('.btn-edit-waste-type').dataset.id);
                this.startEditWasteType(id);
            } else if (e.target.closest('.btn-save-waste-type')) {
                this.saveWasteType();
            } else if (e.target.closest('.btn-cancel-waste-type')) {
                this.cancelEditWasteType();
            // Department management events
            } else if (e.target.closest('.btn-add-department')) {
                this.startAddDepartment();
            } else if (e.target.closest('.btn-delete-departments')) {
                this.deleteSelectedDepartments();
                
            } else if (e.target.closest('.btn-edit-department')) {
                const id = parseInt(e.target.closest('.btn-edit-department').dataset.id);
                console.log('Edit department clicked, id:', id);
                this.startEditDepartment(id);
            } else if (e.target.closest('.btn-save-department')) {
                this.saveDepartment();
            } else if (e.target.closest('.btn-cancel-department')) {
                this.cancelEditDepartment();
            }
        });
        
        // Checkbox events
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                if (e.target.closest('.waste-type-table')) {
                    this.updateWasteTypeButtons();
                } else if (e.target.closest('.department-table')) {
                    this.updateDepartmentButtons();
                }
            }
        });
        
        // Search events
        const wasteTypeSearch = document.querySelector('input[placeholder*="搜尋廢棄物種類"]');
        if (wasteTypeSearch) {
            wasteTypeSearch.addEventListener('input', (e) => {
                this.searchWasteTypes(e.target.value);
            });
        }
        
        const departmentSearch = document.querySelector('input[placeholder*="搜尋部門"]');
        if (departmentSearch) {
            departmentSearch.addEventListener('input', (e) => {
                this.searchDepartments(e.target.value);
            });
        }
    }
    
    
    startAddWasteType() {
        this.cancelEditWasteType(); // Cancel any existing edits
        
        // Create a new row for adding using safe DOM manipulation
        const tbody = document.querySelector('.waste-type-table tbody');
        const newRow = document.createElement('tr');
        newRow.dataset.id = 'new';
        
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
        
        // Create name input cell
        const nameCell = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'ts-input is-solid is-fluid';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'edit-name';
        nameInput.placeholder = '輸入廢棄物種類名稱，用 ; 分隔可以一次新增多個';
        nameDiv.appendChild(nameInput);
        nameCell.appendChild(nameDiv);
        
        // Create unit select cell
        const unitCell = document.createElement('td');
        const unitDiv = document.createElement('div');
        unitDiv.className = 'ts-select is-solid is-fluid';
        const unitSelect = document.createElement('select');
        unitSelect.className = 'edit-unit';
        
        const option1 = document.createElement('option');
        option1.value = 'metric_ton';
        option1.textContent = '公噸';
        const option2 = document.createElement('option');
        option2.value = 'kilogram';
        option2.textContent = '公斤';
        
        unitSelect.appendChild(option1);
        unitSelect.appendChild(option2);
        unitDiv.appendChild(unitSelect);
        unitCell.appendChild(unitDiv);
        
        // Create action cell
        const actionCell = document.createElement('td');
        actionCell.className = 'ts-wrap';
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'ts-button is-positive is-icon btn-save-waste-type';
        const saveIcon = document.createElement('span');
        saveIcon.className = 'ts-icon is-check-icon';
        saveButton.appendChild(saveIcon);
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'ts-button is-negative is-icon btn-cancel-waste-type';
        const cancelIcon = document.createElement('span');
        cancelIcon.className = 'ts-icon is-xmark-icon';
        cancelButton.appendChild(cancelIcon);
        
        actionCell.appendChild(saveButton);
        actionCell.appendChild(cancelButton);
        
        // Append all cells to row
        newRow.appendChild(checkboxCell);
        newRow.appendChild(nameCell);
        newRow.appendChild(unitCell);
        newRow.appendChild(actionCell);
        
        tbody.insertBefore(newRow, tbody.firstChild);
        
        // Focus on the name input
        const focusNameInput = newRow.querySelector('.edit-name');
        if (focusNameInput) focusNameInput.focus();
        
        this.editingWasteTypeId = 'new';
        this.updateWasteTypeButtons();
    }
    
    startEditWasteType(id) {
        this.cancelEditWasteType(); // Cancel any existing edits
        this.editingWasteTypeId = id;
        this.renderWasteTypes();
    }
    
    cancelEditWasteType() {
        this.editingWasteTypeId = null;
        
        // Remove any 'new' rows
        const newRow = document.querySelector('.waste-type-table tbody tr[data-id="new"]');
        if (newRow) {
            newRow.remove();
        }
        
        this.renderWasteTypes();
        // Force button update after cancel
        this.updateWasteTypeButtons();
        
        // If no waste types exist, show empty state but keep table
        if (this.wasteTypes.length === 0) {
            this.showWasteTypeEmptyState();
        } else {
            this.hideWasteTypeEmptyState();
        }
    }
    
    async saveWasteType() {
        try {
            const editingRow = document.querySelector('.waste-type-table tbody tr .btn-save-waste-type').closest('tr');
            const editNameInput = editingRow.querySelector('.edit-name');
            const unitSelect = editingRow.querySelector('.edit-unit');
            
            const name = editNameInput.value.trim();
            const unit = unitSelect.value;
            
            if (!name) {
                NotificationUtils.showAlert('錯誤', '請輸入廢棄物種類名稱', 'error');
                editNameInput.focus();
                return;
            }
            
            const payload = { name: name, unit: unit };
            
            if (this.editingWasteTypeId !== 'new') {
                payload.id = this.editingWasteTypeId;
            }
            
            const response = await fetch('/account/api/database/waste-type/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.success) {
                NotificationUtils.showAlert('成功', result.message, 'success');
                
                // Store the editing mode before clearing it
                const wasNewItem = this.editingWasteTypeId === 'new';
                this.editingWasteTypeId = null;
                
                // Only reload data for creating new items, not editing existing ones
                if (wasNewItem) {
                    await this.loadData();
                } else {
                    // For updates, just refresh the data without losing UI state
                    await this.refreshWasteTypeData();
                }
            } else {
                NotificationUtils.showAlert('錯誤', `儲存失敗: ${result.error}`, 'error');
            }
            
        } catch (error) {
            NotificationUtils.showAlert('錯誤', `儲存失敗: ${error.message}`, 'error');
        }
    }
    
    deleteSelectedWasteTypes() {
        const selected = this.getSelectedWasteTypeIds();
        if (selected.length === 0) {
            NotificationUtils.showAlert('錯誤', '請選擇要刪除的廢棄物種類', 'error');
            return;
        }
        
        NotificationUtils.showConfirm('確認刪除', `確定要刪除選定的 ${selected.length} 個廢棄物種類嗎？此操作無法復原。`, async () => {
            try {
                const response = await fetch('/account/api/database/waste-type/delete/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({ ids: selected })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    NotificationUtils.showAlert('成功', result.message, 'success');
                    await this.loadData();
                } else {
                    NotificationUtils.showAlert('錯誤', `刪除失敗: ${result.error}`, 'error');
                }
                
            } catch (error) {
                NotificationUtils.showAlert('錯誤', `刪除失敗: ${error.message}`, 'error');
            }
        });
    }
    
    // Department methods
    startAddDepartment() {
        
        this.cancelEditDepartment(); // Cancel any existing edits
        
        // Create a new row for adding using safe DOM manipulation
        const tbody = document.querySelector('.department-table tbody');
        const newRow = document.createElement('tr');
        newRow.dataset.id = 'new';
        
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
        
        // Create name input cell
        const nameCell = document.createElement('td');
        const nameDiv = document.createElement('div');
        nameDiv.className = 'ts-input is-solid is-fluid';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'edit-name';
        nameInput.placeholder = '輸入部門名稱，用 ; 分隔可以一次新增多個部門';
        nameDiv.appendChild(nameInput);
        nameCell.appendChild(nameDiv);
        
        // Create action cell
        const actionCell = document.createElement('td');
        actionCell.className = 'ts-wrap';
        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'ts-button is-positive is-icon btn-save-department';
        const saveIcon = document.createElement('span');
        saveIcon.className = 'ts-icon is-check-icon';
        saveButton.appendChild(saveIcon);
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'ts-button is-negative is-icon btn-cancel-department';
        const cancelIcon = document.createElement('span');
        cancelIcon.className = 'ts-icon is-xmark-icon';
        cancelButton.appendChild(cancelIcon);
        
        actionCell.appendChild(saveButton);
        actionCell.appendChild(cancelButton);
        
        // Append all cells to row
        newRow.appendChild(checkboxCell);
        newRow.appendChild(nameCell);
        newRow.appendChild(actionCell);
        
        tbody.insertBefore(newRow, tbody.firstChild);
        
        // Focus on the name input
        const focusNameInput = newRow.querySelector('.edit-name');
        if (focusNameInput) focusNameInput.focus();
        
        this.editingDepartmentId = 'new';
        this.updateDepartmentButtons();
    }
    
    startEditDepartment(id) {
        console.log('startEditDepartment called with id:', id);
        this.cancelEditDepartment(); // Cancel any existing edits
        this.editingDepartmentId = id;
        console.log('editingDepartmentId set to:', this.editingDepartmentId);
        this.renderDepartments();
    }
    
    cancelEditDepartment() {
        this.editingDepartmentId = null;
        
        // Remove any 'new' rows
        const newRow = document.querySelector('.department-table tbody tr[data-id="new"]');
        if (newRow) {
            newRow.remove();
        }
        
        this.renderDepartments();
        // Force button update after cancel
        this.updateDepartmentButtons();
        
        // Show appropriate state based on departments
        if (this.departments.length === 0) {
            this.showDepartmentEmptyState();
        } else {
            this.hideDepartmentEmptyStates();
        }
    }
    
    async saveDepartment() {
        try {
            const editingRow = document.querySelector('.department-table tbody tr .btn-save-department').closest('tr');
            const nameInput = editingRow.querySelector('.edit-name');
            
            const name = nameInput.value.trim();
            
            if (!name) {
                NotificationUtils.showAlert('錯誤', '請輸入部門名稱', 'error');
                nameInput.focus();
                return;
            }
            
            const payload = { name: name };
            
            if (this.editingDepartmentId !== 'new') {
                payload.id = this.editingDepartmentId;
            }
            
            const response = await fetch('/account/api/database/department/save/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            if (result.success) {
                NotificationUtils.showAlert('成功', result.message, 'success');
                
                // Store the editing mode before clearing it
                const wasNewItem = this.editingDepartmentId === 'new';
                this.editingDepartmentId = null;
                
                // Reload all data for both new and existing items
                await this.loadData();
            } else {
                NotificationUtils.showAlert('錯誤', `儲存失敗: ${result.error}`, 'error');
            }
            
        } catch (error) {
            NotificationUtils.showAlert('錯誤', `儲存失敗: ${error.message}`, 'error');
        }
    }
    
    deleteSelectedDepartments() {
        const selected = this.getSelectedDepartmentIds();
        if (selected.length === 0) {
            NotificationUtils.showAlert('錯誤', '請選擇要刪除的部門', 'error');
            return;
        }
        
        NotificationUtils.showConfirm('確認刪除', `確定要刪除選定的 ${selected.length} 個部門嗎？此操作無法復原。`, async () => {
            try {
                const response = await fetch('/account/api/database/department/delete/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({ 
                        ids: selected
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    NotificationUtils.showAlert('成功', result.message, 'success');
                    await this.loadData();
                } else {
                    NotificationUtils.showAlert('錯誤', `刪除失敗: ${result.error}`, 'error');
                }
                
            } catch (error) {
                NotificationUtils.showAlert('錯誤', `刪除失敗: ${error.message}`, 'error');
            }
        });
    }
    
    // Utility methods
    getSelectedWasteTypeIds() {
        const checkboxes = document.querySelectorAll('.waste-type-table tbody input[type="checkbox"]:checked:not([disabled])');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    getSelectedDepartmentIds() {
        const checkboxes = document.querySelectorAll('.department-table tbody input[type="checkbox"]:checked:not([disabled])');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }
    
    updateWasteTypeButtons() {
        const selected = this.getSelectedWasteTypeIds();
        const hasSelection = selected.length > 0;
        
        console.log('updateWasteTypeButtons:', {
            selectedIds: selected,
            hasSelection: hasSelection,
            editingWasteTypeId: this.editingWasteTypeId
        });
        
        // Apply the same logic as department buttons: add and delete are mutually exclusive
        const canManageWasteTypes = !this.editingWasteTypeId;
        
        document.querySelectorAll('.btn-add-waste-type').forEach(btn => {
            btn.style.display = canManageWasteTypes && !hasSelection ? 'inline-flex' : 'none';
        });
        
        document.querySelectorAll('.btn-delete-waste-types').forEach(btn => {
            btn.style.display = canManageWasteTypes && hasSelection ? 'inline-flex' : 'none';
        });
    }
    
    updateDepartmentButtons() {
        const selected = this.getSelectedDepartmentIds();
        const hasSelection = selected.length > 0;
        
        // Can manage departments when not editing
        const canManageDepartments = !this.editingDepartmentId;
        
        document.querySelectorAll('.btn-add-department').forEach(btn => {
            btn.style.display = canManageDepartments && !hasSelection ? 'inline-flex' : 'none';
        });
        
        document.querySelectorAll('.btn-delete-departments').forEach(btn => {
            btn.style.display = canManageDepartments && hasSelection ? 'inline-flex' : 'none';
        });
    }
    
    bindWasteTypeMasterCheckbox() {
        const masterCheckbox = document.querySelector('.waste-type-table thead input[type="checkbox"]');
        if (!masterCheckbox) return;
        
        const allCheckboxes = document.querySelectorAll('.waste-type-table tbody input[type="checkbox"]:not([disabled])');
        const checkedBoxes = document.querySelectorAll('.waste-type-table tbody input[type="checkbox"]:checked');
        
        // Update master checkbox state
        if (checkedBoxes.length === 0) {
            masterCheckbox.indeterminate = false;
            masterCheckbox.checked = false;
        } else if (checkedBoxes.length === allCheckboxes.length) {
            masterCheckbox.indeterminate = false;
            masterCheckbox.checked = true;
        } else {
            masterCheckbox.indeterminate = true;
        }
        
        // Bind master checkbox event
        masterCheckbox.onchange = () => {
            allCheckboxes.forEach(cb => {
                cb.checked = masterCheckbox.checked;
            });
            this.updateWasteTypeButtons();
        };
    }
    
    bindDepartmentMasterCheckbox() {
        const masterCheckbox = document.querySelector('.department-table thead input[type="checkbox"]');
        if (!masterCheckbox) return;
        
        const allCheckboxes = document.querySelectorAll('.department-table tbody input[type="checkbox"]:not([disabled])');
        const checkedBoxes = document.querySelectorAll('.department-table tbody input[type="checkbox"]:checked');
        
        // Update master checkbox state
        if (checkedBoxes.length === 0) {
            masterCheckbox.indeterminate = false;
            masterCheckbox.checked = false;
        } else if (checkedBoxes.length === allCheckboxes.length) {
            masterCheckbox.indeterminate = false;
            masterCheckbox.checked = true;
        } else {
            masterCheckbox.indeterminate = true;
        }
        
        // Bind master checkbox event
        masterCheckbox.onchange = () => {
            allCheckboxes.forEach(cb => {
                cb.checked = masterCheckbox.checked;
            });
            this.updateDepartmentButtons();
        };
    }
    
    searchWasteTypes(query) {
        const rows = document.querySelectorAll('.waste-type-table tbody tr');
        const normalizedQuery = query.toLowerCase().trim();
        
        rows.forEach(row => {
            if (row.dataset.id === 'new') return; // Skip editing row
            
            const nameCell = row.querySelector('td:nth-child(2)');
            if (!nameCell) return;
            
            const name = nameCell.textContent.toLowerCase();
            const matches = !normalizedQuery || name.includes(normalizedQuery);
            row.style.display = matches ? '' : 'none';
        });
    }
    
    searchDepartments(query) {
        const rows = document.querySelectorAll('.department-table tbody tr');
        const normalizedQuery = query.toLowerCase().trim();
        
        rows.forEach(row => {
            if (row.dataset.id === 'new') return; // Skip editing row
            
            const nameCell = row.querySelector('td:nth-child(2)');
            if (!nameCell) return;
            
            const name = nameCell.textContent.toLowerCase();
            const matches = !normalizedQuery || name.includes(normalizedQuery);
            row.style.display = matches ? '' : 'none';
        });
    }
    
    showWasteTypeEmptyState() {
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        // IMPORTANT: Keep table visible so users can add new waste types
        const table = document.querySelector('.waste-type-table');
        if (table) {
            table.style.display = 'table';
        }
        
        // Show error modal on first load if no waste types exist
        if (!this.hasShownWasteTypeModal) {
            this.showWasteTypeErrorModal();
            this.hasShownWasteTypeModal = true;
        }
    }
    
    hideWasteTypeEmptyState() {
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        const table = document.querySelector('.waste-type-table');
        if (table) {
            table.style.display = 'table';
        }
    }
    
    
    showDepartmentEmptyState() {
        const emptyState = document.querySelector('.empty-departments');
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        // Show table anyway - empty table with header allows adding new departments
        const table = document.querySelector('.department-table');
        if (table) {
            table.style.display = 'table';
        }
        
        // Show error modal on first load if no departments exist
        if (!this.hasShownDepartmentModal) {
            this.showDepartmentErrorModal();
            this.hasShownDepartmentModal = true;
        }
    }
    
    hideDepartmentEmptyStates() {
        // Hide empty state
        const emptyState = document.querySelector('.empty-departments');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Show table
        const table = document.querySelector('.department-table');
        if (table) {
            table.style.display = 'table';
        }
    }
    
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }
    
    // Error modal methods
    showWasteTypeErrorModal() {
        if (window.GlobalModalManager) {
            window.GlobalModalManager.alert('錯誤', '目前沒有廢棄物種類資料。請先新增廢棄物種類才能使用部門廢棄物管理功能。', 'error');
        } else {
            NotificationUtils.showAlert('錯誤', '目前沒有廢棄物種類資料。請先新增廢棄物種類才能使用部門廢棄物管理功能。', 'error');
        }
    }
    
    showDepartmentErrorModal() {
        if (window.GlobalModalManager) {
            window.GlobalModalManager.alert('錯誤', '目前沒有部門資料。請先新增部門才能使用部門廢棄物管理功能。', 'error');
        } else {
            NotificationUtils.showAlert('錯誤', '目前沒有部門資料。請先新增部門才能使用部門廢棄物管理功能。', 'error');
        }
    }
}