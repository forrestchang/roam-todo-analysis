// Utility functions for text processing and date calculations

// Extract hashtags from text
export function extractHashtags(text) {
    return (text.match(/#(\w+)/g) || []).map(tag => tag.substring(1));
}

// Extract page links from text
export function extractPageLinks(text) {
    const matches = text.match(/\[\[(.*?)\]\]/g) || [];
    return matches.map(match => match.slice(2, -2));
}

// Calculate task duration in hours
export function calculateTaskDuration(block) {
    if (block.createTime && block.editTime && block.createTime > 0 && block.editTime > 0) {
        return (block.editTime - block.createTime) / 1000 / 3600; // Convert to hours
    }
    return null;
}

// Helper to get ISO week number
export function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

// Format number with commas
export function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Generate emoji based on score
export function getScoreEmoji(score) {
    if (score >= 90) return "🌟";
    if (score >= 80) return "⭐";
    if (score >= 70) return "✨";
    if (score >= 60) return "👍";
    if (score >= 50) return "📈";
    return "💪";
}

// Simple fuzzy search implementation
export function fuzzySearch(query, text) {
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
export function fuzzySearchScore(query, text) {
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