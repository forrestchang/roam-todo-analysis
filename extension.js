// Todo Analysis Extension - Bundled version
// This extension provides comprehensive analytics for TODO items in Roam Research
// Generated from modular source files


// ========== queries module ==========
// Query functions for fetching TODO blocks from Roam

// Get local date string (YYYY-MM-DD) in local timezone
function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Query functions adapted for Roam's native API
async function getTodoBlocks(status) {
    try {
        console.log(`Fetching ${status} blocks...`);
        
        // Query to find all blocks containing the status marker
        const query = `
            [:find ?uid ?string ?create-time ?edit-time ?page-title
             :where
             [?b :block/uid ?uid]
             [?b :block/string ?string]
             [(clojure.string/includes? ?string "{{[[${status}]]}}")]
             [?b :block/page ?page]
             [?page :node/title ?page-title]
             (or-join [?b ?create-time]
               (and [?b :create/time ?create-time])
               (and [(missing? $ ?b :create/time)]
                    [(ground 0) ?create-time]))
             (or-join [?b ?edit-time]
               (and [?b :edit/time ?edit-time])
               (and [(missing? $ ?b :edit/time)]
                    [(ground 0) ?edit-time]))]
        `;

        // Force fresh query by adding timestamp
        const timestamp = Date.now();
        const results = await window.roamAlphaAPI.q(query);
        console.log(`Found ${results.length} ${status} blocks at ${timestamp}`);
        
        // Log a sample of recent results
        const today = getLocalDateString(new Date());
        const todayResults = results.filter(([,,,editTime]) => {
            if (editTime) {
                const date = getLocalDateString(new Date(editTime));
                return date === today;
            }
            return false;
        });
        console.log(`Today's ${status} blocks:`, todayResults.length);
        
        return results.map(([uid, content, createTime, editTime, pageTitle]) => ({
            uid,
            content,
            createTime: createTime || null,
            editTime: editTime || null,
            pageTitle: pageTitle || "Untitled"
        }));
    } catch (error) {
        console.error(`Error fetching ${status} blocks:`, error);
        return [];
    }
}

// Get total TODO count (including all states)
async function getTotalTodos() {
    try {
        console.log("Fetching total TODO count...");
        
        const query = `
            [:find (count ?b)
             :where
             [?b :block/string ?string]
             (or [(clojure.string/includes? ?string "{{[[TODO]]}}")]
                 [(clojure.string/includes? ?string "{{[[DOING]]}}")]
                 [(clojure.string/includes? ?string "{{[[DONE]]}}")])
            ]
        `;
        
        const result = await window.roamAlphaAPI.q(query);
        const count = result[0]?.[0] || 0;
        console.log(`Total TODO count: ${count}`);
        return count;
    } catch (error) {
        console.error("Error fetching total TODO count:", error);
        return 0;
    }
}

// Get archived blocks
async function getArchivedBlocks() {
    try {
        console.log("Fetching ARCHIVED blocks...");
        
        const query = `
            [:find ?uid ?string ?create-time ?edit-time ?page-title
             :where
             [?b :block/uid ?uid]
             [?b :block/string ?string]
             [(clojure.string/includes? ?string "{{[[ARCHIVED]]}}")]
             [?b :block/page ?page]
             [?page :node/title ?page-title]
             (or-join [?b ?create-time]
               (and [?b :create/time ?create-time])
               (and [(missing? $ ?b :create/time)]
                    [(ground 0) ?create-time]))
             (or-join [?b ?edit-time]
               (and [?b :edit/time ?edit-time])
               (and [(missing? $ ?b :edit/time)]
                    [(ground 0) ?edit-time]))]
        `;
        
        const results = await window.roamAlphaAPI.q(query);
        console.log(`Found ${results.length} ARCHIVED blocks`);
        
        return results.map(([uid, content, createTime, editTime, pageTitle]) => ({
            uid,
            content,
            createTime: createTime || null,
            editTime: editTime || null,
            pageTitle: pageTitle || "Untitled"
        }));
    } catch (error) {
        console.error("Error fetching ARCHIVED blocks:", error);
        return [];
    }
}

// Get all task blocks (TODO, DOING, DONE, ARCHIVED) for search
async function getAllTaskBlocks() {
    try {
        console.log("Fetching all task blocks for search...");
        
        const query = `
            [:find ?uid ?string ?create-time ?edit-time ?page-title ?order
             :where
             [?b :block/uid ?uid]
             [?b :block/string ?string]
             (or [(clojure.string/includes? ?string "{{[[TODO]]}}")]
                 [(clojure.string/includes? ?string "{{[[DOING]]}}")]
                 [(clojure.string/includes? ?string "{{[[DONE]]}}")]
                 [(clojure.string/includes? ?string "{{[[ARCHIVED]]}}")])
             [?b :block/page ?page]
             [?page :node/title ?page-title]
             [?b :block/order ?order]
             (or-join [?b ?create-time]
               (and [?b :create/time ?create-time])
               (and [(missing? $ ?b :create/time)]
                    [(ground 0) ?create-time]))
             (or-join [?b ?edit-time]
               (and [?b :edit/time ?edit-time])
               (and [(missing? $ ?b :edit/time)]
                    [(ground 0) ?edit-time]))]
        `;
        
        const results = await window.roamAlphaAPI.q(query);
        console.log(`Found ${results.length} total task blocks`);
        
        return results.map(([uid, content, createTime, editTime, pageTitle, order]) => ({
            uid,
            content,
            createTime: createTime || null,
            editTime: editTime || null,
            pageTitle: pageTitle || "Untitled",
            order: order || 0
        }));
    } catch (error) {
        console.error("Error fetching all task blocks:", error);
        return [];
    }
}

