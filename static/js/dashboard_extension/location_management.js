document.addEventListener('DOMContentLoaded', () => {
    window.locationManager = new LocationManager();
    window.locationManager.initialize();
});

class LocationManager {
    constructor() {
        this.editingLocationId = null;
        this.editingAgencyId = null;
    }
    
    initialize() {
        this.bindEvents();
    }
    
    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            // 定點
            if (e.target.closest('.btn-add-location')) this.startAddLocation();
            else if (e.target.closest('.btn-edit-location')) this.startEditLocation(e);
            else if (e.target.closest('.btn-save-location')) this.saveLocation(e);
            else if (e.target.closest('.btn-cancel-location')) this.cancelEditLocation();
            else if (e.target.closest('.btn-delete-locations')) this.deleteSelectedLocations();
            
            // 機構
            else if (e.target.closest('.btn-add-agency')) this.startAddAgency();
            else if (e.target.closest('.btn-edit-agency')) this.startEditAgency(e);
            else if (e.target.closest('.btn-save-agency')) this.saveAgency(e);
            else if (e.target.closest('.btn-cancel-agency')) this.cancelEditAgency();
            else if (e.target.closest('.btn-delete-agencies')) this.deleteSelectedAgencies();
        });
        
        // 搜尋
        const locSearch = document.querySelector('input[placeholder*="搜尋定點"]');
        if (locSearch) locSearch.addEventListener('input', (e) => this.searchTable('.location-table', e.target.value));
        
        const agencySearch = document.querySelector('input[placeholder*="搜尋機構"]');
        if (agencySearch) agencySearch.addEventListener('input', (e) => this.searchTable('.agency-table', e.target.value));
        
        // 核取方塊 (包含全選功能)
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const table = e.target.closest('table');
                // 如果點擊的是全選的 Checkbox
                if (e.target.closest('thead')) {
                    const isChecked = e.target.checked;
                    table.querySelectorAll('tbody input[type="checkbox"]:not([disabled])').forEach(cb => cb.checked = isChecked);
                }
                
                if (table.classList.contains('location-table')) this.updateLocationButtons();
                else if (table.classList.contains('agency-table')) this.updateAgencyButtons();
            }
        });
    }
    
    // ==========================================
    // 定點管理
    // ==========================================
    startAddLocation() {
        this.cancelEditLocation();
        const tbody = document.querySelector('.location-table tbody');
        const newRow = document.createElement('tr');
        newRow.dataset.id = 'new';
        newRow.style.backgroundColor = 'var(--my-hover)';
        
        newRow.innerHTML = `
            <td class="checkbox-cell"><label class="ts-checkbox is-solo is-large"><input type="checkbox" disabled></label></td>
            <td><span class="ts-badge is-small">新增</span></td>
            <td><div class="ts-input is-solid is-fluid is-small"><input type="text" class="edit-name" placeholder="輸入定點名稱" style="background: var(--my-bg-input); color: var(--my-text-main);"></div></td>
            <td class="action-cell" style="text-align: right; white-space: nowrap;">
                <button type="button" class="ts-button is-secondary is-icon is-small btn-cancel-location"><span class="ts-icon is-xmark-icon"></span></button>
                <button type="button" class="ts-button is-positive is-icon is-small btn-save-location"><span class="ts-icon is-check-icon"></span></button>
            </td>
        `;
        tbody.insertBefore(newRow, tbody.firstChild);
        const input = newRow.querySelector('.edit-name');
        if (input) input.focus();
        this.editingLocationId = 'new';
        this.updateLocationButtons();
    }

    startEditLocation(e) {
        this.cancelEditLocation();
        const row = e.target.closest('tr');
        this.editingLocationId = row.dataset.id;
        
        const nameCell = row.querySelector('td:nth-child(3)');
        const actionCell = row.querySelector('.action-cell') || row.querySelector('td:last-child');
        
        // 暫存原本的 HTML 以便取消時還原
        row.dataset.originalName = nameCell.textContent;
        row.dataset.originalAction = actionCell.innerHTML;
        
        nameCell.innerHTML = `<div class="ts-input is-solid is-fluid is-small"><input type="text" class="edit-name" value="${nameCell.textContent.trim()}" style="background: var(--my-bg-input); color: var(--my-text-main);"></div>`;
        actionCell.innerHTML = `
            <button type="button" class="ts-button is-secondary is-icon is-small btn-cancel-location"><span class="ts-icon is-xmark-icon"></span></button>
            <button type="button" class="ts-button is-positive is-icon is-small btn-save-location"><span class="ts-icon is-check-icon"></span></button>
        `;
        
        const input = row.querySelector('.edit-name');
        if (input) { input.focus(); input.select(); }
        this.updateLocationButtons();
    }
    
    cancelEditLocation() {
        if (this.editingLocationId === 'new') {
            const newRow = document.querySelector('.location-table tbody tr[data-id="new"]');
            if (newRow) newRow.remove();
        } else if (this.editingLocationId) {
            const row = document.querySelector(`.location-table tbody tr[data-id="${this.editingLocationId}"]`);
            if (row) {
                row.querySelector('td:nth-child(3)').textContent = row.dataset.originalName;
                (row.querySelector('.action-cell') || row.querySelector('td:last-child')).innerHTML = row.dataset.originalAction;
            }
        }
        this.editingLocationId = null;
        this.updateLocationButtons();
    }
    
    async saveLocation(e) {
        const row = e.target.closest('tr');
        const nameInput = row.querySelector('.edit-name');
        if (!nameInput.value.trim()) return alert('請輸入定點名稱');
        
        try {
            const response = await fetch('/dashboard/api/location/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCSRFToken() },
                body: JSON.stringify({ id: row.dataset.id, name: nameInput.value.trim() })
            });
            if ((await response.json()).success) window.location.reload();
            else alert('儲存失敗');
        } catch (error) { alert(`發生錯誤: ${error.message}`); }
    }

    async deleteSelectedLocations() {
        const checkboxes = document.querySelectorAll('.location-table tbody input[type="checkbox"]:checked:not([disabled])');
        const ids = Array.from(checkboxes).map(cb => cb.value);
        if (!ids.length || !confirm(`確定要刪除選定的 ${ids.length} 個定點嗎？`)) return;
        
        try {
            const response = await fetch('/dashboard/api/location/delete/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCSRFToken() },
                body: JSON.stringify({ ids: ids })
            });
            if ((await response.json()).success) window.location.reload();
            else alert('刪除失敗');
        } catch (error) { alert(`發生錯誤: ${error.message}`); }
    }

    // ==========================================
    // 機構管理
    // ==========================================
    startAddAgency() {
        this.cancelEditAgency();
        const tbody = document.querySelector('.agency-table tbody');
        const newRow = document.createElement('tr');
        newRow.dataset.id = 'new';
        newRow.style.backgroundColor = 'var(--my-hover)';
        
        newRow.innerHTML = `
            <td class="checkbox-cell"><label class="ts-checkbox is-solo is-large"><input type="checkbox" disabled></label></td>
            <td><span class="ts-badge is-small">新增</span></td>
            <td><div class="ts-input is-solid is-fluid is-small"><input type="text" class="edit-name" placeholder="輸入機構名稱" style="background: var(--my-bg-input); color: var(--my-text-main);"></div></td>
            <td>
                <div class="ts-select is-solid is-small">
                    <select class="edit-type" style="background: var(--my-bg-input); color: var(--my-text-main);">
                        <option value="clear">清理</option><option value="process">處理</option>
                    </select>
                </div>
            </td>
            <td class="action-cell" style="text-align: right; white-space: nowrap;">
                <button type="button" class="ts-button is-secondary is-icon is-small btn-cancel-agency"><span class="ts-icon is-xmark-icon"></span></button>
                <button type="button" class="ts-button is-positive is-icon is-small btn-save-agency"><span class="ts-icon is-check-icon"></span></button>
            </td>
        `;
        tbody.insertBefore(newRow, tbody.firstChild);
        const input = newRow.querySelector('.edit-name');
        if (input) input.focus();
        this.editingAgencyId = 'new';
        this.updateAgencyButtons();
    }

    startEditAgency(e) {
        this.cancelEditAgency();
        const row = e.target.closest('tr');
        this.editingAgencyId = row.dataset.id;
        
        const nameCell = row.querySelector('td:nth-child(3)');
        const typeCell = row.querySelector('td:nth-child(4)');
        const actionCell = row.querySelector('.action-cell') || row.querySelector('td:last-child');
        
        row.dataset.originalName = nameCell.textContent;
        row.dataset.originalType = typeCell.innerHTML;
        row.dataset.originalAction = actionCell.innerHTML;
        
        const isClear = typeCell.textContent.includes('清理');
        
        nameCell.innerHTML = `<div class="ts-input is-solid is-fluid is-small"><input type="text" class="edit-name" value="${nameCell.textContent.trim()}" style="background: var(--my-bg-input); color: var(--my-text-main);"></div>`;
        typeCell.innerHTML = `
            <div class="ts-select is-solid is-small">
                <select class="edit-type" style="background: var(--my-bg-input); color: var(--my-text-main);">
                    <option value="clear" ${isClear ? 'selected' : ''}>清理</option>
                    <option value="process" ${!isClear ? 'selected' : ''}>處理</option>
                </select>
            </div>
        `;
        actionCell.innerHTML = `
            <button type="button" class="ts-button is-secondary is-icon is-small btn-cancel-agency"><span class="ts-icon is-xmark-icon"></span></button>
            <button type="button" class="ts-button is-positive is-icon is-small btn-save-agency"><span class="ts-icon is-check-icon"></span></button>
        `;
        
        const input = row.querySelector('.edit-name');
        if (input) { input.focus(); input.select(); }
        this.updateAgencyButtons();
    }
    
    cancelEditAgency() {
        if (this.editingAgencyId === 'new') {
            const newRow = document.querySelector('.agency-table tbody tr[data-id="new"]');
            if (newRow) newRow.remove();
        } else if (this.editingAgencyId) {
            const row = document.querySelector(`.agency-table tbody tr[data-id="${this.editingAgencyId}"]`);
            if (row) {
                row.querySelector('td:nth-child(3)').textContent = row.dataset.originalName;
                row.querySelector('td:nth-child(4)').innerHTML = row.dataset.originalType;
                (row.querySelector('.action-cell') || row.querySelector('td:last-child')).innerHTML = row.dataset.originalAction;
            }
        }
        this.editingAgencyId = null;
        this.updateAgencyButtons();
    }
    
    async saveAgency(e) {
        const row = e.target.closest('tr');
        const nameInput = row.querySelector('.edit-name');
        const typeSelect = row.querySelector('.edit-type');
        if (!nameInput.value.trim()) return alert('請輸入機構名稱');
        
        try {
            const response = await fetch('/dashboard/api/agency/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCSRFToken() },
                body: JSON.stringify({ id: row.dataset.id, name: nameInput.value.trim(), type: typeSelect.value })
            });
            if ((await response.json()).success) window.location.reload();
            else alert('儲存失敗');
        } catch (error) { alert(`發生錯誤: ${error.message}`); }
    }

    async deleteSelectedAgencies() {
        const checkboxes = document.querySelectorAll('.agency-table tbody input[type="checkbox"]:checked:not([disabled])');
        const ids = Array.from(checkboxes).map(cb => cb.value);
        if (!ids.length || !confirm(`確定要刪除選定的 ${ids.length} 個機構嗎？`)) return;
        
        try {
            const response = await fetch('/dashboard/api/agency/delete/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.getCSRFToken() },
                body: JSON.stringify({ ids: ids })
            });
            if ((await response.json()).success) window.location.reload();
            else alert('刪除失敗');
        } catch (error) { alert(`發生錯誤: ${error.message}`); }
    }

    // ==========================================
    // UI 控制與共用方法
    // ==========================================
    searchTable(tableSelector, query) {
        const rows = document.querySelectorAll(`${tableSelector} tbody tr`);
        const normalizedQuery = query.toLowerCase().trim();
        rows.forEach(row => {
            if (row.dataset.id === 'new') return;
            const nameCell = row.querySelector('td:nth-child(3)');
            if (!nameCell) return;
            row.style.display = (!normalizedQuery || nameCell.textContent.toLowerCase().includes(normalizedQuery)) ? '' : 'none';
        });
    }

    updateLocationButtons() {
        const hasSelection = document.querySelectorAll('.location-table tbody input[type="checkbox"]:checked').length > 0;
        const canManage = !this.editingLocationId;
        document.querySelectorAll('.btn-add-location').forEach(btn => btn.style.display = (canManage && !hasSelection) ? 'inline-flex' : 'none');
        document.querySelectorAll('.btn-delete-locations').forEach(btn => btn.style.display = (canManage && hasSelection) ? 'inline-flex' : 'none');
    }

    updateAgencyButtons() {
        const hasSelection = document.querySelectorAll('.agency-table tbody input[type="checkbox"]:checked').length > 0;
        const canManage = !this.editingAgencyId;
        document.querySelectorAll('.btn-add-agency').forEach(btn => btn.style.display = (canManage && !hasSelection) ? 'inline-flex' : 'none');
        document.querySelectorAll('.btn-delete-agencies').forEach(btn => btn.style.display = (canManage && hasSelection) ? 'inline-flex' : 'none');
    }
}