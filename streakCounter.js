/**
 * Moduł Streak Counter
 * Odpowiedzialny za obliczanie i zarządzanie streak'ami (dniami z rzędu z osiągnięciami)
 */

// Check if a date is a workday (Monday-Friday)
function isWorkday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5; // 1 = Monday, 5 = Friday
}

// Get date string in YYYY-MM-DD format
function getDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Load streak data from localStorage
function loadStreakData() {
    const data = localStorage.getItem('streakData');
    if (data) {
        return JSON.parse(data);
    }
    return {
        current: 0,
        longest: 0,
        lastAchievementDate: null,
        skippedDays: 0,
        lastCalculated: null
    };
}

// Save streak data to localStorage
function saveStreakData(streakData) {
    localStorage.setItem('streakData', JSON.stringify(streakData));
}

// Calculate current streak based on achievement history
function calculateStreak() {
    const today = new Date();
    const todayStr = getDateString(today);

    // Get all achievement dates from localStorage
    const achievementDates = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('achievements_')) {
            const dateStr = key.replace('achievements_', '');
            const achievements = JSON.parse(localStorage.getItem(key) || '[]');
            if (achievements.length > 0) {
                achievementDates.push(dateStr);
            }
        }
    }

    // Sort dates in descending order (newest first)
    achievementDates.sort((a, b) => new Date(b) - new Date(a));

    // Load previous streak data
    const streakData = loadStreakData();
    let currentStreak = 0;
    let consecutiveSkips = 0;
    let usedTolerance = false;

    // Iterate backwards from today to calculate streak
    let checkDate = new Date(today);
    let foundToday = achievementDates.includes(todayStr);

    // If today has achievement, start counting from today
    if (foundToday) {
        currentStreak = 1;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Go back through workdays to count streak
    for (let i = 0; i < 60; i++) { // Check last 60 days max
        // Skip weekends
        while (!isWorkday(checkDate)) {
            checkDate.setDate(checkDate.getDate() - 1);
        }

        const checkDateStr = getDateString(checkDate);
        const hasAchievement = achievementDates.includes(checkDateStr);

        if (hasAchievement) {
            currentStreak++;
            consecutiveSkips = 0; // Reset skip counter
        } else {
            consecutiveSkips++;

            if (consecutiveSkips === 1) {
                // First skip - use tolerance
                usedTolerance = true;
            } else if (consecutiveSkips >= 2) {
                // Second consecutive skip - break streak
                break;
            }
        }

        checkDate.setDate(checkDate.getDate() - 1);
    }

    // Update longest streak
    const longestStreak = Math.max(streakData.longest, currentStreak);

    // Save updated streak data
    const updatedStreakData = {
        current: currentStreak,
        longest: longestStreak,
        lastAchievementDate: foundToday ? todayStr : streakData.lastAchievementDate,
        skippedDays: consecutiveSkips,
        lastCalculated: todayStr,
        showMotivation: usedTolerance && currentStreak > 0
    };

    saveStreakData(updatedStreakData);
    return updatedStreakData;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment (for tests)
    module.exports = {
        isWorkday,
        getDateString,
        loadStreakData,
        saveStreakData,
        calculateStreak
    };
}
