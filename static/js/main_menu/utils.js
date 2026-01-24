// utils.js
let serverTime = null;
let localSyncTime = null;

export async function fetchServerTime() {
    try {
        const response = await fetch('/api/time/'); // Fetch from Django server
        const data = await response.json();
        serverTime = new Date(data.serverTime); // Convert to Date object
        localSyncTime = Date.now(); // Store local fetch timestamp
        updateClock();
        return serverTime; // Return serverTime for use in main_menu.js
    } catch (error) {
        document.getElementById('clock').textContent = "Error fetching server time";
        return new Date(); // Fallback to local time
    }
}

function updateClock() {
    const now = serverTime ? new Date(serverTime.getTime() + (Date.now() - localSyncTime)) : new Date();
    const year = String(now.getFullYear()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timezone_name = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const offsetMinutes = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60)).toString().padStart(2, '0');
    const offsetMins = Math.abs(offsetMinutes % 60).toString().padStart(2, '0');
    const sign = offsetMinutes > 0 ? "-" : "+";

    document.getElementById('clock').textContent = `Current Server Time: ${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezone_name} (UTC${sign}${offsetHours}${offsetMins})`;
    requestAnimationFrame(updateClock); // Continuous update
}

// Initial fetch not needed here; handled in main_menu.js

export const calculateDateRange = (serverTime) => {
    const today = serverTime;
    const cutoffDay = 5;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const cutoffDate = new Date(currentYear, currentMonth, cutoffDay);

    let startMonth, startYear, endMonth, endYear;
    if (today.getDate() < cutoffDay) {
        startMonth = currentMonth - 2 < 0 ? 12 + (currentMonth - 2) : currentMonth - 2;
        startYear = currentMonth - 2 < 0 ? currentYear - 1 : currentYear;
    } else {
        startMonth = currentMonth - 1 < 0 ? 11 : currentMonth - 1;
        startYear = currentMonth - 1 < 0 ? currentYear - 1 : currentYear;
    }
    endMonth = startMonth;
    endYear = startYear;
    const startDate = new Date(startYear, startMonth - 11, 1);
    const endDate = new Date(endYear, endMonth + 1, 0);
    return { startDate, endDate };
};

export const generateLabels = (startDate, endDate) => {
    const labels = [];
    let current = new Date(startDate);
    while (current <= endDate) {
        labels.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
        current.setMonth(current.getMonth() + 1);
    }
    return labels;
};

export const alignDataWithLabels = (originalLabels, originalData, newLabels) => {
    if (!originalLabels || !Array.isArray(originalLabels) || originalLabels.length === 0) {
        console.warn("Original labels missing or invalid:", originalLabels);
        return Array(newLabels.length).fill(0);
    }
    return newLabels.map(newLabel => {
        const index = originalLabels.indexOf(newLabel);
        return index !== -1 && originalData[index] != null ? originalData[index] : 0;
    });
};