const POPUP_ID = "todo-analysis-popup";

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

// Calculate streak and daily average
function calculateStreakAndAverage(blocks) {
    const dailyCounts = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count tasks per day
    blocks.forEach(block => {
        if (block.editTime && block.editTime > 0) {
            const date = new Date(block.editTime);
            const dateStr = getLocalDateString(date);
            dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
        }
    });
    
    console.log("Daily counts:", dailyCounts);
    console.log("Today's date:", getLocalDateString(today));
    
    // Calculate current streak
    let streak = 0;
    let currentDate = new Date(today);
    
    while (true) {
        const dateStr = getLocalDateString(currentDate);
        if (dailyCounts[dateStr] && dailyCounts[dateStr] > 0) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    // Calculate daily average (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    let totalTasks = 0;
    let activeDays = 0;
    
    Object.entries(dailyCounts).forEach(([dateStr, count]) => {
        const date = new Date(dateStr);
        if (date >= thirtyDaysAgo && date <= today) {
            totalTasks += count;
            activeDays++;
        }
    });
    
    const dailyAverage = activeDays > 0 ? (totalTasks / 30).toFixed(1) : 0;
    
    return { streak, dailyAverage, dailyCounts };
}

// Get total TODOs (not just DONE)
async function getTotalTodos() {
    try {
        const query = `
            [:find (count ?b)
             :where
             [?b :block/string ?string]
             [(clojure.string/includes? ?string "{{[[TODO]]}}")]]
        `;
        
        const result = await window.roamAlphaAPI.q(query);
        console.log("Total TODOs found:", result[0]?.[0] || 0);
        return result[0]?.[0] || 0;
    } catch (error) {
        console.error("Error fetching total TODOs:", error);
        return 0;
    }
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

// Calculate achievements
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

// Calculate level and XP
function calculateLevelAndXP(totalCompleted) {
    const xpPerTask = 10;
    const totalXP = totalCompleted * xpPerTask;
    
    // Level calculation (exponential curve)
    let level = 1;
    let xpForNextLevel = 50;
    let cumulativeXP = 0;
    
    while (cumulativeXP + xpForNextLevel <= totalXP) {
        cumulativeXP += xpForNextLevel;
        level++;
        xpForNextLevel = Math.floor(50 * Math.pow(1.2, level - 1));
    }
    
    const xpInCurrentLevel = totalXP - cumulativeXP;
    const progressPercent = (xpInCurrentLevel / xpForNextLevel) * 100;
    
    return {
        level,
        totalXP,
        xpInCurrentLevel,
        xpForNextLevel,
        progressPercent
    };
}

// Generate todo analytics from blocks
function generateTodoAnalytics(blocks) {
    // Initialize distributions
    const hourDistribution = {};
    const weekdayDistribution = {};
    const monthDistribution = {};
    const tags = {};
    const wordFrequency = {};
    const durations = [];
    const recentDates = {};
    
    // New distributions
    const dailyDistributionMap = {};
    const weeklyDistributionMap = {};
    const yearlyDistributionMap = {};

    // Debug log
    console.log("Processing blocks:", blocks.length, "blocks");
    console.log("Sample block:", blocks[0]);
    
    // Process blocks
    blocks.forEach(block => {
        // Time distributions
        if (block.editTime && block.editTime > 0) {
            const date = new Date(block.editTime);
            const hour = date.getHours();
            const weekday = date.getDay();
            const month = date.getMonth();
            const year = date.getFullYear();
            const dateStr = getLocalDateString(date);
            const weekStr = getWeekNumber(date);
            
            hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
            weekdayDistribution[weekday] = (weekdayDistribution[weekday] || 0) + 1;
            monthDistribution[month] = (monthDistribution[month] || 0) + 1;
            
            // New distributions
            dailyDistributionMap[dateStr] = (dailyDistributionMap[dateStr] || 0) + 1;
            weeklyDistributionMap[weekStr] = (weeklyDistributionMap[weekStr] || 0) + 1;
            yearlyDistributionMap[year] = (yearlyDistributionMap[year] || 0) + 1;

            // Recent trend (last 30 days)
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            
            if (date >= thirtyDaysAgo) {
                recentDates[dateStr] = (recentDates[dateStr] || 0) + 1;
            }
        }

        // Tags analysis
        const blockTags = extractHashtags(block.content);
        blockTags.forEach(tag => {
            tags[tag] = (tags[tag] || 0) + 1;
        });

        // Word frequency (simple implementation)
        const words = block.content
            .replace(/{{.*?}}/g, '') // Remove Roam syntax
            .replace(/\[\[.*?\]\]/g, '') // Remove page links
            .replace(/#\w+/g, '') // Remove hashtags
            .split(/\s+/)
            .filter(word => word.length > 3) // Only count words longer than 3 chars
            .map(word => word.toLowerCase());
        
        words.forEach(word => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        });

        // Task duration
        const duration = calculateTaskDuration(block);
        if (duration !== null && duration > 0 && duration < 24 * 365) { // Sanity check: less than a year
            durations.push(duration);
        }
    });

    // Calculate stats
    let completionTimeAvg = null;
    let completionTimeMedian = null;
    
    if (durations.length > 0) {
        completionTimeAvg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        durations.sort((a, b) => a - b);
        completionTimeMedian = durations[Math.floor(durations.length / 2)];
    }

    // Prepare recent trend data
    const dates = Object.keys(recentDates).sort();
    const counts = dates.map(date => recentDates[date]);

    // Convert maps to arrays for the new distributions
    const now = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);
    const sixtyDaysAgoStr = getLocalDateString(sixtyDaysAgo);

    const dailyDistribution = Object.entries(dailyDistributionMap)
        .filter(([date]) => date >= sixtyDaysAgoStr)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const weeklyDistribution = Object.entries(weeklyDistributionMap)
        .map(([week, count]) => ({ week, count }))
        .sort((a, b) => a.week.localeCompare(b.week))
        .slice(-12); // Last 12 weeks

    const yearlyDistribution = Object.entries(yearlyDistributionMap)
        .map(([year, count]) => ({ year: parseInt(year), count }))
        .sort((a, b) => a.year - b.year);

    // Calculate velocity metrics
    const velocityMetrics = calculateTaskVelocity(blocks);
    
    const analytics = {
        hourDistribution,
        weekdayDistribution,
        monthDistribution,
        completionTimeAvg,
        completionTimeMedian,
        tags,
        wordFrequency,
        totalCompleted: blocks.length,
        recentTrend: {
            dates,
            counts
        },
        dailyDistribution,
        weeklyDistribution,
        yearlyDistribution,
        blocks, // Include blocks for detail view
        avgVelocityHours: velocityMetrics.avgVelocityHours,
        medianVelocityHours: velocityMetrics.medianVelocityHours
    };
    
    // Debug log
    console.log("Generated analytics:", analytics);
    
    return analytics;
}

// Create last 10 days trend chart
function createLast10DaysTrend(dailyCounts) {
    console.log("[10-Day Trend] Input dailyCounts:", dailyCounts);
    console.log("[10-Day Trend] Today's local date:", getLocalDateString(new Date()));
    
    const container = document.createElement("div");
    container.className = "chart-container";
    
    const titleEl = document.createElement("h4");
    titleEl.textContent = "Recent Task Completion Trend (Last 10 Days)";
    titleEl.style.cssText = "margin: 0 0 12px 0; color: #182026;";
    container.appendChild(titleEl);
    
    // Get last 10 days
    const dates = [];
    const counts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 9; i >= 0; i--) {
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
    
    const closeButton = document.createElement("button");
    closeButton.className = "bp3-button bp3-minimal bp3-icon-cross";
    closeButton.onclick = () => overlay.remove();
    
    buttonGroup.appendChild(refreshButton);
    buttonGroup.appendChild(closeButton);
    
    header.appendChild(title);
    header.appendChild(buttonGroup);
    
    const content = document.createElement("div");
    content.className = "bp3-dialog-body todo-analysis-content";
    content.style.cssText = `
        overflow-y: auto;
        flex: 1;
    `;
    content.innerHTML = '<div class="bp3-spinner"><div class="bp3-spinner-animation"></div></div>';
    
    popup.appendChild(header);
    popup.appendChild(content);
    overlay.appendChild(popup);
    
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
    
    popup.onclick = (e) => {
        e.stopPropagation();
    };
    
    return { overlay, content };
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
    
    // Create Overview tab panel
    const overviewPanel = document.createElement("div");
    overviewPanel.className = "bp3-tab-panel";
    overviewPanel.style.display = "block";
    tabPanels.overview = overviewPanel;
    
    // Data Overview section
    const overviewSection = document.createElement("div");
    overviewSection.className = "analytics-section";
    overviewSection.style.cssText = "margin-bottom: 24px;";
    
    const overviewTitle = document.createElement("h3");
    overviewTitle.textContent = "Data Overview";
    overviewTitle.style.cssText = "margin: 0 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    overviewSection.appendChild(overviewTitle);
    
    // Add productivity score
    const productivityScoreData = calculateProductivityScore(analytics);
    const scoreContainer = document.createElement("div");
    scoreContainer.style.cssText = "margin-bottom: 20px;";
    
    // Main score circle
    const mainScoreContainer = document.createElement("div");
    mainScoreContainer.style.cssText = "text-align: center; margin-bottom: 24px;";
    
    const scoreCircle = document.createElement("div");
    scoreCircle.style.cssText = `
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: conic-gradient(#0f9960 0deg, #0f9960 ${productivityScoreData.total * 3.6}deg, #e1e8ed ${productivityScoreData.total * 3.6}deg);
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
        <div style="font-size: 32px; font-weight: bold; color: #0f9960;">${productivityScoreData.total}</div>
        <div style="font-size: 12px; color: #5c7080;">Productivity Score</div>
    `;
    
    scoreCircle.appendChild(scoreInner);
    mainScoreContainer.appendChild(scoreCircle);
    scoreContainer.appendChild(mainScoreContainer);
    
    // Component scores breakdown
    const componentsContainer = document.createElement("div");
    componentsContainer.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;";
    
    Object.entries(productivityScoreData.components).forEach(([key, component]) => {
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
    
    scoreContainer.appendChild(componentsContainer);
    overviewSection.appendChild(scoreContainer);
    
    // Add level and XP
    const { level, totalXP, xpInCurrentLevel, xpForNextLevel, progressPercent } = calculateLevelAndXP(analytics.totalCompleted);
    const levelContainer = document.createElement("div");
    levelContainer.style.cssText = "margin-bottom: 20px; padding: 16px; background: #f5f8fa; border-radius: 8px;";
    
    levelContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 18px; font-weight: 600; color: #182026;">Level ${level}</div>
            <div style="font-size: 14px; color: #5c7080;">${totalXP} XP Total</div>
        </div>
        <div style="background: #e1e8ed; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
            <div style="background: #106ba3; height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
        </div>
        <div style="font-size: 12px; color: #5c7080; text-align: right;">${xpInCurrentLevel} / ${xpForNextLevel} XP</div>
    `;
    
    overviewSection.appendChild(levelContainer);
    
    const summaryGrid = document.createElement("div");
    summaryGrid.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;";
    
    const stats = [
        { label: "Total Completed", value: analytics.totalCompleted, icon: "✅" },
        { label: "Total TODOs", value: analytics.totalTodos, icon: "📝" },
        { label: "Total Tags", value: Object.keys(analytics.tags).length, icon: "🏷️" },
        { label: "Day Streak", value: `${analytics.streak} days`, icon: "🔥" },
        { label: "Daily Average", value: analytics.dailyAverage, icon: "📊" },
        { label: "Avg Velocity", value: analytics.avgVelocityHours ? `${analytics.avgVelocityHours.toFixed(1)}h` : "N/A", icon: "⚡" }
    ];
    
    stats.forEach(stat => {
        const statEl = document.createElement("div");
        statEl.style.cssText = "background: #f5f8fa; border-radius: 8px; padding: 16px; text-align: center;";
        statEl.innerHTML = `
            <div style="font-size: 20px; margin-bottom: 8px;">${stat.icon}</div>
            <div style="font-size: 24px; font-weight: bold; color: #106ba3; margin-bottom: 4px;">${stat.value}</div>
            <div style="font-size: 12px; color: #5c7080;">${stat.label}</div>
        `;
        summaryGrid.appendChild(statEl);
    });
    
    overviewSection.appendChild(summaryGrid);
    
    // Add Recent Task Completion Trend to Overview
    const recentTrendSection = document.createElement("div");
    recentTrendSection.style.cssText = "margin-top: 24px;";
    
    const recentTrendTitle = document.createElement("h4");
    recentTrendTitle.textContent = "Recent Task Completion Trend";
    recentTrendTitle.style.cssText = "margin: 0 0 12px 0; color: #5c7080; font-size: 14px; font-weight: 500;";
    recentTrendSection.appendChild(recentTrendTitle);
    
    const last10Days = createLast10DaysTrend(analytics.dailyCounts);
    recentTrendSection.appendChild(last10Days);
    overviewSection.appendChild(recentTrendSection);
    
    // Add Activity Heatmap to Overview
    const heatmapSection = document.createElement("div");
    heatmapSection.style.cssText = "margin-top: 24px;";
    
    const heatmapTitle = document.createElement("h4");
    heatmapTitle.textContent = "Activity Heatmap";
    heatmapTitle.style.cssText = "margin: 0 0 12px 0; color: #5c7080; font-size: 14px; font-weight: 500;";
    heatmapSection.appendChild(heatmapTitle);
    
    const heatmapContainer = createHeatmapCalendar(analytics.dailyCounts);
    heatmapSection.appendChild(heatmapContainer);
    overviewSection.appendChild(heatmapSection);
    
    overviewPanel.appendChild(overviewSection);
    
    // Create Charts tab panel
    const chartsPanel = document.createElement("div");
    chartsPanel.className = "bp3-tab-panel";
    chartsPanel.style.display = "none";
    tabPanels.charts = chartsPanel;
    
    const chartsSection = document.createElement("div");
    chartsSection.style.cssText = "margin-bottom: 24px;";
    
    const chartsTitle = document.createElement("h3");
    chartsTitle.textContent = "Charts";
    chartsTitle.style.cssText = "margin: 0 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    chartsSection.appendChild(chartsTitle);
    
    // Distribution subsection
    const distributionCharts = document.createElement("div");
    distributionCharts.style.cssText = "margin-bottom: 24px;";
    
    const distributionSubtitle = document.createElement("h4");
    distributionSubtitle.textContent = "Distribution";
    distributionSubtitle.style.cssText = "margin: 0 0 12px 0; color: #5c7080; font-size: 14px; font-weight: 500;";
    distributionCharts.appendChild(distributionSubtitle);
    
    const chartsContainer = document.createElement("div");
    chartsContainer.style.cssText = "display: flex; flex-direction: column; gap: 20px;";
    
    // Hourly distribution
    const hourLabels = Array.from({length: 24}, (_, i) => i.toString());
    const hourChart = createBarChart(analytics.hourDistribution, hourLabels, "Hourly Distribution (24h)", "#106ba3");
    chartsContainer.appendChild(hourChart);
    
    // Daily distribution (days of week starting Monday)
    const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekdayData = [1, 2, 3, 4, 5, 6, 0].map(day => analytics.weekdayDistribution[day] || 0);
    const weekdayChart = createBarChart(weekdayData, weekdayLabels, "Weekly Distribution", "#0f9960");
    chartsContainer.appendChild(weekdayChart);
    
    // Monthly distribution
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthChart = createBarChart(analytics.monthDistribution, monthLabels, "Monthly Distribution", "#d13913");
    chartsContainer.appendChild(monthChart);
    
    distributionCharts.appendChild(chartsContainer);
    chartsSection.appendChild(distributionCharts);
    chartsPanel.appendChild(chartsSection);
    
    // Create Logbook tab panel
    const logbookPanel = document.createElement("div");
    logbookPanel.className = "bp3-tab-panel";
    logbookPanel.style.display = "none";
    tabPanels.logbook = logbookPanel;
    
    const logbookSection = document.createElement("div");
    logbookSection.className = "analytics-section";
    logbookSection.style.cssText = "margin-bottom: 24px;";
    
    const logbookTitle = document.createElement("h3");
    logbookTitle.textContent = "Logbook";
    logbookTitle.style.cssText = "margin: 0 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    logbookSection.appendChild(logbookTitle);
    
    // Add day selector and list
    createLogbookView(logbookSection, analytics);
    logbookPanel.appendChild(logbookSection);
    
    // Top tags - Add to logbook panel
    const topTags = Object.entries(analytics.tags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (topTags.length > 0) {
        const tagsSection = document.createElement("div");
        tagsSection.className = "analytics-section";
        tagsSection.style.cssText = "margin-bottom: 24px;";
        
        const tagsTitle = document.createElement("h4");
        tagsTitle.textContent = "Top Tags";
        tagsTitle.style.cssText = "margin: 0 0 12px 0; color: #182026;";
        tagsSection.appendChild(tagsTitle);
        
        const tagsList = document.createElement("div");
        tagsList.style.cssText = "display: flex; flex-wrap: wrap; gap: 8px;";
        
        topTags.forEach(([tag, count]) => {
            const tagEl = document.createElement("span");
            tagEl.className = "bp3-tag";
            tagEl.textContent = `#${tag} (${count})`;
            tagEl.style.cssText = "background: #e1e8ed; color: #182026;";
            tagsList.appendChild(tagEl);
        });
        
        tagsSection.appendChild(tagsList);
        logbookPanel.appendChild(tagsSection);
    }
    
    // Create Achievement tab panel
    const achievementPanel = document.createElement("div");
    achievementPanel.className = "bp3-tab-panel";
    achievementPanel.style.display = "none";
    tabPanels.achievement = achievementPanel;
    
    const achievementSection = document.createElement("div");
    achievementSection.className = "analytics-section";
    
    const achievementTitle = document.createElement("h3");
    achievementTitle.textContent = "Achievements";
    achievementTitle.style.cssText = "margin: 0 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    achievementSection.appendChild(achievementTitle);
    
    const achievementsData = calculateAchievements(analytics);
    
    // Achieved section
    if (achievementsData.achieved.length > 0) {
        const achievedTitle = document.createElement("h4");
        achievedTitle.textContent = "Unlocked Achievements";
        achievedTitle.style.cssText = "margin: 0 0 12px 0; color: #0f9960; font-size: 16px; font-weight: 600;";
        achievementSection.appendChild(achievedTitle);
        
        const achievementsList = document.createElement("div");
        achievementsList.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; margin-bottom: 32px;";
        
        achievementsData.achieved.forEach(achievement => {
            const achievementCard = document.createElement("div");
            achievementCard.style.cssText = `
                background: #f5f8fa;
                border-radius: 8px;
                padding: 16px;
                border: 1px solid #e1e8ed;
                transition: all 0.2s;
                cursor: help;
            `;
            
            achievementCard.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <span style="font-size: 32px;">${achievement.icon}</span>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #182026; font-size: 14px;">${achievement.name}</div>
                        <div style="font-size: 12px; color: #5c7080; margin-top: 2px;">${achievement.desc}</div>
                    </div>
                </div>
            `;
            
            achievementCard.onmouseenter = () => {
                achievementCard.style.transform = "translateY(-2px)";
                achievementCard.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
            };
            
            achievementCard.onmouseleave = () => {
                achievementCard.style.transform = "translateY(0)";
                achievementCard.style.boxShadow = "none";
            };
            
            achievementsList.appendChild(achievementCard);
        });
        
        achievementSection.appendChild(achievementsList);
    }
    
    // Unachieved section
    if (achievementsData.unachieved.length > 0) {
        const unachievedTitle = document.createElement("h4");
        unachievedTitle.textContent = "Locked Achievements";
        unachievedTitle.style.cssText = "margin: 32px 0 12px 0; color: #5c7080; font-size: 16px; font-weight: 600;";
        achievementSection.appendChild(unachievedTitle);
        
        const unachievedList = document.createElement("div");
        unachievedList.style.cssText = "display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px;";
        
        // Group unachieved by category
        const categories = {};
        achievementsData.unachieved.forEach(achievement => {
            const cat = achievement.category || 'other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(achievement);
        });
        
        // Show a sample of unachieved from each category
        Object.entries(categories).forEach(([category, achievements]) => {
            // Show up to 3 from each category
            achievements.slice(0, 3).forEach(achievement => {
                const achievementCard = document.createElement("div");
                achievementCard.style.cssText = `
                    background: #f5f8fa;
                    border-radius: 8px;
                    padding: 16px;
                    border: 1px solid #e1e8ed;
                    opacity: 0.6;
                    position: relative;
                    overflow: hidden;
                `;
                
                achievementCard.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <span style="font-size: 32px; filter: grayscale(100%);">${achievement.icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #5c7080; font-size: 14px;">${achievement.name}</div>
                            <div style="font-size: 12px; color: #a7b1bb; margin-top: 2px;">${achievement.desc}</div>
                        </div>
                    </div>
                    <div style="position: absolute; top: 8px; right: 8px;">
                        <span style="font-size: 20px;">🔒</span>
                    </div>
                `;
                
                unachievedList.appendChild(achievementCard);
            });
        });
        
        // Add "and X more..." card if there are more
        const remainingCount = achievementsData.unachieved.length - unachievedList.children.length;
        if (remainingCount > 0) {
            const moreCard = document.createElement("div");
            moreCard.style.cssText = `
                background: #f5f8fa;
                border-radius: 8px;
                padding: 16px;
                border: 1px solid #e1e8ed;
                opacity: 0.6;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100px;
            `;
            moreCard.innerHTML = `
                <div style="text-align: center; color: #5c7080;">
                    <div style="font-size: 24px; margin-bottom: 8px;">🔮</div>
                    <div style="font-weight: 600;">And ${remainingCount} more...</div>
                    <div style="font-size: 12px; margin-top: 4px;">Keep going to unlock them all!</div>
                </div>
            `;
            unachievedList.appendChild(moreCard);
        }
        
        achievementSection.appendChild(unachievedList);
    }
    
    achievementPanel.appendChild(achievementSection);
    
    // Create Handbook tab panel
    const handbookPanel = document.createElement("div");
    handbookPanel.className = "bp3-tab-panel";
    handbookPanel.style.display = "none";
    tabPanels.handbook = handbookPanel;
    
    const handbookSection = document.createElement("div");
    handbookSection.className = "analytics-section";
    
    const handbookTitle = document.createElement("h3");
    handbookTitle.textContent = "Handbook";
    handbookTitle.style.cssText = "margin: 0 0 16px 0; color: #182026; font-size: 18px; font-weight: 600;";
    handbookSection.appendChild(handbookTitle);
    
    handbookSection.innerHTML += `
        <div style="space-y: 24px;">
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #182026; font-size: 16px; font-weight: 600;">📊 Productivity Score</h4>
                <p style="color: #5c7080; line-height: 1.6; margin-bottom: 12px;">
                    Your productivity score (0-100) is calculated based on four key components, each contributing to your overall productivity profile:
                </p>
                <div style="background: #f5f8fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <h5 style="margin: 0 0 8px 0; color: #d13913; font-size: 14px;">🔥 Streak Score (30 points max)</h5>
                    <p style="color: #5c7080; font-size: 13px; line-height: 1.6; margin: 0;">
                        Rewards consecutive days of task completion. Each day adds 3 points (up to 10 days = 30 points).
                        Maintaining streaks builds consistent habits.
                    </p>
                </div>
                <div style="background: #f5f8fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <h5 style="margin: 0 0 8px 0; color: #106ba3; font-size: 14px;">📊 Daily Average Score (30 points max)</h5>
                    <p style="color: #5c7080; font-size: 13px; line-height: 1.6; margin: 0;">
                        Based on your average tasks per day. Each task/day adds 4 points (up to 7.5 tasks/day = 30 points).
                        Higher daily output shows strong productivity.
                    </p>
                </div>
                <div style="background: #f5f8fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <h5 style="margin: 0 0 8px 0; color: #0f9960; font-size: 14px;">📅 Consistency Score (20 points max)</h5>
                    <p style="color: #5c7080; font-size: 13px; line-height: 1.6; margin: 0;">
                        Percentage of days with tasks in the last 30 days. Working regularly (even with fewer tasks) 
                        is better than sporadic bursts.
                    </p>
                </div>
                <div style="background: #f5f8fa; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                    <h5 style="margin: 0 0 8px 0; color: #d9822b; font-size: 14px;">⚡ Velocity Score (20 points max)</h5>
                    <p style="color: #5c7080; font-size: 13px; line-height: 1.6; margin: 0;">
                        Rewards quick task completion. Faster average completion time = higher score. 
                        Tasks completed in under 48 hours contribute to this score.
                    </p>
                </div>
                <p style="color: #5c7080; line-height: 1.6; margin-top: 12px;">
                    Each component is displayed with its own progress bar in the Overview tab, helping you identify areas for improvement.
                </p>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #182026; font-size: 16px; font-weight: 600;">🏆 Achievements</h4>
                <p style="color: #5c7080; line-height: 1.6; margin-bottom: 12px;">
                    Unlock achievements by reaching various milestones in your task completion journey. 
                    Achievements are divided into categories:
                </p>
                <ul style="color: #5c7080; line-height: 1.8; margin-left: 20px;">
                    <li><strong>Milestone Achievements:</strong> Total tasks completed (10, 50, 100, 500, 1000+)</li>
                    <li><strong>Streak Achievements:</strong> Consecutive days (3, 7, 14, 30, 100 days)</li>
                    <li><strong>Daily Achievements:</strong> Tasks in a single day (5, 10, 20 tasks)</li>
                    <li><strong>Speed Achievements:</strong> Quick task completion</li>
                    <li><strong>Consistency Achievements:</strong> Regular task completion patterns</li>
                    <li><strong>Time-based Achievements:</strong> Early bird, night owl patterns</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 12px 0; color: #182026; font-size: 16px; font-weight: 600;">📈 Level System</h4>
                <p style="color: #5c7080; line-height: 1.6;">
                    Each completed task earns you 10 XP. Your level increases as you accumulate XP:
                </p>
                <ul style="color: #5c7080; line-height: 1.8; margin-left: 20px;">
                    <li>Level 1: 0 XP</li>
                    <li>Level 2: 100 XP (10 tasks)</li>
                    <li>Level 3: 300 XP (30 tasks)</li>
                    <li>Level 4: 600 XP (60 tasks)</li>
                    <li>And so on... (each level requires more XP)</li>
                </ul>
            </div>
            
            <div>
                <h4 style="margin: 0 0 12px 0; color: #182026; font-size: 16px; font-weight: 600;">💡 Tips</h4>
                <ul style="color: #5c7080; line-height: 1.8; margin-left: 20px;">
                    <li>Mark tasks as {{[[DONE]]}} to track them</li>
                    <li>Use #tags to categorize your tasks</li>
                    <li>Complete tasks daily to maintain streaks</li>
                    <li>Check the logbook to review past completions</li>
                </ul>
            </div>
        </div>
    `;
    
    handbookPanel.appendChild(handbookSection);
    
    // Add all panels to the container
    panelsContainer.appendChild(overviewPanel);
    panelsContainer.appendChild(chartsPanel);
    panelsContainer.appendChild(logbookPanel);
    panelsContainer.appendChild(achievementPanel);
    panelsContainer.appendChild(handbookPanel);
}