// Get children blocks for a given parent UID
async function getChildrenBlocks(parentUid) {
    try {
        const query = `
            [:find ?uid ?string ?order
             :where
             [?parent :block/uid "${parentUid}"]
             [?parent :block/children ?child]
             [?child :block/uid ?uid]
             [?child :block/string ?string]
             [?child :block/order ?order]]
        `;
        
        const results = await window.roamAlphaAPI.q(query);
        
        return results
            .map(([uid, content, order]) => ({
                uid,
                content,
                order: order || 0
            }))
            .sort((a, b) => a.order - b.order);
    } catch (error) {
        console.error("Error fetching children blocks:", error);
        return [];
    }
}
// ========== utils module ==========
// Utility functions for text processing and date calculations

// Extract hashtags from text
function extractHashtags(text) {
    return (text.match(/#(\w+)/g) || []).map(tag => tag.substring(1));
}

// Extract page links from text
function extractPageLinks(text) {
    const matches = text.match(/\[\[(.*?)\]\]/g) || [];
    return matches.map(match => match.slice(2, -2));
}

// Calculate task duration in hours
function calculateTaskDuration(block) {
    if (block.createTime && block.editTime && block.createTime > 0 && block.editTime > 0) {
        return (block.editTime - block.createTime) / 1000 / 3600; // Convert to hours
    }
    return null;
}

// Helper to get ISO week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

// Format number with commas
function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Generate emoji based on score
function getScoreEmoji(score) {
    if (score >= 90) return "🌟";
    if (score >= 80) return "⭐";
    if (score >= 70) return "✨";
    if (score >= 60) return "👍";
    if (score >= 50) return "📈";
    return "💪";
}

// Simple fuzzy search implementation
function fuzzySearch(query, text) {
    if (!query || !text) return false;
    
    query = query.toLowerCase();
    text = text.toLowerCase();
    
    // Exact match
    if (text.includes(query)) return true;
    
    // Fuzzy match - all characters in query must appear in text in order
    let queryIndex = 0;
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
            queryIndex++;
        }
    }
    
    return queryIndex === query.length;
}

// Calculate fuzzy search score
function fuzzySearchScore(query, text) {
    if (!query || !text) return 0;
    
    query = query.toLowerCase();
    text = text.toLowerCase();
    
    // Exact match gets highest score
    if (text === query) return 1000;
    
    // Contains exact query
    if (text.includes(query)) return 500;
    
    // Fuzzy match scoring
    let score = 0;
    let queryIndex = 0;
    let consecutiveMatches = 0;
    
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
        if (text[i] === query[queryIndex]) {
            score += 10;
            consecutiveMatches++;
            if (consecutiveMatches > 1) {
                score += consecutiveMatches * 5; // Bonus for consecutive matches
            }
            queryIndex++;
        } else {
            consecutiveMatches = 0;
        }
    }
    
    // Only return score if all characters were found
    return queryIndex === query.length ? score : 0;
}
// ========== analytics module ==========
// Analytics calculations for TODO tasks


// Calculate streak and daily average
function calculateStreakAndAverage(blocks) {
    const dailyCounts = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count tasks per day
    blocks.forEach(block => {
        if (block.editTime && block.editTime > 0) {
            const date = getLocalDateString(new Date(block.editTime));
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        }
    });
    
    // Calculate current streak
    let streak = 0;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    while (true) {
        const dateStr = getLocalDateString(currentDate);
        if (dailyCounts[dateStr] && dailyCounts[dateStr] > 0) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            // Check if we should look at yesterday (today might have no tasks yet)
            if (streak === 0 && currentDate.getTime() === today.getTime()) {
                currentDate.setDate(currentDate.getDate() - 1);
                const yesterdayStr = getLocalDateString(currentDate);
                if (dailyCounts[yesterdayStr] && dailyCounts[yesterdayStr] > 0) {
                    streak = 1;
                    currentDate.setDate(currentDate.getDate() - 1);
                    
                    // Continue counting backwards
                    while (true) {
                        const dateStr = getLocalDateString(currentDate);
                        if (dailyCounts[dateStr] && dailyCounts[dateStr] > 0) {
                            streak++;
                            currentDate.setDate(currentDate.getDate() - 1);
                        } else {
                            break;
                        }
                    }
                }
            }
            break;
        }
    }
    
    // Calculate daily average (last 30 days)
    let totalTasks = 0;
    let activeDays = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = getLocalDateString(d);
        const count = dailyCounts[dateStr] || 0;
        totalTasks += count;
        if (count > 0) activeDays++;
    }
    
    const dailyAverage = activeDays > 0 ? (totalTasks / 30).toFixed(1) : "0.0";
    
    return { streak, dailyAverage, dailyCounts };
}

// Calculate productivity score (0-100)
function calculateProductivityScore(analytics) {
    // Streak component (30 points max)
    const streakScore = Math.min(analytics.streak * 3, 30);
    const streakPercentage = Math.round((streakScore / 30) * 100);
    
    // Daily average component (30 points max)
    const avgScore = Math.min(parseFloat(analytics.dailyAverage) * 4, 30);
    const avgPercentage = Math.round((avgScore / 30) * 100);
    
    // Consistency component (20 points max) - based on how many days had tasks
    const last30Days = Object.entries(analytics.dailyCounts || {})
        .filter(([date]) => {
            const d = new Date(date + 'T00:00:00');
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return d >= thirtyDaysAgo;
        }).length;
    const consistencyScore = Math.min((last30Days / 30) * 20, 20);
    const consistencyPercentage = Math.round((consistencyScore / 20) * 100);
    
    // Completion velocity component (20 points max)
    let velocityScore = 0;
    if (analytics.avgVelocityHours !== null && analytics.avgVelocityHours < 48) {
        velocityScore = Math.max(20 - (analytics.avgVelocityHours / 2.4), 0);
    }
    const velocityPercentage = Math.round((velocityScore / 20) * 100);
    
    const totalScore = Math.round(streakScore + avgScore + consistencyScore + velocityScore);
    
    return {
        total: totalScore,
        components: {
            streak: {
                score: Math.round(streakScore),
                max: 30,
                percentage: streakPercentage,
                value: analytics.streak,
                label: 'Streak'
            },
            dailyAverage: {
                score: Math.round(avgScore),
                max: 30,
                percentage: avgPercentage,
                value: analytics.dailyAverage,
                label: 'Daily Average'
            },
            consistency: {
                score: Math.round(consistencyScore),
                max: 20,
                percentage: consistencyPercentage,
                value: last30Days,
                label: 'Consistency'
            },
            velocity: {
                score: Math.round(velocityScore),
                max: 20,
                percentage: velocityPercentage,
                value: analytics.avgVelocityHours ? analytics.avgVelocityHours.toFixed(1) + 'h' : 'N/A',
                label: 'Velocity'
            }
        }
    };
}

