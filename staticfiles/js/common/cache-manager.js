/**
 * Frontend Cache Invalidation System
 * Manages API response caching with intelligent invalidation,
 * dependency tracking, and automatic cleanup
 */

window.CacheManager = (function() {
    'use strict';

    // Cache strategies
    const CACHE_STRATEGIES = {
        LRU: 'lru',
        TTL: 'ttl',
        FIFO: 'fifo',
        DEPENDENCY: 'dependency'
    };

    // Cache levels
    const CACHE_LEVELS = {
        MEMORY: 'memory',
        SESSION: 'session',
        LOCAL: 'local',
        INDEXED_DB: 'indexeddb'
    };

    class CacheEntry {
        constructor(key, data, options = {}) {
            this.key = key;
            this.data = data;
            this.createdAt = Date.now();
            this.accessedAt = Date.now();
            this.accessCount = 1;
            this.ttl = options.ttl || 0;
            this.dependencies = options.dependencies || [];
            this.tags = options.tags || [];
            this.size = this.calculateSize(data);
            this.metadata = options.metadata || {};
        }

        calculateSize(data) {
            try {
                return JSON.stringify(data).length * 2; // Rough estimate in bytes
            } catch {
                return 1024; // Default size
            }
        }

        isExpired() {
            if (this.ttl <= 0) return false;
            return Date.now() - this.createdAt > this.ttl;
        }

        touch() {
            this.accessedAt = Date.now();
            this.accessCount++;
        }

        isValid() {
            return !this.isExpired();
        }
    }

    class CacheStorage {
        constructor(level, maxSize = 50 * 1024 * 1024) { // 50MB default
            this.level = level;
            this.maxSize = maxSize;
            this.currentSize = 0;
            this.entries = new Map();
            this.accessOrder = [];
            this.tags = new Map();
            this.dependencies = new Map();
        }

        set(key, data, options = {}) {
            // Remove existing entry if it exists
            if (this.entries.has(key)) {
                this.remove(key);
            }

            const entry = new CacheEntry(key, data, options);

            // Check if we need to make space
            while (this.currentSize + entry.size > this.maxSize && this.entries.size > 0) {
                this.evictLRU();
            }

            // Add entry
            this.entries.set(key, entry);
            this.currentSize += entry.size;
            this.updateAccessOrder(key);
            this.indexTags(key, entry.tags);
            this.indexDependencies(key, entry.dependencies);

            return true;
        }

        get(key) {
            const entry = this.entries.get(key);
            if (!entry || !entry.isValid()) {
                if (entry) {
                    this.remove(key);
                }
                return null;
            }

            entry.touch();
            this.updateAccessOrder(key);
            return entry.data;
        }

        has(key) {
            const entry = this.entries.get(key);
            return entry && entry.isValid();
        }

        remove(key) {
            const entry = this.entries.get(key);
            if (!entry) return false;

            this.entries.delete(key);
            this.currentSize -= entry.size;
            this.removeFromAccessOrder(key);
            this.unindexTags(key, entry.tags);
            this.unindexDependencies(key, entry.dependencies);

            return true;
        }

        clear() {
            this.entries.clear();
            this.accessOrder = [];
            this.tags.clear();
            this.dependencies.clear();
            this.currentSize = 0;
        }

        evictLRU() {
            if (this.accessOrder.length === 0) return;
            const oldestKey = this.accessOrder[0];
            this.remove(oldestKey);
        }

        updateAccessOrder(key) {
            this.removeFromAccessOrder(key);
            this.accessOrder.push(key);
        }

        removeFromAccessOrder(key) {
            const index = this.accessOrder.indexOf(key);
            if (index > -1) {
                this.accessOrder.splice(index, 1);
            }
        }

        indexTags(key, tags) {
            tags.forEach(tag => {
                if (!this.tags.has(tag)) {
                    this.tags.set(tag, new Set());
                }
                this.tags.get(tag).add(key);
            });
        }

        unindexTags(key, tags) {
            tags.forEach(tag => {
                if (this.tags.has(tag)) {
                    this.tags.get(tag).delete(key);
                    if (this.tags.get(tag).size === 0) {
                        this.tags.delete(tag);
                    }
                }
            });
        }

        indexDependencies(key, dependencies) {
            dependencies.forEach(dep => {
                if (!this.dependencies.has(dep)) {
                    this.dependencies.set(dep, new Set());
                }
                this.dependencies.get(dep).add(key);
            });
        }

        unindexDependencies(key, dependencies) {
            dependencies.forEach(dep => {
                if (this.dependencies.has(dep)) {
                    this.dependencies.get(dep).delete(key);
                    if (this.dependencies.get(dep).size === 0) {
                        this.dependencies.delete(dep);
                    }
                }
            });
        }

        invalidateByTag(tag) {
            const keys = this.tags.get(tag);
            if (keys) {
                const keysToRemove = Array.from(keys);
                keysToRemove.forEach(key => this.remove(key));
            }
        }

        invalidateByDependency(dependency) {
            const keys = this.dependencies.get(dependency);
            if (keys) {
                const keysToRemove = Array.from(keys);
                keysToRemove.forEach(key => this.remove(key));
            }
        }

        cleanup() {
            const now = Date.now();
            const keysToRemove = [];

            this.entries.forEach((entry, key) => {
                if (!entry.isValid()) {
                    keysToRemove.push(key);
                }
            });

            keysToRemove.forEach(key => this.remove(key));
        }

        getStats() {
            return {
                level: this.level,
                entries: this.entries.size,
                currentSize: this.currentSize,
                maxSize: this.maxSize,
                utilization: (this.currentSize / this.maxSize) * 100,
                tags: this.tags.size,
                dependencies: this.dependencies.size
            };
        }
    }

    class CacheManager {
        constructor() {
            this.storages = new Map();
            this.defaultOptions = {
                level: CACHE_LEVELS.MEMORY,
                strategy: CACHE_STRATEGIES.LRU,
                ttl: 5 * 60 * 1000, // 5 minutes
                tags: [],
                dependencies: []
            };
            this.hitCount = 0;
            this.missCount = 0;
            this.cleanupInterval = null;

            this.init();
        }

        init() {
            // Initialize cache storages
            this.storages.set(CACHE_LEVELS.MEMORY, new CacheStorage(CACHE_LEVELS.MEMORY, 50 * 1024 * 1024));
            this.storages.set(CACHE_LEVELS.SESSION, new CacheStorage(CACHE_LEVELS.SESSION, 10 * 1024 * 1024));
            this.storages.set(CACHE_LEVELS.LOCAL, new CacheStorage(CACHE_LEVELS.LOCAL, 20 * 1024 * 1024));

            // Start cleanup interval
            this.startCleanupTimer();

            // Bind to page lifecycle
            this.bindPageEvents();
        }

        startCleanupTimer() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            this.cleanupInterval = setInterval(() => {
                this.cleanup();
            }, 60000); // Clean up every minute
        }

        bindPageEvents() {
            // Clear memory cache on page unload
            window.addEventListener('beforeunload', () => {
                this.storages.get(CACHE_LEVELS.MEMORY).clear();
            });

            // Cleanup on visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.cleanup();
                }
            });
        }

        /**
         * Generate cache key from URL and options
         */
        generateKey(url, options = {}) {
            const keyData = {
                url: url,
                method: options.method || 'GET',
                params: options.params || {},
                headers: options.headers || {}
            };

            return this.hashCode(JSON.stringify(keyData));
        }

        hashCode(str) {
            let hash = 0;
            if (str.length === 0) return hash;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(36);
        }

        /**
         * Get data from cache
         */
        get(key, level = CACHE_LEVELS.MEMORY) {
            const storage = this.storages.get(level);
            if (!storage) return null;

            const data = storage.get(key);
            if (data !== null) {
                this.hitCount++;
                return data;
            }

            this.missCount++;
            return null;
        }

        /**
         * Set data in cache
         */
        set(key, data, options = {}) {
            const finalOptions = { ...this.defaultOptions, ...options };
            const storage = this.storages.get(finalOptions.level);
            
            if (!storage) return false;

            return storage.set(key, data, finalOptions);
        }

        /**
         * Remove specific key
         */
        remove(key, level = CACHE_LEVELS.MEMORY) {
            const storage = this.storages.get(level);
            return storage ? storage.remove(key) : false;
        }

        /**
         * Check if key exists and is valid
         */
        has(key, level = CACHE_LEVELS.MEMORY) {
            const storage = this.storages.get(level);
            return storage ? storage.has(key) : false;
        }

        /**
         * Invalidate cache by tags
         */
        invalidateByTags(tags, levels = [CACHE_LEVELS.MEMORY]) {
            if (!Array.isArray(tags)) tags = [tags];
            if (!Array.isArray(levels)) levels = [levels];

            levels.forEach(level => {
                const storage = this.storages.get(level);
                if (storage) {
                    tags.forEach(tag => storage.invalidateByTag(tag));
                }
            });
        }

        /**
         * Invalidate cache by dependencies
         */
        invalidateByDependencies(dependencies, levels = [CACHE_LEVELS.MEMORY]) {
            if (!Array.isArray(dependencies)) dependencies = [dependencies];
            if (!Array.isArray(levels)) levels = [levels];

            levels.forEach(level => {
                const storage = this.storages.get(level);
                if (storage) {
                    dependencies.forEach(dep => storage.invalidateByDependency(dep));
                }
            });
        }

        /**
         * Invalidate cache by URL patterns
         */
        invalidateByPattern(pattern, levels = [CACHE_LEVELS.MEMORY]) {
            if (!Array.isArray(levels)) levels = [levels];

            levels.forEach(level => {
                const storage = this.storages.get(level);
                if (storage) {
                    const keysToRemove = [];
                    storage.entries.forEach((entry, key) => {
                        // For URL-based keys, we need to check metadata or reconstruct URL
                        if (entry.metadata.url && entry.metadata.url.includes(pattern)) {
                            keysToRemove.push(key);
                        }
                    });
                    keysToRemove.forEach(key => storage.remove(key));
                }
            });
        }

        /**
         * Clear all caches
         */
        clearAll() {
            this.storages.forEach(storage => storage.clear());
            this.resetStats();
        }

        /**
         * Clear specific level
         */
        clear(level = CACHE_LEVELS.MEMORY) {
            const storage = this.storages.get(level);
            if (storage) {
                storage.clear();
            }
        }

        /**
         * Cleanup expired entries
         */
        cleanup() {
            this.storages.forEach(storage => storage.cleanup());
        }

        /**
         * Reset statistics
         */
        resetStats() {
            this.hitCount = 0;
            this.missCount = 0;
        }

        /**
         * Get cache statistics
         */
        getStats() {
            const storageStats = {};
            this.storages.forEach((storage, level) => {
                storageStats[level] = storage.getStats();
            });

            const totalRequests = this.hitCount + this.missCount;
            return {
                hitCount: this.hitCount,
                missCount: this.missCount,
                hitRatio: totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0,
                storages: storageStats
            };
        }

        /**
         * Cached API request wrapper
         */
        async cachedRequest(url, options = {}) {
            const cacheOptions = {
                level: options.cacheLevel || CACHE_LEVELS.MEMORY,
                ttl: options.cacheTTL || this.defaultOptions.ttl,
                tags: options.cacheTags || [],
                dependencies: options.cacheDependencies || []
            };

            const key = this.generateKey(url, options);
            
            // Try to get from cache first
            let data = this.get(key, cacheOptions.level);
            if (data !== null) {
                return data;
            }

            // Make actual request
            try {
                let response;
                if (window.APIUtils) {
                    response = await window.APIUtils.get(url, options.params);
                } else {
                    const fetchOptions = {
                        method: options.method || 'GET',
                        headers: options.headers || {}
                    };
                    const fetchResponse = await fetch(url, fetchOptions);
                    response = await fetchResponse.json();
                }

                // Cache successful response
                if (response && response.success !== false) {
                    this.set(key, response, {
                        ...cacheOptions,
                        metadata: { url, method: options.method || 'GET' }
                    });
                }

                return response;
            } catch (error) {
                console.error('Cached request failed:', error);
                throw error;
            }
        }

        /**
         * Preload data into cache
         */
        async preload(requests, level = CACHE_LEVELS.MEMORY) {
            const promises = requests.map(async request => {
                try {
                    await this.cachedRequest(request.url, {
                        ...request.options,
                        cacheLevel: level
                    });
                } catch (error) {
                    console.warn('Preload failed for', request.url, error);
                }
            });

            return Promise.allSettled(promises);
        }

        /**
         * Smart invalidation based on operation types
         */
        invalidateAfterOperation(operation, resourceType, resourceId = null) {
            const invalidationRules = {
                CREATE: {
                    tags: [`${resourceType}:list`, `${resourceType}:stats`],
                    dependencies: [resourceType, 'statistics']
                },
                UPDATE: {
                    tags: [`${resourceType}:list`, `${resourceType}:stats`, `${resourceType}:${resourceId}`],
                    dependencies: [resourceType, 'statistics', `${resourceType}:${resourceId}`]
                },
                DELETE: {
                    tags: [`${resourceType}:list`, `${resourceType}:stats`, `${resourceType}:${resourceId}`],
                    dependencies: [resourceType, 'statistics', `${resourceType}:${resourceId}`]
                },
                BATCH_CREATE: {
                    tags: [`${resourceType}:list`, `${resourceType}:stats`],
                    dependencies: [resourceType, 'statistics']
                },
                BATCH_UPDATE: {
                    tags: [`${resourceType}:list`, `${resourceType}:stats`],
                    dependencies: [resourceType, 'statistics']
                },
                BATCH_DELETE: {
                    tags: [`${resourceType}:list`, `${resourceType}:stats`],
                    dependencies: [resourceType, 'statistics']
                }
            };

            const rule = invalidationRules[operation];
            if (rule) {
                this.invalidateByTags(rule.tags, Object.values(CACHE_LEVELS));
                this.invalidateByDependencies(rule.dependencies, Object.values(CACHE_LEVELS));
            }
        }

        destroy() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            this.clearAll();
        }
    }

    // Create global instance
    const instance = new CacheManager();

    // Export API
    return {
        STRATEGIES: CACHE_STRATEGIES,
        LEVELS: CACHE_LEVELS,

        // Main methods
        get: (...args) => instance.get(...args),
        set: (...args) => instance.set(...args),
        remove: (...args) => instance.remove(...args),
        has: (...args) => instance.has(...args),
        clear: (...args) => instance.clear(...args),
        clearAll: (...args) => instance.clearAll(...args),

        // Invalidation methods
        invalidateByTags: (...args) => instance.invalidateByTags(...args),
        invalidateByDependencies: (...args) => instance.invalidateByDependencies(...args),
        invalidateByPattern: (...args) => instance.invalidateByPattern(...args),
        invalidateAfterOperation: (...args) => instance.invalidateAfterOperation(...args),

        // Request methods
        cachedRequest: (...args) => instance.cachedRequest(...args),
        preload: (...args) => instance.preload(...args),

        // Utility methods
        generateKey: (...args) => instance.generateKey(...args),
        cleanup: (...args) => instance.cleanup(...args),
        getStats: (...args) => instance.getStats(...args),
        resetStats: (...args) => instance.resetStats(...args),

        // Instance access
        getInstance: () => instance
    };
})();

// Service registration for dependency injection
window.CacheManager.$serviceName = 'cacheManager';
window.CacheManager.$lifecycle = 'singleton';