// Main function to show todo analysis
async function showTodoAnalysisPopup() {
    const { overlay, content } = createPopup();
    document.body.appendChild(overlay);
    
    try {
        // Show loading state
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="bp3-spinner">
                    <div class="bp3-spinner-animation"></div>
                </div>
                <div style="margin-top: 16px; color: #5c7080;">Analyzing your todos...</div>
            </div>
        `;
        
        // Add timestamp to prevent caching
        console.log("Fetching todo data at:", new Date().toISOString());
        
        // Fetch DONE todos and total TODOs in parallel
        const [doneBlocks, totalTodos] = await Promise.all([
            getTodoBlocks("DONE"),
            getTotalTodos()
        ]);
        
        if (doneBlocks.length === 0) {
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #5c7080;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <div style="font-size: 18px;">No completed todos found!</div>
                    <div style="font-size: 14px; margin-top: 8px;">Complete some todos marked with {{[[DONE]]}} to see analytics.</div>
                </div>
            `;
            return;
        }
        
        // Calculate streak and daily average
        const { streak, dailyAverage, dailyCounts } = calculateStreakAndAverage(doneBlocks);
        
        // Generate analytics
        const analytics = generateTodoAnalytics(doneBlocks);
        analytics.streak = streak;
        analytics.dailyAverage = dailyAverage;
        analytics.totalTodos = totalTodos;
        analytics.dailyCounts = dailyCounts;
        
        // Display analytics
        displayAnalytics(content, analytics);
        
    } catch (error) {
        console.error("Error generating todo analysis:", error);
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #d13913;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 18px;">Error generating analysis</div>
                <div style="font-size: 14px; margin-top: 8px;">${error.message}</div>
            </div>
        `;
    }
}

// Create topbar button
function createTopbarButton() {
    const createIconButton = (icon) => {
        const button = document.createElement("span");
        button.className = "bp3-button bp3-minimal bp3-small todo-analysis-toggle";
        button.tabIndex = 0;

        const iconSpan = document.createElement("span");
        iconSpan.className = `bp3-icon bp3-icon-${icon}`;
        
        // Add custom icon as fallback
        iconSpan.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 13v2h14v-2H1zm0-3h3V3H1v7zm5 0h3V5H6v5zm5 0h3V1h-3v9z"/>
            </svg>
        `;

        button.appendChild(iconSpan);
        button.title = "Todo Analysis";
        return button;
    };

    const nameToUse = "todoAnalysis";
    const checkForButton = document.getElementById(`${nameToUse}-flex-space`);
    
    if (!checkForButton) {
        const mainButton = createIconButton("chart");
        const roamTopbar = document.getElementsByClassName("rm-topbar")[0];
        
        if (roamTopbar) {
            const nextIconButton = roamTopbar.lastElementChild;
            const flexDiv = document.createElement("div");
            flexDiv.className = "rm-topbar__spacer-sm todo-analysis-toggle";
            flexDiv.id = nameToUse + "-flex-space";

            const flexDivAfter = document.createElement("div");
            flexDivAfter.className = "rm-topbar__spacer-sm todo-analysis-toggle";
            flexDivAfter.id = nameToUse + "-flex-space-after";
            
            nextIconButton.insertAdjacentElement("afterend", mainButton);
            mainButton.insertAdjacentElement("beforebegin", flexDiv);
            mainButton.insertAdjacentElement("afterend", flexDivAfter);
            mainButton.addEventListener("click", showTodoAnalysisPopup);
            
            console.log("Added Todo Analysis button to topbar");
        }
    }
}

