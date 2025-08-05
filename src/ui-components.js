// UI Components for the Todo Analysis extension
import { getLocalDateString, getTotalTodos, getTodoBlocks } from './queries.js';
import { formatNumber, getScoreEmoji } from './utils.js';
import { calculateStreakAndAverage, generateTodoAnalytics, calculateProductivityScore, calculateLevelAndXP } from './analytics.js';
import { calculateAchievements } from './achievements.js';
import { createLast12DaysTrend, createLast12WeeksTrend, createLast12MonthsTrend, createHeatmapCalendar, createBarChart } from './charts.js';

const POPUP_ID = "todo-analysis-popup";

// Create logbook view
export function createLogbookView(container, analytics) {
    // Header with controls
    const headerContainer = document.createElement("div");
    headerContainer.style.cssText = "margin-bottom: 20px;";
    
    // Task type toggle
    const toggleContainer = document.createElement("div");
    toggleContainer.style.cssText = "display: flex; gap: 8px; margin-bottom: 12px;";
    
    const completedToggle = document.createElement("button");
    completedToggle.className = "bp3-button bp3-intent-primary";
    completedToggle.innerHTML = '<span style="margin-right: 4px;">✅</span> Completed';
    
    const archivedToggle = document.createElement("button");
    archivedToggle.className = "bp3-button";
    archivedToggle.innerHTML = '<span style="margin-right: 4px;">🗑️</span> Archived';
    
    toggleContainer.appendChild(completedToggle);
    toggleContainer.appendChild(archivedToggle);
    
    // Date navigation row
    const dateNavContainer = document.createElement("div");
    dateNavContainer.style.cssText = "display: flex; align-items: center; gap: 12px; margin-bottom: 12px;";
    
    const prevButton = document.createElement("button");
    prevButton.className = "bp3-button bp3-minimal bp3-icon-chevron-left";
    prevButton.title = "Previous day";
    
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "bp3-input";
    dateInput.value = getLocalDateString(new Date());
    dateInput.style.cssText = "width: 200px;";
    
    const nextButton = document.createElement("button");
    nextButton.className = "bp3-button bp3-minimal bp3-icon-chevron-right";
    nextButton.title = "Next day";
    
    const todayButton = document.createElement("button");
    todayButton.className = "bp3-button bp3-small";
    todayButton.textContent = "Today";
    
    const weekButton = document.createElement("button");
    weekButton.className = "bp3-button bp3-small bp3-minimal";
    weekButton.textContent = "This Week";
    
    const monthButton = document.createElement("button");
    monthButton.className = "bp3-button bp3-small bp3-minimal";
    monthButton.textContent = "This Month";
    
    dateNavContainer.appendChild(prevButton);
    dateNavContainer.appendChild(dateInput);
    dateNavContainer.appendChild(nextButton);
    dateNavContainer.appendChild(todayButton);
    dateNavContainer.appendChild(weekButton);
    dateNavContainer.appendChild(monthButton);
    
    // Filter and search row
    const filterContainer = document.createElement("div");
    filterContainer.style.cssText = "display: flex; gap: 12px; align-items: center;";
    
    const searchInput = document.createElement("input");
    searchInput.className = "bp3-input";
    searchInput.placeholder = "Search tasks...";
    searchInput.style.cssText = "flex: 1;";
    
    const pageFilter = document.createElement("select");
    pageFilter.className = "bp3-select";
    pageFilter.style.cssText = "width: 200px;";
    
    const sortSelect = document.createElement("select");
    sortSelect.className = "bp3-select";
    sortSelect.style.cssText = "width: 150px;";
    sortSelect.innerHTML = `
        <option value="time-desc">Time (newest first)</option>
        <option value="time-asc">Time (oldest first)</option>
        <option value="page">Page name</option>
        <option value="content">Task content</option>
    `;
    
    const exportButton = document.createElement("button");
    exportButton.className = "bp3-button bp3-minimal bp3-icon-export";
    exportButton.title = "Export tasks";
    
    filterContainer.appendChild(searchInput);
    filterContainer.appendChild(pageFilter);
    filterContainer.appendChild(sortSelect);
    filterContainer.appendChild(exportButton);
    
    headerContainer.appendChild(toggleContainer);
    headerContainer.appendChild(dateNavContainer);
    headerContainer.appendChild(filterContainer);
    container.appendChild(headerContainer);
    
    // Stats bar
    const statsBar = document.createElement("div");
    statsBar.style.cssText = "display: flex; gap: 20px; margin-bottom: 16px; padding: 12px; background: #f5f8fa; border-radius: 6px; border: 1px solid #e1e8ed;";
    container.appendChild(statsBar);
    
    // Tasks container with sections
    const tasksWrapper = document.createElement("div");
    tasksWrapper.style.cssText = "border: 1px solid #e1e8ed; border-radius: 6px; background: white; overflow: hidden;";
    
    const tasksContainer = document.createElement("div");
    tasksContainer.style.cssText = "max-height: 600px; overflow-y: auto; padding: 16px;";
    tasksWrapper.appendChild(tasksContainer);
    
    container.appendChild(tasksWrapper);
    
    // State management
    let currentView = 'day'; // day, week, month
    let searchTerm = '';
    let selectedPage = 'all';
    let sortBy = 'time-desc';
    let taskType = 'completed'; // completed or archived
    let archivedBlocks = [];
    
    // Helper functions
    const navigateDate = (direction) => {
        const current = new Date(dateInput.value);
        current.setDate(current.getDate() + direction);
        dateInput.value = getLocalDateString(current);
        updateLogbook();
    };
    
    const getDateRange = () => {
        const selected = new Date(dateInput.value);
        let startDate, endDate;
        
        switch (currentView) {
            case 'week':
                startDate = new Date(selected);
                const dayOfWeek = selected.getDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days, otherwise go back (dayOfWeek - 1) days
                startDate.setDate(selected.getDate() - daysToMonday);
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                break;
            case 'month':
                startDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
                endDate = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
                break;
            default: // day
                startDate = endDate = selected;
        }
        
        return { startDate, endDate };
    };
    
    const populatePageFilter = () => {
        const sourceBlocks = taskType === 'completed' ? analytics.blocks : archivedBlocks;
        const pages = [...new Set(sourceBlocks.map(b => b.pageTitle))].sort();
        pageFilter.innerHTML = '<option value="all">All pages</option>';
        pages.forEach(page => {
            const option = document.createElement("option");
            option.value = page;
            option.textContent = page;
            pageFilter.appendChild(option);
        });
    };
    
    const exportTasks = (tasks) => {
        const data = tasks.map(task => ({
            time: new Date(task.editTime).toLocaleString(),
            content: task.content.replace(/\{\{\[\[DONE\]\]\}\}|\{\{\[\[TODO\]\]\}\}|\{\{DONE\}\}|\{\{TODO\}\}|\{\{\[\[ARCHIVED\]\]\}\}/g, '').trim(),
            page: task.pageTitle
        }));
        
        const csv = [
            'Time,Task,Page',
            ...data.map(row => `"${row.time}","${row.content.replace(/"/g, '""')}","${row.page}"`)
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-${dateInput.value}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    const updateLogbook = () => {
        const { startDate, endDate } = getDateRange();
        
        // Use appropriate data based on task type
        const sourceBlocks = taskType === 'completed' ? analytics.blocks : archivedBlocks;
        
        // Filter tasks by date range
        let filteredTasks = sourceBlocks.filter(block => {
            if (!block.editTime) return false;
            const taskDate = new Date(block.editTime);
            taskDate.setHours(0, 0, 0, 0);
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            return taskDate >= start && taskDate <= end;
        });
        
        // Apply filters
        if (searchTerm) {
            filteredTasks = filteredTasks.filter(task => 
                task.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        if (selectedPage !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.pageTitle === selectedPage);
        }
        
        // Sort tasks
        switch (sortBy) {
            case 'time-asc':
                filteredTasks.sort((a, b) => (a.editTime || 0) - (b.editTime || 0));
                break;
            case 'page':
                filteredTasks.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
                break;
            case 'content':
                filteredTasks.sort((a, b) => a.content.localeCompare(b.content));
                break;
            default: // time-desc
                filteredTasks.sort((a, b) => (b.editTime || 0) - (a.editTime || 0));
        }
        
        // Update stats bar
        const timeSpent = filteredTasks.length * 2; // Estimate 2 min per task
        const productivity = filteredTasks.length > 0 ? 
            Math.round((filteredTasks.length / (currentView === 'day' ? 10 : currentView === 'week' ? 50 : 200)) * 100) : 0;
        
        statsBar.innerHTML = `
            <div>
                <div style="font-size: 24px; font-weight: bold; color: #0f9960;">${filteredTasks.length}</div>
                <div style="font-size: 12px; color: #5c7080;">Tasks completed</div>
            </div>
            <div>
                <div style="font-size: 24px; font-weight: bold; color: #106ba3;">${Math.floor(timeSpent / 60)}h ${timeSpent % 60}m</div>
                <div style="font-size: 12px; color: #5c7080;">Est. time spent</div>
            </div>
            <div>
                <div style="font-size: 24px; font-weight: bold; color: #d9822b;">${productivity}%</div>
                <div style="font-size: 12px; color: #5c7080;">Productivity level</div>
            </div>
            ${currentView === 'day' ? `
                <div>
                    <div style="font-size: 24px; font-weight: bold; color: #5c7080;">${filteredTasks.length > 0 ? 
                        new Date(Math.min(...filteredTasks.map(t => t.editTime))).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 
                        '-'}</div>
                    <div style="font-size: 12px; color: #5c7080;">First task</div>
                </div>
            ` : ''}
        `;
        
        // Clear container
        tasksContainer.innerHTML = "";
        
        if (filteredTasks.length === 0) {
            tasksContainer.innerHTML = `
                <div style="text-align: center; color: #5c7080; padding: 60px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">
                        ${searchTerm || selectedPage !== 'all' ? '🔍' : '📅'}
                    </div>
                    <div style="font-size: 16px; margin-bottom: 8px;">
                        ${searchTerm || selectedPage !== 'all' ? 'No matching tasks found' : 
                          taskType === 'completed' ? 'No tasks completed' : 'No archived tasks'}
                    </div>
                    <div style="font-size: 14px;">
                        ${currentView === 'day' ? 'on ' + new Date(dateInput.value).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) :
                          currentView === 'week' ? 'this week' : 'this month'}
                    </div>
                </div>
            `;
            return;
        }
        
        // Group tasks by time period
        const groups = {};
        filteredTasks.forEach(task => {
            const date = new Date(task.editTime);
            let groupKey;
            
            if (currentView === 'day') {
                groupKey = date.getHours();
            } else {
                groupKey = getLocalDateString(date);
            }
            
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(task);
        });
        
        // Display grouped tasks
        Object.entries(groups).forEach(([groupKey, tasks]) => {
            // Group header
            const groupHeader = document.createElement("div");
            groupHeader.style.cssText = "margin: 20px 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e1e8ed; display: flex; justify-content: space-between; align-items: center;";
            
            let headerText;
            if (currentView === 'day') {
                const hour = parseInt(groupKey);
                headerText = `${hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
            } else {
                headerText = new Date(groupKey).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }
            
            groupHeader.innerHTML = `
                <span style="font-weight: 600; color: #182026;">${headerText}</span>
                <span style="font-size: 14px; color: #5c7080;">${tasks.length} task${tasks.length > 1 ? 's' : ''}</span>
            `;
            tasksContainer.appendChild(groupHeader);
            
            // Tasks in group
            tasks.forEach(task => {
                const taskEl = document.createElement("div");
                taskEl.style.cssText = "margin-bottom: 12px; padding: 12px 16px; background: #f5f8fa; border-radius: 6px; border: 1px solid #e1e8ed; cursor: pointer; transition: all 0.2s; position: relative;";
                
                const time = new Date(task.editTime).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                });
                
                const cleanContent = task.content
                    .replace(/\{\{\[\[DONE\]\]\}\}|\{\{\[\[TODO\]\]\}\}|\{\{DONE\}\}|\{\{TODO\}\}|\{\{\[\[ARCHIVED\]\]\}\}/g, '')
                    .trim();
                
                // Highlight search term
                const displayContent = searchTerm ? 
                    cleanContent.replace(new RegExp(`(${searchTerm})`, 'gi'), '<mark style="background: #ffd700; padding: 0 2px;">$1</mark>') : 
                    cleanContent;
                
                const taskIcon = taskType === 'completed' ? 
                    '<div style="color: #0f9960; font-size: 18px; flex-shrink: 0; margin-top: 2px;">✓</div>' :
                    '<div style="color: #5c7080; font-size: 18px; flex-shrink: 0; margin-top: 2px;">🗑️</div>';
                
                taskEl.innerHTML = `
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        ${taskIcon}
                        <div style="flex: 1;">
                            <div style="color: #182026; margin-bottom: 6px; line-height: 1.4;">${displayContent}</div>
                            <div style="font-size: 12px; color: #5c7080; display: flex; gap: 16px; align-items: center;">
                                <span style="display: flex; align-items: center; gap: 4px;">
                                    <span style="opacity: 0.7;">⏰</span> ${time}
                                </span>
                                <span style="display: flex; align-items: center; gap: 4px;">
                                    <span style="opacity: 0.7;">📄</span> ${task.pageTitle}
                                </span>
                            </div>
                        </div>
                        <button class="bp3-button bp3-minimal bp3-small bp3-icon-link" title="Open in Roam" style="opacity: 0; transition: opacity 0.2s;"></button>
                    </div>
                `;
                
                const linkButton = taskEl.querySelector('button');
                linkButton.onclick = (e) => {
                    e.stopPropagation();
                    window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid: task.uid } });
                };
                
                taskEl.onclick = () => {
                    window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid: task.uid } });
                };
                
                taskEl.onmouseenter = () => {
                    taskEl.style.transform = "translateX(4px)";
                    taskEl.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
                    taskEl.style.background = "white";
                    linkButton.style.opacity = "1";
                };
                
                taskEl.onmouseleave = () => {
                    taskEl.style.transform = "translateX(0)";
                    taskEl.style.boxShadow = "none";
                    taskEl.style.background = "#f5f8fa";
                    linkButton.style.opacity = "0";
                };
                
                tasksContainer.appendChild(taskEl);
            });
        });
    };
    
    // Event handlers
    prevButton.onclick = () => navigateDate(-1);
    nextButton.onclick = () => navigateDate(1);
    
    todayButton.onclick = () => {
        currentView = 'day';
        dateInput.value = getLocalDateString(new Date());
        updateViewButtons();
        updateLogbook();
    };
    
    weekButton.onclick = () => {
        currentView = 'week';
        updateViewButtons();
        updateLogbook();
    };
    
    monthButton.onclick = () => {
        currentView = 'month';
        updateViewButtons();
        updateLogbook();
    };
    
    const updateViewButtons = () => {
        [todayButton, weekButton, monthButton].forEach(btn => btn.classList.remove('bp3-intent-primary'));
        if (currentView === 'day') todayButton.classList.add('bp3-intent-primary');
        else if (currentView === 'week') weekButton.classList.add('bp3-intent-primary');
        else monthButton.classList.add('bp3-intent-primary');
    };
    
    searchInput.oninput = (e) => {
        searchTerm = e.target.value;
        updateLogbook();
    };
    
    pageFilter.onchange = (e) => {
        selectedPage = e.target.value;
        updateLogbook();
    };
    
    sortSelect.onchange = (e) => {
        sortBy = e.target.value;
        updateLogbook();
    };
    
    exportButton.onclick = () => {
        const { startDate, endDate } = getDateRange();
        const tasks = analytics.blocks.filter(block => {
            if (!block.editTime) return false;
            const taskDate = new Date(block.editTime);
            return taskDate >= startDate && taskDate <= endDate;
        });
        exportTasks(tasks);
    };
    
    dateInput.onchange = updateLogbook;
    
    // Toggle button handlers
    completedToggle.onclick = async () => {
        if (taskType !== 'completed') {
            taskType = 'completed';
            completedToggle.classList.add('bp3-intent-primary');
            archivedToggle.classList.remove('bp3-intent-primary');
            populatePageFilter();
            updateLogbook();
        }
    };
    
    archivedToggle.onclick = async () => {
        if (taskType !== 'archived') {
            taskType = 'archived';
            archivedToggle.classList.add('bp3-intent-primary');
            completedToggle.classList.remove('bp3-intent-primary');
            
            // Fetch archived blocks if not already loaded
            if (archivedBlocks.length === 0) {
                // Show loading state
                tasksContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div class="bp3-spinner">
                            <div class="bp3-spinner-animation"></div>
                        </div>
                        <div style="margin-top: 16px; color: #5c7080;">Loading archived tasks...</div>
                    </div>
                `;
                
                try {
                    const { getArchivedBlocks } = await import('./queries.js');
                    archivedBlocks = await getArchivedBlocks();
                } catch (error) {
                    console.error("Error fetching archived blocks:", error);
                    archivedBlocks = [];
                }
            }
            
            populatePageFilter();
            updateLogbook();
        }
    };
    
    // Initialize
    populatePageFilter();
    updateViewButtons();
    updateLogbook();
}

// Create the analytics popup
export function createPopup() {
    const overlay = document.createElement("div");
    overlay.id = POPUP_ID;
    overlay.className = "todo-analysis-overlay";
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        padding: 20px;
    `;
    
    const popup = document.createElement("div");
    popup.className = "todo-analysis-popup bp3-dialog";
    popup.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        width: 1200px;
        max-width: 95vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `;
    
    const header = document.createElement("div");
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    `;
    
    const title = document.createElement("h3");
    title.className = "bp3-dialog-header";
    title.textContent = "Todo Analysis";
    title.style.margin = "0";
    
    const buttonGroup = document.createElement("div");
    buttonGroup.style.cssText = "display: flex; gap: 8px;";
    
    const refreshButton = document.createElement("button");
    refreshButton.className = "bp3-button bp3-minimal bp3-icon-refresh";
    refreshButton.title = "Refresh data";
    
    const closeButton = document.createElement("button");
    closeButton.className = "bp3-button bp3-minimal bp3-icon-cross";
    closeButton.onclick = () => overlay.remove();
    
    buttonGroup.appendChild(refreshButton);
    buttonGroup.appendChild(closeButton);
    
    header.appendChild(title);
    header.appendChild(buttonGroup);
    
    const content = document.createElement("div");
    content.className = "bp3-dialog-body";
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
    `;
    
    popup.appendChild(header);
    popup.appendChild(content);
    overlay.appendChild(popup);
    
    // Make refresh button work
    refreshButton.onclick = async () => {
        // Show loading state
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="bp3-spinner">
                    <div class="bp3-spinner-animation"></div>
                </div>
                <div style="margin-top: 16px; color: #5c7080;">Refreshing data...</div>
            </div>
        `;
        
        // Reload the data
        setTimeout(async () => {
            try {
                const [doneBlocks, totalTodos] = await Promise.all([
                    getTodoBlocks("DONE"),
                    getTotalTodos()
                ]);
                
                const { streak, dailyAverage, dailyCounts } = calculateStreakAndAverage(doneBlocks);
                const analytics = generateTodoAnalytics(doneBlocks);
                analytics.streak = streak;
                analytics.dailyAverage = dailyAverage;
                analytics.totalTodos = totalTodos;
                analytics.dailyCounts = dailyCounts;
                analytics.blocks = doneBlocks;
                
                displayAnalytics(content, analytics);
            } catch (error) {
                console.error("Error refreshing data:", error);
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #d13913;">
                        <div>Error refreshing data</div>
                    </div>
                `;
            }
        }, 100);
    };
    
    return { overlay, content };
}

// Create topbar button
export function createTopbarButton() {
    const button = document.createElement("button");
    button.id = "todo-analysis-button";
    button.className = "bp3-button bp3-minimal bp3-icon-chart";
    button.title = "Todo Analysis";
    button.style.cssText = "margin: 0 4px;";
    
    button.onclick = async () => {
        // Check if popup already exists
        if (document.getElementById(POPUP_ID)) return;
        
        const { overlay, content } = createPopup();
        document.body.appendChild(overlay);
        
        // Show loading state
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="bp3-spinner">
                    <div class="bp3-spinner-animation"></div>
                </div>
                <div style="margin-top: 16px; color: #5c7080;">Loading analytics...</div>
            </div>
        `;
        
        // Fetch data and generate analytics
        try {
            const [doneBlocks, totalTodos] = await Promise.all([
                getTodoBlocks("DONE"),
                getTotalTodos()
            ]);
            
            const { streak, dailyAverage, dailyCounts } = calculateStreakAndAverage(doneBlocks);
            const analytics = generateTodoAnalytics(doneBlocks);
            analytics.streak = streak;
            analytics.dailyAverage = dailyAverage;
            analytics.totalTodos = totalTodos;
            analytics.dailyCounts = dailyCounts;
            analytics.blocks = doneBlocks;
            
            displayAnalytics(content, analytics);
        } catch (error) {
            console.error("Error loading analytics:", error);
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #d13913;">
                    <div style="font-size: 18px; margin-bottom: 8px;">Error loading analytics</div>
                    <div style="font-size: 14px; color: #5c7080;">${error.message}</div>
                </div>
            `;
        }
    };
    
    return button;
}

