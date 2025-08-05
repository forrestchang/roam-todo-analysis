// Chart components for visualization
import { getLocalDateString } from './queries.js';

// Create last 12 days trend chart
export function createLast12DaysTrend(dailyCounts) {
    console.log("[12-Day Trend] Input dailyCounts:", dailyCounts);
    console.log("[12-Day Trend] Today's local date:", getLocalDateString(new Date()));
    
    const container = document.createElement("div");
    container.className = "chart-container";
    
    const titleEl = document.createElement("h4");
    titleEl.textContent = "Recent Task Completion Trend (Last 12 Days)";
    titleEl.style.cssText = "margin: 0 0 12px 0; color: #182026;";
    container.appendChild(titleEl);
    
    // Get last 12 days
    const dates = [];
    const counts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = getLocalDateString(date);
        dates.push(dateStr);
        counts.push(dailyCounts[dateStr] || 0);
    }
    
    const chartWrapper = document.createElement("div");
    chartWrapper.style.cssText = "display: flex; align-items: flex-end; gap: 8px; height: 150px; padding: 0 8px; background: #f5f8fa; border-radius: 4px; padding: 16px;";
    
    const maxCount = Math.max(...counts, 1);
    
    dates.forEach((dateStr, index) => {
        const count = counts[index];
        const percentage = (count / maxCount) * 100;
        const date = new Date(dateStr);
        const isToday = index === dates.length - 1;
        
        const barWrapper = document.createElement("div");
        barWrapper.style.cssText = "flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; height: 100%;";
        
        const barContainer = document.createElement("div");
        barContainer.style.cssText = "flex: 1; width: 100%; position: relative; display: flex; align-items: flex-end;";
        
        const bar = document.createElement("div");
        bar.style.cssText = `
            width: 100%;
            height: ${percentage}%;
            background-color: ${isToday ? '#0f9960' : '#106ba3'};
            border-radius: 4px 4px 0 0;
            transition: all 0.3s;
            cursor: pointer;
            min-height: ${count > 0 ? '4px' : '0'};
            position: relative;
        `;
        
        // Add count label on the bar
        if (count > 0) {
            const countLabel = document.createElement("div");
            countLabel.textContent = count;
            countLabel.style.cssText = `
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 12px;
                font-weight: 500;
                color: #182026;
            `;
            bar.appendChild(countLabel);
        }
        
        const labelEl = document.createElement("div");
        labelEl.textContent = date.getDate();
        labelEl.style.cssText = "font-size: 11px; color: #5c7080; margin-top: 6px; text-align: center;";
        
        if (isToday) {
            labelEl.innerHTML = `<strong>Today</strong>`;
            labelEl.style.color = "#0f9960";
        }
        
        barContainer.appendChild(bar);
        barWrapper.appendChild(barContainer);
        barWrapper.appendChild(labelEl);
        chartWrapper.appendChild(barWrapper);
    });
    
    container.appendChild(chartWrapper);
    return container;
}

