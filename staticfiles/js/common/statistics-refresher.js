/**
 * Statistics Auto-Refresh System
 * Automatically refreshes statistics after batch operations
 * with intelligent scheduling and error handling
 */

window.StatisticsRefresher = (function() {
    'use strict';

    // Refresh strategies
    const REFRESH_STRATEGIES = {
        IMMEDIATE: 'immediate',         // Refresh immediately after operation
        DEBOUNCED: 'debounced',        // Wait for operations to settle
        PERIODIC: 'periodic',          // Refresh at regular intervals
        ON_FOCUS: 'on_focus'          // Refresh when user focuses on stats
    };

    // Operation types that trigger refresh
    const TRIGGER_OPERATIONS = {
        CREATE: 'create',
        UPDATE: 'update',
        DELETE: 'delete',
        BATCH_CREATE: 'batch_create',
        BATCH_UPDATE: 'batch_update',
        BATCH_DELETE: 'batch_delete',
        IMPORT: 'import',
        EXPORT: 'export'
    };

    class StatisticsRefreshManager {
        constructor() {
            this.refreshCallbacks = new Map();
            this.refreshTimers = new Map();
            this.operationQueue = [];
            this.isRefreshing = false;
            this.config = {
                debounceDelay: 2000,
                maxRetries: 3,
                retryDelay: 1000,
                periodicInterval: 30000,
                enableAutoRefresh: true,
                batchSize: 10
            };
            this.metrics = {
                refreshCount: 0,
                failedRefreshes: 0,
                lastRefreshTime: null,
                operationsProcessed: 0
            };

            this.init();
        }

        init() {
            this.bindEventListeners();
            this.setupPeriodicRefresh();
        }

        bindEventListeners() {
            // Listen for page visibility changes
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.config.enableAutoRefresh) {
                    this.refreshAll(REFRESH_STRATEGIES.ON_FOCUS);
                }
            });

            // Listen for window focus
            window.addEventListener('focus', () => {
                if (this.config.enableAutoRefresh) {
                    this.refreshAll(REFRESH_STRATEGIES.ON_FOCUS);
                }
            });

            // Listen for custom statistics events
            document.addEventListener('statisticsInvalidated', (event) => {
                this.handleOperationComplete(event.detail);
            });
        }

        setupPeriodicRefresh() {
            if (this.periodicTimer) {
                clearInterval(this.periodicTimer);
            }

            if (this.config.periodicInterval > 0) {
                this.periodicTimer = setInterval(() => {
                    if (this.config.enableAutoRefresh && !document.hidden) {
                        this.refreshAll(REFRESH_STRATEGIES.PERIODIC);
                    }
                }, this.config.periodicInterval);
            }
        }

        /**
         * Register a statistics component for auto-refresh
         * @param {string} key - Unique identifier for the statistics component
         * @param {Function} refreshCallback - Function to call for refresh
         * @param {Object} options - Configuration options
         */
        register(key, refreshCallback, options = {}) {
            const config = {
                strategy: REFRESH_STRATEGIES.DEBOUNCED,
                triggers: [
                    TRIGGER_OPERATIONS.CREATE,
                    TRIGGER_OPERATIONS.UPDATE,
                    TRIGGER_OPERATIONS.DELETE,
                    TRIGGER_OPERATIONS.BATCH_CREATE,
                    TRIGGER_OPERATIONS.BATCH_UPDATE,
                    TRIGGER_OPERATIONS.BATCH_DELETE
                ],
                debounceDelay: this.config.debounceDelay,
                priority: 1,
                ...options
            };

            this.refreshCallbacks.set(key, {
                callback: refreshCallback,
                config: config,
                retryCount: 0,
                lastRefresh: null,
                isRefreshing: false
            });

            console.log(`Registered statistics refresher: ${key}`);
            return key;
        }

        /**
         * Unregister a statistics component
         * @param {string} key - Component identifier
         */
        unregister(key) {
            if (this.refreshTimers.has(key)) {
                clearTimeout(this.refreshTimers.get(key));
                this.refreshTimers.delete(key);
            }
            this.refreshCallbacks.delete(key);
            console.log(`Unregistered statistics refresher: ${key}`);
        }

        /**
         * Handle operation completion and trigger appropriate refreshes
         * @param {Object} operation - Operation details
         */
        handleOperationComplete(operation) {
            if (!this.config.enableAutoRefresh) return;

            const { type, resourceType, resourceIds, batchSize } = operation;
            
            this.operationQueue.push({
                type,
                resourceType,
                resourceIds,
                batchSize,
                timestamp: Date.now()
            });

            this.metrics.operationsProcessed++;

            // Determine which components need refresh
            const componentsToRefresh = this.getComponentsForOperation(operation);
            
            componentsToRefresh.forEach(key => {
                const component = this.refreshCallbacks.get(key);
                if (!component) return;

                switch (component.config.strategy) {
                    case REFRESH_STRATEGIES.IMMEDIATE:
                        this.refreshComponent(key);
                        break;
                    
                    case REFRESH_STRATEGIES.DEBOUNCED:
                        this.scheduleDebounceRefresh(key, component.config.debounceDelay);
                        break;
                    
                    case REFRESH_STRATEGIES.PERIODIC:
                        // Handled by periodic timer
                        break;
                    
                    case REFRESH_STRATEGIES.ON_FOCUS:
                        if (!document.hidden) {
                            this.refreshComponent(key);
                        }
                        break;
                }
            });
        }

        getComponentsForOperation(operation) {
            const componentsToRefresh = [];
            
            this.refreshCallbacks.forEach((component, key) => {
                if (component.config.triggers.includes(operation.type)) {
                    // Check resource type filtering if applicable
                    if (!component.config.resourceTypes || 
                        component.config.resourceTypes.includes(operation.resourceType)) {
                        componentsToRefresh.push(key);
                    }
                }
            });

            return componentsToRefresh;
        }

        scheduleDebounceRefresh(key, delay) {
            // Clear existing timer
            if (this.refreshTimers.has(key)) {
                clearTimeout(this.refreshTimers.get(key));
            }

            // Schedule new refresh
            const timer = setTimeout(() => {
                this.refreshComponent(key);
                this.refreshTimers.delete(key);
            }, delay);

            this.refreshTimers.set(key, timer);
        }

        async refreshComponent(key) {
            const component = this.refreshCallbacks.get(key);
            if (!component || component.isRefreshing) return;

            component.isRefreshing = true;
            const startTime = Date.now();

            try {
                await component.callback();
                component.retryCount = 0;
                component.lastRefresh = Date.now();
                this.metrics.refreshCount++;
                this.metrics.lastRefreshTime = Date.now();

                console.log(`Statistics refreshed: ${key} (${Date.now() - startTime}ms)`);

                // Invalidate related cache
                if (window.CacheManager) {
                    window.CacheManager.invalidateAfterOperation('UPDATE', 'statistics');
                }

            } catch (error) {
                console.error(`Statistics refresh failed for ${key}:`, error);
                this.metrics.failedRefreshes++;
                
                component.retryCount++;
                if (component.retryCount < this.config.maxRetries) {
                    setTimeout(() => {
                        this.refreshComponent(key);
                    }, this.config.retryDelay * component.retryCount);
                }
            } finally {
                component.isRefreshing = false;
            }
        }

        async refreshAll(strategy = REFRESH_STRATEGIES.IMMEDIATE) {
            if (this.isRefreshing) return;
            this.isRefreshing = true;

            try {
                const refreshPromises = [];
                
                this.refreshCallbacks.forEach((component, key) => {
                    if (component.config.strategy === strategy || strategy === REFRESH_STRATEGIES.IMMEDIATE) {
                        refreshPromises.push(this.refreshComponent(key));
                    }
                });

                await Promise.allSettled(refreshPromises);
                console.log(`Bulk statistics refresh completed (${strategy})`);

            } catch (error) {
                console.error('Bulk refresh failed:', error);
            } finally {
                this.isRefreshing = false;
            }
        }

        /**
         * Trigger refresh after batch operation
         * @param {string} operationType - Type of operation
         * @param {string} resourceType - Type of resource affected
         * @param {Array|number} resourceIds - IDs of affected resources or count
         */
        triggerAfterBatchOperation(operationType, resourceType, resourceIds = []) {
            const operation = {
                type: operationType,
                resourceType: resourceType,
                resourceIds: Array.isArray(resourceIds) ? resourceIds : [],
                batchSize: Array.isArray(resourceIds) ? resourceIds.length : resourceIds,
                timestamp: Date.now()
            };

            this.handleOperationComplete(operation);

            // Dispatch custom event for other components
            const event = new CustomEvent('statisticsInvalidated', {
                detail: operation
            });
            document.dispatchEvent(event);
        }

        /**
         * Force refresh of specific components
         * @param {Array|string} keys - Component key(s) to refresh
         */
        async forceRefresh(keys) {
            if (typeof keys === 'string') {
                keys = [keys];
            }

            const refreshPromises = keys.map(key => this.refreshComponent(key));
            return Promise.allSettled(refreshPromises);
        }

        /**
         * Update configuration
         * @param {Object} newConfig - New configuration options
         */
        setConfig(newConfig) {
            this.config = { ...this.config, ...newConfig };
            
            // Restart periodic refresh if interval changed
            if (newConfig.periodicInterval !== undefined) {
                this.setupPeriodicRefresh();
            }
        }

        /**
         * Get refresh metrics
         */
        getMetrics() {
            return {
                ...this.metrics,
                registeredComponents: this.refreshCallbacks.size,
                pendingRefreshes: this.refreshTimers.size,
                queuedOperations: this.operationQueue.length,
                isRefreshing: this.isRefreshing,
                config: this.config
            };
        }

        /**
         * Enable or disable auto-refresh
         * @param {boolean} enabled - Whether to enable auto-refresh
         */
        setEnabled(enabled) {
            this.config.enableAutoRefresh = enabled;
            console.log(`Statistics auto-refresh ${enabled ? 'enabled' : 'disabled'}`);
        }

        /**
         * Clear operation queue
         */
        clearQueue() {
            this.operationQueue = [];
        }

        /**
         * Clean up expired timers and reset retry counts
         */
        cleanup() {
            // Clear expired timers
            this.refreshTimers.forEach((timer, key) => {
                clearTimeout(timer);
            });
            this.refreshTimers.clear();

            // Reset retry counts
            this.refreshCallbacks.forEach(component => {
                component.retryCount = 0;
            });

            // Clear old operations from queue
            const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes
            this.operationQueue = this.operationQueue.filter(
                op => op.timestamp > cutoffTime
            );
        }

        destroy() {
            // Clear all timers
            this.refreshTimers.forEach(timer => clearTimeout(timer));
            this.refreshTimers.clear();

            if (this.periodicTimer) {
                clearInterval(this.periodicTimer);
            }

            // Clear callbacks
            this.refreshCallbacks.clear();

            // Clear queue
            this.operationQueue = [];
        }
    }

    // Helper functions for common use cases
    class StatisticsHelper {
        static createDashboardRefresher() {
            return window.StatisticsRefresher.register('dashboard', async () => {
                if (window.location.pathname === '/main/') {
                    // Refresh dashboard statistics
                    if (window.DashboardManager && window.DashboardManager.refreshStats) {
                        await window.DashboardManager.refreshStats();
                    }
                }
            }, {
                strategy: REFRESH_STRATEGIES.DEBOUNCED,
                debounceDelay: 3000,
                triggers: [
                    TRIGGER_OPERATIONS.BATCH_CREATE,
                    TRIGGER_OPERATIONS.BATCH_UPDATE,
                    TRIGGER_OPERATIONS.BATCH_DELETE,
                    TRIGGER_OPERATIONS.IMPORT
                ]
            });
        }

        static createModuleStatsRefresher(module, refreshFunction) {
            return window.StatisticsRefresher.register(`${module}-stats`, refreshFunction, {
                strategy: REFRESH_STRATEGIES.DEBOUNCED,
                debounceDelay: 2000,
                resourceTypes: [module],
                triggers: [
                    TRIGGER_OPERATIONS.CREATE,
                    TRIGGER_OPERATIONS.UPDATE,
                    TRIGGER_OPERATIONS.DELETE,
                    TRIGGER_OPERATIONS.BATCH_DELETE
                ]
            });
        }

        static createChartRefresher(chartId, refreshFunction) {
            return window.StatisticsRefresher.register(`chart-${chartId}`, refreshFunction, {
                strategy: REFRESH_STRATEGIES.DEBOUNCED,
                debounceDelay: 5000, // Charts can be slower to refresh
                triggers: [
                    TRIGGER_OPERATIONS.BATCH_CREATE,
                    TRIGGER_OPERATIONS.BATCH_UPDATE,
                    TRIGGER_OPERATIONS.BATCH_DELETE,
                    TRIGGER_OPERATIONS.IMPORT
                ]
            });
        }

        // Quick operation triggers
        static afterBatchImport(module, count) {
            window.StatisticsRefresher.triggerAfterBatchOperation(
                TRIGGER_OPERATIONS.IMPORT, 
                module, 
                count
            );
        }

        static afterBatchDelete(module, ids) {
            window.StatisticsRefresher.triggerAfterBatchOperation(
                TRIGGER_OPERATIONS.BATCH_DELETE, 
                module, 
                ids
            );
        }

        static afterBatchCreate(module, count) {
            window.StatisticsRefresher.triggerAfterBatchOperation(
                TRIGGER_OPERATIONS.BATCH_CREATE, 
                module, 
                count
            );
        }
    }

    // Create global instance
    const instance = new StatisticsRefreshManager();

    // Export API
    return {
        STRATEGIES: REFRESH_STRATEGIES,
        OPERATIONS: TRIGGER_OPERATIONS,
        Helper: StatisticsHelper,

        // Core methods
        register: (...args) => instance.register(...args),
        unregister: (...args) => instance.unregister(...args),
        triggerAfterBatchOperation: (...args) => instance.triggerAfterBatchOperation(...args),
        forceRefresh: (...args) => instance.forceRefresh(...args),
        refreshAll: (...args) => instance.refreshAll(...args),

        // Configuration
        setConfig: (...args) => instance.setConfig(...args),
        setEnabled: (...args) => instance.setEnabled(...args),

        // Utility
        getMetrics: (...args) => instance.getMetrics(...args),
        cleanup: (...args) => instance.cleanup(...args),
        clearQueue: (...args) => instance.clearQueue(...args),

        // Instance access
        getInstance: () => instance
    };
})();

// Service registration for dependency injection
window.StatisticsRefresher.$serviceName = 'statisticsRefresher';
window.StatisticsRefresher.$lifecycle = 'singleton';