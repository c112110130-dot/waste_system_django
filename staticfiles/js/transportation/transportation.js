// Wait for the DOM to fully load before executing
document.addEventListener('DOMContentLoaded', () => {
    class TransportManager {
        constructor() {
            this.currentCategory = 'overall';
            this.currentPage = 1;
            this.selectedManifests = new Set(); // Store all selected manifest numbers globally
            this.currentManifestDetail = null;
            this.isLoading = false;
            this.hasMore = true;
            this.manifestsCache = []; // Cache for loaded manifests (UI only)

            // Ensure common utilities are available
            if (!window.APIUtils) {
                console.error('[Transport Manager] APIUtils not loaded');
                return;
            }

            this.ui = new window.TransportUIManager(this);
            this.dataHandler = new TransportDataHandler(this);
            this.importHandler = new window.ImportHandler(this);

            this.initialize();
        }

        initialize() {
            this.ui.bindEvents();
            this.loadManifests('overall').then(() => {
                // After initial load, ensure statistics reflect current state (no filters initially)
                if (this.ui.activeFilters.length === 0) {
                    // For initial load with no filters, update statistics to ensure consistency
                    this.ui.updateStatisticsWithFilters();
                }
            });
        }

        // Pass only new manifests when appending to avoid duplication
        async loadManifests(category, page = 1, append = false) {
            if (this.isLoading) {
                console.log('Load manifests skipped: already loading');
                return;
            }

            this.isLoading = true;

            try {
                // Only update category and reset page when not appending
                if (!append) {
                    this.currentCategory = category;
                    this.currentPage = 1;
                }
                // When appending, use the passed page number directly
                else {
                    this.currentPage = page;
                }

                // Build request body with filters
                const requestBody = {
                    category: this.currentCategory,
                    page: this.currentPage,
                    filters: this.ui.activeFilters || []
                };

                console.log(`Loading manifests: category=${this.currentCategory}, page=${this.currentPage}, append=${append}`);

                // Use APIUtils for standardized API communication with CSRF token
                const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                const response = await APIUtils.post('/transportation/api/get_manifests/', requestBody, csrfToken);

                if (response.success) {
                    const data = response.data;
                    console.log(`Received ${data.manifests.length} manifests for page ${this.currentPage}, hasNext: ${data.hasNext}`);

                    // Update cache management
                    if (append) {
                        // Add new manifests to cache
                        this.manifestsCache = [...this.manifestsCache, ...data.manifests];
                        console.log(`Appended data: total manifests now ${this.manifestsCache.length}`);
                    } else {
                        // Reset cache for new category/filter
                        this.manifestsCache = data.manifests;
                        console.log(`Reset data: loaded ${this.manifestsCache.length} manifests`);
                    }

                    // Update state with server response
                    this.hasMore = data.hasNext;

                    // When appending, only pass the new manifests (data.manifests)
                    // When not appending, pass the entire cache
                    this.ui.updateManifestsList(append ? data.manifests : this.manifestsCache, append);
                    this.ui.updateCategoryDisplay(this.currentCategory);

                    // Only update statistics if not the initial page load to avoid overriding filtered stats
                    if (!append && (this.ui.activeFilters.length > 0 || page > 1)) {
                        await this.ui.updateStatisticsWithFilters();
                    }

                    // Update selection states after loading
                    this.ui.updateVisualCheckboxes();
                    this.ui.updateSelectAllStateServerSide();

                } else {
                    console.error('Load manifests error:', response.error);
                    this.ui.showAlert(response.error || '載入聯單失敗'); // Failed to load manifests
                    // Reset hasMore on error to prevent infinite loading
                    if (append) {
                        this.hasMore = false;
                    }
                }
            } catch (error) {
                console.error('Load manifests error:', error);
                this.ui.showAlert('載入聯單時發生錯誤'); // Error occurred while loading manifests
                // Reset hasMore on error to prevent infinite loading
                if (append) {
                    this.hasMore = false;
                }
            } finally {
                this.isLoading = false;
            }
        }

        async loadManifestDetail(manifestNumber, wasteSubstanceId) {
            try {
                // Use APIUtils for GET request with parameters
                const response = await APIUtils.get('/transportation/api/get_manifest_detail/', {
                    manifestNumber: manifestNumber,
                    wasteSubstanceId: wasteSubstanceId
                });

                if (response.success) {
                    const data = response.data;
                    this.currentManifestDetail = data.detail;
                    this.ui.updateManifestDetail(data.detail);
                } else {
                    this.ui.showAlert(response.error || '載入聯單詳情失敗'); // Failed to load manifest details
                }
            } catch (error) {
                console.error('Load manifest detail error:', error);
                this.ui.showAlert('載入聯單詳情時發生錯誤'); // Error occurred while loading manifest details
            }
        }

        // CSRF token functionality is now handled by APIUtils
        // No need for manual CSRF token management
    }

    class TransportDataHandler {
        constructor(manager) {
            this.manager = manager;
        }

        // Process manifest data with server-side validation
        processManifestData(data) {
            // Validate manifest data structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid manifest data structure');
            }

            // Check required fields
            const requiredFields = ['manifestNumber', 'wasteSubstanceId', 'manifestType'];
            for (const field of requiredFields) {
                if (!data[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            return data;
        }

        validateManifestSelection(manifests) {
            if (!manifests || !Array.isArray(manifests)) {
                return false;
            }
            return manifests.length > 0;
        }

        // Server-side bulk operations helper
        async performBulkOperation(operation, manifests, additionalData = {}) {
            try {
                // Use APIUtils for POST request
                const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                const response = await APIUtils.post(`/transportation/api/${operation}/`, {
                    manifestNumbers: manifests,
                    ...additionalData
                }, csrfToken);

                if (!response.success) {
                    throw new Error(response.error || 'Operation failed');
                }

                return response.data;
            } catch (error) {
                console.error(`Bulk operation ${operation} error:`, error);
                throw error;
            }
        }

        // data filtering with server-side support
        async applyServerSideFilters(category, filters) {
            try {
                // Use APIUtils for POST request
                const csrfToken = window.SecurityUtils ? window.SecurityUtils.getCSRFToken() : '';
                const response = await APIUtils.post('/transportation/api/get_matching_manifests/', {
                    category: category,
                    filters: filters
                }, csrfToken);

                if (response.success) {
                    const data = response.data;
                    return data.manifestNumbers;
                } else {
                    console.error('Server-side filtering failed:', response.error);
                    return [];
                }
            } catch (error) {
                console.error('Server-side filtering error:', error);
                return [];
            }
        }
    }

    // Initialize the transportation manager
    window.transportManager = new TransportManager();
});