// Create heatmap calendar
export function createHeatmapCalendar(dailyCounts) {
    console.log("[Heatmap] Creating calendar with dailyCounts:", dailyCounts);
    
    const container = document.createElement("div");
    container.style.cssText = "overflow-x: auto; padding: 16px; background: #f5f8fa; border-radius: 8px;";
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const startDate = new Date();
    startDate.setDate(today.getDate() - 364); // Show last year
    
    // Calculate start to align with Monday
    while (startDate.getDay() !== 1) {
        startDate.setDate(startDate.getDate() - 1);
    }
    
    // Create main wrapper
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "position: relative; min-width: fit-content;";
    
    // Month labels container
    const monthLabelsContainer = document.createElement("div");
    monthLabelsContainer.style.cssText = "display: flex; gap: 3px; height: 20px; margin-bottom: 4px; margin-left: 40px; position: relative;";
    
    const monthPositions = [];
    let currentMonth = -1;
    
    // Create grid container
    const gridContainer = document.createElement("div");
    gridContainer.style.cssText = "display: flex; align-items: flex-start;";
    
    // Create grid
    const grid = document.createElement("div");
    grid.style.cssText = "display: flex; gap: 3px;";
    
    // Day labels
    const dayLabels = document.createElement("div");
    dayLabels.style.cssText = "display: flex; flex-direction: column; gap: 3px; margin-right: 8px; font-size: 10px; color: #5c7080; width: 32px;";
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
        const label = document.createElement("div");
        label.style.cssText = "height: 12px; display: flex; align-items: center; justify-content: flex-end; padding-right: 4px;";
        label.textContent = day;
        dayLabels.appendChild(label);
    });
    gridContainer.appendChild(dayLabels);
    
    // Create cells
    const maxCount = Math.max(...Object.values(dailyCounts), 1);
    
    // Calculate number of weeks needed
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekCount = Math.ceil((today - startDate) / msPerWeek);
    
    console.log("[Heatmap] Date range:", {
        startDate: getLocalDateString(startDate),
        today: getLocalDateString(today),
        weekCount
    });
    
    for (let week = 0; week < weekCount; week++) {
        const weekColumn = document.createElement("div");
        weekColumn.style.cssText = "display: flex; flex-direction: column; gap: 3px;";
        
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (week * 7) + day);
            
            if (currentDate <= today) {
                const dateStr = getLocalDateString(currentDate);
                const count = dailyCounts[dateStr] || 0;
                
                const cell = document.createElement("div");
                cell.className = "heatmap-cell";
                cell.style.cssText = `
                    width: 12px;
                    height: 12px;
                    border-radius: 2px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                `;
                
                // Color based on count
                if (count === 0) {
                    cell.style.background = "#e1e8ed";
                } else if (count <= maxCount * 0.25) {
                    cell.style.background = "#9ec3ff";
                } else if (count <= maxCount * 0.5) {
                    cell.style.background = "#4a9eff";
                } else if (count <= maxCount * 0.75) {
                    cell.style.background = "#1971ff";
                } else {
                    cell.style.background = "#0349b4";
                }
                
                // Create tooltip
                const tooltip = document.createElement("div");
                tooltip.style.cssText = `
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #182026;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    white-space: nowrap;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s;
                    margin-bottom: 4px;
                    z-index: 1000;
                `;
                tooltip.textContent = `${currentDate.toLocaleDateString()}: ${count} ${count === 1 ? 'task' : 'tasks'}`;
                
                cell.appendChild(tooltip);
                
                cell.onmouseenter = () => {
                    cell.style.transform = "scale(1.2)";
                    cell.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
                    cell.style.zIndex = "10";
                    tooltip.style.opacity = "1";
                };
                
                cell.onmouseleave = () => {
                    cell.style.transform = "scale(1)";
                    cell.style.boxShadow = "none";
                    cell.style.zIndex = "1";
                    tooltip.style.opacity = "0";
                };
                
                // Track month changes
                if (currentDate.getMonth() !== currentMonth) {
                    currentMonth = currentDate.getMonth();
                    monthPositions.push({ week, month: currentMonth });
                }
                
                weekColumn.appendChild(cell);
            } else {
                const emptyCell = document.createElement("div");
                emptyCell.style.cssText = "width: 12px; height: 12px;";
                weekColumn.appendChild(emptyCell);
            }
        }
        
        grid.appendChild(weekColumn);
    }
    
    gridContainer.appendChild(grid);
    
    // Add month labels
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastLabelEnd = 0;
    monthPositions.forEach((pos, index) => {
        if (index < monthPositions.length - 1 || pos.week === 0) {
            const labelStart = pos.week * 15;
            if (labelStart >= lastLabelEnd) {
                const label = document.createElement("div");
                label.textContent = months[pos.month];
                label.style.cssText = `
                    position: absolute;
                    left: ${labelStart}px;
                    top: 0;
                    font-size: 10px;
                    color: #5c7080;
                `;
                monthLabelsContainer.appendChild(label);
                lastLabelEnd = labelStart + 30; // Minimum spacing between labels
            }
        }
    });
    
    wrapper.appendChild(monthLabelsContainer);
    wrapper.appendChild(gridContainer);
    
    // Add legend
    const legend = document.createElement("div");
    legend.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: #5c7080;";
    legend.innerHTML = `
        <span>Less</span>
        <div style="display: flex; gap: 3px;">
            <div style="width: 12px; height: 12px; background: #e1e8ed; border-radius: 2px;"></div>
            <div style="width: 12px; height: 12px; background: #9ec3ff; border-radius: 2px;"></div>
            <div style="width: 12px; height: 12px; background: #4a9eff; border-radius: 2px;"></div>
            <div style="width: 12px; height: 12px; background: #1971ff; border-radius: 2px;"></div>
            <div style="width: 12px; height: 12px; background: #0349b4; border-radius: 2px;"></div>
        </div>
        <span>More</span>
    `;
    
    container.appendChild(wrapper);
    container.appendChild(legend);
    
    return container;
}