// Display analytics in the popup
export function displayAnalytics(content, analytics) {
    content.innerHTML = "";
    
    // Create tab navigation
    const tabContainer = document.createElement("div");
    tabContainer.className = "bp3-tabs";
    tabContainer.style.cssText = "margin-bottom: 20px;";
    
    const tabList = document.createElement("div");
    tabList.className = "bp3-tab-list";
    tabList.setAttribute("role", "tablist");
    
    const tabs = [
        { id: "overview", label: "Overview", icon: "📊" },
        { id: "charts", label: "Charts", icon: "📈" },
        { id: "logbook", label: "Logbook", icon: "📖" },
        { id: "achievement", label: "Achievement", icon: "🏆" },
        { id: "handbook", label: "Handbook", icon: "📚" }
    ];
    
    const tabPanels = {};
    let activeTab = "overview";
    
    // Create tab buttons
    tabs.forEach(tab => {
        const tabButton = document.createElement("div");
        tabButton.className = "bp3-tab";
        tabButton.setAttribute("role", "tab");
        tabButton.setAttribute("data-tab", tab.id);
        if (tab.id === activeTab) {
            tabButton.classList.add("bp3-tab-selected");
        }
        tabButton.innerHTML = `<span style="margin-right: 4px;">${tab.icon}</span>${tab.label}`;
        tabButton.style.cursor = "pointer";
        
        tabButton.onclick = () => {
            // Update tab selection
            tabList.querySelectorAll(".bp3-tab").forEach(t => t.classList.remove("bp3-tab-selected"));
            tabButton.classList.add("bp3-tab-selected");
            
            // Show corresponding panel
            Object.keys(tabPanels).forEach(panelId => {
                tabPanels[panelId].style.display = panelId === tab.id ? "block" : "none";
            });
            activeTab = tab.id;
        };
        
        tabList.appendChild(tabButton);
    });
    
    tabContainer.appendChild(tabList);
    content.appendChild(tabContainer);
    
    // Create tab panels container
    const panelsContainer = document.createElement("div");
    panelsContainer.className = "bp3-tab-panels";
    content.appendChild(panelsContainer);
    
    // Create and populate each tab panel
    createOverviewPanel(tabPanels, panelsContainer, analytics);
    createChartsPanel(tabPanels, panelsContainer, analytics);
    createLogbookPanel(tabPanels, panelsContainer, analytics);
    createAchievementPanel(tabPanels, panelsContainer, analytics);
    createHandbookPanel(tabPanels, panelsContainer);
}

