/**
 * Loading and Status Display Utilities
 * Unified loading state and progress display tools
 */

class LoadingUtils {
    static activeLoaders = new Map();
    
    // ============ 基本載入指示器 ============
    
    /**
     * 顯示全螢幕載入覆蓋層
     * @param {string} message - 載入訊息
     * @param {boolean} cancellable - 是否可取消
     * @returns {string} loaderId
     */
    static showOverlay(message = AppConfig.TEXT.STATUS.LOADING, cancellable = false) {
        const loaderId = CommonUtils.generateId();
        
        // 移除現有的覆蓋層
        const existing = document.querySelector('.loading-overlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.setAttribute('data-loader-id', loaderId);
        
        const content = document.createElement('div');
        content.className = 'loading-content';
        
        // 載入動畫
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        // 載入訊息
        const messageElement = document.createElement('div');
        messageElement.className = 'loading-message';
        DOMUtils.setText(messageElement, message);
        
        content.appendChild(spinner);
        content.appendChild(messageElement);
        
        // 取消按鈕
        if (cancellable) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = AppConfig.CSS_CLASSES.BUTTON.SECONDARY;
            DOMUtils.setText(cancelBtn, AppConfig.TEXT.BUTTONS.CANCEL);
            
            cancelBtn.addEventListener('click', () => {
                this.hideOverlay(loaderId);
            });
            
            content.appendChild(cancelBtn);
        }
        
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        // 記錄載入器
        this.activeLoaders.set(loaderId, {
            type: 'overlay',
            element: overlay,
            message: message,
            timestamp: Date.now()
        });
        
        return loaderId;
    }
    
    /**
     * 隱藏全螢幕載入覆蓋層
     * @param {string} loaderId - 載入器ID
     */
    static hideOverlay(loaderId = null) {
        if (loaderId) {
            const loader = this.activeLoaders.get(loaderId);
            if (loader && loader.element) {
                loader.element.remove();
                this.activeLoaders.delete(loaderId);
            }
        } else {
            // 移除所有覆蓋層
            document.querySelectorAll('.loading-overlay').forEach(overlay => {
                const id = overlay.getAttribute('data-loader-id');
                if (id) this.activeLoaders.delete(id);
                overlay.remove();
            });
        }
    }
    
    /**
     * 顯示元素載入狀態
     * @param {HTMLElement} element - 目標元素
     * @param {string} message - 載入訊息
     * @returns {string} loaderId
     */
    static showElementLoading(element, message = AppConfig.TEXT.STATUS.LOADING) {
        if (!element) return null;
        
        const loaderId = CommonUtils.generateId();
        
        // 保存原始內容
        const originalContent = element.innerHTML;
        const originalClasses = element.className;
        
        // 創建載入內容
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'element-loading';
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner small';
        
        const messageElement = document.createElement('span');
        messageElement.className = 'loading-message';
        DOMUtils.setText(messageElement, message);
        
        loadingContainer.appendChild(spinner);
        loadingContainer.appendChild(messageElement);
        
        // 設置載入狀態
        element.innerHTML = '';
        element.appendChild(loadingContainer);
        element.classList.add('is-loading');
        
        // 記錄載入器
        this.activeLoaders.set(loaderId, {
            type: 'element',
            element: element,
            originalContent: originalContent,
            originalClasses: originalClasses,
            message: message,
            timestamp: Date.now()
        });
        
        return loaderId;
    }
    
    /**
     * 隱藏元素載入狀態
     * @param {string} loaderId - 載入器ID
     */
    static hideElementLoading(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'element') return;
        
        const { element, originalContent, originalClasses } = loader;
        
        if (element) {
            element.innerHTML = originalContent;
            element.className = originalClasses;
        }
        