// Destroy topbar button
function destroyTopbarButton() {
    // Remove all parts of the button
    const toggles = document.querySelectorAll(".todo-analysis-toggle");
    toggles.forEach(tog => {
        tog.remove();
    });
}

// Extension lifecycle
function onload({ extensionAPI }) {
    console.log("Todo Analysis extension loaded");
    
    // Add button to topbar
    createTopbarButton();
    
    // Also register command palette command
    try {
        if (extensionAPI?.ui?.commandPalette?.addCommand) {
            extensionAPI.ui.commandPalette.addCommand({
                label: "Todo Analysis",
                callback: showTodoAnalysisPopup
            });
            console.log("Todo Analysis command registered via extensionAPI");
        } else if (window.roamAlphaAPI?.ui?.commandPalette?.addCommand) {
            window.roamAlphaAPI.ui.commandPalette.addCommand({
                label: "Todo Analysis",
                callback: showTodoAnalysisPopup
            });
            console.log("Todo Analysis command registered via window.roamAlphaAPI");
        }
    } catch (error) {
        console.error("Error registering command:", error);
    }
}

function onunload() {
    console.log("Todo Analysis extension unloaded");
    
    // Remove any open popups
    const popup = document.getElementById(POPUP_ID);
    if (popup) {
        popup.remove();
    }
    
    // Remove topbar button
    destroyTopbarButton();
    
    // Try to remove command from command palette
    try {
        if (window.roamAlphaAPI?.ui?.commandPalette?.removeCommand) {
            window.roamAlphaAPI.ui.commandPalette.removeCommand({
                label: "Todo Analysis"
            });
        }
    } catch (error) {
        // Ignore errors during cleanup
    }
}

export default {
    onload: onload,
    onunload: onunload
};