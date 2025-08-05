// UI Components for the Todo Analysis extension
import { getLocalDateString, getTotalTodos } from './queries.js';
import { formatNumber, getScoreEmoji } from './utils.js';
import { calculateStreakAndAverage, generateTodoAnalytics, calculateProductivityScore, calculateLevelAndXP } from './analytics.js';
import { calculateAchievements } from './achievements.js';
import { createLast10DaysTrend, createHeatmapCalendar, createBarChart } from './charts.js';

const POPUP_ID = "todo-analysis-popup";

// Create logbook view
export function createLogbookView(container, analytics) {
    // Date selector
    const selectorContainer = document.createElement("div");
    selectorContainer.style.cssText = "margin-bottom: 16px; display: flex; align-items: center; gap: 12px;";
    
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "bp3-input";
    dateInput.value = getLocalDateString(new Date());
    dateInput.style.cssText = "width: 200px;";
    
    const todayButton = document.createElement("button");
    todayButton.className = "bp3-button bp3-small";
    todayButton.textContent = "Today";
    todayButton.onclick = () => {
        dateInput.value = getLocalDateString(new Date());
        updateLogbook();
    };
    
    selectorContainer.appendChild(dateInput);
    selectorContainer.appendChild(todayButton);
    container.appendChild(selectorContainer);
    
    // Tasks list container
    const tasksContainer = document.createElement("div");
    tasksContainer.style.cssText = "max-height: 400px; overflow-y: auto; border: 1px solid #e1e8ed; border-radius: 4px; padding: 16px; background: #f5f8fa;";
    container.appendChild(tasksContainer);
    
    // Update function
    const updateLogbook = () => {
        const selectedDate = dateInput.value;
        console.log("Updating logbook for date:", selectedDate);
        
        const tasksForDay = analytics.blocks.filter(block => {
            if (!block.editTime) return false;
            const taskDate = getLocalDateString(new Date(block.editTime));
            return taskDate === selectedDate;
        });
        
        console.log("Tasks found for", selectedDate, ":", tasksForDay.length);
        
        // Sort by time
        tasksForDay.sort((a, b) => (b.editTime || 0) - (a.editTime || 0));
        
        tasksContainer.innerHTML = "";
        
        if (tasksForDay.length === 0) {
            tasksContainer.innerHTML = `
                <div style="text-align: center; color: #5c7080; padding: 40px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">📅</div>
                    <div>No tasks completed on this day</div>
                </div>
            `;
            return;
        }
        
        // Display count
        const countDiv = document.createElement("div");
        countDiv.style.cssText = "margin-bottom: 16px; font-weight: 500; color: #182026;";
        countDiv.textContent = `${tasksForDay.length} tasks completed`;
        tasksContainer.appendChild(countDiv);
        
        // Display tasks
        tasksForDay.forEach(task => {
            const taskEl = document.createElement("div");
            taskEl.style.cssText = "margin-bottom: 12px; padding: 12px; background: white; border-radius: 4px; border: 1px solid #e1e8ed; cursor: pointer; transition: all 0.2s;";
            
            // Time
            const time = new Date(task.editTime).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            
            // Clean content (remove {{[[DONE]]}}) and other todo markers
            const cleanContent = task.content
                .replace(/\{\{\[\[DONE\]\]\}\}/g, '')
                .replace(/\{\{\[\[TODO\]\]\}\}/g, '')
                .replace(/\{\{DONE\}\}/g, '')
                .replace(/\{\{TODO\}\}/g, '')
                .trim();
            
            taskEl.innerHTML = `
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                    <div style="color: #0f9960; font-size: 18px; flex-shrink: 0;">✓</div>
                    <div style="flex: 1;">
                        <div style="color: #182026; margin-bottom: 4px;">${cleanContent}</div>
                        <div style="font-size: 12px; color: #5c7080; display: flex; gap: 12px;">
                            <span>${time}</span>
                            <span>${task.pageTitle}</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Click to open block
            taskEl.onclick = () => {
                window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid: task.uid } });
            };
            
            taskEl.onmouseenter = () => {
                taskEl.style.transform = "translateX(4px)";
                taskEl.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
            };
            
            taskEl.onmouseleave = () => {
                taskEl.style.transform = "translateX(0)";
                taskEl.style.boxShadow = "none";
            };
            
            tasksContainer.appendChild(taskEl);
        });
    };
    
    // Initial load
    updateLogbook();
    
    // Update on date change
    dateInput.onchange = updateLogbook;
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
                const { getTodoBlocks } = await import('./queries.js');
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
    button.className = "bp3-button bp3-minimal bp3-icon-timeline-events";
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
            const { getTodoBlocks } = await import('./queries.js');
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
    
    // Recent trend
    const trendChart = createLast10DaysTrend(analytics.dailyCounts);
    panel.appendChild(trendChart);
    
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
    const weekdayData = Object.values(analytics.weekdayDistribution);
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
        <div style="padding: 20px; background: #f5f8fa; border-radius: 8px;">
            <h3 style="margin: 0 0 16px 0; color: #182026;">How to Use Todo Analysis</h3>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #182026; margin-bottom: 8px;">📊 Overview Tab</h4>
                <p style="color: #5c7080; margin: 0 0 8px 0;">View your productivity score, key metrics, and recent trends at a glance.</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #182026; margin-bottom: 8px;">📈 Charts Tab</h4>
                <p style="color: #5c7080; margin: 0 0 8px 0;">Analyze your task completion patterns by hour, day of week, and view your activity heatmap.</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #182026; margin-bottom: 8px;">📖 Logbook Tab</h4>
                <p style="color: #5c7080; margin: 0 0 8px 0;">Review tasks completed on specific days. Click on any task to open it in Roam.</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="color: #182026; margin-bottom: 8px;">🏆 Achievement Tab</h4>
                <p style="color: #5c7080; margin: 0 0 8px 0;">Track your progress with levels, XP, and unlock achievements as you complete more tasks.</p>
            </div>
            
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e1e8ed;">
                <h4 style="color: #182026; margin-bottom: 8px;">Tips for Better Productivity</h4>
                <ul style="color: #5c7080; margin: 0; padding-left: 20px;">
                    <li>Maintain a daily streak by completing at least one task every day</li>
                    <li>Use hashtags to categorize your tasks for better organization</li>
                    <li>Review your hourly patterns to find your most productive times</li>
                    <li>Set daily goals based on your average completion rate</li>
                </ul>
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