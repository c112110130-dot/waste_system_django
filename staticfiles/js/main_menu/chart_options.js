// Theme detection utility that integrates with Django theme system
function getCurrentTheme() {
    const htmlRoot = document.documentElement;

    // First check if theme config is available from Django
    if (window.themeConfig) {
        // For system theme, detect actual browser preference
        if (window.themeConfig.isSystemTheme) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        // Return explicit theme setting
        if (window.themeConfig.isDarkMode) return 'dark';
        if (window.themeConfig.isLightMode) return 'light';
    }

    // Fallback: Check for DOM classes (for compatibility)
    if (htmlRoot.classList.contains('is-light')) {
        return 'light';
    } else if (htmlRoot.classList.contains('is-dark')) {
        return 'dark';
    }

    // Final fallback: System preference detection
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Get theme-aware options for ApexCharts
function getThemedOptions(overrideTheme = null) {
    const currentTheme = overrideTheme || getCurrentTheme();
    const isDark = currentTheme === 'dark';

    return {
        ...baseOptions,
        theme: {
            mode: isDark ? 'dark' : 'light',
            palette: 'palette1'
        },
        chart: {
            ...baseOptions.chart,
            background: 'transparent', // Let container handle background
            foreColor: isDark ? '#e5e7eb' : '#374151'
        },
        grid: {
            borderColor: isDark ? '#4b5563' : '#e5e7eb',
            strokeDashArray: 0,
            xaxis: {
                lines: {
                    show: false
                }
            },
            yaxis: {
                lines: {
                    show: true
                }
            }
        },
        tooltip: {
            ...baseOptions.tooltip,
            theme: isDark ? 'dark' : 'light'
        },
        // Additional theme-specific styling
        legend: {
            ...baseOptions.legend,
            labels: {
                colors: isDark ? '#e5e7eb' : '#374151'
            }
        },
        xaxis: {
            ...baseOptions.xaxis,
            labels: {
                ...baseOptions.xaxis.labels,
                style: {
                    ...baseOptions.xaxis.labels.style,
                    colors: isDark ? '#e5e7eb' : '#374151'
                }
            },
            title: {
                style: {
                    color: isDark ? '#e5e7eb' : '#374151',
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                }
            }
        },
        yaxis: {
            ...baseOptions.yaxis,
            labels: {
                ...baseOptions.yaxis.labels,
                style: {
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif',
                    color: isDark ? '#e5e7eb' : '#374151'
                }
            },
            title: {
                style: {
                    color: isDark ? '#e5e7eb' : '#374151',
                    fontSize: '14px',
                    fontFamily: 'Sarasa Mono TC Regular, sans-serif'
                }
            }
        },
        title: {
            ...baseOptions.title,
            style: {
                ...baseOptions.title.style,
                color: isDark ? '#e5e7eb' : '#374151'
            }
        }
    };
}

// Listen for system theme changes when using system theme
function initializeThemeListener() {
    if (window.themeConfig && window.themeConfig.isSystemTheme) {
        // Add listener for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
            // Emit custom event for charts to update
            window.dispatchEvent(new CustomEvent('themeChanged', {
                detail: { theme: e.matches ? 'dark' : 'light' }
            }));
        });
    }
}

export const baseOptions = {
    chart: {
        height: 500,
        toolbar: { show: true },
        zoom: { enabled: true },
        animations: {
            enabled: true,
            speed: 800,
            animateGradually: {
                enabled: true,
                delay: 150
            },
            dynamicAnimation: {
                enabled: true,
                speed: 350
            }
        }
    },
    xaxis: {
        categories: [],
        labels: {
            style: {
                fontSize: '14px',
                fontFamily: 'Sarasa Mono TC Regular, sans-serif'
            },
            formatter: val => val
        }
    },
    yaxis: {
        labels: {
            style: {
                fontSize: '14px',
                fontFamily: 'Sarasa Mono TC Regular, sans-serif'
            },
            formatter: val => Math.floor(val)
        }
    },
    title: {
        text: '',
        align: 'center',
        style: {
            fontSize: '18px',
            fontFamily: 'Sarasa Mono TC Bold, sans-serif'
        }
    },
    legend: {
        fontSize: '14px',
        fontFamily: 'Sarasa Mono TC Regular, monospace'
    },
    tooltip: {
        style: {
            fontSize: '16px',
            fontFamily: 'Sarasa Mono TC Regular, sans-serif'
        },
        y: {
            formatter: val => Number(val).toFixed(2).replace(/\.0+$/, '')
        }
    },
    dataLabels: { enabled: false }
};

// Initialize theme system when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeThemeListener();
});

// Export theme detection functions
export { getCurrentTheme, getThemedOptions, initializeThemeListener };