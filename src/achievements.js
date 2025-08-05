// Achievements system for TODO analytics
import { getLocalDateString } from './queries.js';

// Calculate achievements based on analytics
export function calculateAchievements(analytics) {
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