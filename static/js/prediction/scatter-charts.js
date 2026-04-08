// Define helper functions at global scope
function interpolateColor(r2) {
    const colors = [
        { value: 0.1, color: [255, 0, 0] },    // red
        { value: 0.3, color: [255, 140, 0] },  // darkorange
        { value: 0.5, color: [255, 215, 0] },  // gold
        { value: 0.7, color: [60, 179, 113] }, // mediumseagreen
        { value: 0.9, color: [30, 144, 255] }  // dodgerblue
    ];

    let lowerBound = colors[0];
    let upperBound = colors[colors.length - 1];

    for (let i = 0; i < colors.length - 1; i++) {
        if (r2 >= colors[i].value && r2 <= colors[i + 1].value) {
            lowerBound = colors[i];
            upperBound = colors[i + 1];
            break;
        }
    }

    const ratio = (r2 - lowerBound.value) / (upperBound.value - lowerBound.value);

    const r = Math.round(lowerBound.color[0] + ratio * (upperBound.color[0] - lowerBound.color[0]));
    const g = Math.round(lowerBound.color[1] + ratio * (upperBound.color[1] - lowerBound.color[1]));
    const b = Math.round(lowerBound.color[2] + ratio * (upperBound.color[2] - lowerBound.color[2]));

    return `rgb(${r}, ${g}, ${b})`;
}

// Create SVG scatter plot
function createSVGScatterPlot(data, r2, slope, intercept) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Find data range
    const xValues = data.map(p => p.x);
    const yValues = data.map(p => p.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Add 5% padding to ranges for better visualization
    const xPadding = (xMax - xMin) * 0.05;
    const yPadding = (yMax - yMin) * 0.05;
    const xRangeMin = xMin - xPadding;
    const xRangeMax = xMax + xPadding;
    const yRangeMin = yMin - yPadding;
    const yRangeMax = yMax + yPadding;

    // Scaling functions with padding
    const scaleX = (x) => ((x - xRangeMin) / (xRangeMax - xRangeMin || 1)) * 90 + 5;
    const scaleY = (y) => 95 - ((y - yRangeMin) / (yRangeMax - yRangeMin || 1)) * 90;

    // Get point color
    const color = interpolateColor(r2);

    // Data points
    data.forEach(point => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute('cx', scaleX(point.x));
        circle.setAttribute('cy', scaleY(point.y));
        circle.setAttribute('r', '2.5'); // Slightly larger points
        circle.setAttribute('fill', color);
        svg.appendChild(circle);
    });

    // Regression line
    if (data.length > 1) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const y1 = slope * xRangeMin + intercept;
        const y2 = slope * xRangeMax + intercept;
        line.setAttribute('x1', scaleX(xRangeMin));
        line.setAttribute('y1', scaleY(y1));
        line.setAttribute('x2', scaleX(xRangeMax));
        line.setAttribute('y2', scaleY(y2));
        line.setAttribute('stroke', 'violet');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-dasharray', '5,5');
        line.setAttribute('stroke-opacity', '0.8');
        svg.appendChild(line);
    }

    return svg;
}

// Define renderAllScatterPlots globally so it can be called from other scripts
function renderAllScatterPlots() {
    const cells = document.querySelectorAll('.scatter-cell');

    cells.forEach(cell => {
        // Clear any existing content
        cell.innerHTML = '';

        try {
            const data = JSON.parse(cell.dataset.points);
            const r2 = parseFloat(cell.dataset.r2);
            const slope = parseFloat(cell.dataset.slope);
            const intercept = parseFloat(cell.dataset.intercept);

            const svg = createSVGScatterPlot(data, r2, slope, intercept);
            cell.appendChild(svg);
        } catch (e) {
        }
    });

    // Ensure consistent row heights
    setTimeout(() => {
        const rows = document.querySelectorAll('#scatterPlotArea table tbody tr');
        let maxHeight = 0;

        // Find maximum natural row height
        rows.forEach(row => {
            row.style.height = 'auto'; // Reset height to measure natural height
            const height = row.offsetHeight;
            if (height > maxHeight) {
                maxHeight = height;
            }
        });

        // Apply the max height to all rows (with some padding)
        if (maxHeight > 0) {
            rows.forEach(row => {
                row.style.height = `${maxHeight}px`;
            });
        }
    }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
    // Call the function when page loads
    renderAllScatterPlots();

    // Also call it after a short delay to ensure all DOM elements are fully rendered
    setTimeout(renderAllScatterPlots, 500);
});