// Helper functions to create individual panels
function createOverviewPanel(tabPanels, container, analytics) {
    const panel = document.createElement("div");
    panel.className = "bp3-tab-panel";
    panel.style.display = "block";
    tabPanels.overview = panel;
    
    // Productivity Score
    const productivityScoreData = calculateProductivityScore(analytics);
    const scoreContainer = createProductivityScoreSection(productivityScoreData);
    panel.appendChild(scoreContainer);
    
    // Key metrics grid
    const metricsGrid = createMetricsGrid(analytics);
    panel.appendChild(metricsGrid);
    
    // Trend charts section
    const trendSection = document.createElement("div");
    trendSection.style.cssText = "margin-top: 24px;";
    
    // Section title
    const trendTitle = document.createElement("h3");
    trendTitle.textContent = "Task Completion Trends";
    trendTitle.style.cssText = "margin: 0 0 20px 0; color: #182026; font-size: 18px; font-weight: 600;";
    trendSection.appendChild(trendTitle);
    
    // Daily trend (12 days)
    const dailyTrend = createLast12DaysTrend(analytics.dailyCounts);
    trendSection.appendChild(dailyTrend);
    
    // Weekly trend (12 weeks)
    const weeklyTrend = createLast12WeeksTrend(analytics.dailyCounts);
    weeklyTrend.style.marginTop = "20px";
    trendSection.appendChild(weeklyTrend);
    
    // Monthly trend (12 months)
    const monthlyTrend = createLast12MonthsTrend(analytics.dailyCounts);
    monthlyTrend.style.marginTop = "20px";
    trendSection.appendChild(monthlyTrend);
    
    panel.appendChild(trendSection);
    container.appendChild(panel);
}