// Calculate task velocity metrics
function calculateTaskVelocity(blocks) {
    const velocities = [];
    
    blocks.forEach(block => {
        if (block.createTime && block.editTime && block.createTime > 0 && block.editTime > 0) {
            const hoursToComplete = (block.editTime - block.createTime) / (1000 * 60 * 60);
            if (hoursToComplete > 0 && hoursToComplete < 24 * 30) { // Reasonable range
                velocities.push(hoursToComplete);
            }
        }
    });
    
    if (velocities.length === 0) return { avgVelocityHours: null, medianVelocityHours: null };
    
    const avg = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    velocities.sort((a, b) => a - b);
    const median = velocities[Math.floor(velocities.length / 2)];
    
    return {
        avgVelocityHours: avg,
        medianVelocityHours: median
    };
}

// Calculate level and XP based on total completed tasks
function calculateLevelAndXP(totalCompleted) {
    // XP required per level increases gradually
    const baseXP = 10;
    const xpMultiplier = 1.2;
    
    let level = 1;
    let totalXPRequired = 0;
    let xpForCurrentLevel = baseXP;
    
    while (totalXPRequired + xpForCurrentLevel <= totalCompleted) {
        totalXPRequired += xpForCurrentLevel;
        level++;
        xpForCurrentLevel = Math.floor(baseXP * Math.pow(xpMultiplier, level - 1));
    }
    
    const xpInCurrentLevel = totalCompleted - totalXPRequired;
    const xpProgress = (xpInCurrentLevel / xpForCurrentLevel) * 100;
    
    return {
        level,
        xp: xpInCurrentLevel,
        xpRequired: xpForCurrentLevel,
        xpInCurrentLevel: xpInCurrentLevel,
        xpForNextLevel: xpForCurrentLevel,
        progressPercent: Math.round(xpProgress),
        xpProgress: Math.round(xpProgress)
    };
}