        this.activeLoaders.delete(loaderId);
    }

    // ============ 按鈕載入狀態 ============
    
    /**
     * 設置按鈕載入狀態
     * @param {HTMLElement} button - 按鈕元素
     * @param {string} message - 載入訊息
     * @returns {string} loaderId
     */
    static setButtonLoading(button, message = AppConfig.TEXT.STATUS.PROCESSING) {
        if (!button) return null;
        
        const loaderId = CommonUtils.generateId();
        
        // 保存原始狀態
        const originalText = button.textContent;
        const originalDisabled = button.disabled;
        const originalClasses = button.className;
        
        // 設置載入狀態
        button.disabled = true;
        button.classList.add('is-loading');
        DOMUtils.setText(button, message);
        
        // 記錄載入器
        this.activeLoaders.set(loaderId, {
            type: 'button',
            element: button,
            originalText: originalText,
            originalDisabled: originalDisabled,
            originalClasses: originalClasses,
            timestamp: Date.now()
        });
        
        return loaderId;
    }
    
    /**
     * 恢復按鈕原始狀態
     * @param {string} loaderId - 載入器ID
     */
    static restoreButton(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'button') return;
        
        const { element, originalText, originalDisabled, originalClasses } = loader;
        
        if (element) {
            element.disabled = originalDisabled;
            element.className = originalClasses;
            DOMUtils.setText(element, originalText);
        }
        
        this.activeLoaders.delete(loaderId);
    }

    // ============ 進度條工具 ============
    
    /**
     * 創建進度條
     * @param {HTMLElement} container - 容器元素
     * @param {Object} options - 進度條選項
     * @returns {Object} 進度條控制器
     */
    static createProgressBar(container, options = {}) {
        if (!container) return null;
        
        const {
            showPercentage = true,
            showLabel = true,
            animated = true,
            color = 'primary'
        } = options;
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        // 標籤
        if (showLabel) {
            const label = document.createElement('div');
            label.className = 'progress-label';
            DOMUtils.setText(label, '處理中...');
            progressContainer.appendChild(label);
        }
        
        // 進度條容器
        const progressWrapper = document.createElement('div');
        progressWrapper.className = 'progress-wrapper';
        
        const progressBar = document.createElement('div');
        progressBar.className = `progress-bar ${animated ? 'animated' : ''} ${color}`;
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = '0%';
        
        progressBar.appendChild(progressFill);
        progressWrapper.appendChild(progressBar);
        
        // 百分比顯示
        if (showPercentage) {
            const percentage = document.createElement('div');
            percentage.className = 'progress-percentage';
            DOMUtils.setText(percentage, '0%');
            progressWrapper.appendChild(percentage);
        }
        
        progressContainer.appendChild(progressWrapper);
        container.appendChild(progressContainer);
        
        // 返回控制器
        return {
            setProgress: (value, label = null) => {
                const percent = Math.max(0, Math.min(100, value));
                progressFill.style.width = `${percent}%`;
                
                if (showPercentage) {
                    const percentageElement = progressContainer.querySelector('.progress-percentage');
                    if (percentageElement) {
                        DOMUtils.setText(percentageElement, `${Math.round(percent)}%`);
                    }
                }
                
                if (label && showLabel) {
                    const labelElement = progressContainer.querySelector('.progress-label');
                    if (labelElement) {
                        DOMUtils.setText(labelElement, label);
                    }
                }
            },
            
            setLabel: (label) => {
                if (showLabel) {
                    const labelElement = progressContainer.querySelector('.progress-label');
                    if (labelElement) {
                        DOMUtils.setText(labelElement, label);
                    }
                }
            },
            
            complete: () => {
                progressFill.style.width = '100%';
                if (showPercentage) {
                    const percentageElement = progressContainer.querySelector('.progress-percentage');
                    if (percentageElement) {
                        DOMUtils.setText(percentageElement, '100%');
                    }
                }
                
                setTimeout(() => {
                    progressContainer.classList.add('completed');
                }, 100);
            },
            
            remove: () => {
                progressContainer.remove();
            }
        };
    }

    // ============ 骨架載入 ============
    
    /**
     * 創建骨架載入動畫
     * @param {HTMLElement} container - 容器元素
     * @param {Object} config - 骨架配置
     */
    static createSkeleton(container, config = {}) {
        if (!container) return;
        
        const {
            rows = 3,
            showAvatar = false,
            showButton = false,
            animated = true
        } = config;
        
        const skeleton = document.createElement('div');
        skeleton.className = `skeleton-container ${animated ? 'animated' : ''}`;
        
        if (showAvatar) {
            const avatar = document.createElement('div');
            avatar.className = 'skeleton-avatar';
            skeleton.appendChild(avatar);
        }
        
        const content = document.createElement('div');
        content.className = 'skeleton-content';
        
        for (let i = 0; i < rows; i++) {
            const row = document.createElement('div');
            row.className = 'skeleton-row';
            
            // 隨機寬度讓骨架看起來更自然
            const width = i === rows - 1 ? '60%' : '100%';
            row.style.width = width;
            
            content.appendChild(row);
        }
        
        if (showButton) {
            const button = document.createElement('div');
            button.className = 'skeleton-button';
            content.appendChild(button);
        }
        
        skeleton.appendChild(content);
        container.appendChild(skeleton);
        
        return {
            remove: () => skeleton.remove()
        };
    }

    // ============ 狀態指示器 ============
    
    /**
     * 顯示狀態點
     * @param {HTMLElement} element - 目標元素
     * @param {string} status - 狀態類型：success, error, warning, info
     * @param {string} tooltip - 提示文字
     */
    static showStatusIndicator(element, status = 'info', tooltip = '') {
        if (!element) return;
        
        // 移除現有指示器
        const existing = element.querySelector('.status-indicator');
        if (existing) existing.remove();
        
        const indicator = document.createElement('span');
        indicator.className = `status-indicator ${status}`;
        
        if (tooltip) {
            indicator.title = tooltip;
        }
        
        element.appendChild(indicator);
        
        return indicator;
    }

    // ============ 工具方法 ============
    
    /**
     * 清理所有載入器
     */
    static cleanup() {
        this.activeLoaders.forEach((loader, id) => {
            switch (loader.type) {
                case 'overlay':
                    this.hideOverlay(id);
                    break;
                case 'element':
                    this.hideElementLoading(id);
                    break;
                case 'button':
                    this.restoreButton(id);
                    break;
            }
        });
        
        this.activeLoaders.clear();
    }
    
    /**
     * 獲取活動載入器狀態
     * @returns {Object}
     */
    static getActiveLoaders() {
        const status = {};
        this.activeLoaders.forEach((loader, id) => {
            status[id] = {
                type: loader.type,
                message: loader.message,
                duration: Date.now() - loader.timestamp
            };
        });
        return status;
    }
    
    /**
     * 自動清理超時的載入器
     * @param {number} timeout - 超時時間（毫秒）
     */
    static cleanupTimeout(timeout = 30000) {
        const now = Date.now();
        const toRemove = [];
        
        this.activeLoaders.forEach((loader, id) => {
            if (now - loader.timestamp > timeout) {
                toRemove.push(id);
            }
        });
        
        toRemove.forEach(id => {
            const loader = this.activeLoaders.get(id);
            if (loader) {
                switch (loader.type) {
                    case 'overlay':
                        this.hideOverlay(id);
                        break;
                    case 'element':
                        this.hideElementLoading(id);
                        break;
                    case 'button':
                        this.restoreButton(id);
                        break;
                }
            }
        });
    }
}

// 自動清理超時載入器（每分鐘檢查一次）
setInterval(() => {
    LoadingUtils.cleanupTimeout();
}, 60000);

// 頁面卸載時清理所有載入器
window.addEventListener('beforeunload', () => {
    LoadingUtils.cleanup();
});

// 匯出工具類別
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingUtils };
} else {
    window.LoadingUtils = LoadingUtils;
}