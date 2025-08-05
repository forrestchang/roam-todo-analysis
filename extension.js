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
function createHeatmapCalendar(dailyCounts) {
    console.log("[Heatmap] Creating calendar with dailyCounts:", dailyCounts);
    
    const container = document.createElement("div");
    container.style.cssText = "overflow-x: auto; padding: 16px; background: #f5f8fa; border-radius: 8px;";
    
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    const startDate = new Date();
    startDate.setDate(today.getDate() - 364); // Show last year
    
    // Calculate start to align with Sunday
    while (startDate.getDay() !== 0) {
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
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
    
    // Get start of current week (Sunday)
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    
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

// ========== uiComponents module ==========
// UI Components for the Todo Analysis extension





const POPUP_ID = "todo-analysis-popup";

// Create logbook view
function createLogbookView(container, analytics) {
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