// Main analytics generation function
function generateTodoAnalytics(blocks) {
    const analytics = {
        totalCompleted: blocks.length,
        dailyCounts: {},
        weeklyTrend: {},
        monthlyTrend: {},
        hourDistribution: {},
        weekdayDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
        tags: {},
        pages: {},
        avgTaskLength: 0,
        longestTask: null,
        shortestTask: null,
        taskDurations: []
    };
    
    blocks.forEach(block => {
        const date = block.editTime ? new Date(block.editTime) : null;
        
        if (date && block.editTime > 0) {
            // Daily counts
            const dateStr = getLocalDateString(date);
            analytics.dailyCounts[dateStr] = (analytics.dailyCounts[dateStr] || 0) + 1;
            
            // Weekly trend
            const weekStr = getWeekNumber(date);
            analytics.weeklyTrend[weekStr] = (analytics.weeklyTrend[weekStr] || 0) + 1;
            
            // Monthly trend
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            analytics.monthlyTrend[monthStr] = (analytics.monthlyTrend[monthStr] || 0) + 1;
            
            // Hour distribution
            const hour = date.getHours();
            analytics.hourDistribution[hour] = (analytics.hourDistribution[hour] || 0) + 1;
            
            // Weekday distribution (0 = Sunday)
            const weekday = date.getDay();
            analytics.weekdayDistribution[weekday]++;
        }
        
        // Extract and count hashtags
        const hashtags = extractHashtags(block.content);
        hashtags.forEach(tag => {
            analytics.tags[tag] = (analytics.tags[tag] || 0) + 1;
        });
        
        // Extract and count page links
        const pageLinks = extractPageLinks(block.content);
        pageLinks.forEach(page => {
            analytics.pages[page] = (analytics.pages[page] || 0) + 1;
        });
        
        // Track page of origin
        if (block.pageTitle) {
            analytics.pages[block.pageTitle] = (analytics.pages[block.pageTitle] || 0) + 1;
        }
        
        // Calculate task duration
        const duration = calculateTaskDuration(block);
        if (duration !== null) {
            analytics.taskDurations.push({
                content: block.content.substring(0, 100),
                duration: duration,
                uid: block.uid
            });
            
            if (!analytics.longestTask || duration > analytics.longestTask.duration) {
                analytics.longestTask = { content: block.content, duration, uid: block.uid };
            }
            
            if (!analytics.shortestTask || duration < analytics.shortestTask.duration) {
                analytics.shortestTask = { content: block.content, duration, uid: block.uid };
            }
        }
    });
    
    // Calculate average task length
    if (analytics.taskDurations.length > 0) {
        const totalLength = analytics.taskDurations.reduce((sum, t) => sum + t.duration, 0);
        analytics.avgTaskLength = totalLength / analytics.taskDurations.length;
    }
    
    // Sort and limit
    analytics.tags = Object.entries(analytics.tags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((obj, [tag, count]) => ({ ...obj, [tag]: count }), {});
    
    analytics.pages = Object.entries(analytics.pages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((obj, [page, count]) => ({ ...obj, [page]: count }), {});
    
    // Calculate velocity metrics
    const velocityMetrics = calculateTaskVelocity(blocks);
    analytics.avgVelocityHours = velocityMetrics.avgVelocityHours;
    analytics.medianVelocityHours = velocityMetrics.medianVelocityHours;
    
    return analytics;
}
// ========== achievements module ==========
// Achievements system for TODO analytics

// Calculate achievements based on analytics
function calculateAchievements(analytics) {
    const achievedIds = new Set();
    
    // Calculate some derived values first
    const maxDaily = Math.max(...Object.values(analytics.dailyCounts || {}), 0);
    const morningTasks = Object.values(analytics.hourDistribution || {}).slice(5, 9).reduce((a, b) => a + (b || 0), 0);
    const nightTasks = Object.values(analytics.hourDistribution || {}).slice(22, 24).concat(Object.values(analytics.hourDistribution || {}).slice(0, 3)).reduce((a, b) => a + (b || 0), 0);
    const weekendTasks = (analytics.weekdayDistribution[0] || 0) + (analytics.weekdayDistribution[6] || 0);
    const tagCount = Object.keys(analytics.tags).length;
    const activeDays = Object.keys(analytics.dailyCounts || {}).length;
    const todayCount = analytics.dailyCounts[getLocalDateString(new Date())] || 0;
    
    // Check for perfect week
    const lastWeekDates = [];
    let hasPerfectWeek = true;
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = getLocalDateString(date);
        lastWeekDates.push(dateStr);
        if ((analytics.dailyCounts[dateStr] || 0) < 5) {
            hasPerfectWeek = false;
        }
    }
    
    // Check for consistent month (20+ days with tasks in last 30 days)
    let daysWithTasksInMonth = 0;
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = getLocalDateString(date);
        if ((analytics.dailyCounts[dateStr] || 0) > 0) {
            daysWithTasksInMonth++;
        }
    }
    
    // Define all possible achievements
    const allAchievements = [
        // Streak achievements
        { id: 'streak3', name: 'On Fire', desc: '3 day streak', icon: '🔥', category: 'streak', requirement: analytics.streak >= 3 },
        { id: 'streak7', name: 'Week Warrior', desc: '7 day streak', icon: '⚔️', category: 'streak', requirement: analytics.streak >= 7 },
        { id: 'streak14', name: 'Fortnight Fighter', desc: '14 day streak', icon: '🛡️', category: 'streak', requirement: analytics.streak >= 14 },
        { id: 'streak30', name: 'Unstoppable', desc: '30 day streak', icon: '🚀', category: 'streak', requirement: analytics.streak >= 30 },
        { id: 'streak60', name: 'Habit Master', desc: '60 day streak', icon: '👑', category: 'streak', requirement: analytics.streak >= 60 },
        { id: 'streak100', name: 'Legendary', desc: '100 day streak', icon: '🏆', category: 'streak', requirement: analytics.streak >= 100 },
        { id: 'streak365', name: 'Year of Fire', desc: '365 day streak', icon: '🌟', category: 'streak', requirement: analytics.streak >= 365 },
        
        // Total completed achievements
        { id: 'total1', name: 'First Step', desc: 'Complete your first task', icon: '👶', category: 'milestone', requirement: analytics.totalCompleted >= 1 },
        { id: 'total10', name: 'Getting Started', desc: '10 tasks completed', icon: '🌱', category: 'milestone', requirement: analytics.totalCompleted >= 10 },
        { id: 'total25', name: 'Quarter Century', desc: '25 tasks completed', icon: '🌿', category: 'milestone', requirement: analytics.totalCompleted >= 25 },
        { id: 'total50', name: 'Task Master', desc: '50 tasks completed', icon: '🎯', category: 'milestone', requirement: analytics.totalCompleted >= 50 },
        { id: 'total100', name: 'Century', desc: '100 tasks completed', icon: '💯', category: 'milestone', requirement: analytics.totalCompleted >= 100 },
        { id: 'total250', name: 'Task Warrior', desc: '250 tasks completed', icon: '⚔️', category: 'milestone', requirement: analytics.totalCompleted >= 250 },
        { id: 'total500', name: 'Productivity Guru', desc: '500 tasks completed', icon: '🧘', category: 'milestone', requirement: analytics.totalCompleted >= 500 },
        { id: 'total1000', name: 'Task Titan', desc: '1000 tasks completed', icon: '⚡', category: 'milestone', requirement: analytics.totalCompleted >= 1000 },
        { id: 'total2500', name: 'Grand Master', desc: '2500 tasks completed', icon: '🎖️', category: 'milestone', requirement: analytics.totalCompleted >= 2500 },
        { id: 'total5000', name: 'Task Legend', desc: '5000 tasks completed', icon: '🌌', category: 'milestone', requirement: analytics.totalCompleted >= 5000 },
        
        // Daily achievements
        { id: 'daily5', name: 'Good Day', desc: '5+ tasks in one day', icon: '😊', category: 'daily', requirement: maxDaily >= 5 },
        { id: 'daily10', name: 'Productive Day', desc: '10+ tasks in one day', icon: '📈', category: 'daily', requirement: maxDaily >= 10 },
        { id: 'daily15', name: 'Power Day', desc: '15+ tasks in one day', icon: '💪', category: 'daily', requirement: maxDaily >= 15 },
        { id: 'daily20', name: 'Super Day', desc: '20+ tasks in one day', icon: '⚡', category: 'daily', requirement: maxDaily >= 20 },
        { id: 'daily30', name: 'Ultra Day', desc: '30+ tasks in one day', icon: '🌟', category: 'daily', requirement: maxDaily >= 30 },
        { id: 'daily50', name: 'Legendary Day', desc: '50+ tasks in one day', icon: '🏆', category: 'daily', requirement: maxDaily >= 50 },
        { id: 'daily100', name: 'Mythical Day', desc: '100+ tasks in one day', icon: '🔮', category: 'daily', requirement: maxDaily >= 100 },
        
        // Velocity achievements
        { id: 'lightning', name: 'Lightning Fast', desc: 'Avg completion < 1h', icon: '⚡', category: 'speed', requirement: analytics.avgVelocityHours && analytics.avgVelocityHours < 1 },
        { id: 'quick', name: 'Quick Draw', desc: 'Avg completion < 6h', icon: '🤠', category: 'speed', requirement: analytics.avgVelocityHours && analytics.avgVelocityHours < 6 },
        { id: 'fast', name: 'Speed Demon', desc: 'Avg completion < 24h', icon: '💨', category: 'speed', requirement: analytics.avgVelocityHours && analytics.avgVelocityHours < 24 },
        
        // Time-based achievements
        { id: 'earlybird', name: 'Early Bird', desc: '50+ tasks before 9 AM', icon: '🐦', category: 'time', requirement: morningTasks >= 50 },
        { id: 'nightowl', name: 'Night Owl', desc: '50+ tasks after 10 PM', icon: '🦉', category: 'time', requirement: nightTasks >= 50 },
        { id: 'earlybird100', name: 'Morning Person', desc: '100+ tasks before 9 AM', icon: '🌅', category: 'time', requirement: morningTasks >= 100 },
        { id: 'nightowl100', name: 'Nocturnal', desc: '100+ tasks after 10 PM', icon: '🌙', category: 'time', requirement: nightTasks >= 100 },
        
        // Weekend warrior
        { id: 'weekend50', name: 'Weekend Hustler', desc: '50+ weekend tasks', icon: '🏖️', category: 'pattern', requirement: weekendTasks >= 50 },
        { id: 'weekend100', name: 'Weekend Warrior', desc: '100+ weekend tasks', icon: '⚔️', category: 'pattern', requirement: weekendTasks >= 100 },
        { id: 'weekend250', name: 'No Rest', desc: '250+ weekend tasks', icon: '🔥', category: 'pattern', requirement: weekendTasks >= 250 },
        
        // Tag diversity
        { id: 'tags5', name: 'Tag Beginner', desc: 'Used 5+ different tags', icon: '🏷️', category: 'organization', requirement: tagCount >= 5 },
        { id: 'tags10', name: 'Tag Explorer', desc: 'Used 10+ different tags', icon: '🗂️', category: 'organization', requirement: tagCount >= 10 },
        { id: 'tags25', name: 'Tag Master', desc: 'Used 25+ different tags', icon: '🎨', category: 'organization', requirement: tagCount >= 25 },
        { id: 'tags50', name: 'Tag Wizard', desc: 'Used 50+ different tags', icon: '🧙', category: 'organization', requirement: tagCount >= 50 },
        { id: 'tags100', name: 'Tag Encyclopedia', desc: 'Used 100+ different tags', icon: '📚', category: 'organization', requirement: tagCount >= 100 },
        
        // Consistency achievements
        { id: 'active30', name: 'Monthly Regular', desc: 'Active for 30+ days', icon: '📅', category: 'consistency', requirement: activeDays >= 30 },
        { id: 'active100', name: 'Centurion', desc: 'Active for 100+ days', icon: '🗓️', category: 'consistency', requirement: activeDays >= 100 },
        { id: 'active365', name: 'Year-Round', desc: 'Active for 365+ days', icon: '🎊', category: 'consistency', requirement: activeDays >= 365 },
        { id: 'consistent20', name: 'Consistent Month', desc: '20+ active days in 30 days', icon: '📊', category: 'consistency', requirement: daysWithTasksInMonth >= 20 },
        
        // Special achievements
        { id: 'today5', name: 'Today\'s Hero', desc: '5+ tasks today', icon: '⭐', category: 'special', requirement: todayCount >= 5 },
        { id: 'perfectweek', name: 'Perfect Week', desc: '5+ tasks daily for 7 days', icon: '💎', category: 'special', requirement: hasPerfectWeek },
        { id: 'firsttask', name: 'Hello World', desc: 'Complete your very first task', icon: '👋', category: 'special', requirement: analytics.totalCompleted >= 1 },
        
        // Fun achievements
        { id: 'prime', name: 'Prime Time', desc: 'Complete exactly 13, 17, 23, 29, or 31 tasks in a day', icon: '🔢', category: 'fun', requirement: [13, 17, 23, 29, 31].includes(maxDaily) },
        { id: 'fibonacci', name: 'Fibonacci Fan', desc: 'Complete exactly 1, 2, 3, 5, 8, 13, or 21 tasks in a day', icon: '🌻', category: 'fun', requirement: [1, 2, 3, 5, 8, 13, 21].includes(maxDaily) },
        { id: 'pi', name: 'Pi Day', desc: 'Complete exactly 3, 14, or 31 tasks in a day', icon: '🥧', category: 'fun', requirement: [3, 14, 31].includes(maxDaily) },
        { id: 'answer', name: 'The Answer', desc: 'Complete exactly 42 tasks in a day', icon: '🌌', category: 'fun', requirement: maxDaily === 42 },
        { id: 'binary', name: 'Binary Boss', desc: 'Complete exactly 2, 4, 8, 16, 32, or 64 tasks in a day', icon: '💻', category: 'fun', requirement: [2, 4, 8, 16, 32, 64].includes(maxDaily) },
        { id: 'lucky7', name: 'Lucky Seven', desc: 'Complete exactly 7 or 77 tasks in a day', icon: '🍀', category: 'fun', requirement: maxDaily === 7 || maxDaily === 77 },
        
        // Productivity patterns
        { id: 'balanced', name: 'Work-Life Balance', desc: 'Tasks spread across all 7 days of week', icon: '⚖️', category: 'pattern', requirement: Object.values(analytics.weekdayDistribution || {}).every(v => v > 0) },
        { id: 'focused', name: 'Laser Focus', desc: '100+ tasks with single tag', icon: '🎯', category: 'pattern', requirement: Math.max(...Object.values(analytics.tags || {}), 0) >= 100 },
        { id: 'diverse', name: 'Jack of All Trades', desc: 'No single tag > 20% of tasks', icon: '🤹', category: 'pattern', requirement: tagCount > 0 && Math.max(...Object.values(analytics.tags || {}), 0) < analytics.totalCompleted * 0.2 },
        
        // Motivational achievements
        { id: 'comeback', name: 'Comeback Kid', desc: 'Return after 7+ day break', icon: '💪', category: 'special', requirement: analytics.streak >= 1 && activeDays > 10 }, // This is approximate
        { id: 'marathon', name: 'Marathon Runner', desc: 'Complete tasks for 30 days straight', icon: '🏃', category: 'special', requirement: analytics.streak >= 30 },
        { id: 'sprinter', name: 'Sprinter', desc: '10+ tasks in under 2 hours', icon: '🏃‍♂️', category: 'speed', requirement: false } // Would need more complex calculation
    ];
    
    // Filter achieved vs unachieved
    const achieved = allAchievements.filter(a => a.requirement);
    const unachieved = allAchievements.filter(a => !a.requirement);
    
    return { achieved, unachieved, all: allAchievements };
}
// ========== charts module ==========
// Chart components for visualization

