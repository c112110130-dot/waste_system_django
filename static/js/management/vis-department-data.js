/**
 * Department Waste Visualization Data Module
 * Department-specific data processing and validation logic
 * Handles dataset configuration, color management, and UI interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    // Ensure common utilities and core module are available
    if (!window.DOMUtils || !window.ModalUtils) {
        console.error('[Department Data] Common utilities not loaded');
        return;
    }

    // Use the same color swatches as visualize-data.js
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

    // DOM element references
    const dataList = document.getElementById('dataList');
    const addDataBtn = document.getElementById('addDataBtn');

    // Get next color from palette using global color index from visualize-tabs.js
    function getNextDepartmentColor() {
        // Initialize global color index if not exists
        if (typeof window.globalColorIndex === 'undefined') {
            window.globalColorIndex = 0;
        }

        const color = swatches[window.globalColorIndex % swatches.length];
        window.globalColorIndex++;
        return color;
    }

    // Reset color index using global color index
    function resetDepartmentColorIndex() {
        window.globalColorIndex = 0;
        console.log('[Department Data] Global color index reset to 0');
    }

    // Create new data row for department analysis
    function createDepartmentDataRow(customColor = null) {
        if (!dataList) {
            console.error('[Department Data] Data list container not found');
            return null;
        }

        const nextColor = customColor || getNextDepartmentColor();

        // Get current xAxis setting to use correct date format
        const xAxisSelect = document.getElementById('xAxis');
        const currentXAxis = xAxisSelect ? xAxisSelect.value : 'year_sum';

        // Use getDepartmentDataRowHTML with current xAxis setting for correct date format
        const rowHTML = getDepartmentDataRowHTML(currentXAxis, nextColor, '', '', '');

        // Create data row container
        const dataRow = document.createElement('div');
        dataRow.className = 'ts-box is-fluid is-raised background-quaternary has-padded has-bottom-spaced';

        // Parse HTML safely using temporary container
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = rowHTML;
        while (tempContainer.firstChild) {
            dataRow.appendChild(tempContainer.firstChild);
        }

        return dataRow;
    }

    // Populate waste type options in a select element with Select2
    async function populateWasteTypeOptions(selectElement) {
        if (!selectElement || !window.departmentConfig) {
            console.error('[Department Data] Cannot populate waste types - missing element or config');
            return;
        }

        try {
            // Destroy existing Select2 if it exists
            if ($(selectElement).hasClass('select2-hidden-accessible')) {
                $(selectElement).select2('destroy');
            }

            // Clear existing options except placeholder
            while (selectElement.children.length > 1) {
                selectElement.removeChild(selectElement.lastChild);
            }

            // Add waste type options
            if (window.departmentConfig.waste_types) {
                window.departmentConfig.waste_types.forEach(wasteType => {
                    const option = document.createElement('option');
                    option.value = wasteType.id;
                    option.textContent = wasteType.name;
                    selectElement.appendChild(option);
                });
            }

            // Initialize Select2 with department theme
            $(selectElement).select2({
                placeholder: '選擇廢棄物種類',
                width: '100%',
                allowClear: false
            });

            console.log('[Department Data] Waste type options populated with Select2 successfully');
        } catch (error) {
            console.error('[Department Data] Error populating waste types:', error);
        }
    }

    // Setup event listeners for a data row
    function setupDepartmentDataRowListeners(dataRow) {
        if (!dataRow) return;

        // Remove button functionality
        const removeBtn = dataRow.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                dataRow.remove();
                console.log('[Department Data] Data row removed successfully');
            });
        }

        // Copy button functionality
        const copyBtn = dataRow.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                copyDepartmentDataRow(dataRow);
            });
        }

        // Color picker initialization - will be handled by global Coloris setup
        const colorPicker = dataRow.querySelector('.color-picker');
        if (colorPicker) {
            // Set background color based on initial value
            if (colorPicker.value) {
                colorPicker.style.backgroundColor = colorPicker.value;
            }
        }

        // Remove auto-generation of series names - user should input manually
    }

    // Copy data row configuration
    function copyDepartmentDataRow(sourceRow) {
        try {
            // Get next color only once to avoid double increment
            const nextColor = getNextDepartmentColor();

            // Create new row with custom color to avoid double color increment
            const newRow = createDepartmentDataRow(nextColor);
            if (!newRow) return;

            // Copy values from source row
            const sourceInputs = sourceRow.querySelectorAll('input, select');
            const targetInputs = newRow.querySelectorAll('input, select');

            sourceInputs.forEach((sourceInput, index) => {
                if (targetInputs[index] && sourceInput.className === targetInputs[index].className) {
                    if (sourceInput.classList.contains('color-picker')) {
                        // Assign new color for copied row (use pre-generated color)
                        targetInputs[index].value = nextColor;
                    } else if (sourceInput.classList.contains('data-name')) {
                        // Clear name to allow auto-generation
                        targetInputs[index].value = '';
                    } else {
                        // Copy other values
                        targetInputs[index].value = sourceInput.value;
                    }
                }
            });

            // Insert into data list container (append to the end)
            dataList.appendChild(newRow);

            // Setup listeners for new row
            setupDepartmentDataRowListeners(newRow);
            newRow.setAttribute('data-listeners-attached', 'true');

            // Populate waste types and set selected value from source
            const sourceWasteTypeSelect = sourceRow.querySelector('.waste-type-select');
            const targetWasteTypeSelect = newRow.querySelector('.waste-type-select');
            if (targetWasteTypeSelect && window.departmentConfig) {
                populateWasteTypeOptions(targetWasteTypeSelect).then(() => {
                    // Copy the selected waste type from source after Select2 is ready
                    if (sourceWasteTypeSelect && sourceWasteTypeSelect.value) {
                        $(targetWasteTypeSelect).val(sourceWasteTypeSelect.value).trigger('change');
                    }
                });
            }

            // Set background color for copied color picker
            const colorPicker = newRow.querySelector('.color-picker');
            if (colorPicker && colorPicker.value) {
                colorPicker.style.backgroundColor = colorPicker.value;
            }

            console.log('[Department Data] Data row copied successfully');

        } catch (error) {
            console.error('[Department Data] Error copying data row:', error);
            VisualizeChartUtils.showErrorModal('複製失敗: ' + error.message);
        }
    }

    // Add new data row
    function addDepartmentDataRow() {
        try {
            const newRow = createDepartmentDataRow();
            if (!newRow) return;

            // Insert into data list container (append to the end)
            dataList.appendChild(newRow);

            // Setup listeners
            setupDepartmentDataRowListeners(newRow);
            newRow.setAttribute('data-listeners-attached', 'true');

            // Populate waste types if config is available
            const wasteTypeSelect = newRow.querySelector('.waste-type-select');
            if (wasteTypeSelect && window.departmentConfig) {
                populateWasteTypeOptions(wasteTypeSelect);
            }

            // Set background color for new color picker
            const colorPicker = newRow.querySelector('.color-picker');
            if (colorPicker && colorPicker.value) {
                colorPicker.style.backgroundColor = colorPicker.value;
            }

            console.log('[Department Data] New data row added successfully');

        } catch (error) {
            console.error('[Department Data] Error adding data row:', error);
            VisualizeChartUtils.showErrorModal('新增失敗: ' + error.message);
        }
    }

    // Initialize existing data rows
    function initializeExistingDepartmentRows() {
        const existingRows = dataList.querySelectorAll('.ts-box:not(#addChartBtnContainer)');
        
        existingRows.forEach(row => {
            // Check if listeners are already attached to prevent duplicates
            if (!row.hasAttribute('data-listeners-attached')) {
                setupDepartmentDataRowListeners(row);
                row.setAttribute('data-listeners-attached', 'true');
            }
            
            // Populate waste types for existing rows
            const wasteTypeSelect = row.querySelector('.waste-type-select');
            if (wasteTypeSelect && window.departmentConfig) {
                populateWasteTypeOptions(wasteTypeSelect);
            }
        });

        // Don't add default row automatically - let user add manually
    }

    // Update department data inputs based on time axis selection
    function updateDepartmentDataInputs(xAxis) {
        const rows = document.querySelectorAll('#dataList .ts-box');
        if (rows.length === 0) return;

        rows.forEach(row => {
            // Get current values to preserve them during update
            const currentName = row.querySelector('.data-name')?.value || '';
            const currentColor = row.querySelector('.color-picker')?.value || '#ea5545';
            const wasteTypeSelect = row.querySelector('.waste-type-select');
            const currentWasteType = wasteTypeSelect?.value || '';
            const rankingTypeSelect = row.querySelector('.ranking-type-select');
            const currentRankingType = rankingTypeSelect?.value || 'most';
            const rankingCountInput = row.querySelector('.ranking-count-input');
            const currentRankingCount = rankingCountInput?.value || '';

            // Get current date values
            let startDate = '', endDate = '';
            
            if (xAxis.startsWith('year')) {
                // For year-based axis, get year values
                startDate = row.querySelector('.start-date')?.value || '';
                endDate = row.querySelector('.end-date')?.value || '';
            } else if (xAxis.startsWith('quarter')) {
                // For quarter-based axis, convert from separate year/quarter inputs
                const startYear = row.querySelector('.start-date-year')?.value || '';
                const startQuarter = row.querySelector('.start-date-quarter')?.value || '';
                const endYear = row.querySelector('.end-date-year')?.value || '';
                const endQuarter = row.querySelector('.end-date-quarter')?.value || '';
                startDate = startYear && startQuarter ? `${startYear}-${startQuarter}` : '';
                endDate = endYear && endQuarter ? `${endYear}-${endQuarter}` : '';
            } else {
                // For month-based axis, get month values
                startDate = row.querySelector('.start-date')?.value || '';
                endDate = row.querySelector('.end-date')?.value || '';
            }

            // Create new row HTML with updated time inputs
            const newRowHTML = getDepartmentDataRowHTML(xAxis, currentColor, currentName, startDate, endDate);
            
            // Replace row content
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = newRowHTML;
            
            // Clear existing row content and append new content
            while (row.firstChild) {
                row.removeChild(row.firstChild);
            }
            while (tempContainer.firstChild) {
                row.appendChild(tempContainer.firstChild);
            }

            // Restore values after HTML update
            const newNameInput = row.querySelector('.data-name');
            if (newNameInput) newNameInput.value = currentName;

            const newColorPicker = row.querySelector('.color-picker');
            if (newColorPicker) {
                newColorPicker.value = currentColor;
                newColorPicker.style.backgroundColor = currentColor;
            }

            const newWasteTypeSelect = row.querySelector('.waste-type-select');
            if (newWasteTypeSelect) {
                // Populate waste types first (this will also initialize Select2)
                if (window.departmentConfig) {
                    populateWasteTypeOptions(newWasteTypeSelect).then(() => {
                        // Set value after Select2 is initialized
                        $(newWasteTypeSelect).val(currentWasteType).trigger('change');
                    });
                } else {
                    newWasteTypeSelect.value = currentWasteType;
                }
            }

            const newRankingTypeSelect = row.querySelector('.ranking-type-select');
            if (newRankingTypeSelect) newRankingTypeSelect.value = currentRankingType;

            const newRankingCountInput = row.querySelector('.ranking-count-input');
            if (newRankingCountInput) newRankingCountInput.value = currentRankingCount;

            // Set up listeners for updated row
            setupDepartmentDataRowListeners(row);
        });

        console.log('[Department Data] Data inputs updated for X-axis:', xAxis);
    }

    // Generate HTML for department data row based on time axis
    function getDepartmentDataRowHTML(xAxis, color, name, startDate, endDate) {
        const colorPickerId = `color_picker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get department count for placeholder
        const departmentCount = (window.departmentConfig && window.departmentConfig.departments) 
            ? window.departmentConfig.departments.length 
            : '';
        const placeholder = departmentCount ? `${departmentCount}` : '數量';
        
        let dateInputs;
        if (xAxis.startsWith('quarter')) {
            // Split date for quarter inputs
            const [startYear, startQuarter] = startDate ? startDate.split('-') : ['', ''];
            const [endYear, endQuarter] = endDate ? endDate.split('-') : ['', ''];
            
            dateInputs = `
                <!-- Quarter Range -->
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
            // Month inputs (YYYY-MM format)
            dateInputs = `
                <!-- Month Range -->
                <div class="column is-4-wide ts-input">
                    <input type="month" class="start-date" placeholder="開始月份" value="${startDate}">
                </div>
                <span class="ts-text">至</span>
                <div class="column is-4-wide ts-input">
                    <input type="month" class="end-date" placeholder="結束月份" value="${endDate}">
                </div>
            `;
        } else {
            // Year inputs (default)
            dateInputs = `
                <!-- Year Range -->
                <div class="column is-4-wide ts-input">
                    <input type="number" class="start-date" min="1970" max="9999" step="1" placeholder="開始年份" value="${startDate}">
                </div>
                <span class="ts-text">至</span>
                <div class="column is-4-wide ts-input">
                    <input type="number" class="end-date" min="1970" max="9999" step="1" placeholder="結束年份" value="${endDate}">
                </div>
            `;
        }

        return `
            <!-- Date Range & Name -->
            <div class="ts-grid is-middle-aligned">
                <span class="column ts-icon is-bars-icon is-large chart-tab-handle sortable-handle"></span>
                ${dateInputs}
                <!-- Series Name -->
                <div class="column is-fluid ts-input">
                    <input type="text" class="data-name" placeholder="線段名稱" value="${name}">
                </div>
                <!-- Color Picker -->
                <div class="column ts-input is-1-wide">
                    <input type="text" id="${colorPickerId}" class="color-picker" value="${color}" data-coloris>
                </div>
                <!-- Copy Button -->
                <button class="column ts-button is-1-wide is-icon is-warning is-outlined is-critical copy-btn" title="複製線段設定">
                    <span class="ts-icon is-clipboard-list-icon"></span>
                </button>
                <!-- Remove Button -->
                <button class="column ts-button is-1-wide is-icon is-negative is-outlined is-critical remove-btn" title="刪除線段">
                    <span class="ts-icon is-trash-can-icon"></span>
                </button>
            </div>
            <!-- Department Selection Options -->
            <div class="ts-grid is-middle-aligned is-end-aligned has-top-padded-small">
                <!-- Waste Type Selection -->
                <div class="column" style="width: 42.5em">
                    <select class="waste-type-select">
                        <option value="">選擇廢棄物種類</option>
                    </select>
                </div>
                <!-- Ranking Type Selection -->
                <div class="column">
                    <div class="ts-select">
                        <select class="ranking-type-select">
                            <option value="most">依序</option>
                            <option value="least">反序</option>
                        </select>
                    </div>
                </div>
                <!-- Ranking Count Input -->
                <div class="column is-2-wide">
                    <div class="ts-input">
                        <input type="number" class="ranking-count-input" min="1" step="1" placeholder="${placeholder}">
                    </div>
                </div>
                <div class="column"><span class="ts-text">項</span></div>
            </div>
        `;
    }

    // Dynamic theme detection function for Coloris (matching visualize-data.js)
    function getColorisTheme() {
        const currentTheme = getCurrentDepartmentSwitchTheme(); // Use department theme detection
        return currentTheme === 'dark' ? 'dark' : 'light';
    }

    // Get current department theme for Coloris
    function getCurrentDepartmentSwitchTheme() {
        // Check theme switch state
        const lightRadio = document.getElementById('light');
        const darkRadio = document.getElementById('dark');
        
        if (lightRadio && lightRadio.checked) {
            return 'light';
        } else if (darkRadio && darkRadio.checked) {
            return 'dark';
        }
        
        // Fallback to system theme detection
        const htmlRoot = document.documentElement;
        if (htmlRoot.classList.contains('is-light')) return 'light';
        if (htmlRoot.classList.contains('is-dark')) return 'dark';
        
        // Final fallback to browser preference
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Initialize Coloris with enhanced theme support (matching visualize-data.js)
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

        // Fix swatches layout after initialization with enhanced styling
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

                // swatches styling for better theme support
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

                    // hover effects for different themes
                    button.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.1)';
                        this.style.transition = 'transform 0.2s ease';
                    });

                    button.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                    });
                });

                // picker styling for theme support
                picker.style.width = '300px';
                picker.style.minHeight = '475px';
                picker.style.maxWidth = 'none';
                picker.style.overflow = 'visible';

                // Apply theme-specific styling to picker
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

    // Function to update Coloris theme with enhanced transition effects (matching visualize-data.js)
    function updateDepartmentColorisTheme() {
        // Close any open Coloris instances
        window.Coloris.close();

        // Add smooth transition effect
        const existingPicker = document.querySelector('#clr-picker');
        if (existingPicker) {
            existingPicker.style.transition = 'all 0.3s ease';
        }

        // Re-initialize with new theme after a brief delay
        setTimeout(() => {
            initializeDepartmentColoris();
        }, 50);
    }

    // Setup main event listeners
    function setupDepartmentDataListeners() {
        // Add data row button
        if (addDataBtn) {
            addDataBtn.addEventListener('click', addDepartmentDataRow);
        }

        // X-axis change listener for department pages
        const xAxisSelect = document.getElementById('xAxis');
        if (xAxisSelect) {
            xAxisSelect.addEventListener('change', () => {
                updateDepartmentDataInputs(xAxisSelect.value);
            });
        }

        // Initialize SortableJS for drag-and-drop sorting
        if (dataList && window.Sortable) {
            new window.Sortable(dataList, {
                handle: '.ts-icon.is-bars-icon',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                filter: '#addChartBtnContainer', // Exclude the add button from sorting
                onEnd: function(evt) {
                    console.log('[Department Data] Data row reordered');
                }
            });
        }

        // Listen for theme changes to update Coloris (matching visualize-data.js)
        if (window.addEventListener) {
            // Listen for custom theme change events
            window.addEventListener('themeChanged', updateDepartmentColorisTheme);

            // Listen for switchTheme radio button changes
            const lightRadio = document.getElementById('light');
            const darkRadio = document.getElementById('dark');

            if (lightRadio) {
                lightRadio.addEventListener('change', function() {
                    if (this.checked) {
                        setTimeout(updateDepartmentColorisTheme, 100);
                    }
                });
            }

            if (darkRadio) {
                darkRadio.addEventListener('change', function() {
                    if (this.checked) {
                        setTimeout(updateDepartmentColorisTheme, 100);
                    }
                });
            }

            // Also listen for system theme changes
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', function() {
                // Only update if we're following system theme
                if (!lightRadio?.checked && !darkRadio?.checked) {
                    updateDepartmentColorisTheme();
                }
            });
        }

        // Listen for configuration updates
        window.addEventListener('departmentConfigLoaded', () => {
            console.log('[Department Data] Configuration loaded, updating existing rows');
            initializeExistingDepartmentRows();
        });
    }

    // Validate department dataset configuration
    function validateDepartmentDatasetConfig(dataset, index) {
        const errors = [];

        // Check waste type
        if (!dataset.waste_type_id || dataset.waste_type_id === '') {
            errors.push('請選擇廢棄物種類');
        }

        // Check date range
        if (!dataset.start_date || dataset.start_date === '') {
            errors.push('請輸入開始年份');
        }

        if (!dataset.end_date || dataset.end_date === '') {
            errors.push('請輸入結束年份');
        }

        // Validate year format and range
        if (dataset.start_date && dataset.end_date) {
            const startYear = parseInt(dataset.start_date);
            const endYear = parseInt(dataset.end_date);

            if (isNaN(startYear) || startYear < 1970 || startYear > 9999) {
                errors.push('開始年份必須在 1970-9999 之間');
            }

            if (isNaN(endYear) || endYear < 1970 || endYear > 9999) {
                errors.push('結束年份必須在 1970-9999 之間');
            }

            if (!isNaN(startYear) && !isNaN(endYear) && startYear > endYear) {
                errors.push('開始年份不能大於結束年份');
            }
        }

        // Check ranking settings
        if (!dataset.ranking_type || dataset.ranking_type === '') {
            errors.push('請選擇排名類型');
        }

        if (!dataset.ranking_count || dataset.ranking_count === '') {
            errors.push('請輸入排名數量');
        } else {
            const count = parseInt(dataset.ranking_count);
            if (isNaN(count) || count < 1) {
                errors.push('排名數量必須大於 0');
            }
        }

        // Check name
        if (!dataset.name || dataset.name.trim() === '') {
            errors.push('請輸入線段名稱');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Initialize department data module
    function initializeDepartmentDataModule() {
        console.log('[Department Data] Initializing data module...');

        setupDepartmentDataListeners();

        // Initialize Coloris with department theme support
        if (window.Coloris) {
            initializeDepartmentColoris();
        }

        // Wait a bit for configuration to load, then initialize rows
        setTimeout(() => {
            if (window.departmentConfig) {
                initializeExistingDepartmentRows();
            } else {
                console.warn('[Department Data] Configuration not loaded yet, will initialize rows later');
                // Don't add default row - user should add manually
            }
        }, 1000);

        console.log('[Department Data] Data module initialized successfully');
    }

    // Global functions for external access
    window.addDepartmentDataRow = addDepartmentDataRow;
    window.copyDepartmentDataRow = copyDepartmentDataRow;
    window.validateDepartmentDatasetConfig = validateDepartmentDatasetConfig;
    window.resetDepartmentColorIndex = resetDepartmentColorIndex;
    window.getNextDepartmentColor = getNextDepartmentColor;

    // Initialize module
    initializeDepartmentDataModule();

    console.log('[Department Data] Module loaded successfully');
});