// Create a simple bar chart using divs
export function createBarChart(data, labels, title, color = "#106ba3", options = {}) {
    const container = document.createElement("div");
    container.className = "chart-container";
    
    const titleEl = document.createElement("h4");
    titleEl.textContent = title;
    titleEl.style.cssText = "margin: 0 0 12px 0; color: #182026;";
    container.appendChild(titleEl);
    
    const chartWrapper = document.createElement("div");
    const isHourChart = title.includes("Hour");
    const gap = isHourChart ? "2px" : "4px";
    chartWrapper.style.cssText = `display: flex; align-items: flex-end; gap: ${gap}; height: 180px; position: relative; padding: 0 8px;`;
    
    // Get all values for the chart
    const values = labels.map((_, index) => data[index] || 0);
    const maxValue = Math.max(...values, 1);
    
    // Debug log
    console.log(`Chart: ${title}`, { data, labels, values, maxValue });
    
    labels.forEach((label, index) => {
        const value = data[index] || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        
        const barWrapper = document.createElement("div");
        barWrapper.style.cssText = "flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; height: 100%;";
        
        const barContainer = document.createElement("div");
        barContainer.style.cssText = "flex: 1; width: 100%; position: relative; display: flex; align-items: flex-end;";
        
        const bar = document.createElement("div");
        bar.style.cssText = `
            width: 100%;
            height: ${percentage}%;
            background-color: ${color};
            border-radius: 3px 3px 0 0;
            transition: all 0.3s;
            cursor: pointer;
            min-height: ${value > 0 ? '4px' : '0'};
        `;
        bar.title = `${label}: ${value}`;
        
        // Add value label on hover
        bar.onmouseenter = (e) => {
            if (value > 0) {
                const valueLabel = document.createElement("div");
                valueLabel.className = "chart-value-label";
                valueLabel.textContent = value.toString();
                valueLabel.style.cssText = `
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #182026;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 2px;
                    font-size: 11px;
                    margin-bottom: 2px;
                    white-space: nowrap;
                    pointer-events: none;
                    z-index: 10;
                `;
                barContainer.appendChild(valueLabel);
            }
        };
        
        bar.onmouseleave = (e) => {
            const valueLabel = barContainer.querySelector(".chart-value-label");
            if (valueLabel) valueLabel.remove();
        };
        
        const labelEl = document.createElement("div");
        // Now we have more space, show all labels
        labelEl.textContent = label;
        labelEl.style.cssText = `font-size: 11px; color: #5c7080; margin-top: 6px; text-align: center; line-height: 1;`;
        
        barContainer.appendChild(bar);
        barWrapper.appendChild(barContainer);
        barWrapper.appendChild(labelEl);
        chartWrapper.appendChild(barWrapper);
    });
    
    container.appendChild(chartWrapper);
    return container;
}

// Create last 12 weeks trend chart
export function createLast12WeeksTrend(dailyCounts) {
    const container = document.createElement("div");
    container.className = "chart-container";
    
    const titleEl = document.createElement("h4");
    titleEl.textContent = "Weekly Task Completion Trend (Last 12 Weeks)";
    titleEl.style.cssText = "margin: 0 0 12px 0; color: #182026;";
    container.appendChild(titleEl);
    
    // Calculate weekly totals
    const weeklyData = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get start of current week (Monday)
    const currentWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days, otherwise go back (dayOfWeek - 1) days
    currentWeekStart.setDate(today.getDate() - daysToMonday);
    
    // Calculate data for last 12 weeks
    const weeks = [];
    const counts = [];
    
    for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        let weekTotal = 0;
        const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
        
        // Sum up daily counts for this week
        for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
            const dateStr = getLocalDateString(d);
            weekTotal += dailyCounts[dateStr] || 0;
        }
        
        weeks.push(weekLabel);
        counts.push(weekTotal);
    }
    
    // Create the chart
    const chartWrapper = document.createElement("div");
    chartWrapper.style.cssText = "display: flex; align-items: flex-end; gap: 6px; height: 150px; padding: 0 8px; background: #f5f8fa; border-radius: 4px; padding: 16px;";
    
    const maxCount = Math.max(...counts, 1);
    
    weeks.forEach((week, index) => {
        const count = counts[index];
        const percentage = (count / maxCount) * 100;
        const isCurrentWeek = index === weeks.length - 1;
        
        const barWrapper = document.createElement("div");
        barWrapper.style.cssText = "flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; height: 100%;";
        
        const barContainer = document.createElement("div");
        barContainer.style.cssText = "flex: 1; width: 100%; position: relative; display: flex; align-items: flex-end;";
        
        const bar = document.createElement("div");
        bar.style.cssText = `
            width: 100%;
            height: ${percentage}%;
            background-color: ${isCurrentWeek ? '#0f9960' : '#d9822b'};
            border-radius: 4px 4px 0 0;
            transition: all 0.3s;
            cursor: pointer;
            min-height: ${count > 0 ? '4px' : '0'};
            position: relative;
        `;
        
        // Add count label on the bar
        if (count > 0) {
            const countLabel = document.createElement("div");
            countLabel.textContent = count;
            countLabel.style.cssText = `
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 12px;
                font-weight: 500;
                color: #182026;
            `;
            bar.appendChild(countLabel);
        }
        
        const labelEl = document.createElement("div");
        labelEl.innerHTML = week.split('-').join('<br>');
        labelEl.style.cssText = "font-size: 9px; color: #5c7080; margin-top: 6px; text-align: center; line-height: 1.2;";
        
        if (isCurrentWeek) {
            labelEl.style.color = "#0f9960";
            labelEl.style.fontWeight = "500";
        }
        
        barContainer.appendChild(bar);
        barWrapper.appendChild(barContainer);
        barWrapper.appendChild(labelEl);
        chartWrapper.appendChild(barWrapper);
    });
    
    container.appendChild(chartWrapper);
    return container;
}