function createChartsPanel(tabPanels, container, analytics) {
    const panel = document.createElement("div");
    panel.className = "bp3-tab-panel";
    panel.style.display = "none";
    tabPanels.charts = panel;
    
    // Charts grid
    const chartsGrid = document.createElement("div");
    chartsGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;";
    
    // Hour distribution
    const hourData = Array.from({ length: 24 }, (_, i) => analytics.hourDistribution[i] || 0);
    const hourLabels = Array.from({ length: 24 }, (_, i) => {
        if (i === 0) return "12AM";
        if (i === 12) return "12PM";
        return i < 12 ? `${i}` : `${i-12}`;
    });
    const hourChart = createBarChart(hourData, hourLabels, "Tasks by Hour of Day", "#106ba3");
    chartsGrid.appendChild(hourChart);
    
    // Weekday distribution
    // Reorder data to start from Monday
    const weekdayDataOriginal = analytics.weekdayDistribution;
    const weekdayData = [
        weekdayDataOriginal[1], // Mon
        weekdayDataOriginal[2], // Tue
        weekdayDataOriginal[3], // Wed
        weekdayDataOriginal[4], // Thu
        weekdayDataOriginal[5], // Fri
        weekdayDataOriginal[6], // Sat
        weekdayDataOriginal[0]  // Sun
    ];
    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekdayChart = createBarChart(weekdayData, weekdayLabels, "Tasks by Day of Week", "#0f9960");
    chartsGrid.appendChild(weekdayChart);
    
    panel.appendChild(chartsGrid);
    
    // Heatmap calendar
    const heatmapTitle = document.createElement("h3");
    heatmapTitle.textContent = "Activity Calendar";
    heatmapTitle.style.cssText = "margin: 24px 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    panel.appendChild(heatmapTitle);
    
    const heatmap = createHeatmapCalendar(analytics.dailyCounts);
    panel.appendChild(heatmap);
    
    container.appendChild(panel);
}