// Create last 12 days trend chart
function createLast12DaysTrend(dailyCounts) {
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
        
        // Get weekday name
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const weekdayName = weekdays[date.getDay()];
        
        const labelEl = document.createElement("div");
        // Show weekday and date
        labelEl.innerHTML = `${weekdayName}<br>${date.getDate()}`;
        labelEl.style.cssText = "font-size: 10px; color: #5c7080; margin-top: 6px; text-align: center; line-height: 1.2;";
        
        if (isToday) {
            labelEl.innerHTML = `<strong>Today</strong><br>${weekdayName}`;
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
function createHeatmapCalendar(dailyCounts) {
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
function createBarChart(data, labels, title, color = "#106ba3", options = {}) {
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
function createLast12WeeksTrend(dailyCounts) {
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
function createLast12MonthsTrend(dailyCounts) {
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

// Create 7x24 weekly heatmap (days of week vs hours of day)
function createWeeklyHeatmap(completedTasks) {
    // Handle undefined or null input
    const tasks = completedTasks || [];
    console.log("[Weekly Heatmap] Creating with tasks:", tasks.length);
    
    const container = document.createElement("div");
    container.className = "chart-container";
    
    const titleEl = document.createElement("h4");
    titleEl.textContent = "Weekly Activity Heatmap (7 Days × 24 Hours)";
    titleEl.style.cssText = "margin: 0 0 12px 0; color: #182026;";
    container.appendChild(titleEl);
    
    // Initialize data structure: 7 days x 24 hours (Monday-Sunday order)
    const heatmapData = Array(7).fill().map(() => Array(24).fill(0));
    
    // Aggregate task completion by day of week and hour
    tasks.forEach(task => {
        // Use editTime instead of time, as that's what the blocks have
        if (task.editTime) {
            const date = new Date(task.editTime);
            let dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
            // Convert to Monday-first index: Sunday (0) becomes 6, Monday (1) becomes 0, etc.
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const hour = date.getHours(); // 0-23
            heatmapData[dayOfWeek][hour]++;
        }
    });
    
    // Find max value for color scaling
    const maxValue = Math.max(...heatmapData.flat(), 1);
    
    // Create heatmap wrapper
    const heatmapWrapper = document.createElement("div");
    heatmapWrapper.style.cssText = "background: #f5f8fa; border-radius: 8px; padding: 16px; overflow-x: auto;";
    
    // Create main grid container
    const gridContainer = document.createElement("div");
    gridContainer.style.cssText = "display: flex; gap: 8px; min-width: fit-content;";
    
    // Day labels (left side) - Monday first
    const dayLabels = document.createElement("div");
    dayLabels.style.cssText = "display: flex; flex-direction: column; gap: 2px; margin-top: 30px; width: 50px;";
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    days.forEach(day => {
        const label = document.createElement("div");
        label.textContent = day;
        label.style.cssText = "height: 20px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-size: 11px; color: #5c7080;";
        dayLabels.appendChild(label);
    });
    gridContainer.appendChild(dayLabels);
    
    // Create hour columns container
    const hoursContainer = document.createElement("div");
    hoursContainer.style.cssText = "display: flex; flex-direction: column; gap: 4px;";
    
    // Hour labels (top)
    const hourLabels = document.createElement("div");
    hourLabels.style.cssText = "display: flex; gap: 2px; height: 25px; margin-bottom: 4px;";
    for (let hour = 0; hour < 24; hour++) {
        const label = document.createElement("div");
        // Show label for every 3 hours to avoid crowding
        if (hour % 3 === 0) {
            label.textContent = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour-12}p`;
        }
        label.style.cssText = "width: 20px; font-size: 10px; color: #5c7080; text-align: center;";
        hourLabels.appendChild(label);
    }
    hoursContainer.appendChild(hourLabels);
    
    // Create heatmap grid
    const heatmapGrid = document.createElement("div");
    heatmapGrid.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
    
    // Create cells for each day
    for (let day = 0; day < 7; day++) {
        const dayRow = document.createElement("div");
        dayRow.style.cssText = "display: flex; gap: 2px;";
        
        for (let hour = 0; hour < 24; hour++) {
            const value = heatmapData[day][hour];
            const intensity = maxValue > 0 ? value / maxValue : 0;
            
            const cell = document.createElement("div");
            cell.style.cssText = `
                width: 20px;
                height: 20px;
                border-radius: 3px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            `;
            
            // Color based on intensity
            if (value === 0) {
                cell.style.background = "#e1e8ed";
            } else if (intensity <= 0.25) {
                cell.style.background = "#bee3f8";
            } else if (intensity <= 0.5) {
                cell.style.background = "#63b3ed";
            } else if (intensity <= 0.75) {
                cell.style.background = "#3182ce";
            } else {
                cell.style.background = "#2c5282";
            }
            
            // Create tooltip
            const tooltip = document.createElement("div");
            const hourStr = hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour-12}:00 PM`;
            tooltip.textContent = `${days[day]} ${hourStr}: ${value} ${value === 1 ? 'task' : 'tasks'}`;
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
            cell.appendChild(tooltip);
            
            // Hover effects
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
            
            dayRow.appendChild(cell);
        }
        
        heatmapGrid.appendChild(dayRow);
    }
    
    hoursContainer.appendChild(heatmapGrid);
    gridContainer.appendChild(hoursContainer);
    heatmapWrapper.appendChild(gridContainer);
    
    // Add legend
    const legend = document.createElement("div");
    legend.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 11px; color: #5c7080;";
    legend.innerHTML = `
        <span>Less</span>
        <div style="display: flex; gap: 3px;">
            <div style="width: 16px; height: 16px; background: #e1e8ed; border-radius: 2px;"></div>
            <div style="width: 16px; height: 16px; background: #bee3f8; border-radius: 2px;"></div>
            <div style="width: 16px; height: 16px; background: #63b3ed; border-radius: 2px;"></div>
            <div style="width: 16px; height: 16px; background: #3182ce; border-radius: 2px;"></div>
            <div style="width: 16px; height: 16px; background: #2c5282; border-radius: 2px;"></div>
        </div>
        <span>More</span>
    `;
    heatmapWrapper.appendChild(legend);
    
    container.appendChild(heatmapWrapper);
    return container;
}
// ========== uiComponents module ==========
// UI Components for the Todo Analysis extension





const POPUP_ID = "todo-analysis-popup";

// Create logbook view
function createLogbookView(container, analytics) {
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

// Create search view
function createSearchView(container) {
    // Search input container
    const searchContainer = document.createElement("div");
    searchContainer.style.cssText = "margin-bottom: 20px;";
    
    const searchInputWrapper = document.createElement("div");
    searchInputWrapper.style.cssText = "position: relative;";
    
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "bp3-input bp3-large";
    searchInput.placeholder = "Search all tasks (fuzzy search)...";
    searchInput.style.cssText = "width: 100%; padding-left: 40px;";
    
    const searchIcon = document.createElement("span");
    searchIcon.className = "bp3-icon bp3-icon-search";
    searchIcon.style.cssText = "position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none;";
    
    searchInputWrapper.appendChild(searchIcon);
    searchInputWrapper.appendChild(searchInput);
    searchContainer.appendChild(searchInputWrapper);
    
    // Stats and filters
    const controlsBar = document.createElement("div");
    controlsBar.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;";
    
    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = "color: #5c7080; font-size: 14px;";
    
    const filtersDiv = document.createElement("div");
    filtersDiv.style.cssText = "display: flex; gap: 8px;";
    
    // Task type filters
    const typeFilters = [
        { value: 'all', label: 'All Tasks', color: '#5c7080' },
        { value: 'TODO', label: 'TODO', color: '#db3737' },
        { value: 'DOING', label: 'DOING', color: '#d9822b' },
        { value: 'DONE', label: 'DONE', color: '#0f9960' },
        { value: 'ARCHIVED', label: 'ARCHIVED', color: '#5c7080' }
    ];
    
    let selectedType = 'all';
    const typeButtons = {};
    
    typeFilters.forEach(filter => {
        const btn = document.createElement("button");
        btn.className = "bp3-button bp3-small";
        if (filter.value === 'all') btn.classList.add('bp3-intent-primary');
        btn.textContent = filter.label;
        btn.onclick = () => {
            selectedType = filter.value;
            Object.values(typeButtons).forEach(b => b.classList.remove('bp3-intent-primary'));
            btn.classList.add('bp3-intent-primary');
            performSearch();
        };
        typeButtons[filter.value] = btn;
        filtersDiv.appendChild(btn);
    });
    
    controlsBar.appendChild(statsDiv);
    controlsBar.appendChild(filtersDiv);
    
    // Results container
    const resultsContainer = document.createElement("div");
    resultsContainer.style.cssText = "max-height: 600px; overflow-y: auto; border: 1px solid #e1e8ed; border-radius: 6px; background: white;";
    
    container.appendChild(searchContainer);
    container.appendChild(controlsBar);
    container.appendChild(resultsContainer);
    
    // State
    let allTasks = [];
    let searchTimeout;
    
    // Load all tasks
    const loadAllTasks = async () => {
        resultsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="bp3-spinner">
                    <div class="bp3-spinner-animation"></div>
                </div>
                <div style="margin-top: 16px; color: #5c7080;">Loading all tasks...</div>
            </div>
        `;
        
        try {
            allTasks = await getAllTaskBlocks();
            statsDiv.textContent = `${allTasks.length} total tasks`;
            performSearch();
        } catch (error) {
            console.error("Error loading tasks:", error);
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #d13913;">
                    <div>Error loading tasks</div>
                </div>
            `;
        }
    };
    
    // Perform search
    const performSearch = async () => {
        const query = searchInput.value.trim();
        
        // Filter by type
        let filteredTasks = selectedType === 'all' 
            ? allTasks 
            : allTasks.filter(task => task.content.includes(`{{[[${selectedType}]]}}`));
        
        // Apply fuzzy search
        if (query) {
            filteredTasks = filteredTasks
                .map(task => ({
                    ...task,
                    searchScore: fuzzySearchScore(query, task.content)
                }))
                .filter(task => task.searchScore > 0)
                .sort((a, b) => b.searchScore - a.searchScore);
        }
        
        // Update stats
        statsDiv.textContent = `${filteredTasks.length} ${query ? 'matching' : 'total'} tasks`;
        
        // Display results
        displaySearchResults(filteredTasks, query);
    };
    
    // Display search results
    const displaySearchResults = (tasks, query) => {
        resultsContainer.innerHTML = "";
        
        if (tasks.length === 0) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #5c7080;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🔍</div>
                    <div style="font-size: 16px;">No tasks found</div>
                </div>
            `;
            return;
        }
        
        // Group by page
        const tasksByPage = {};
        tasks.forEach(task => {
            if (!tasksByPage[task.pageTitle]) {
                tasksByPage[task.pageTitle] = [];
            }
            tasksByPage[task.pageTitle].push(task);
        });
        
        // Display grouped results
        Object.entries(tasksByPage).forEach(([pageTitle, pageTasks]) => {
            const pageSection = document.createElement("div");
            pageSection.style.cssText = "border-bottom: 1px solid #e1e8ed;";
            
            // Page header
            const pageHeader = document.createElement("div");
            pageHeader.style.cssText = "padding: 12px 16px; background: #f5f8fa; font-weight: 600; color: #182026; cursor: pointer; display: flex; justify-content: space-between; align-items: center;";
            pageHeader.innerHTML = `
                <span>📄 ${pageTitle}</span>
                <span style="font-size: 12px; font-weight: normal; color: #5c7080;">${pageTasks.length} task${pageTasks.length > 1 ? 's' : ''}</span>
            `;
            
            // Tasks container
            const tasksContainer = document.createElement("div");
            tasksContainer.style.cssText = "padding: 8px 0;";
            
            // Display tasks
            pageTasks.forEach(task => {
                const taskEl = document.createElement("div");
                taskEl.style.cssText = "padding: 12px 16px; cursor: pointer; transition: all 0.2s; border-left: 3px solid transparent;";
                
                // Determine task type and color
                let taskType = 'TODO';
                let taskColor = '#db3737';
                if (task.content.includes('{{[[DONE]]}}')) {
                    taskType = 'DONE';
                    taskColor = '#0f9960';
                } else if (task.content.includes('{{[[DOING]]}}')) {
                    taskType = 'DOING';
                    taskColor = '#d9822b';
                } else if (task.content.includes('{{[[ARCHIVED]]}}')) {
                    taskType = 'ARCHIVED';
                    taskColor = '#5c7080';
                }
                
                // Clean content
                const cleanContent = task.content
                    .replace(/\{\{\[\[DONE\]\]\}\}|\{\{\[\[TODO\]\]\}\}|\{\{\[\[DOING\]\]\}\}|\{\{\[\[ARCHIVED\]\]\}\}/g, '')
                    .trim();
                
                // Highlight search term
                const displayContent = query ? 
                    highlightSearchTerm(cleanContent, query) : 
                    cleanContent;
                
                taskEl.innerHTML = `
                    <div style="display: flex; gap: 12px; align-items: flex-start;">
                        <div style="color: ${taskColor}; font-size: 12px; font-weight: 600; flex-shrink: 0; margin-top: 2px;">${taskType}</div>
                        <div style="flex: 1;">
                            <div style="color: #182026; line-height: 1.5;">${displayContent}</div>
                            <div style="margin-top: 4px; font-size: 12px; color: #5c7080;">
                                ${task.editTime ? new Date(task.editTime).toLocaleDateString() : 'No date'}
                            </div>
                        </div>
                    </div>
                `;
                
                // Click to open in Roam
                taskEl.onclick = () => {
                    window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid: task.uid } });
                };
                
                taskEl.onmouseenter = () => {
                    taskEl.style.background = '#f5f8fa';
                };
                
                taskEl.onmouseleave = () => {
                    taskEl.style.background = 'transparent';
                };
                
                tasksContainer.appendChild(taskEl);
            });
            
            pageSection.appendChild(pageHeader);
            pageSection.appendChild(tasksContainer);
            resultsContainer.appendChild(pageSection);
            
            // Toggle page section
            let isCollapsed = false;
            pageHeader.onclick = () => {
                isCollapsed = !isCollapsed;
                tasksContainer.style.display = isCollapsed ? 'none' : 'block';
                pageHeader.style.background = isCollapsed ? '#e1e8ed' : '#f5f8fa';
            };
        });
    };
    
    // Highlight search term
    const highlightSearchTerm = (text, query) => {
        if (!query) return text;
        
        // Simple highlight for exact matches
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background: #ffd700; padding: 0 2px;">$1</mark>');
    };
    
    // Search input handler
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch();
        }, 300);
    };
    
    // Initialize
    loadAllTasks();
}

// Create the analytics popup
function createPopup() {
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
function createTopbarButton() {
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
function displayAnalytics(content, analytics) {
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
        { id: "search", label: "Search", icon: "🔍" },
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
    createSearchPanel(tabPanels, panelsContainer);
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
    
    // Weekly heatmap (7x24)
    const weeklyHeatmapTitle = document.createElement("h3");
    weeklyHeatmapTitle.textContent = "Weekly Pattern";
    weeklyHeatmapTitle.style.cssText = "margin: 24px 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    panel.appendChild(weeklyHeatmapTitle);
    
    const weeklyHeatmap = createWeeklyHeatmap(analytics.blocks || []);
    panel.appendChild(weeklyHeatmap);
    
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

function createSearchPanel(tabPanels, container) {
    const panel = document.createElement("div");
    panel.className = "bp3-tab-panel";
    panel.style.display = "none";
    tabPanels.search = panel;
    
    createSearchView(panel);
    
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
// ========== Main extension code ==========

// Main extension object
export default {
    onload: ({ extensionAPI }) => {
        console.log("Todo Analysis extension loading...");
        
        // Add topbar button
        const topbar = document.querySelector(".rm-topbar");
        if (topbar) {
            const button = createTopbarButton();
            
            // Find the right place to insert (after the graph icon)
            const graphIcon = topbar.querySelector(".bp3-icon-graph");
            if (graphIcon && graphIcon.parentElement) {
                graphIcon.parentElement.insertAdjacentElement('afterend', button);
            } else {
                // Fallback: add to end of topbar
                topbar.appendChild(button);
            }
            
            console.log("Todo Analysis button added to topbar");
        } else {
            console.warn("Topbar not found - Todo Analysis button not added");
        }
        
        console.log("Todo Analysis extension loaded successfully");
    },
    
    onunload: () => {
        console.log("Todo Analysis extension unloading...");
        
        // Remove topbar button
        const button = document.getElementById("todo-analysis-button");
        if (button) {
            button.remove();
        }
        
        // Remove popup if open
        const popup = document.getElementById(POPUP_ID);
        if (popup) {
            popup.remove();
        }
        
        console.log("Todo Analysis extension unloaded");
    }
};