// Create last 12 months trend chart
export function createLast12MonthsTrend(dailyCounts) {
    const container = document.createElement("div");
    container.className = "chart-container";
    
    const titleEl = document.createElement("h4");
    titleEl.textContent = "Monthly Task Completion Trend (Last 12 Months)";
    titleEl.style.cssText = "margin: 0 0 12px 0; color: #182026;";
    container.appendChild(titleEl);
    
    // Calculate monthly totals
    const today = new Date();
    const months = [];
    const counts = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const monthLabel = `${monthNames[month]} ${year}`;
        
        let monthTotal = 0;
        
        // Get the last day of the month
        const lastDay = new Date(year, month + 1, 0).getDate();
        
        // Sum up daily counts for this month
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dateStr = getLocalDateString(date);
            monthTotal += dailyCounts[dateStr] || 0;
        }
        
        months.push(monthLabel);
        counts.push(monthTotal);
    }
    
    // Create the chart
    const chartWrapper = document.createElement("div");
    chartWrapper.style.cssText = "display: flex; align-items: flex-end; gap: 6px; height: 150px; padding: 0 8px; background: #f5f8fa; border-radius: 4px; padding: 16px;";
    
    const maxCount = Math.max(...counts, 1);
    
    months.forEach((month, index) => {
        const count = counts[index];
        const percentage = (count / maxCount) * 100;
        const isCurrentMonth = index === months.length - 1;
        
        const barWrapper = document.createElement("div");
        barWrapper.style.cssText = "flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; height: 100%;";
        
        const barContainer = document.createElement("div");
        barContainer.style.cssText = "flex: 1; width: 100%; position: relative; display: flex; align-items: flex-end;";
        
        const bar = document.createElement("div");
        bar.style.cssText = `
            width: 100%;
            height: ${percentage}%;
            background-color: ${isCurrentMonth ? '#0f9960' : '#7157d9'};
            border-radius: 4px 4px 0 0;
            transition: all 0.3s;
            cursor: pointer;
            min-height: ${count > 0 ? '4px' : '0'};
            position: relative;
        `;
        
        // Add count label on the bar
        if (count > 0) {
            const countLabel = document.createElement("div");
            countLabel.textContent = count;
            countLabel.style.cssText = `
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 12px;
                font-weight: 500;
                color: #182026;
            `;
            bar.appendChild(countLabel);
        }
        
        const labelEl = document.createElement("div");
        const [monthName, year] = month.split(' ');
        labelEl.innerHTML = `${monthName}<br>${year}`;
        labelEl.style.cssText = "font-size: 9px; color: #5c7080; margin-top: 6px; text-align: center; line-height: 1.2;";
        
        if (isCurrentMonth) {
            labelEl.style.color = "#0f9960";
            labelEl.style.fontWeight = "500";
        }
        
        barContainer.appendChild(bar);
        barWrapper.appendChild(barContainer);
        barWrapper.appendChild(labelEl);
        chartWrapper.appendChild(barWrapper);
    });
    
    container.appendChild(chartWrapper);
    return container;
}
