/**
 * Unified Loading Manager System
 * Centralized loading state management with intelligent overlay system
 * Provides consistent loading UX across all application components
 */

window.LoadingManager = (function() {
    'use strict';

    // Loading state types
    const LOADING_TYPES = {
        SPINNER: 'spinner',           // Simple spinner overlay
        SKELETON: 'skeleton',         // Skeleton placeholder loading
        PROGRESS: 'progress',         // Progress bar with percentage
        INLINE: 'inline',            // Inline loading indicator
        BUTTON: 'button',            // Button loading state
        TABLE: 'table'               // Table-specific loading
    };

    // Loading priority levels
    const PRIORITY = {
        LOW: 1,
        NORMAL: 2,
        HIGH: 3,
        CRITICAL: 4
    };

    // Global loading state registry
    class LoadingStateRegistry {
        constructor() {
            this.activeLoadings = new Map();
            this.loadingHistory = [];
            this.subscribers = [];
            this.metrics = {
                totalLoadings: 0,
                averageDuration: 0,
                longestLoading: 0,
                currentActiveCount: 0
            };
        }

        register(id, config) {
            const loading = {
                id,
                startTime: Date.now(),
                config,
                priority: config.priority || PRIORITY.NORMAL
            };

            this.activeLoadings.set(id, loading);
            this.metrics.totalLoadings++;
            this.metrics.currentActiveCount = this.activeLoadings.size;

            this.notifySubscribers('started', loading);
            console.debug(`Loading started: ${id}`);
        }

        unregister(id) {
            const loading = this.activeLoadings.get(id);
            if (loading) {
                const duration = Date.now() - loading.startTime;
                
                // Update metrics
                this.updateMetrics(duration);
                
                // Move to history
                this.loadingHistory.push({
                    ...loading,
                    endTime: Date.now(),
                    duration
                });

                // Keep history manageable
                if (this.loadingHistory.length > 100) {
                    this.loadingHistory = this.loadingHistory.slice(-50);
                }

                this.activeLoadings.delete(id);
                this.metrics.currentActiveCount = this.activeLoadings.size;

                this.notifySubscribers('ended', { ...loading, duration });
                console.debug(`Loading ended: ${id} (${duration}ms)`);
            }
        }

        updateMetrics(duration) {
            const totalDuration = this.loadingHistory.reduce((sum, loading) => sum + loading.duration, 0) + duration;
            this.metrics.averageDuration = totalDuration / this.metrics.totalLoadings;
            this.metrics.longestLoading = Math.max(this.metrics.longestLoading, duration);
        }

        isLoading(id) {
            return this.activeLoadings.has(id);
        }

        getActiveLoadings() {
            return Array.from(this.activeLoadings.values());
        }

        getHighestPriorityLoading() {
            let highest = null;
            for (const loading of this.activeLoadings.values()) {
                if (!highest || loading.priority > highest.priority) {
                    highest = loading;
                }
            }
            return highest;
        }

        subscribe(callback) {
            this.subscribers.push(callback);
        }

        unsubscribe(callback) {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
                this.subscribers.splice(index, 1);
            }
        }

        notifySubscribers(event, data) {
            this.subscribers.forEach(callback => {
                try {
                    callback(event, data);
                } catch (error) {
                    console.error('Loading subscriber error:', error);
                }
            });
        }

        getMetrics() {
            return {
                ...this.metrics,
                activeLoadings: this.activeLoadings.size,
                historyCount: this.loadingHistory.length
            };
        }

        clear() {
            // End all active loadings
            for (const id of this.activeLoadings.keys()) {
                this.unregister(id);
            }
            this.loadingHistory = [];
        }
    }

    // Global registry instance
    const registry = new LoadingStateRegistry();

    // Base Loading Component
    class BaseLoadingComponent {
        constructor(container, config = {}) {
            this.container = container;
            this.config = {
                type: LOADING_TYPES.SPINNER,
                message: '載入中...',
                backdrop: true,
                zIndex: 1000,
                className: '',
                timeout: 30000,
                ...config
            };
            
            this.element = null;
            this.timeoutId = null;
            this.isActive = false;
        }

        show() {
            if (this.isActive) return;

            this.createElement();
            this.attachToDOM();
            this.setupTimeout();
            this.isActive = true;

            // Add animation
            requestAnimationFrame(() => {
                if (this.element) {
                    this.element.classList.add('loading-show');
                }
            });
        }

        hide() {
            if (!this.isActive) return;

            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }

            if (this.element) {
                this.element.classList.add('loading-hide');
                setTimeout(() => {
                    this.removeFromDOM();
                }, 300); // Animation duration
            }

            this.isActive = false;
        }

        createElement() {
            this.element = document.createElement('div');
            this.element.className = `loading-overlay loading-${this.config.type} ${this.config.className}`;
            this.element.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: ${this.config.zIndex};
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: ${this.config.backdrop ? 'all' : 'none'};
                background: ${this.config.backdrop ? 'rgba(255, 255, 255, 0.8)' : 'transparent'};
            `;

            this.createContent();
        }

        createContent() {
            // Override in subclasses
            const content = document.createElement('div');
            content.textContent = this.config.message;
            this.element.appendChild(content);
        }

        attachToDOM() {
            // Ensure container is positioned
            const containerStyle = window.getComputedStyle(this.container);
            if (containerStyle.position === 'static') {
                this.container.style.position = 'relative';
            }

            this.container.appendChild(this.element);
        }

        removeFromDOM() {
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            this.element = null;
        }

        setupTimeout() {
            if (this.config.timeout > 0) {
                this.timeoutId = setTimeout(() => {
                    console.warn(`Loading timeout after ${this.config.timeout}ms`);
                    this.hide();
                }, this.config.timeout);
            }
        }

        updateMessage(message) {
            this.config.message = message;
            if (this.element) {
                const messageElement = this.element.querySelector('.loading-message');
                if (messageElement) {
                    messageElement.textContent = message;
                }
            }
        }

        updateProgress(percentage) {
            if (this.config.type === LOADING_TYPES.PROGRESS && this.element) {
                const progressBar = this.element.querySelector('.progress-bar');
                const progressText = this.element.querySelector('.progress-text');
                
                if (progressBar) {
                    progressBar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
                }
                if (progressText) {
                    progressText.textContent = `${Math.round(percentage)}%`;
                }
            }
        }
    }

    // Spinner Loading Component
    class SpinnerLoading extends BaseLoadingComponent {
        createContent() {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.cssText = `
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: loading-spin 1s linear infinite;
            `;

            const message = document.createElement('div');
            message.className = 'loading-message';
            message.textContent = this.config.message;
            message.style.cssText = `
                margin-top: 16px;
                font-size: 14px;
                color: #666;
                text-align: center;
            `;

            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
            container.appendChild(spinner);
            container.appendChild(message);

            this.element.appendChild(container);

            // Add CSS animation if not exists
            this.addSpinAnimation();
        }

        addSpinAnimation() {
            const styleId = 'loading-spin-animation';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    @keyframes loading-spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .loading-show { opacity: 1 !important; }
                    .loading-hide { opacity: 0 !important; }
                `;
                document.head.appendChild(style);
            }
        }
    }

    // Progress Loading Component
    class ProgressLoading extends BaseLoadingComponent {
        constructor(container, config = {}) {
            super(container, { ...config, type: LOADING_TYPES.PROGRESS });
            this.progress = 0;
        }

        createContent() {
            const container = document.createElement('div');
            container.style.cssText = `
                background: white;
                padding: 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                min-width: 300px;
            `;

            const message = document.createElement('div');
            message.className = 'loading-message';
            message.textContent = this.config.message;
            message.style.cssText = `
                margin-bottom: 16px;
                font-size: 14px;
                color: #333;
                text-align: center;
            `;

            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                width: 100%;
                height: 8px;
                background: #f0f0f0;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            `;

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.cssText = `
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #3498db, #2980b9);
                transition: width 0.3s ease;
                border-radius: 4px;
            `;

            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            progressText.textContent = '0%';
            progressText.style.cssText = `
                text-align: center;
                font-size: 12px;
                color: #666;
            `;

            progressContainer.appendChild(progressBar);
            container.appendChild(message);
            container.appendChild(progressContainer);
            container.appendChild(progressText);

            this.element.appendChild(container);
        }
    }

    // Skeleton Loading Component
    class SkeletonLoading extends BaseLoadingComponent {
        constructor(container, config = {}) {
            super(container, { 
                ...config, 
                type: LOADING_TYPES.SKELETON,
                backdrop: false 
            });
        }

        createContent() {
            const skeletonConfig = this.config.skeleton || {
                rows: 3,
                columns: ['30%', '50%', '20%']
            };

            const container = document.createElement('div');
            container.className = 'skeleton-container';
            container.style.cssText = `
                width: 100%;
                padding: 16px;
            `;

            for (let i = 0; i < skeletonConfig.rows; i++) {
                const row = document.createElement('div');
                row.style.cssText = `
                    display: flex;
                    gap: 12px;
                    margin-bottom: 12px;
                `;

                skeletonConfig.columns.forEach(width => {
                    const skeleton = document.createElement('div');
                    skeleton.className = 'skeleton-item';
                    skeleton.style.cssText = `
                        height: 20px;
                        width: ${width};
                        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                        background-size: 200% 100%;
                        animation: skeleton-loading 1.5s infinite;
                        border-radius: 4px;
                    `;
                    row.appendChild(skeleton);
                });

                container.appendChild(row);
            }

            this.element.appendChild(container);
            this.addSkeletonAnimation();
        }

        addSkeletonAnimation() {
            const styleId = 'skeleton-loading-animation';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = `
                    @keyframes skeleton-loading {
                        0% { background-position: -200% 0; }
                        100% { background-position: 200% 0; }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    // Button Loading Component
    class ButtonLoading {
        constructor(button, config = {}) {
            this.button = button;
            this.config = {
                spinner: true,
                disableButton: true,
                text: '處理中...',
                ...config
            };
            this.originalState = null;
        }

        show() {
            if (this.originalState) return; // Already loading

            // Save original state
            this.originalState = {
                text: this.button.textContent,
                disabled: this.button.disabled,
                innerHTML: this.button.innerHTML
            };

            // Set loading state
            if (this.config.disableButton) {
                this.button.disabled = true;
            }

            if (this.config.spinner) {
                const spinner = document.createElement('span');
                spinner.className = 'button-spinner';
                spinner.style.cssText = `
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border: 2px solid transparent;
                    border-top: 2px solid currentColor;
                    border-radius: 50%;
                    animation: loading-spin 1s linear infinite;
                    margin-right: 8px;
                `;

                this.button.innerHTML = '';
                this.button.appendChild(spinner);
                this.button.appendChild(document.createTextNode(this.config.text));
            } else {
                this.button.textContent = this.config.text;
            }
        }

        hide() {
            if (!this.originalState) return; // Not loading

            // Restore original state
            this.button.disabled = this.originalState.disabled;
            this.button.innerHTML = this.originalState.innerHTML;

            this.originalState = null;
        }

        isLoading() {
            return this.originalState !== null;
        }
    }

    // Main Loading Manager
    class LoadingManagerClass {
        constructor() {
            this.loadings = new Map();
            this.globalOverlay = null;
        }

        show(id, container, config = {}) {
            // End existing loading with same ID
            if (this.loadings.has(id)) {
                this.hide(id);
            }

            let loading;
            const finalConfig = { ...config, id };

            // Create appropriate loading component
            switch (config.type) {
                case LOADING_TYPES.PROGRESS:
                    loading = new ProgressLoading(container, finalConfig);
                    break;
                case LOADING_TYPES.SKELETON:
                    loading = new SkeletonLoading(container, finalConfig);
                    break;
                case LOADING_TYPES.BUTTON:
                    loading = new ButtonLoading(container, finalConfig);
                    break;
                default:
                    loading = new SpinnerLoading(container, finalConfig);
            }

            this.loadings.set(id, loading);
            loading.show();

            // Register in global registry
            registry.register(id, finalConfig);

            return loading;
        }

        hide(id) {
            const loading = this.loadings.get(id);
            if (loading) {
                loading.hide();
                this.loadings.delete(id);
                registry.unregister(id);
            }
        }

        update(id, updates) {
            const loading = this.loadings.get(id);
            if (loading) {
                if (updates.message) {
                    loading.updateMessage(updates.message);
                }
                if (typeof updates.progress === 'number') {
                    loading.updateProgress(updates.progress);
                }
            }
        }

        isLoading(id) {
            return this.loadings.has(id);
        }

        showGlobal(config = {}) {
            if (this.globalOverlay) {
                this.hideGlobal();
            }

            const overlay = document.createElement('div');
            overlay.className = 'global-loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;

            const loading = new SpinnerLoading(overlay, {
                ...config,
                backdrop: false,
                zIndex: 1
            });

            document.body.appendChild(overlay);
            loading.show();

            // Trigger animation
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
            });

            this.globalOverlay = { overlay, loading };
            registry.register('global', { ...config, type: 'global' });
        }

        hideGlobal() {
            if (this.globalOverlay) {
                const { overlay, loading } = this.globalOverlay;
                
                overlay.style.opacity = '0';
                loading.hide();
                
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 300);

                this.globalOverlay = null;
                registry.unregister('global');
            }
        }

        hideAll() {
            // Hide all local loadings
            for (const id of this.loadings.keys()) {
                this.hide(id);
            }

            // Hide global overlay
            this.hideGlobal();
        }

        getActiveLoadings() {
            return Array.from(this.loadings.keys());
        }

        getMetrics() {
            return registry.getMetrics();
        }

        // Utility methods
        async withLoading(id, container, asyncFunction, config = {}) {
            this.show(id, container, config);
            try {
                return await asyncFunction();
            } finally {
                this.hide(id);
            }
        }

        async withGlobalLoading(asyncFunction, config = {}) {
            this.showGlobal(config);
            try {
                return await asyncFunction();
            } finally {
                this.hideGlobal();
            }
        }

        // Subscribe to loading state changes
        subscribe(callback) {
            registry.subscribe(callback);
        }

        unsubscribe(callback) {
            registry.unsubscribe(callback);
        }
    }

    // Create singleton instance
    const loadingManager = new LoadingManagerClass();

    // Export classes and manager
    return {
        // Main manager
        ...loadingManager,
        
        // Constants
        LOADING_TYPES,
        PRIORITY,
        
        // Component classes (for advanced usage)
        BaseLoadingComponent,
        SpinnerLoading,
        ProgressLoading,
        SkeletonLoading,
        ButtonLoading,
        
        // Registry access
        registry
    };
})();

// Register with DI container if available
if (window.DependencyInjection) {
    window.DependencyInjection.registerInstance('loadingManager', window.LoadingManager, {
        version: '1.0.0'
    });
}

// Add service name for auto-registration
window.LoadingManager.$serviceName = 'loadingManager';
window.LoadingManager.$lifecycle = window.DependencyInjection ? window.DependencyInjection.LIFECYCLE.SINGLETON : undefined;