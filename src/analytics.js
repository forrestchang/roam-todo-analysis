// Analytics calculations for TODO tasks
import { getLocalDateString } from './queries.js';
import { getWeekNumber, calculateTaskDuration, extractHashtags, extractPageLinks } from './utils.js';

// Calculate streak and daily average
export function calculateStreakAndAverage(blocks) {
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
export function calculateProductivityScore(analytics) {
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
export function calculateTaskVelocity(blocks) {
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
export function calculateLevelAndXP(totalCompleted) {
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
        xpProgress: Math.round(xpProgress)
    };
}

// Main analytics generation function
export function generateTodoAnalytics(blocks) {
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