window.TransportUIManager = class TransportUIManager {
    constructor(manager) {
        this.manager = manager;
        this.activeFilters = [];
        this.allLoadedManifests = []; // Keep track of loaded manifests for UI
        this.globalSelectedManifests = new Set(); // Global cache for all selected manifests, not just visible ones

        // Simplified scrolling properties
        this.allManifestData = []; // Complete data cache
        this.displayedManifests = []; // Currently displayed manifests

        // Simplified scroll control properties
        this.scrollTimeout = null;
        this.isLoadingMore = false;
        this.loadMoreThreshold = 200;
    }

    bindEvents() {
        // Category selection with scroll state reset
        document.getElementById('overallCategory').addEventListener('click', () => {
            this.resetScrollState();
            this.manager.loadManifests('overall');
        });

        document.getElementById('disposalCategory').addEventListener('click', () => {
            this.resetScrollState();
            this.manager.loadManifests('disposal');
        });

        document.getElementById('reuseCategory').addEventListener('click', () => {
            this.resetScrollState();
            this.manager.loadManifests('reuse');
        });

        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            this.manager.importHandler.showImportModal();
        });

        // Delete button
        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.handleDeleteAllSelectedManifestsServerSide();
        });

        // Select all checkbox
        document.getElementById('selectAllManifests').addEventListener('change', (e) => {
            this.handleSelectAllMatchingServerSide(e.target.checked);
        });

        // Simple and reliable scroll handler
        const manifestContainer = document.getElementById('selectManifest');
        manifestContainer.addEventListener('scroll', (e) => {
            this.handleScroll(e);
        });

        // Filter functionality
        this.bindFilterEvents();

        // Initialize filter chips display
        this.updateFilterChipsDisplay();
    }

    // Simplified scroll handler that works correctly
    handleScroll(event) {
        const container = event.target;

        // Clear existing timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Debounce scroll events
        this.scrollTimeout = setTimeout(() => {
            this.checkLoadMore(container);
        }, 150);
    }

    // Simple and correct load more detection
    checkLoadMore(container) {
        // Skip if already loading or no more data
        if (this.isLoadingMore || !this.manager.hasMore || this.manager.isLoading) {
            return;
        }

        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const scrollHeight = container.scrollHeight;
        const distanceFromBottom = scrollHeight - (scrollTop + containerHeight);

        // Trigger load more when near bottom
        if (distanceFromBottom <= this.loadMoreThreshold) {
            console.log('Triggering load more...');
            this.loadMoreData();
        }
    }

    // Correct load more implementation
    async loadMoreData() {
        if (this.isLoadingMore || !this.manager.hasMore || this.manager.isLoading) {
            return;
        }

        this.isLoadingMore = true;

        try {
            // Calculate next page correctly
            const nextPage = this.manager.currentPage + 1;
            console.log(`Loading next page: ${nextPage} (current: ${this.manager.currentPage})`);

            // Load next page with append=true
            await this.manager.loadManifests(this.manager.currentCategory, nextPage, true);

            console.log(`Load more completed. New current page: ${this.manager.currentPage}`);

        } catch (error) {
            console.error('Load more failed:', error);
            this.manager.hasMore = false; // Stop further attempts on error
        } finally {
            this.isLoadingMore = false;
        }
    }

    // Clean scroll state reset
    resetScrollState() {
        this.isLoadingMore = false;

        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }

        // Reset scroll position
        const container = document.getElementById('selectManifest');
        if (container) {
            container.scrollTop = 0;
        }

        console.log('Scroll state reset');
    }

    // Update filter chips display to show empty state message
    updateFilterChipsDisplay() {
        const filterChips = document.getElementById('filterChips');
        if (this.activeFilters.length === 0) {
            filterChips.innerHTML = '';
            // Force the CSS :empty selector to trigger
            filterChips.offsetHeight; // Trigger reflow
        }
    }

    // DELETE ALL selected manifests using server-side operation with proper manifest keys
    async handleDeleteAllSelectedManifestsServerSide() {
        try {
            // Use all globally selected manifests, not just visible ones
            const selectedManifestKeys = Array.from(this.globalSelectedManifests);

            if (selectedManifestKeys.length === 0) {
                this.showAlert('請選擇至少一筆聯單');
                return;
            }

            let confirmed = false;

            // Safety check for bulk deletion (>=10 items)
            if (selectedManifestKeys.length >= 10) {
                confirmed = await this.showBulkDeleteConfirmDialog(selectedManifestKeys.length);
            } else {
                confirmed = await this.showConfirmDialog(
                    '確認刪除',
                    `確定要永久刪除 ${selectedManifestKeys.length} 筆聯單嗎？（此操作無法復原）`
                );
            }

            if (!confirmed) return;

            // Check if currently displayed manifest is being deleted
            const currentDisplayElement = document.querySelector('.manifest-item.current-display');
            let currentManifestKey = null;
            if (currentDisplayElement) {
                const manifestNumber = currentDisplayElement.dataset.manifestNumber;
                const wasteSubstanceId = currentDisplayElement.dataset.wasteSubstanceId;
                currentManifestKey = `${manifestNumber}-${wasteSubstanceId}`;
            }
            const isCurrentManifestBeingDeleted = currentManifestKey && selectedManifestKeys.includes(currentManifestKey);

            // Perform server-side deletion using manifest keys
            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
            const deleteResponse = await APIUtils.post('/transportation/api/bulk_remove/', {
                category: this.manager.currentCategory,
                filters: this.activeFilters,
                selectedManifestKeys: selectedManifestKeys
            }, csrfToken);

            if (deleteResponse.success) {
                const deleteData = deleteResponse.data;
                this.showAlert(`已刪除 ${deleteData.removedCount} 筆聯單`, true);

                // Clear all selections and cache
                this.globalSelectedManifests.clear();
                this.allLoadedManifests = [];
                this.allManifestData = [];
                this.manager.selectedManifests.clear();

                // Always clear current manifest detail to force reselection after deletion
                this.manager.currentManifestDetail = null;

                // Clear the displayed manifest detail immediately
                this.clearAllTabs();
                this.showDetailEmptyState();

                // Reset scroll state
                this.resetScrollState();

                // Reload data and update statistics
                await this.manager.loadManifests(this.manager.currentCategory);

                // After reload completes, updateManifestsList will auto-select first manifest
                // Force statistics update after data reload
                setTimeout(async () => {
                    await this.updateStatisticsWithFilters();
                }, 100);

            } else {
                this.showAlert(deleteResponse.error || '操作失敗');
            }
        } catch (error) {
            console.error('Delete error:', error);
            this.showAlert('操作時發生錯誤');
        }
    }

    // Select ALL manifests that match current filter criteria using server-side operation
    async handleSelectAllMatchingServerSide(selectAll) {
        try {
            // Get ALL matching manifests from server, not just visible ones
            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
            const response = await APIUtils.post('/transportation/api/get_matching_manifests/', {
                category: this.manager.currentCategory,
                filters: this.activeFilters,
                action: selectAll ? 'select_all' : 'deselect_all'
            }, csrfToken);

            if (response.success) {
                const data = response.data;
                const manifestDetails = data.manifestDetails || [];

                if (selectAll) {
                    // Add ALL matching manifests to selection
                    manifestDetails.forEach(manifest => {
                        const manifestKey = `${manifest.manifestNumber}-${manifest.wasteSubstanceId}`;
                        this.globalSelectedManifests.add(manifestKey);
                        this.manager.selectedManifests.add(manifestKey);
                    });
                } else {
                    // Remove ALL matching manifests from selection
                    manifestDetails.forEach(manifest => {
                        const manifestKey = `${manifest.manifestNumber}-${manifest.wasteSubstanceId}`;
                        this.globalSelectedManifests.delete(manifestKey);
                        this.manager.selectedManifests.delete(manifestKey);
                    });
                }

                // Update visual checkboxes for visible items only
                this.updateVisualCheckboxes();

                // Keep the select all checkbox checked/unchecked
                const selectAllCheckbox = document.getElementById('selectAllManifests');
                selectAllCheckbox.checked = selectAll;
                selectAllCheckbox.indeterminate = false;

                this.updateButtonVisibility();
            } else {
                this.showAlert(response.error || '操作失敗');
            }
        } catch (error) {
            console.error('Select all error:', error);
            this.showAlert('操作時發生錯誤');
        }
    }

    // Update visual checkboxes based on global selection state
    updateVisualCheckboxes() {
        const checkboxes = document.querySelectorAll('.manifest-checkbox');
        checkboxes.forEach(checkbox => {
            const manifestNumber = checkbox.value;
            const wasteSubstanceId = checkbox.dataset.wasteSubstanceId;
            const manifestKey = `${manifestNumber}-${wasteSubstanceId}`;
            checkbox.checked = this.globalSelectedManifests.has(manifestKey);
        });
    }

    bindFilterEvents() {
        const filterCategory = document.getElementById('filterCategory');
        const filterSubCategory = document.getElementById('filterSubCategory');

        // Complete subcategory options for each category
        const categoryOptions = {
            'manifest_overview': [
                { value: 'manifestNumber', text: '聯單編號', type: 'string' },
                { value: 'vehicleNumber', text: '運載車號', type: 'string' },
                { value: 'wasteSubstanceName', text: '廢棄物/物質名稱', type: 'string' }
            ],
            'declaration_info': [
                { value: 'enterpriseCode', text: '事業機構代碼', type: 'string' },
                { value: 'enterpriseName', text: '事業機構名稱', type: 'string' },
                { value: 'declarationDatetime', text: '申報日期', type: 'datetime' },
                { value: 'declaredWeight', text: '申報重量', type: 'number' }
            ],
            'waste_info': [
                { value: 'wasteCode', text: '廢棄物代碼', type: 'string' },
                { value: 'wasteName', text: '廢棄物名稱', type: 'string' },
                { value: 'processCode', text: '製程代碼', type: 'string' },
                { value: 'processName', text: '製程名稱', type: 'string' }
            ],
            'substance_info': [
                { value: 'substanceCode', text: '物質代碼', type: 'string' },
                { value: 'substanceName', text: '物質名稱', type: 'string' },
                { value: 'processCode', text: '製程代碼', type: 'string' },
                { value: 'processName', text: '製程名稱', type: 'string' }
            ],
            'transportation_info': [
                { value: 'transporterCode', text: '清除者代碼', type: 'string' },
                { value: 'transporterName', text: '清除者名稱', type: 'string' },
                { value: 'transportVehicleNumber', text: '清除運載車號', type: 'string' },
                { value: 'transportationDatetime', text: '清運日期/時間', type: 'datetime' },
                { value: 'deliveryDatetime', text: '運送日期/時間', type: 'datetime' }
            ],
            'treatment_info': [
                { value: 'treatmentFacilityCode', text: '處理者代碼', type: 'string' },
                { value: 'treatmentFacilityName', text: '處理者名稱', type: 'string' },
                { value: 'receiptDatetime', text: '收受日期/時間', type: 'datetime' },
                { value: 'intermediateTreatmentMethod', text: '中間處理方式', type: 'string' },
                { value: 'finalDisposalMethod', text: '最終處置方式', type: 'string' }
            ],
            'recovery_info': [
                { value: 'recyclerCode', text: '再利用者代碼', type: 'string' },
                { value: 'recyclerName', text: '再利用者名稱', type: 'string' },
                { value: 'recoveryDatetime', text: '回收日期/時間', type: 'datetime' },
                { value: 'recyclingPurpose', text: '再利用用途', type: 'string' },
                { value: 'recyclingMethod', text: '再利用方式', type: 'string' }
            ]
        };

        // Initialize with first category AFTER categoryOptions is defined
        this.updateSubcategories('manifest_overview', categoryOptions);

        filterCategory.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            this.updateSubcategories(selectedCategory, categoryOptions);
        });

        filterSubCategory.addEventListener('change', (e) => {
            const selectedCategory = filterCategory.value;
            const selectedSubcategory = e.target.value;

            if (!selectedSubcategory) {
                this.hideAllFilterInputs();
                return;
            }

            const categoryData = categoryOptions[selectedCategory];
            const subcategoryData = categoryData?.find(item => item.value === selectedSubcategory);

            if (subcategoryData) {
                this.showFilterInput(subcategoryData.type, selectedSubcategory);
            }
        });

        document.getElementById('addFilterBtn').addEventListener('click', () => {
            this.addFilter();
        });

        document.getElementById('clearFiltersBtn').addEventListener('click', () => {
            this.clearFilters();
        });
    }

    updateSubcategories(category, categoryOptions) {
        const filterSubCategory = document.getElementById('filterSubCategory');
        const options = categoryOptions[category] || [];

        filterSubCategory.innerHTML = '<option value="">請選擇子項目</option>';
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            filterSubCategory.appendChild(optionElement);
        });

        this.hideAllFilterInputs();
    }

    showFilterInput(type, field) {
        const stringFilter = document.getElementById('stringFilter');
        const datetimeFilter = document.getElementById('datetimeFilter');
        const valueFilter = document.getElementById('valueFilter');

        this.hideAllFilterInputs();

        switch (type) {
            case 'string':
                stringFilter.classList.remove('has-hidden');
                this.setupSelect2StringFilter(field);
                break;
            case 'datetime':
                datetimeFilter.classList.remove('has-hidden');
                break;
            case 'number':
                valueFilter.classList.remove('has-hidden');
                break;
        }
    }

    // Setup Select2 with all available options from database
    async setupSelect2StringFilter(field) {
        try {
            // Get all available options for this field without filtering
            const response = await APIUtils.get('/transportation/api/get_field_options/', {
                category: this.manager.currentCategory,
                field: field
            });

            const stringFilter = document.getElementById('stringFilter');

            // Always create a new select element to avoid conflicts
            const newSelect = document.createElement('select');
            newSelect.id = 'stringFilter';
            newSelect.className = 'ts-select';

            // Replace the existing element
            stringFilter.parentNode.replaceChild(newSelect, stringFilter);

            // Add placeholder option
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = '請選擇或輸入...';
            newSelect.appendChild(placeholderOption);

            if (response.success && response.data && response.data.options && response.data.options.length > 0) {
                // Add options from server
                response.data.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    newSelect.appendChild(optionElement);
                });
            }

            // Initialize Select2 with proper dropdownParent
            $(newSelect).select2({
                placeholder: '請選擇或輸入...',
                allowClear: true,
                tags: true,
                width: '100%',
                language: 'zh-TW',
                dropdownParent: $('body'),
                theme: 'default',
                dropdownCssClass: 'transportation-select2-dropdown'
            });

        } catch (error) {
            console.error('Failed to setup Select2:', error);
            this.convertToTextInput(document.getElementById('stringFilter'));
        }
    }

    convertToTextInput(selectElement) {
        const parent = selectElement.parentNode;
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'stringFilter';
        input.className = 'ts-input is-solid';
        input.placeholder = '輸入搜尋文字';
        parent.replaceChild(input, selectElement);
    }

    hideAllFilterInputs() {
        const elements = ['stringFilter', 'datetimeFilter', 'valueFilter'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('has-hidden');
                // Clean up Select2 if it exists and is initialized
                if (typeof $ !== 'undefined' && $.fn.select2 && $(element).hasClass('select2-hidden-accessible')) {
                    try {
                        $(element).select2('destroy');
                    } catch (e) {
                        console.warn('Failed to destroy Select2 instance:', e);
                    }
                }
            }
        });
    }

    addFilter() {
        const category = document.getElementById('filterCategory').value;
        const subCategory = document.getElementById('filterSubCategory').value;

        if (!category || !subCategory) {
            this.showAlert('請選擇類別和子項目');
            return;
        }

        let filterValue = '';
        let filterText = '';

        const stringFilter = document.getElementById('stringFilter');
        const startDatetime = document.getElementById('startDatetime');
        const endDatetime = document.getElementById('endDatetime');
        const minValue = document.getElementById('minValue');
        const maxValue = document.getElementById('maxValue');

        if (stringFilter && !stringFilter.classList.contains('has-hidden')) {
            // Handle Select2 value extraction properly
            if (typeof $ !== 'undefined' && $.fn.select2 && $(stringFilter).hasClass('select2-hidden-accessible')) {
                filterValue = $(stringFilter).val();
            } else {
                filterValue = stringFilter.value;
            }

            // Check if value is valid
            if (!filterValue || filterValue === '' || filterValue === null) {
                this.showAlert('請輸入或選擇搜尋條件');
                return;
            }
            filterText = `${document.getElementById('filterSubCategory').selectedOptions[0].text}: ${filterValue}`;
        } else if (startDatetime && !startDatetime.closest('#datetimeFilter').classList.contains('has-hidden')) {
            const start = startDatetime.value;
            const end = endDatetime.value;
            if (!start && !end) {
                this.showAlert('請選擇日期範圍');
                return;
            }
            filterValue = { start, end };

            // Format datetime to specific format
            const formatDateTime = (isoString) => {
                if (!isoString) return '';
                const date = new Date(isoString);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}年${month}月${day}日${hours}時${minutes}分`;
            };

            const startFormatted = start ? formatDateTime(start) : '開始';
            const endFormatted = end ? formatDateTime(end) : '結束';
            filterText = `${document.getElementById('filterSubCategory').selectedOptions[0].text}: ${startFormatted} 至 ${endFormatted}`;
        } else if (minValue && !minValue.closest('#valueFilter').classList.contains('has-hidden')) {
            const min = minValue.value;
            const max = maxValue.value;
            if (!min && !max) {
                this.showAlert('請輸入數值範圍');
                return;
            }
            filterValue = { min, max };
            filterText = `${document.getElementById('filterSubCategory').selectedOptions[0].text}: ${min || '最小'} 至 ${max || '最大'}`;
        }

        this.addFilterChip({ category, subCategory, value: filterValue, text: filterText });

        // Reset form
        document.getElementById('filterSubCategory').value = '';
        this.hideAllFilterInputs();
        this.clearFilterInputs();
    }

    clearFilterInputs() {
        const stringFilter = document.getElementById('stringFilter');
        const startDatetime = document.getElementById('startDatetime');
        const endDatetime = document.getElementById('endDatetime');
        const minValue = document.getElementById('minValue');
        const maxValue = document.getElementById('maxValue');

        // Handle Select2 clear
        if (stringFilter && typeof $ !== 'undefined' && $.fn.select2 && $(stringFilter).hasClass('select2-hidden-accessible')) {
            $(stringFilter).val(null).trigger('change');
        } else if (stringFilter) {
            stringFilter.value = '';
        }

        if (startDatetime) startDatetime.value = '';
        if (endDatetime) endDatetime.value = '';
        if (minValue) minValue.value = '';
        if (maxValue) maxValue.value = '';
    }

    addFilterChip(filter) {
        const filterChips = document.getElementById('filterChips');

        // Check for duplicates
        const existingChips = Array.from(filterChips.querySelectorAll('.ts-chip'));
        const duplicate = existingChips.find(chip =>
            chip.dataset.category === filter.category &&
            chip.dataset.subCategory === filter.subCategory &&
            chip.dataset.value === JSON.stringify(filter.value)
        );

        if (duplicate) {
            this.showAlert('此篩選條件已存在');
            return;
        }

        const chip = document.createElement('span');
        chip.className = 'ts-chip is-small';
        chip.dataset.category = filter.category;
        chip.dataset.subCategory = filter.subCategory;
        chip.dataset.value = JSON.stringify(filter.value);

        // Use secure method instead of innerHTML
        chip.textContent = filter.text;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'ts-close is-small remove-filter';
        removeBtn.type = 'button';
        chip.appendChild(removeBtn);

        chip.querySelector('.remove-filter').addEventListener('click', () => {
            chip.remove();
            this.activeFilters = this.activeFilters.filter(f =>
                !(f.category === filter.category && f.subCategory === filter.subCategory && JSON.stringify(f.value) === JSON.stringify(filter.value))
            );
            this.updateFilterChipsDisplay();
            this.applyFiltersServerSide();
            this.updateSelectAllStateServerSide();
        });

        filterChips.appendChild(chip);
        this.activeFilters.push(filter);

        this.updateFilterChipsDisplay();
        this.applyFiltersServerSide();
        this.updateSelectAllStateServerSide();
    }

    // Apply filters using server-side processing
    async applyFiltersServerSide() {
        try {
            // Reset scroll state before reloading
            this.resetScrollState();

            // Update statistics with current filters
            await this.updateStatisticsWithFilters();

            // Reload manifests with current filters
            await this.manager.loadManifests(this.manager.currentCategory, 1, false);

            this.updateSelectAllStateServerSide();
            this.updateButtonVisibility();

        } catch (error) {
            console.error('Server-side filter error:', error);
            this.showAlert('篩選時發生錯誤');
        }
    }

    clearFilters() {
        const filterChips = document.getElementById('filterChips');
        filterChips.innerHTML = '';
        this.activeFilters = [];

        this.updateFilterChipsDisplay();
        this.applyFiltersServerSide();
        this.updateSelectAllStateServerSide();
        this.updateButtonVisibility();
    }

    // Update statistics with current filters
    async updateStatisticsWithFilters() {
        try {
            const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
            const response = await APIUtils.post('/transportation/api/get_statistics/', {
                category: this.manager.currentCategory,
                filters: this.activeFilters
            }, csrfToken);

            if (response.success) {
                const data = response.data;
                this.updateStatistics({
                    totalCount: data.totalCount,
                    disposalCount: data.disposalCount,
                    reuseCount: data.reuseCount
                });

                // Update the current category display to show correct count
                this.updateCategoryCount(this.manager.currentCategory, {
                    total: data.totalCount,
                    disposal: data.disposalCount,
                    reuse: data.reuseCount
                });
            }
        } catch (error) {
            console.error('Update statistics with filters error:', error);
        }
    }

    // Update select all state using simple logic
    async updateSelectAllStateServerSide() {
        try {
            const selectAllCheckbox = document.getElementById('selectAllManifests');

            // Simple logic: check if any visible items are selected
            const visibleSelected = this.allLoadedManifests.filter(manifest => {
                const manifestKey = `${manifest.manifestNumber}-${manifest.wasteSubstanceId}`;
                return this.globalSelectedManifests.has(manifestKey);
            }).length;

            const totalVisible = this.allLoadedManifests.length;

            if (totalVisible === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (visibleSelected === totalVisible) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else if (visibleSelected > 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        } catch (error) {
            console.error('Update select all state error:', error);
        }
    }

    handleEmptyState(visibleCount) {
        const container = document.getElementById('selectManifest');
        const existingMessage = container.querySelector('#noManifestsMessage');

        if (visibleCount === 0) {
            if (!existingMessage) {
                this.showNoDataMessage(container);
            }
        } else {
            if (existingMessage) {
                existingMessage.remove();
            }
        }
    }

    updateCategoryDisplay(category) {
        // Only clear current-display from category buttons, not manifest items
        const categoryContainer = document.querySelector('.ts-segment.is-tertiary-indicated');
        if (categoryContainer) {
            categoryContainer.querySelectorAll('.current-display').forEach(el => {
                el.classList.remove('current-display');
            });
        }

        const categoryMap = {
            'overall': 'overallCategory',
            'disposal': 'disposalCategory',
            'reuse': 'reuseCategory'
        };

        const targetElement = document.getElementById(categoryMap[category]);
        if (targetElement) {
            targetElement.classList.add('current-display');
        }
    }

    updateStatistics(stats) {
        document.getElementById('totalCount').textContent = stats.totalCount || 0;
        document.getElementById('disposalCount').textContent = stats.disposalCount || 0;
        document.getElementById('reuseCount').textContent = stats.reuseCount || 0;
    }

    updateCategoryCount(currentCategory, stats) {
        // Only clear current-display from category buttons, not manifest items
        const categoryContainer = document.querySelector('.ts-segment.is-tertiary-indicated');
        if (categoryContainer) {
            categoryContainer.querySelectorAll('.current-display').forEach(el => {
                el.classList.remove('current-display');
            });
        }

        const categoryMap = {
            'overall': { element: 'overallCategory', count: stats.total },
            'disposal': { element: 'disposalCategory', count: stats.disposal },
            'reuse': { element: 'reuseCategory', count: stats.reuse }
        };

        const current = categoryMap[currentCategory];
        if (current) {
            const element = document.getElementById(current.element);
            if (element) {
                element.classList.add('current-display');
            }
        }
    }

    // Correct manifest list update with NO duplication
    updateManifestsList(manifests, append = false) {
        const container = document.getElementById('selectManifest');

        console.log(`updateManifestsList called: append=${append}, manifests count=${manifests.length}`);

        if (!append) {
            // Complete reset for new category or fresh load
            this.allManifestData = [];
            this.displayedManifests = [];
            this.allLoadedManifests = [];
            this.resetScrollState();
            container.innerHTML = '';
            console.log('Manifest list reset');
        }

        if (manifests.length === 0 && !append) {
            this.showNoDataMessage(container);
            this.updateButtonVisibility();
            this.showOverviewTabWithEmptyState();
            return;
        }

        if (append || manifests.length > 0) {
            const existingMessage = container.querySelector('#noManifestsMessage');
            if (existingMessage) {
                existingMessage.remove();
            }
        }

        // When appending, only add NEW manifests and render ONLY the new ones
        if (append) {
            this.allManifestData.push(...manifests);
            this.displayedManifests.push(...manifests);
            this.allLoadedManifests.push(...manifests);

            // Only render the NEW manifests, not ALL manifests
            manifests.forEach(manifest => {
                const manifestElement = this.createManifestElement(manifest);
                container.appendChild(manifestElement);
            });

            console.log(`Appended ${manifests.length} new manifests. Total: ${this.allLoadedManifests.length}`);
        } else {
            // Initial load - render all manifests
            this.allManifestData = [...manifests];
            this.displayedManifests = [...manifests];
            this.allLoadedManifests = [...manifests];

            container.innerHTML = '';
            manifests.forEach(manifest => {
                const manifestElement = this.createManifestElement(manifest);
                container.appendChild(manifestElement);
            });

            console.log(`Initial load: ${manifests.length} manifests loaded`);
        }

        this.updateButtonVisibility();

        // Auto-select first manifest if not appending and has manifests
        if (!append && manifests.length > 0) {
            setTimeout(() => {
                this.autoSelectFirstManifest();
            }, 100);
        }
    }

    // Always show 聯單總覽 tab with proper state
    showOverviewTabWithEmptyState() {
        // Reset tab to 聯單總覽
        this.resetToOverviewTab();

        // Show empty state in overview tab
        this.showDetailEmptyState();
    }

    // Reset tab to 聯單總覽
    resetToOverviewTab() {
        const tabButtons = document.querySelectorAll('.ts-tab .item[data-tab]');
        const overviewTabButton = document.querySelector('.ts-tab .item[data-tab="tabOverview"]');

        if (overviewTabButton) {
            // Remove is-active from all tab buttons
            tabButtons.forEach(btn => btn.classList.remove('is-active'));
            // Add is-active to overview tab
            overviewTabButton.classList.add('is-active');

            // Trigger tab switch by clicking the overview tab (TocasUI 5.0 method)
            overviewTabButton.click();
        }
    }

    // Auto-select first manifest with error handling and verification
    autoSelectFirstManifest() {
        try {
            const firstManifestElement = document.querySelector('.manifest-item');
            if (firstManifestElement) {
                // Clear any existing current-display first
                document.querySelectorAll('.manifest-item.current-display').forEach(el => {
                    el.classList.remove('current-display');
                });

                // Select the first manifest
                this.selectManifest(firstManifestElement);

                // Verify the selection was applied
                setTimeout(() => {
                    if (!firstManifestElement.classList.contains('current-display')) {
                        console.warn('Auto-select failed, retrying...');
                        firstManifestElement.classList.add('current-display');

                        // Load manifest detail if not already loaded
                        const manifestNumber = firstManifestElement.dataset.manifestNumber;
                        const wasteSubstanceId = firstManifestElement.dataset.wasteSubstanceId;
                        if (manifestNumber && wasteSubstanceId) {
                            this.manager.loadManifestDetail(manifestNumber, wasteSubstanceId);
                        }
                    }
                }, 10);
            } else {
                // No manifests to select, show overview with empty state
                this.showOverviewTabWithEmptyState();
            }
        } catch (error) {
            console.error('Error auto-selecting first manifest:', error);
            // Fallback to showing empty overview state
            this.showOverviewTabWithEmptyState();
        }
    }

    showNoDataMessage(container) {
        const noDataMessage = window.SecurityUtils.createElement('div', '', { 
            class: 'ts-blankslate is-large', 
            id: 'noManifestsMessage' 
        });
        
        const icon = window.SecurityUtils.createElement('span', '', { class: 'ts-icon is-table-list-icon' });
        const header = window.SecurityUtils.createElement('div', '無聯單資料', { class: 'header' });
        const description = window.SecurityUtils.createElement('div', '請先匯入聯單資料或調整篩選條件', { class: 'description' });
        
        noDataMessage.appendChild(icon);
        noDataMessage.appendChild(header);
        noDataMessage.appendChild(description);
        container.appendChild(noDataMessage);
    }

    createManifestElement(manifest) {
        const manifestDiv = document.createElement('div');
        manifestDiv.className = `ts-box is-${manifest.manifestType === 'disposal' ? 'disposal' : 'reuse'} is-start-indicated is-raised has-padded manifest-item`;
        manifestDiv.dataset.manifestNumber = manifest.manifestNumber;
        manifestDiv.dataset.wasteSubstanceId = manifest.wasteSubstanceId;

        const manifestKey = `${manifest.manifestNumber}-${manifest.wasteSubstanceId}`;
        const isChecked = this.globalSelectedManifests.has(manifestKey);

        // Create safe DOM structure instead of using innerHTML
        const grid = document.createElement('div');
        grid.className = 'ts-grid';
        
        // Create checkbox column
        const checkboxColumn = document.createElement('div');
        checkboxColumn.className = 'column is-2-wide is-center-aligned';
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'ts-checkbox is-large';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'manifest-checkbox';
        checkbox.value = manifest.manifestNumber;
        checkbox.setAttribute('data-waste-substance-id', manifest.wasteSubstanceId);
        checkbox.checked = isChecked;
        checkboxLabel.appendChild(checkbox);
        checkboxColumn.appendChild(checkboxLabel);
        
        // Create content column
        const contentColumn = document.createElement('div');
        contentColumn.className = 'column is-14-wide';
        const manifestText = document.createElement('div');
        manifestText.className = 'ts-text is-big monospace-medium';
        manifestText.textContent = manifest.manifestNumber; // Safe text content
        const wasteText = document.createElement('div');
        wasteText.className = 'ts-text is-description is-truncated';
        wasteText.textContent = manifest.wasteSubstanceName; // Safe text content
        contentColumn.appendChild(manifestText);
        contentColumn.appendChild(wasteText);
        
        grid.appendChild(checkboxColumn);
        grid.appendChild(contentColumn);
        manifestDiv.appendChild(grid);

        const spacingDiv = document.createElement('div');
        spacingDiv.className = 'has-spaced';
        manifestDiv.appendChild(spacingDiv);

        manifestDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.manifest-checkbox')) {
                this.selectManifest(manifestDiv);
            }
        });

        const checkboxElement = manifestDiv.querySelector('.manifest-checkbox');
        checkboxElement.addEventListener('change', (e) => {
            this.toggleManifestSelection(manifest.manifestNumber, manifest.wasteSubstanceId, e.target.checked);
        });

        return manifestDiv;
    }

    selectManifest(manifestElement) {
        document.querySelectorAll('.manifest-item.current-display').forEach(el => {
            el.classList.remove('current-display');
        });

        manifestElement.classList.add('current-display');

        // Always reset tab to "聯單總覽" when selecting a manifest
        this.resetToOverviewTab();

        const manifestNumber = manifestElement.dataset.manifestNumber;
        const wasteSubstanceId = manifestElement.dataset.wasteSubstanceId;
        this.manager.loadManifestDetail(manifestNumber, wasteSubstanceId);
    }

    toggleManifestSelection(manifestNumber, wasteSubstanceId, selected) {
        const manifestKey = `${manifestNumber}-${wasteSubstanceId}`;

        if (selected) {
            this.globalSelectedManifests.add(manifestKey);
            this.manager.selectedManifests.add(manifestKey);
        } else {
            this.globalSelectedManifests.delete(manifestKey);
            this.manager.selectedManifests.delete(manifestKey);
        }

        this.updateButtonVisibility();
        this.updateSelectAllStateServerSide();
    }

    async updateButtonVisibility() {
        try {
            // Use global selected manifests count
            const selectedCount = this.globalSelectedManifests.size;

            const importBtn = document.getElementById('importBtn');
            const deleteBtn = document.getElementById('deleteBtn');

            if (selectedCount > 0) {
                importBtn.classList.add('has-hidden');
                deleteBtn.classList.remove('has-hidden');
                // Create safe button content
                deleteBtn.replaceChildren();
                const icon = document.createElement('span');
                icon.className = 'ts-icon is-trash-can-icon';
                deleteBtn.appendChild(icon);
                deleteBtn.appendChild(document.createTextNode(`刪除聯單 (${selectedCount})`));
            } else {
                importBtn.classList.remove('has-hidden');
                deleteBtn.classList.add('has-hidden');
            }
        } catch (error) {
            console.error('Update button visibility error:', error);
            // Fallback to local count if error occurs
            const localSelectedCount = this.manager.selectedManifests.size;
            const importBtn = document.getElementById('importBtn');
            const deleteBtn = document.getElementById('deleteBtn');

            if (localSelectedCount > 0) {
                importBtn.classList.add('has-hidden');
                deleteBtn.classList.remove('has-hidden');
                deleteBtn.innerHTML = `
                    <span class="ts-icon is-trash-can-icon"></span>
                    刪除聯單 (${localSelectedCount})
                `;
            } else {
                importBtn.classList.remove('has-hidden');
                deleteBtn.classList.add('has-hidden');
            }
        }
    }

    clearAllTabs() {
        const tabs = ['tabOverview', 'tabDeclarationInfo', 'tabWasteInfo', 'tabSubstanceInfo', 'tabTransportationInfo', 'tabTreatmentInfo', 'tabRecycleInfo'];
        tabs.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (tab) {
                tab.innerHTML = '';
            }
        });
    }

    // Convert UTC datetime string to UTC+8 Taiwan time
    convertToTaiwanTime(utcDatetimeString) {
        if (!utcDatetimeString) return '';

        try {
            // Parse "2018/12/31 23:00:00" format as UTC time
            const parts = utcDatetimeString.match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
            if (!parts) return utcDatetimeString;

            const [, year, month, day, hour, minute, second] = parts;

            // Create UTC Date object
            const utcDate = new Date(Date.UTC(
                parseInt(year),
                parseInt(month) - 1, // Month is 0-based
                parseInt(day),
                parseInt(hour),
                parseInt(minute),
                parseInt(second)
            ));

            // Add 8 hours for Taiwan timezone
            const taiwanTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));

            // Format as YYYY/MM/DD HH:MM:SS
            const formatNumber = (num) => String(num).padStart(2, '0');

            return `${taiwanTime.getUTCFullYear()}/${formatNumber(taiwanTime.getUTCMonth() + 1)}/${formatNumber(taiwanTime.getUTCDate())} ${formatNumber(taiwanTime.getUTCHours())}:${formatNumber(taiwanTime.getUTCMinutes())}:${formatNumber(taiwanTime.getUTCSeconds())}`;
        } catch (error) {
            console.error('Date conversion error:', error);
            return utcDatetimeString; // Return original if conversion fails
        }
    }

    // Update manifest detail display following exact layout from layout_transport.html
    updateManifestDetail(detail) {
        this.clearAllTabs();

        const overviewTab = document.getElementById('tabOverview');
        if (detail) {
            // Create overview tab using safe DOM methods
            window.SecurityUtils.clearElement(overviewTab);
            
            const grid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-3-columns has-spaced' });
            
            // Manifest number column
            const manifestColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const manifestContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const manifestHeader = window.SecurityUtils.createElement('div', '聯單編號', { class: 'ts-header has-bottom-spaced-small' });
            const manifestText = window.SecurityUtils.createElement('div', detail.manifestNumber || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            manifestContent.appendChild(manifestHeader);
            manifestContent.appendChild(manifestText);
            manifestColumn.appendChild(manifestContent);
            
            // Manifest type column
            const typeColumn = window.SecurityUtils.createElement('div', '', { 
                class: `column ts-box is-raised background-quaternary is-top-indicated ${detail.manifestType === '清除單' ? 'is-disposal' : 'is-reuse'} current-display` 
            });
            const typeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const typeHeader = window.SecurityUtils.createElement('div', '聯單類型', { class: 'ts-header has-bottom-spaced-small' });
            const typeText = window.SecurityUtils.createElement('div', detail.manifestType || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            typeContent.appendChild(typeHeader);
            typeContent.appendChild(typeText);
            typeColumn.appendChild(typeContent);
            
            // Vehicle number column
            const vehicleColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const vehicleContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const vehicleHeader = window.SecurityUtils.createElement('div', '運載車號', { class: 'ts-header has-bottom-spaced-small' });
            const vehicleText = window.SecurityUtils.createElement('div', detail.vehicleNumber || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            vehicleContent.appendChild(vehicleHeader);
            vehicleContent.appendChild(vehicleText);
            vehicleColumn.appendChild(vehicleContent);
            
            grid.appendChild(manifestColumn);
            grid.appendChild(typeColumn);
            grid.appendChild(vehicleColumn);
            overviewTab.appendChild(grid);

            // Create declaration info tab using safe DOM methods
            const declarationTab = document.getElementById('tabDeclarationInfo');
            window.SecurityUtils.clearElement(declarationTab);
            
            // Date/time section
            const dateGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-1-columns has-spaced' });
            const dateColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const dateContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const dateInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
            const dateLabel = window.SecurityUtils.createElement('div', '申報日期/時間', { class: 'column is-2-wide ts-header has-bottom-spaced-small' });
            const dateValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.declarationDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
            dateInnerGrid.appendChild(dateLabel);
            dateInnerGrid.appendChild(dateValue);
            dateContent.appendChild(dateInnerGrid);
            dateColumn.appendChild(dateContent);
            dateGrid.appendChild(dateColumn);
            
            // Weight section
            const weightGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-1-columns has-spaced' });
            const weightColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const weightContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const weightInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-middle-aligned' });
            const weightLabel = window.SecurityUtils.createElement('div', '申報重量', { class: 'column is-2-wide ts-header has-bottom-spaced-small' });
            const weightValueColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-3-wide' });
            const weightValue = window.SecurityUtils.createElement('div', detail.declaredWeight || '', { class: 'ts-text is-massive monospace-medium' });
            const weightUnitColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid' });
            const weightUnit = window.SecurityUtils.createElement('div', '公斤', { class: 'ts-text is-large monospace-medium' });
            weightValueColumn.appendChild(weightValue);
            weightUnitColumn.appendChild(weightUnit);
            weightInnerGrid.appendChild(weightLabel);
            weightInnerGrid.appendChild(weightValueColumn);
            weightInnerGrid.appendChild(weightUnitColumn);
            weightContent.appendChild(weightInnerGrid);
            weightColumn.appendChild(weightContent);
            weightGrid.appendChild(weightColumn);
            
            // Enterprise info section
            const enterpriseGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
            const enterpriseCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-4-wide ts-box is-raised background-quaternary' });
            const enterpriseCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const enterpriseCodeHeader = window.SecurityUtils.createElement('div', '事業機構代碼', { class: 'ts-header has-bottom-spaced-small' });
            const enterpriseCodeText = window.SecurityUtils.createElement('div', detail.enterpriseCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            enterpriseCodeContent.appendChild(enterpriseCodeHeader);
            enterpriseCodeContent.appendChild(enterpriseCodeText);
            enterpriseCodeColumn.appendChild(enterpriseCodeContent);
            
            const enterpriseNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
            const enterpriseNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const enterpriseNameHeader = window.SecurityUtils.createElement('div', '事業機構名稱', { class: 'ts-header has-bottom-spaced-small' });
            const enterpriseNameText = window.SecurityUtils.createElement('div', detail.enterpriseName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            enterpriseNameContent.appendChild(enterpriseNameHeader);
            enterpriseNameContent.appendChild(enterpriseNameText);
            enterpriseNameColumn.appendChild(enterpriseNameContent);
            
            enterpriseGrid.appendChild(enterpriseCodeColumn);
            enterpriseGrid.appendChild(enterpriseNameColumn);
            
            declarationTab.appendChild(dateGrid);
            declarationTab.appendChild(weightGrid);
            declarationTab.appendChild(enterpriseGrid);

            // Create transportation info tab using safe DOM methods
            const transportationTab = document.getElementById('tabTransportationInfo');
            window.SecurityUtils.clearElement(transportationTab);
            
            // Transporter info section
            const transporterGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
            const transporterCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-4-wide ts-box is-raised background-quaternary' });
            const transporterCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const transporterCodeHeader = window.SecurityUtils.createElement('div', '清除者代碼', { class: 'ts-header has-bottom-spaced-small' });
            const transporterCodeText = window.SecurityUtils.createElement('div', detail.transporterCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            transporterCodeContent.appendChild(transporterCodeHeader);
            transporterCodeContent.appendChild(transporterCodeText);
            transporterCodeColumn.appendChild(transporterCodeContent);
            
            const transporterNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
            const transporterNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const transporterNameHeader = window.SecurityUtils.createElement('div', '清除者名稱', { class: 'ts-header has-bottom-spaced-small' });
            const transporterNameText = window.SecurityUtils.createElement('div', detail.transporterName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
            transporterNameContent.appendChild(transporterNameHeader);
            transporterNameContent.appendChild(transporterNameText);
            transporterNameColumn.appendChild(transporterNameContent);
            
            transporterGrid.appendChild(transporterCodeColumn);
            transporterGrid.appendChild(transporterNameColumn);
            
            // Transportation datetime section
            const transportationDateGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-1-columns has-spaced' });
            const transportationDateColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const transportationDateContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const transportationDateInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
            const transportationDateLabel = window.SecurityUtils.createElement('div', '清運日期/時間', { class: 'column is-2-wide ts-header has-bottom-spaced-small' });
            const transportationDateValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.transportationDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
            transportationDateInnerGrid.appendChild(transportationDateLabel);
            transportationDateInnerGrid.appendChild(transportationDateValue);
            transportationDateContent.appendChild(transportationDateInnerGrid);
            transportationDateColumn.appendChild(transportationDateContent);
            transportationDateGrid.appendChild(transportationDateColumn);
            
            // Delivery datetime section
            const deliveryDateGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-1-columns has-spaced' });
            const deliveryDateColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const deliveryDateContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const deliveryDateInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
            const deliveryDateLabel = window.SecurityUtils.createElement('div', '運送日期/時間', { class: 'column is-2-wide ts-header has-bottom-spaced-small' });
            const deliveryDateValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.deliveryDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
            deliveryDateInnerGrid.appendChild(deliveryDateLabel);
            deliveryDateInnerGrid.appendChild(deliveryDateValue);
            deliveryDateContent.appendChild(deliveryDateInnerGrid);
            deliveryDateColumn.appendChild(deliveryDateContent);
            deliveryDateGrid.appendChild(deliveryDateColumn);
            
            // Transport vehicle number section
            const transportVehicleGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-1-columns has-spaced' });
            const transportVehicleColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
            const transportVehicleContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
            const transportVehicleInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
            const transportVehicleLabel = window.SecurityUtils.createElement('div', '清除者運載車號', { class: 'column is-2-wide ts-header has-bottom-spaced-small' });
            const transportVehicleValue = window.SecurityUtils.createElement('div', detail.transportVehicleNumber || '', { class: 'column is-fluid ts-text is-massive monospace-medium' });
            transportVehicleInnerGrid.appendChild(transportVehicleLabel);
            transportVehicleInnerGrid.appendChild(transportVehicleValue);
            transportVehicleContent.appendChild(transportVehicleInnerGrid);
            transportVehicleColumn.appendChild(transportVehicleContent);
            transportVehicleGrid.appendChild(transportVehicleColumn);
            
            transportationTab.appendChild(transporterGrid);
            transportationTab.appendChild(transportationDateGrid);
            transportationTab.appendChild(deliveryDateGrid);
            transportationTab.appendChild(transportVehicleGrid);

            this.updateTabVisibility(detail.manifestType);

            if (detail.manifestType === '清除單') {
                this.updateWasteInfo(detail);
                this.updateTreatmentInfo(detail);
            } else if (detail.manifestType === '再利用單') {
                this.updateSubstanceInfo(detail);
                this.updateRecoveryInfo(detail);
            }
        } else {
            this.showDetailEmptyState();
        }
    }

    // Update waste info display
    updateWasteInfo(detail) {
        const wasteTab = document.getElementById('tabWasteInfo');
        window.SecurityUtils.clearElement(wasteTab);
        
        // First grid - waste code and name
        const firstGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
        
        // Waste code column
        const wasteCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-4-wide ts-box is-raised background-quaternary is-disposal' });
        const wasteCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const wasteCodeHeader = window.SecurityUtils.createElement('div', '廢棄物代碼', { class: 'ts-header has-bottom-spaced-small' });
        const wasteCodeText = window.SecurityUtils.createElement('div', detail.wasteCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        wasteCodeContent.appendChild(wasteCodeHeader);
        wasteCodeContent.appendChild(wasteCodeText);
        wasteCodeColumn.appendChild(wasteCodeContent);
        
        // Waste name column
        const wasteNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const wasteNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const wasteNameHeader = window.SecurityUtils.createElement('div', '廢棄物名稱', { class: 'ts-header has-bottom-spaced-small' });
        const wasteNameText = window.SecurityUtils.createElement('div', detail.wasteName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        wasteNameContent.appendChild(wasteNameHeader);
        wasteNameContent.appendChild(wasteNameText);
        wasteNameColumn.appendChild(wasteNameContent);
        
        firstGrid.appendChild(wasteCodeColumn);
        firstGrid.appendChild(wasteNameColumn);
        
        // Second grid - process code and name
        const secondGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
        
        // Process code column
        const processCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-4-wide ts-box is-raised background-quaternary is-disposal' });
        const processCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const processCodeHeader = window.SecurityUtils.createElement('div', '製程代碼', { class: 'ts-header has-bottom-spaced-small' });
        const processCodeText = window.SecurityUtils.createElement('div', detail.processCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        processCodeContent.appendChild(processCodeHeader);
        processCodeContent.appendChild(processCodeText);
        processCodeColumn.appendChild(processCodeContent);
        
        // Process name column
        const processNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const processNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const processNameHeader = window.SecurityUtils.createElement('div', '製程名稱', { class: 'ts-header has-bottom-spaced-small' });
        const processNameText = window.SecurityUtils.createElement('div', detail.processName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        processNameContent.appendChild(processNameHeader);
        processNameContent.appendChild(processNameText);
        processNameColumn.appendChild(processNameContent);
        
        secondGrid.appendChild(processCodeColumn);
        secondGrid.appendChild(processNameColumn);
        
        wasteTab.appendChild(firstGrid);
        wasteTab.appendChild(secondGrid);
    }

    // Update treatment info display
    updateTreatmentInfo(detail) {
        const treatmentTab = document.getElementById('tabTreatmentInfo');
        window.SecurityUtils.clearElement(treatmentTab);
        
        // First grid - receipt and completion dates
        const dateGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-2-columns has-spaced' });
        
        // Receipt date column
        const receiptColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
        const receiptContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const receiptInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
        const receiptLabel = window.SecurityUtils.createElement('div', '收受日期/時間', { class: 'column is-5-wide ts-header has-bottom-spaced-small' });
        const receiptValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.receiptDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
        receiptInnerGrid.appendChild(receiptLabel);
        receiptInnerGrid.appendChild(receiptValue);
        receiptContent.appendChild(receiptInnerGrid);
        receiptColumn.appendChild(receiptContent);
        
        // Treatment completion date column
        const completionColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
        const completionContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const completionInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
        const completionLabel = window.SecurityUtils.createElement('div', '處理完成日期/時間', { class: 'column is-5-wide ts-header has-bottom-spaced-small' });
        const completionValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.treatmentCompletionDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
        completionInnerGrid.appendChild(completionLabel);
        completionInnerGrid.appendChild(completionValue);
        completionContent.appendChild(completionInnerGrid);
        completionColumn.appendChild(completionContent);
        
        dateGrid.appendChild(receiptColumn);
        dateGrid.appendChild(completionColumn);
        
        // Second grid - facility info
        const facilityGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
        
        // Facility code column
        const facilityCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-4-wide ts-box is-raised background-quaternary is-disposal' });
        const facilityCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const facilityCodeHeader = window.SecurityUtils.createElement('div', '處理者代碼', { class: 'ts-header has-bottom-spaced-small' });
        const facilityCodeText = window.SecurityUtils.createElement('div', detail.treatmentFacilityCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        facilityCodeContent.appendChild(facilityCodeHeader);
        facilityCodeContent.appendChild(facilityCodeText);
        facilityCodeColumn.appendChild(facilityCodeContent);
        
        // Facility name column
        const facilityNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const facilityNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const facilityNameHeader = window.SecurityUtils.createElement('div', '處理者名稱', { class: 'ts-header has-bottom-spaced-small' });
        const facilityNameText = window.SecurityUtils.createElement('div', detail.treatmentFacilityName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        facilityNameContent.appendChild(facilityNameHeader);
        facilityNameContent.appendChild(facilityNameText);
        facilityNameColumn.appendChild(facilityNameContent);
        
        facilityGrid.appendChild(facilityCodeColumn);
        facilityGrid.appendChild(facilityNameColumn);
        
        // Third grid - treatment methods
        const methodGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-2-columns has-spaced' });
        
        // Intermediate treatment method column
        const intermediateColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary is-disposal' });
        const intermediateContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const intermediateHeader = window.SecurityUtils.createElement('div', '中間處理方式', { class: 'ts-header has-bottom-spaced-small' });
        const intermediateText = window.SecurityUtils.createElement('div', detail.intermediateTreatmentMethod || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        intermediateContent.appendChild(intermediateHeader);
        intermediateContent.appendChild(intermediateText);
        intermediateColumn.appendChild(intermediateContent);
        
        // Final disposal method column
        const finalColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const finalContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const finalHeader = window.SecurityUtils.createElement('div', '最終處置方式', { class: 'ts-header has-bottom-spaced-small' });
        const finalText = window.SecurityUtils.createElement('div', detail.finalDisposalMethod || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        finalContent.appendChild(finalHeader);
        finalContent.appendChild(finalText);
        finalColumn.appendChild(finalContent);
        
        methodGrid.appendChild(intermediateColumn);
        methodGrid.appendChild(finalColumn);
        
        // Fourth grid - vehicle number
        const vehicleGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-1-columns has-spaced' });
        const vehicleColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
        const vehicleContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const vehicleInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
        const vehicleLabel = window.SecurityUtils.createElement('div', '處理者運載車號', { class: 'column is-2-wide ts-header has-bottom-spaced-small' });
        const vehicleValue = window.SecurityUtils.createElement('div', detail.treatmentVehicleNumber || '', { class: 'column is-fluid ts-text is-massive monospace-medium' });
        vehicleInnerGrid.appendChild(vehicleLabel);
        vehicleInnerGrid.appendChild(vehicleValue);
        vehicleContent.appendChild(vehicleInnerGrid);
        vehicleColumn.appendChild(vehicleContent);
        vehicleGrid.appendChild(vehicleColumn);
        
        treatmentTab.appendChild(dateGrid);
        treatmentTab.appendChild(facilityGrid);
        treatmentTab.appendChild(methodGrid);
        treatmentTab.appendChild(vehicleGrid);
    }

    // Update substance info display
    updateSubstanceInfo(detail) {
        const substanceTab = document.getElementById('tabSubstanceInfo');
        window.SecurityUtils.clearElement(substanceTab);
        
        // First grid - substance code and name
        const firstGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
        
        // Substance code column
        const substanceCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-2-wide ts-box is-raised background-quaternary is-reuse' });
        const substanceCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const substanceCodeHeader = window.SecurityUtils.createElement('div', '物質代碼', { class: 'ts-header has-bottom-spaced-small' });
        const substanceCodeText = window.SecurityUtils.createElement('div', detail.substanceCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        substanceCodeContent.appendChild(substanceCodeHeader);
        substanceCodeContent.appendChild(substanceCodeText);
        substanceCodeColumn.appendChild(substanceCodeContent);
        
        // Substance name column
        const substanceNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const substanceNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const substanceNameHeader = window.SecurityUtils.createElement('div', '物質名稱', { class: 'ts-header has-bottom-spaced-small' });
        const substanceNameText = window.SecurityUtils.createElement('div', detail.substanceName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        substanceNameContent.appendChild(substanceNameHeader);
        substanceNameContent.appendChild(substanceNameText);
        substanceNameColumn.appendChild(substanceNameContent);
        
        firstGrid.appendChild(substanceCodeColumn);
        firstGrid.appendChild(substanceNameColumn);
        
        // Second grid - process code and name
        const secondGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
        
        // Process code column
        const processCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-2-wide ts-box is-raised background-quaternary is-reuse' });
        const processCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const processCodeHeader = window.SecurityUtils.createElement('div', '製程代碼', { class: 'ts-header has-bottom-spaced-small' });
        const processCodeText = window.SecurityUtils.createElement('div', detail.processCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        processCodeContent.appendChild(processCodeHeader);
        processCodeContent.appendChild(processCodeText);
        processCodeColumn.appendChild(processCodeContent);
        
        // Process name column
        const processNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const processNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const processNameHeader = window.SecurityUtils.createElement('div', '製程名稱', { class: 'ts-header has-bottom-spaced-small' });
        const processNameText = window.SecurityUtils.createElement('div', detail.processName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        processNameContent.appendChild(processNameHeader);
        processNameContent.appendChild(processNameText);
        processNameColumn.appendChild(processNameContent);
        
        secondGrid.appendChild(processCodeColumn);
        secondGrid.appendChild(processNameColumn);
        
        substanceTab.appendChild(firstGrid);
        substanceTab.appendChild(secondGrid);
    }

    // Update recovery info display
    updateRecoveryInfo(detail) {
        const recycleTab = document.getElementById('tabRecycleInfo');
        window.SecurityUtils.clearElement(recycleTab);
        
        // First grid - recovery dates
        const dateGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-2-columns has-spaced' });
        
        // Recovery date column
        const recoveryDateColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
        const recoveryDateContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const recoveryDateInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
        const recoveryDateLabel = window.SecurityUtils.createElement('div', '回收日期/時間', { class: 'column is-5-wide ts-header has-bottom-spaced-small' });
        const recoveryDateValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.recoveryDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
        recoveryDateInnerGrid.appendChild(recoveryDateLabel);
        recoveryDateInnerGrid.appendChild(recoveryDateValue);
        recoveryDateContent.appendChild(recoveryDateInnerGrid);
        recoveryDateColumn.appendChild(recoveryDateContent);
        
        // Recycling completion date column
        const completionDateColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary' });
        const completionDateContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const completionDateInnerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid' });
        const completionDateLabel = window.SecurityUtils.createElement('div', '再利用完成日期/時間', { class: 'column is-5-wide ts-header has-bottom-spaced-small' });
        const completionDateValue = window.SecurityUtils.createElement('div', this.convertToTaiwanTime(detail.recyclingCompletionDatetime), { class: 'column is-fluid ts-text is-massive monospace-medium' });
        completionDateInnerGrid.appendChild(completionDateLabel);
        completionDateInnerGrid.appendChild(completionDateValue);
        completionDateContent.appendChild(completionDateInnerGrid);
        completionDateColumn.appendChild(completionDateContent);
        
        dateGrid.appendChild(recoveryDateColumn);
        dateGrid.appendChild(completionDateColumn);
        
        // Second grid - recycler info
        const recyclerGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid has-spaced' });
        
        // Recycler code column
        const recyclerCodeColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-4-wide ts-box is-raised background-quaternary is-reuse' });
        const recyclerCodeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const recyclerCodeHeader = window.SecurityUtils.createElement('div', '再利用者代碼', { class: 'ts-header has-bottom-spaced-small' });
        const recyclerCodeText = window.SecurityUtils.createElement('div', detail.recyclerCode || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        recyclerCodeContent.appendChild(recyclerCodeHeader);
        recyclerCodeContent.appendChild(recyclerCodeText);
        recyclerCodeColumn.appendChild(recyclerCodeContent);
        
        // Recycler name column
        const recyclerNameColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const recyclerNameContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const recyclerNameHeader = window.SecurityUtils.createElement('div', '再利用者名稱', { class: 'ts-header has-bottom-spaced-small' });
        const recyclerNameText = window.SecurityUtils.createElement('div', detail.recyclerName || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        recyclerNameContent.appendChild(recyclerNameHeader);
        recyclerNameContent.appendChild(recyclerNameText);
        recyclerNameColumn.appendChild(recyclerNameContent);
        
        recyclerGrid.appendChild(recyclerCodeColumn);
        recyclerGrid.appendChild(recyclerNameColumn);
        
        // Third grid - recycling purpose and method
        const methodGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-2-columns has-spaced' });
        
        // Recycling purpose column
        const purposeColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary is-reuse' });
        const purposeContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const purposeHeader = window.SecurityUtils.createElement('div', '再利用用途', { class: 'ts-header has-bottom-spaced-small' });
        const purposeText = window.SecurityUtils.createElement('div', detail.recyclingPurpose || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        purposeContent.appendChild(purposeHeader);
        purposeContent.appendChild(purposeText);
        purposeColumn.appendChild(purposeContent);
        
        // Recycling method column
        const methodColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const methodContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const methodHeader = window.SecurityUtils.createElement('div', '再利用方式', { class: 'ts-header has-bottom-spaced-small' });
        const methodText = window.SecurityUtils.createElement('div', detail.recyclingMethod || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        methodContent.appendChild(methodHeader);
        methodContent.appendChild(methodText);
        methodColumn.appendChild(methodContent);
        
        methodGrid.appendChild(purposeColumn);
        methodGrid.appendChild(methodColumn);
        
        // Fourth grid - vehicle numbers
        const vehicleGrid = window.SecurityUtils.createElement('div', '', { class: 'ts-grid is-2-columns has-spaced' });
        
        // Recovery vehicle number column
        const recoveryVehicleColumn = window.SecurityUtils.createElement('div', '', { class: 'column ts-box is-raised background-quaternary is-reuse' });
        const recoveryVehicleContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const recoveryVehicleHeader = window.SecurityUtils.createElement('div', '回收者運載車號', { class: 'ts-header has-bottom-spaced-small' });
        const recoveryVehicleText = window.SecurityUtils.createElement('div', detail.recoveryVehicleNumber || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        recoveryVehicleContent.appendChild(recoveryVehicleHeader);
        recoveryVehicleContent.appendChild(recoveryVehicleText);
        recoveryVehicleColumn.appendChild(recoveryVehicleContent);
        
        // Actual recycler vehicle number column
        const actualVehicleColumn = window.SecurityUtils.createElement('div', '', { class: 'column is-fluid ts-box is-raised background-quaternary' });
        const actualVehicleContent = window.SecurityUtils.createElement('div', '', { class: 'ts-content' });
        const actualVehicleHeader = window.SecurityUtils.createElement('div', '再利用者實際運載車號', { class: 'ts-header has-bottom-spaced-small' });
        const actualVehicleText = window.SecurityUtils.createElement('div', detail.actualRecyclerVehicleNumber || '', { class: 'ts-text is-massive is-center-aligned monospace-medium' });
        actualVehicleContent.appendChild(actualVehicleHeader);
        actualVehicleContent.appendChild(actualVehicleText);
        actualVehicleColumn.appendChild(actualVehicleContent);
        
        vehicleGrid.appendChild(recoveryVehicleColumn);
        vehicleGrid.appendChild(actualVehicleColumn);
        
        recycleTab.appendChild(dateGrid);
        recycleTab.appendChild(recyclerGrid);
        recycleTab.appendChild(methodGrid);
        recycleTab.appendChild(vehicleGrid);
    }

    showDetailEmptyState() {
        // First clear all tabs completely
        this.clearAllTabs();

        // Then set overview tab to show empty state
        const overviewTab = document.getElementById('tabOverview');

        // Create empty state using safe DOM methods
        const blankslate = window.SecurityUtils.createElement('div', '', { class: 'ts-blankslate is-large' });
        const icon = window.SecurityUtils.createElement('span', '', { class: 'ts-icon is-file-lines-icon' });
        const header = window.SecurityUtils.createElement('div', '請選擇聯單', { class: 'header' });
        const description = window.SecurityUtils.createElement('div', '從左側列表中選擇聯單以查看詳細資訊', { class: 'description' });

        blankslate.appendChild(icon);
        blankslate.appendChild(header);
        blankslate.appendChild(description);
        overviewTab.appendChild(blankslate);
    }

    updateTabVisibility(manifestType) {
        const wasteInfoTab = document.querySelector('[data-tab="tabWasteInfo"]');
        const substanceInfoTab = document.querySelector('[data-tab="tabSubstanceInfo"]');
        const treatmentInfoTab = document.querySelector('[data-tab="tabTreatmentInfo"]');
        const recycleInfoTab = document.querySelector('[data-tab="tabRecycleInfo"]');

        if (manifestType === '清除單') {
            wasteInfoTab.style.display = 'block';
            treatmentInfoTab.style.display = 'block';
            substanceInfoTab.style.display = 'none';
            recycleInfoTab.style.display = 'none';
        } else if (manifestType === '再利用單') {
            substanceInfoTab.style.display = 'block';
            recycleInfoTab.style.display = 'block';
            wasteInfoTab.style.display = 'none';
            treatmentInfoTab.style.display = 'none';
        }
    }

    showAlert(message, success = false) {
        // Use GlobalModalManager if available, fallback to native alert
        if (window.GlobalModalManager) {
            const alertType = success ? 'success' : 'error';
            const title = success ? '操作成功' : '操作失敗';
            window.GlobalModalManager.alert(title, message, alertType);
        } else {
            alert(message);
        }
    }

    // Bulk delete confirmation dialog for large operations
    showBulkDeleteConfirmDialog(count) {
        if (window.GlobalModalManager) {
            return window.GlobalModalManager.bulkDeleteConfirm(count);
        } else {
            const requiredText = '我很清楚我目前正在做的事情，而我也願意承擔任何後果。';
            const input = prompt(`您正在刪除大量資料（${count} 筆聯單），請輸入：${requiredText}`);
            return Promise.resolve(input === requiredText);
        }
    }

    showConfirmDialog(title, message) {
        if (window.GlobalModalManager) {
            return window.GlobalModalManager.confirm(title, message);
        } else {
            return Promise.resolve(confirm(message));
        }
    }

    updateProgress(processed, total) {
        // Round to integers to avoid floating point precision issues
        const processedInt = Math.floor(processed);
        const totalInt = Math.floor(total);

        // Ensure percentage doesn't exceed 100
        const rawPercentage = (processedInt / totalInt) * 100;
        const percentage = Math.min(100, rawPercentage).toFixed(2);

        const progressBar = document.querySelector('#loadingModal .bar');
        const progressText = document.getElementById('progressText');

        if (progressBar) {
            progressBar.style.setProperty('--value', percentage);
        }
        if (progressText) {
            progressText.textContent = `${percentage}% (${processedInt}/${totalInt})`;
        }
    }
}