function createLogbookPanel(tabPanels, container, analytics) {
    const panel = document.createElement("div");
    panel.className = "bp3-tab-panel";
    panel.style.display = "none";
    tabPanels.logbook = panel;
    
    createLogbookView(panel, analytics);
    
    container.appendChild(panel);
}

function createAchievementPanel(tabPanels, container, analytics) {
    const panel = document.createElement("div");
    panel.className = "bp3-tab-panel";
    panel.style.display = "none";
    tabPanels.achievement = panel;
    
    const achievements = calculateAchievements(analytics);
    const levelData = calculateLevelAndXP(analytics.totalCompleted);
    
    // Level and XP section
    const levelSection = createLevelSection(levelData, analytics);
    panel.appendChild(levelSection);
    
    // Achievements section
    const achievementsSection = createAchievementsSection(achievements);
    panel.appendChild(achievementsSection);
    
    container.appendChild(panel);
}

function createHandbookPanel(tabPanels, container) {
    const panel = document.createElement("div");
    panel.className = "bp3-tab-panel";
    panel.style.display = "none";
    tabPanels.handbook = panel;
    
    panel.innerHTML = `
        <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
            <h2 style="margin: 0 0 24px 0; color: #182026; text-align: center;">📚 Todo Analysis Handbook</h2>
            
            <!-- Introduction Section -->
            <div style="background: #f5f8fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e1e8ed;">
                <h3 style="margin: 0 0 12px 0; color: #182026;">🎯 Introduction</h3>
                <p style="color: #5c7080; margin: 0 0 12px 0; line-height: 1.6;">
                    Todo Analysis is a powerful extension for Roam Research that helps you track, analyze, and optimize your task completion habits. 
                    By providing detailed insights into your productivity patterns, it empowers you to make data-driven decisions about your workflow.
                </p>
                <p style="color: #5c7080; margin: 0; line-height: 1.6;">
                    Whether you're looking to build better habits, understand your work patterns, or simply stay motivated with gamification features,
                    Todo Analysis provides the tools and insights you need to succeed.
                </p>
            </div>
            
            <!-- Quick Start Guide -->
            <div style="background: #e7f3ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #106ba3;">
                <h3 style="margin: 0 0 12px 0; color: #182026;">🚀 Quick Start Guide</h3>
                <ol style="color: #5c7080; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Mark tasks as TODO:</strong> Use {{[[TODO]]}} or {{TODO}} in your blocks</li>
                    <li><strong>Complete tasks:</strong> Change {{[[TODO]]}} to {{[[DONE]]}} when finished</li>
                    <li><strong>Open Todo Analysis:</strong> Click the chart icon in the top bar</li>
                    <li><strong>Review your stats:</strong> Explore the different tabs for insights</li>
                    <li><strong>Build habits:</strong> Check daily to maintain your streak!</li>
                </ol>
            </div>
            
            <!-- Tab Descriptions -->
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px 0; color: #182026;">📋 Understanding Each Tab</h3>
                
                <div style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e1e8ed;">
                    <h4 style="color: #182026; margin: 0 0 8px 0;">📊 Overview Tab</h4>
                    <p style="color: #5c7080; margin: 0 0 8px 0; line-height: 1.6;">
                        Your productivity dashboard showing key metrics at a glance:
                    </p>
                    <ul style="color: #5c7080; margin: 0; padding-left: 20px;">
                        <li><strong>Productivity Score (0-100):</strong> A composite score based on streak, daily average, consistency, and momentum</li>
                        <li><strong>Key Metrics:</strong> Total completed tasks, current streak, daily average, and total TODOs</li>
                        <li><strong>Trend Charts:</strong> Visual representation of your task completion over the last 12 days, weeks, and months</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e1e8ed;">
                    <h4 style="color: #182026; margin: 0 0 8px 0;">📈 Charts Tab</h4>
                    <p style="color: #5c7080; margin: 0 0 8px 0; line-height: 1.6;">
                        Deep dive into your productivity patterns:
                    </p>
                    <ul style="color: #5c7080; margin: 0; padding-left: 20px;">
                        <li><strong>Hour Distribution:</strong> Discover your most productive hours of the day</li>
                        <li><strong>Weekday Distribution:</strong> See which days you complete the most tasks</li>
                        <li><strong>Activity Calendar:</strong> A GitHub-style heatmap showing your daily activity over time</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e1e8ed;">
                    <h4 style="color: #182026; margin: 0 0 8px 0;">📖 Logbook Tab</h4>
                    <p style="color: #5c7080; margin: 0 0 8px 0; line-height: 1.6;">
                        Review your completed tasks by date:
                    </p>
                    <ul style="color: #5c7080; margin: 0; padding-left: 20px;">
                        <li>Navigate to any date using the date picker</li>
                        <li>View all tasks completed on that day with timestamps</li>
                        <li>Click any task to open it directly in Roam</li>
                        <li>See which pages your tasks belonged to</li>
                    </ul>
                </div>
                
                <div style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e1e8ed;">
                    <h4 style="color: #182026; margin: 0 0 8px 0;">🏆 Achievement Tab</h4>
                    <p style="color: #5c7080; margin: 0 0 8px 0; line-height: 1.6;">
                        Gamification features to keep you motivated:
                    </p>
                    <ul style="color: #5c7080; margin: 0; padding-left: 20px;">
                        <li><strong>Level System:</strong> Gain XP for each completed task and level up</li>
                        <li><strong>Achievements:</strong> Unlock badges for reaching milestones and maintaining streaks</li>
                        <li><strong>Categories:</strong> Achievements span multiple categories including streaks, milestones, daily goals, and more</li>
                    </ul>
                </div>
            </div>
            
            <!-- Productivity Score Breakdown -->
            <div style="background: #f5f8fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e1e8ed;">
                <h3 style="margin: 0 0 16px 0; color: #182026;">💯 Understanding Your Productivity Score</h3>
                <p style="color: #5c7080; margin: 0 0 12px 0; line-height: 1.6;">
                    Your productivity score is calculated from four components, each worth up to 25 points:
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div style="padding: 12px; background: white; border-radius: 6px;">
                        <h5 style="color: #d13913; margin: 0 0 4px 0;">🔥 Streak (25 points)</h5>
                        <p style="color: #5c7080; margin: 0; font-size: 14px;">Consecutive days with completed tasks</p>
                    </div>
                    <div style="padding: 12px; background: white; border-radius: 6px;">
                        <h5 style="color: #106ba3; margin: 0 0 4px 0;">📊 Daily Average (25 points)</h5>
                        <p style="color: #5c7080; margin: 0; font-size: 14px;">Average tasks completed per day</p>
                    </div>
                    <div style="padding: 12px; background: white; border-radius: 6px;">
                        <h5 style="color: #0f9960; margin: 0 0 4px 0;">📅 Consistency (25 points)</h5>
                        <p style="color: #5c7080; margin: 0; font-size: 14px;">Days with tasks in last 30 days</p>
                    </div>
                    <div style="padding: 12px; background: white; border-radius: 6px;">
                        <h5 style="color: #d9822b; margin: 0 0 4px 0;">📈 Momentum (25 points)</h5>
                        <p style="color: #5c7080; margin: 0; font-size: 14px;">Recent 7-day average vs overall</p>
                    </div>
                </div>
            </div>
            
            <!-- Advanced Tips -->
            <div style="background: #e7f3ff; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #106ba3;">
                <h3 style="margin: 0 0 16px 0; color: #182026;">💡 Advanced Tips & Strategies</h3>
                
                <h4 style="color: #182026; margin: 16px 0 8px 0;">🎯 Building Better Habits</h4>
                <ul style="color: #5c7080; margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Start small:</strong> Begin with 1-3 tasks daily to build consistency</li>
                    <li><strong>Time blocking:</strong> Schedule tasks during your peak productivity hours (check Charts tab)</li>
                    <li><strong>Weekly reviews:</strong> Use the Logbook to review what you accomplished each week</li>
                    <li><strong>Streak protection:</strong> Set a minimum daily task to maintain your streak</li>
                </ul>
                
                <h4 style="color: #182026; margin: 16px 0 8px 0;">📊 Optimizing Your Workflow</h4>
                <ul style="color: #5c7080; margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Pattern recognition:</strong> Identify your most productive times and days</li>
                    <li><strong>Batch similar tasks:</strong> Group related TODOs on the same page</li>
                    <li><strong>Use tags:</strong> Add #tags to tasks for better categorization</li>
                    <li><strong>Daily planning:</strong> Create TODOs the night before for next day</li>
                </ul>
                
                <h4 style="color: #182026; margin: 16px 0 8px 0;">🏆 Achievement Hunting</h4>
                <ul style="color: #5c7080; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li><strong>Check progress:</strong> Review locked achievements for goals to pursue</li>
                    <li><strong>Milestone planning:</strong> Plan ahead for big milestones (100, 500, 1000 tasks)</li>
                    <li><strong>Special achievements:</strong> Look for unique patterns and special dates</li>
                    <li><strong>Category focus:</strong> Target specific achievement categories each month</li>
                </ul>
            </div>
            
            <!-- Common Questions -->
            <div style="background: #fff3cd; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #ffeaa7;">
                <h3 style="margin: 0 0 16px 0; color: #182026;">❓ Common Questions</h3>
                
                <div style="margin-bottom: 16px;">
                    <h5 style="color: #182026; margin: 0 0 4px 0;">Q: How are tasks counted?</h5>
                    <p style="color: #5c7080; margin: 0; font-size: 14px;">
                        Any block containing {{[[DONE]]}} or {{DONE}} is counted as a completed task. The extension tracks when TODOs are changed to DONE.
                    </p>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <h5 style="color: #182026; margin: 0 0 4px 0;">Q: When does my streak reset?</h5>
                    <p style="color: #5c7080; margin: 0; font-size: 14px;">
                        Your streak resets if you don't complete at least one task in a calendar day (midnight to midnight in your local timezone).
                    </p>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <h5 style="color: #182026; margin: 0 0 4px 0;">Q: Can I track different types of tasks?</h5>
                    <p style="color: #5c7080; margin: 0; font-size: 14px;">
                        Currently, all {{[[TODO]]}} → {{[[DONE]]}} transitions are tracked equally. Use tags or page organization for categorization.
                    </p>
                </div>
                
                <div>
                    <h5 style="color: #182026; margin: 0 0 4px 0;">Q: Is my data stored anywhere?</h5>
                    <p style="color: #5c7080; margin: 0; font-size: 14px;">
                        No, all analysis is done locally in your browser using Roam's database. No data is sent to external servers.
                    </p>
                </div>
            </div>
            
            <!-- Keyboard Shortcuts -->
            <div style="background: #f5f8fa; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e1e8ed;">
                <h3 style="margin: 0 0 16px 0; color: #182026;">⌨️ Keyboard Shortcuts</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <kbd style="background: #e1e8ed; padding: 4px 8px; border-radius: 4px; font-family: monospace;">Esc</kbd>
                        <span style="color: #5c7080; margin-left: 8px;">Close the popup</span>
                    </div>
                    <div>
                        <kbd style="background: #e1e8ed; padding: 4px 8px; border-radius: 4px; font-family: monospace;">Tab</kbd>
                        <span style="color: #5c7080; margin-left: 8px;">Navigate between tabs</span>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e1e8ed; color: #5c7080;">
                <p style="margin: 0 0 8px 0;">
                    <strong>Todo Analysis</strong> for Roam Research
                </p>
                <p style="margin: 0; font-size: 14px;">
                    Track your progress • Build better habits • Achieve your goals
                </p>
            </div>
        </div>
    `;
    
    container.appendChild(panel);
}

