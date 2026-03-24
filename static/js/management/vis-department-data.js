/**
 * Department Waste Visualization Data Module
 * Enhanced to support both Department & Transportation data sources
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!window.DOMUtils || !window.ModalUtils) {
        console.error('[Department Data] Common utilities not loaded');
        return;
    }

    const swatches = [
        "#ea5545", "#f46a9b", "#ef9b20", "#edbf33", "#ede15b", "#bdcf32", "#87bc45", "#27aeef", "#b33dc6",
        "#e60049", "#0bb4ff", "#50e991", "#e6d800", "#9b19f5", "#ffa300", "#dc0ab4", "#b3d4ff", "#00bfa0",
        "#b30000", "#7c1158", "#4421af", "#1a53ff", "#0d88e6", "#00b7c7", "#5ad45a", "#8be04e", "#ebdc78",
        "#fd7f6f", "#7eb0d5", "#b2e061", "#bd7ebe", "#ffb55a", "#ffee65", "#beb9db", "#fdcce5", "#8bd3c7",
        "#d7e1ee", "#cbd6e4", "#bfcbdb", "#b3bfd1", "#a4a2a8", "#df8879", "#c86558", "#b04238", "#991f17",
        "#2e2b28", "#3b3734", "#474440", "#54504c", "#6b506b", "#ab3da9", "#de25da", "#eb44e8", "#ff80ff",
        "#1984c5", "#22a7f0", "#63bff0", "#a7d5ed", "#e2e2e2", "#e1a692", "#de6e56", "#e14b31", "#c23728",
        "#54bebe", "#76c8c8", "#98d1d1", "#badbdb", "#dedad2", "#e4bcad", "#df979e", "#d7658b", "#c80064"
    ];

    const dataList = document.getElementById('dataList');
    const addDataBtn = document.getElementById('addDataBtn');

    function getNextDepartmentColor() {
        if (typeof window.globalColorIndex === 'undefined') {
            window.globalColorIndex = 0;
        }
        const color = swatches[window.globalColorIndex % swatches.length];
        window.globalColorIndex++;
        return color;
    }

    function resetDepartmentColorIndex() {
        window.globalColorIndex = 0;
        console.log('[Department Data] Global color index reset to 0');
    }

    function createDepartmentDataRow(customColor = null) {
        if (!dataList) return null;

        const nextColor = customColor || getNextDepartmentColor();
        const xAxisSelect = document.getElementById('xAxis');
        const currentXAxis = xAxisSelect ? xAxisSelect.value : 'year_sum';
        
        // 🌟 新增：取得當前選擇的資料來源
        const dataSourceSelect = document.getElementById('dataSource');
        const currentSource = dataSourceSelect ? dataSourceSelect.value : 'department';

        const rowHTML = getDepartmentDataRowHTML(currentXAxis, nextColor, '', '', '', currentSource);

        const dataRow = document.createElement('div');
        dataRow.className = 'ts-box is-fluid is-raised background-quaternary has-padded has-bottom-spaced data-row-item';

        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = rowHTML;
        while (tempContainer.firstChild) {
            dataRow.appendChild(tempContainer.firstChild);
        }

        return dataRow;
    }

    async function populateWasteTypeOptions(selectElement) {
        if (!selectElement || !window.departmentConfig) return;

        try {
            if ($(selectElement).hasClass('select2-hidden-accessible')) {
                $(selectElement).select2('destroy');
            }

            while (selectElement.children.length > 1) {
                selectElement.removeChild(selectElement.lastChild);
            }

            // 如果是部門資料，載入廢棄物種類
            if (window.departmentConfig.waste_types) {
                window.departmentConfig.waste_types.forEach(wasteType => {
                    const option = document.createElement('option');
                    option.value = wasteType.id;
                    option.textContent = wasteType.name;
                    selectElement.appendChild(option);
                });
            }

            $(selectElement).select2({
                placeholder: '選擇廢棄物種類',
                width: '100%',
                allowClear: false
            });
        } catch (error) {
            console.error('[Department Data] Error populating options:', error);
        }
    }

    function setupDepartmentDataRowListeners(dataRow) {
        if (!dataRow) return;

        const removeBtn = dataRow.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                dataRow.remove();
            });
        }

        const copyBtn = dataRow.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyDepartmentDataRow(dataRow);
            });
        }

        const colorPicker = dataRow.querySelector('.color-picker');
        if (colorPicker && colorPicker.value) {
            colorPicker.style.backgroundColor = colorPicker.value;
        }
    }

    function copyDepartmentDataRow(sourceRow) {
        try {
            const nextColor = getNextDepartmentColor();
            const newRow = createDepartmentDataRow(nextColor);
            if (!newRow) return;

            const sourceInputs = sourceRow.querySelectorAll('input, select');
            const targetInputs = newRow.querySelectorAll('input, select');

            sourceInputs.forEach((sourceInput, index) => {
                if (targetInputs[index] && sourceInput.className === targetInputs[index].className) {
                    if (sourceInput.classList.contains('color-picker')) {
                        targetInputs[index].value = nextColor;
                    } else if (sourceInput.classList.contains('data-name')) {
                        targetInputs[index].value = '';
                    } else {
                        targetInputs[index].value = sourceInput.value;
                    }
                }
            });

            dataList.appendChild(newRow);
            setupDepartmentDataRowListeners(newRow);
            newRow.setAttribute('data-listeners-attached', 'true');

            const targetWasteTypeSelect = newRow.querySelector('.waste-type-select');
            if (targetWasteTypeSelect && window.departmentConfig) {
                populateWasteTypeOptions(targetWasteTypeSelect).then(() => {
                    const sourceWasteTypeSelect = sourceRow.querySelector('.waste-type-select');
                    if (sourceWasteTypeSelect && sourceWasteTypeSelect.value) {
                        $(targetWasteTypeSelect).val(sourceWasteTypeSelect.value).trigger('change');
                    }
                });
            }

            const colorPicker = newRow.querySelector('.color-picker');
            if (colorPicker && colorPicker.value) {
                colorPicker.style.backgroundColor = colorPicker.value;
            }
        } catch (error) {
            VisualizeChartUtils.showErrorModal('複製失敗: ' + error.message);
        }
    }

    function addDepartmentDataRow() {
        try {
            const newRow = createDepartmentDataRow();
            if (!newRow) return;

            dataList.appendChild(newRow);
            setupDepartmentDataRowListeners(newRow);
            newRow.setAttribute('data-listeners-attached', 'true');

            const wasteTypeSelect = newRow.querySelector('.waste-type-select');
            if (wasteTypeSelect && window.departmentConfig) {
                populateWasteTypeOptions(wasteTypeSelect);
            }

            const colorPicker = newRow.querySelector('.color-picker');
            if (colorPicker && colorPicker.value) {
                colorPicker.style.backgroundColor = colorPicker.value;
            }
        } catch (error) {
            VisualizeChartUtils.showErrorModal('新增失敗: ' + error.message);
        }
    }

    function initializeExistingDepartmentRows() {
        const existingRows = dataList.querySelectorAll('.ts-box:not(#addChartBtnContainer)');
        existingRows.forEach(row => {
            if (!row.hasAttribute('data-listeners-attached')) {
                setupDepartmentDataRowListeners(row);
                row.setAttribute('data-listeners-attached', 'true');
            }
            const wasteTypeSelect = row.querySelector('.waste-type-select');
            if (wasteTypeSelect && window.departmentConfig) {
                populateWasteTypeOptions(wasteTypeSelect);
            }
        });
    }

    function updateDepartmentDataInputs(xAxis) {
        const dataSourceSelect = document.getElementById('dataSource');
        const currentSource = dataSourceSelect ? dataSourceSelect.value : 'department';
        
        const rows = document.querySelectorAll('#dataList .data-row-item');
        if (rows.length === 0) return;

        rows.forEach(row => {
            const currentName = row.querySelector('.data-name')?.value || '';
            const currentColor = row.querySelector('.color-picker')?.value || '#ea5545';
            
            // Save state based on source
            let currentWasteType = '', currentRankingType = 'most', currentRankingCount = '';
            if (currentSource === 'department') {
                currentWasteType = row.querySelector('.waste-type-select')?.value || '';
                currentRankingType = row.querySelector('.ranking-type-select')?.value || 'most';
                currentRankingCount = row.querySelector('.ranking-count-input')?.value || '';
            }

            let startDate = '', endDate = '';
            if (xAxis.startsWith('year')) {
                startDate = row.querySelector('.start-date')?.value || '';
                endDate = row.querySelector('.end-date')?.value || '';
            } else if (xAxis.startsWith('quarter')) {
                const startYear = row.querySelector('.start-date-year')?.value || '';
                const startQuarter = row.querySelector('.start-date-quarter')?.value || '';
                const endYear = row.querySelector('.end-date-year')?.value || '';
                const endQuarter = row.querySelector('.end-date-quarter')?.value || '';
                startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
                endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
            } else {
                startDate = row.querySelector('.start-date')?.value || '';
                endDate = row.querySelector('.end-date')?.value || '';
            }

            // 🌟 傳入 currentSource 重新產生 HTML
            const newRowHTML = getDepartmentDataRowHTML(xAxis, currentColor, currentName, startDate, endDate, currentSource);
            
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = newRowHTML;
            
            while (row.firstChild) row.removeChild(row.firstChild);
            while (tempContainer.firstChild) row.appendChild(tempContainer.firstChild);

            const newNameInput = row.querySelector('.data-name');
            if (newNameInput) newNameInput.value = currentName;

            const newColorPicker = row.querySelector('.color-picker');
            if (newColorPicker) {
                newColorPicker.value = currentColor;
                newColorPicker.style.backgroundColor = currentColor;
            }

            if (currentSource === 'department') {
                const newWasteTypeSelect = row.querySelector('.waste-type-select');
                if (newWasteTypeSelect && window.departmentConfig) {
                    populateWasteTypeOptions(newWasteTypeSelect).then(() => {
                        $(newWasteTypeSelect).val(currentWasteType).trigger('change');
                    });
                }
                const newRankingTypeSelect = row.querySelector('.ranking-type-select');
                if (newRankingTypeSelect) newRankingTypeSelect.value = currentRankingType;
                const newRankingCountInput = row.querySelector('.ranking-count-input');
                if (newRankingCountInput) newRankingCountInput.value = currentRankingCount;
            }

            setupDepartmentDataRowListeners(row);
        });
    }

    // 🌟 核心修改：根據資料來源動態切換介面
    function getDepartmentDataRowHTML(xAxis, color, name, startDate, endDate, source = 'department') {
        const colorPickerId = `color_picker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let dateInputs;
        if (xAxis.startsWith('quarter')) {
            const [startYear, startQuarter] = startDate ? startDate.split('-') : ['', ''];
            const [endYear, endQuarter] = endDate ? endDate.split('-') : ['', ''];
            dateInputs = `
                <div class="column is-2-wide ts-input">
                    <input type="number" class="start-date-year" min="1970" max="9999" step="1" placeholder="開始年" value="${startYear}">
                </div>
                <div class="column ts-select is-2-wide">
                    <select class="start-date-quarter">
                        <option value="1" ${startQuarter === '1' ? 'selected' : ''}>第一季</option>
                        <option value="2" ${startQuarter === '2' ? 'selected' : ''}>第二季</option>
                        <option value="3" ${startQuarter === '3' ? 'selected' : ''}>第三季</option>
                        <option value="4" ${startQuarter === '4' ? 'selected' : ''}>第四季</option>
                    </select>
                </div>
                <span class="ts-text">至</span>
                <div class="column is-2-wide ts-input">
                    <input type="number" class="end-date-year" min="1970" max="9999" step="1" placeholder="結束年" value="${endYear}">
                </div>
                <div class="column ts-select is-2-wide">
                    <select class="end-date-quarter">
                        <option value="1" ${endQuarter === '1' ? 'selected' : ''}>第一季</option>
                        <option value="2" ${endQuarter === '2' ? 'selected' : ''}>第二季</option>
                        <option value="3" ${endQuarter === '3' ? 'selected' : ''}>第三季</option>
                        <option value="4" ${endQuarter === '4' ? 'selected' : ''}>第四季</option>
                    </select>
                </div>
            `;
        } else if (xAxis.startsWith('month')) {
            dateInputs = `
                <div class="column is-4-wide ts-input">
                    <input type="month" class="start-date" placeholder="開始月份" value="${startDate}">
                </div>
                <span class="ts-text">至</span>
                <div class="column is-4-wide ts-input">
                    <input type="month" class="end-date" placeholder="結束月份" value="${endDate}">
                </div>
            `;
        } else {
            dateInputs = `
                <div class="column is-4-wide ts-input">
                    <input type="number" class="start-date" min="1970" max="9999" step="1" placeholder="開始年份" value="${startDate}">
                </div>
                <span class="ts-text">至</span>
                <div class="column is-4-wide ts-input">
                    <input type="number" class="end-date" min="1970" max="9999" step="1" placeholder="結束年份" value="${endDate}">
                </div>
            `;
        }

        // 🌟 判斷下方要顯示哪一種過濾條件
        let specificOptionsHTML = '';
        
        if (source === 'department') {
            const departmentCount = (window.departmentConfig && window.departmentConfig.departments) ? window.departmentConfig.departments.length : '';
            const placeholder = departmentCount ? `${departmentCount}` : '數量';
            specificOptionsHTML = `
                <div class="ts-grid is-middle-aligned is-end-aligned has-top-padded-small">
                    <div class="column" style="width: 42.5em">
                        <select class="waste-type-select">
                            <option value="">選擇廢棄物種類</option>
                        </select>
                    </div>
                    <div class="column">
                        <div class="ts-select">
                            <select class="ranking-type-select">
                                <option value="most">依序 (最高產出)</option>
                                <option value="least">反序 (最低產出)</option>
                            </select>
                        </div>
                    </div>
                    <div class="column is-2-wide">
                        <div class="ts-input">
                            <input type="number" class="ranking-count-input" min="1" step="1" placeholder="${placeholder}">
                        </div>
                    </div>
                    <div class="column"><span class="ts-text">項</span></div>
                </div>
            `;
        } else if (source === 'transportation') {
            // 載運紀錄的專屬選項 (不需要選種類跟排行，因為是看總載運量)
            specificOptionsHTML = `
                <div class="ts-grid is-middle-aligned is-end-aligned has-top-padded-small">
                    <div class="column is-fluid">
                        <div class="ts-text is-description" style="color: #2185d0; padding-left: 50px;">
                            <span class="ts-icon is-truck-fast-icon"></span> 載運紀錄將直接加總此區間內所有合規機構的「總清運重量」。
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="ts-grid is-middle-aligned">
                <span class="column ts-icon is-bars-icon is-large chart-tab-handle sortable-handle"></span>
                ${dateInputs}
                <div class="column is-fluid ts-input">
                    <input type="text" class="data-name" placeholder="線段名稱 (例：2026載運趨勢)" value="${name}">
                </div>
                <div class="column ts-input is-1-wide">
                    <input type="text" id="${colorPickerId}" class="color-picker" value="${color}" data-coloris>
                </div>
                <button class="column ts-button is-1-wide is-icon is-warning is-outlined is-critical copy-btn" title="複製線段設定">
                    <span class="ts-icon is-clipboard-list-icon"></span>
                </button>
                <button class="column ts-button is-1-wide is-icon is-negative is-outlined is-critical remove-btn" title="刪除線段">
                    <span class="ts-icon is-trash-can-icon"></span>
                </button>
            </div>
            ${specificOptionsHTML}
        `;
    }

    function getColorisTheme() {
        const currentTheme = getCurrentDepartmentSwitchTheme();
        return currentTheme === 'dark' ? 'dark' : 'light';
    }

    function getCurrentDepartmentSwitchTheme() {
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');
        if (lightRadio && lightRadio.checked) return 'light';
        if (darkRadio && darkRadio.checked) return 'dark';
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) return 'light';
        if (htmlRoot.classList.contains('is-dark')) return 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function initializeDepartmentColoris() {
        const themeMode = getColorisTheme();
        Coloris({
            el: '.color-picker',
            wrap: true,
            format: 'hex',
            swatches: swatches,
            swatchesOnly: false,
            defaultColor: '#000000',
            alpha: false,
            theme: 'large',
            themeMode: themeMode,
            onChange: (color, input) => {
                input.style.backgroundColor = color;
                input.value = color;
            }
        });

        setTimeout(() => {
            const picker = document.querySelector('#clr-picker.clr-picker');
            const swatchesContainer = document.querySelector('#clr-picker .clr-swatches');
            if (swatchesContainer && picker) {
                const wrapperDiv = swatchesContainer.querySelector('div');
                if (wrapperDiv) {
                    while (wrapperDiv.firstChild) {
                        swatchesContainer.appendChild(wrapperDiv.firstChild);
                    }
                    wrapperDiv.remove();
                }

                swatchesContainer.style.display = 'grid';
                swatchesContainer.style.gridTemplateColumns = 'repeat(9, 1fr)';
                swatchesContainer.style.gridTemplateRows = 'repeat(8, 1fr)';
                swatchesContainer.style.width = '275px';
                swatchesContainer.style.height = '290px';
                swatchesContainer.style.maxWidth = 'none';
                swatchesContainer.style.position = 'relative';
                swatchesContainer.style.margin = '0 auto';
                swatchesContainer.style.justifyItems = 'center';

                const buttons = swatchesContainer.querySelectorAll('button');
                buttons.forEach(button => {
                    button.style.width = '24px';
                    button.style.height = '24px';
                    button.style.margin = '0';
                    button.style.padding = '0';
                    button.style.boxSizing = 'border-box';
                    button.style.fontSize = '0';
                    button.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.1)';
                        this.style.transition = 'transform 0.2s ease';
                    });
                    button.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                    });
                });

                picker.style.width = '300px';
                picker.style.minHeight = '475px';
                picker.style.maxWidth = 'none';
                picker.style.overflow = 'visible';

                if (themeMode === 'dark') {
                    picker.style.backgroundColor = '#1f2937';
                    picker.style.color = '#f9fafb';
                    picker.style.border = '1px solid #374151';
                } else {
                    picker.style.backgroundColor = '#ffffff';
                    picker.style.color = '#111827';
                    picker.style.border = '1px solid #d1d5db';
                }
            }
        }, 100);
    }

    function updateDepartmentColorisTheme() {
        window.Coloris.close();
        const existingPicker = document.querySelector('#clr-picker');
        if (existingPicker) existingPicker.style.transition = 'all 0.3s ease';
        setTimeout(() => { initializeDepartmentColoris(); }, 50);
    }

    function setupDepartmentDataListeners() {
        if (addDataBtn) {
            addDataBtn.addEventListener('click', addDepartmentDataRow);
        }

        const xAxisSelect = document.getElementById('xAxis');
        if (xAxisSelect) {
            xAxisSelect.addEventListener('change', () => {
                updateDepartmentDataInputs(xAxisSelect.value);
            });
        }

        // 🌟 新增：當切換資料來源時，清空並重新整理畫面上的線段
        const dataSourceSelect = document.getElementById('dataSource');
        if (dataSourceSelect) {
            dataSourceSelect.addEventListener('change', () => {
                // 清空所有現有線段
                while (dataList.firstChild) {
                    dataList.removeChild(dataList.firstChild);
                }
                // 重新加上一條預設線段
                addDepartmentDataRow();
            });
        }

        if (dataList && window.Sortable) {
            new window.Sortable(dataList, {
                handle: '.ts-icon.is-bars-icon',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                filter: '#addChartBtnContainer'
            });
        }

        if (window.addEventListener) {
            window.addEventListener('themeChanged', updateDepartmentColorisTheme);
            const lightRadio = document.getElementById('light');
            const darkRadio = document.getElementById('dark');
            if (lightRadio) {
                lightRadio.addEventListener('change', function() {
                    if (this.checked) setTimeout(updateDepartmentColorisTheme, 100);
                });
            }
            if (darkRadio) {
                darkRadio.addEventListener('change', function() {
                    if (this.checked) setTimeout(updateDepartmentColorisTheme, 100);
                });
            }
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', function() {
                if (!lightRadio?.checked && !darkRadio?.checked) {
                    updateDepartmentColorisTheme();
                }
            });
        }

        window.addEventListener('departmentConfigLoaded', () => {
            initializeExistingDepartmentRows();
        });
    }

    // 🌟 更新：驗證邏輯支援兩種模式
    function validateDepartmentDatasetConfig(dataset, index) {
        const errors = [];
        const currentSource = document.getElementById('dataSource')?.value || 'department';

        if (!dataset.start_date || dataset.start_date === '') errors.push('請輸入開始年份');
        if (!dataset.end_date || dataset.end_date === '') errors.push('請輸入結束年份');

        if (dataset.start_date && dataset.end_date) {
            const startYear = parseInt(dataset.start_date);
            const endYear = parseInt(dataset.end_date);
            if (isNaN(startYear) || startYear < 1970 || startYear > 9999) errors.push('開始年份必須在 1970-9999 之間');
            if (isNaN(endYear) || endYear < 1970 || endYear > 9999) errors.push('結束年份必須在 1970-9999 之間');
            if (!isNaN(startYear) && !isNaN(endYear) && startYear > endYear) errors.push('開始年份不能大於結束年份');
        }

        if (!dataset.name || dataset.name.trim() === '') errors.push('請輸入線段名稱');

        // 如果是部門模式，才需要檢查廢棄物種類跟排名
        if (currentSource === 'department') {
            if (!dataset.waste_type_id || dataset.waste_type_id === '') errors.push('請選擇廢棄物種類');
            if (!dataset.ranking_type || dataset.ranking_type === '') errors.push('請選擇排名類型');
            
            if (!dataset.ranking_count || dataset.ranking_count === '') {
                errors.push('請輸入排名數量');
            } else {
                const count = parseInt(dataset.ranking_count);
                if (isNaN(count) || count < 1) errors.push('排名數量必須大於 0');
            }
        }

        return { isValid: errors.length === 0, errors: errors };
    }

    function initializeDepartmentDataModule() {
        setupDepartmentDataListeners();
        if (window.Coloris) initializeDepartmentColoris();
        setTimeout(() => {
            if (window.departmentConfig) {
                initializeExistingDepartmentRows();
            }
        }, 1000);
    }

    window.addDepartmentDataRow = addDepartmentDataRow;
    window.copyDepartmentDataRow = copyDepartmentDataRow;
    window.validateDepartmentDatasetConfig = validateDepartmentDatasetConfig;
    window.resetDepartmentColorIndex = resetDepartmentColorIndex;
    window.getNextDepartmentColor = getNextDepartmentColor;

    initializeDepartmentDataModule();
});