// Helper functions for creating UI sections
function createProductivityScoreSection(scoreData) {
    const container = document.createElement("div");
    container.style.cssText = "margin-bottom: 24px;";
    
    // Main score circle
    const mainScoreContainer = document.createElement("div");
    mainScoreContainer.style.cssText = "text-align: center; margin-bottom: 24px;";
    
    const scoreCircle = document.createElement("div");
    scoreCircle.style.cssText = `
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: conic-gradient(#0f9960 0deg, #0f9960 ${scoreData.total * 3.6}deg, #e1e8ed ${scoreData.total * 3.6}deg);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        position: relative;
    `;
    
    const scoreInner = document.createElement("div");
    scoreInner.style.cssText = `
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    `;
    
    scoreInner.innerHTML = `
        <div style="font-size: 32px; font-weight: bold; color: #0f9960;">${scoreData.total}</div>
        <div style="font-size: 12px; color: #5c7080;">Productivity Score</div>
    `;
    
    scoreCircle.appendChild(scoreInner);
    mainScoreContainer.appendChild(scoreCircle);
    container.appendChild(mainScoreContainer);
    
    // Component scores breakdown
    const componentsContainer = document.createElement("div");
    componentsContainer.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;";
    
    Object.entries(scoreData.components).forEach(([key, component]) => {
        const componentCard = document.createElement("div");
        componentCard.style.cssText = "background: #f5f8fa; border-radius: 8px; padding: 12px; border: 1px solid #e1e8ed;";
        
        const color = key === 'streak' ? '#d13913' : 
                     key === 'dailyAverage' ? '#106ba3' : 
                     key === 'consistency' ? '#0f9960' : '#d9822b';
        
        componentCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 600; color: #5c7080;">${component.label}</span>
                <span style="font-size: 14px; font-weight: bold; color: ${color};">${component.score}/${component.max}</span>
            </div>
            <div style="background: #e1e8ed; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 4px;">
                <div style="background: ${color}; height: 100%; width: ${component.percentage}%; transition: width 0.3s;"></div>
            </div>
            <div style="font-size: 11px; color: #5c7080; text-align: right;">
                ${key === 'streak' ? `${component.value} days` :
                  key === 'dailyAverage' ? `${component.value} tasks/day` :
                  key === 'consistency' ? `${component.value}/30 days` :
                  component.value}
            </div>
        `;
        
        componentsContainer.appendChild(componentCard);
    });
    
    container.appendChild(componentsContainer);
    return container;
}

function createMetricsGrid(analytics) {
    const grid = document.createElement("div");
    grid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;";
    
    const metrics = [
        { label: "Total Completed", value: formatNumber(analytics.totalCompleted), icon: "✅", color: "#0f9960" },
        { label: "Current Streak", value: `${analytics.streak} days`, icon: "🔥", color: "#d13913" },
        { label: "Daily Average", value: analytics.dailyAverage, icon: "📊", color: "#106ba3" },
        { label: "Total TODOs", value: formatNumber(analytics.totalTodos), icon: "📝", color: "#5c7080" }
    ];
    
    metrics.forEach(metric => {
        const card = document.createElement("div");
        card.style.cssText = "background: #f5f8fa; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e1e8ed;";
        card.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 8px;">${metric.icon}</div>
            <div style="font-size: 24px; font-weight: bold; color: ${metric.color}; margin-bottom: 4px;">${metric.value}</div>
            <div style="font-size: 14px; color: #5c7080;">${metric.label}</div>
        `;
        grid.appendChild(card);
    });
    
    return grid;
}

function createLevelSection(levelData, analytics) {
    const section = document.createElement("div");
    section.style.cssText = "margin-bottom: 32px;";
    
    const levelCard = document.createElement("div");
    levelCard.style.cssText = "background: linear-gradient(135deg, #106ba3, #0f9960); color: white; padding: 24px; border-radius: 12px; text-align: center;";
    
    levelCard.innerHTML = `
        <div style="font-size: 48px; font-weight: bold; margin-bottom: 8px;">Level ${levelData.level}</div>
        <div style="font-size: 18px; margin-bottom: 16px;">${formatNumber(levelData.xpInCurrentLevel)} / ${formatNumber(levelData.xpForNextLevel)} XP</div>
        <div style="background: rgba(255,255,255,0.2); height: 12px; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
            <div style="background: white; height: 100%; width: ${levelData.progressPercent}%; transition: width 0.5s;"></div>
        </div>
        <div style="font-size: 16px; opacity: 0.9;">Total Tasks Completed: ${formatNumber(analytics.totalCompleted)}</div>
    `;
    
    section.appendChild(levelCard);
    return section;
}

function createAchievementsSection(achievements) {
    const section = document.createElement("div");
    
    // Achievement stats
    const stats = document.createElement("div");
    stats.style.cssText = "margin-bottom: 24px; text-align: center;";
    stats.innerHTML = `
        <div style="font-size: 20px; color: #182026; font-weight: 600;">
            ${achievements.achieved.length} / ${achievements.all.length} Achievements Unlocked
        </div>
    `;
    section.appendChild(stats);
    
    // Achievement categories
    const categories = ['streak', 'milestone', 'daily', 'speed', 'time', 'pattern', 'organization', 'consistency', 'special', 'fun'];
    
    categories.forEach(category => {
        const categoryAchievements = achievements.all.filter(a => a.category === category);
        if (categoryAchievements.length === 0) return;
        
        const categorySection = document.createElement("div");
        categorySection.style.cssText = "margin-bottom: 24px;";
        
        const categoryTitle = document.createElement("h4");
        categoryTitle.style.cssText = "margin: 0 0 12px 0; color: #182026; text-transform: capitalize;";
        categoryTitle.textContent = category;
        categorySection.appendChild(categoryTitle);
        
        const achievementGrid = document.createElement("div");
        achievementGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px;";
        
        categoryAchievements.forEach(achievement => {
            const card = document.createElement("div");
            const isAchieved = achievement.requirement;
            card.style.cssText = `
                padding: 12px;
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
                ${isAchieved ? 
                    'background: #f5f8fa; border: 2px solid #0f9960;' : 
                    'background: #f5f8fa; border: 1px solid #e1e8ed; opacity: 0.6;'}
            `;
            
            card.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 8px; ${!isAchieved ? 'filter: grayscale(1);' : ''}">${achievement.icon}</div>
                <div style="font-size: 12px; font-weight: 600; color: ${isAchieved ? '#182026' : '#5c7080'}; margin-bottom: 4px;">${achievement.name}</div>
                <div style="font-size: 11px; color: #5c7080;">${achievement.desc}</div>
            `;
            
            card.onmouseenter = () => {
                if (isAchieved) {
                    card.style.transform = "scale(1.05)";
                    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                }
            };
            
            card.onmouseleave = () => {
                card.style.transform = "scale(1)";
                card.style.boxShadow = "none";
            };
            
            achievementGrid.appendChild(card);
        });
        
        categorySection.appendChild(achievementGrid);
        section.appendChild(categorySection);
    });
    
    return section;
}