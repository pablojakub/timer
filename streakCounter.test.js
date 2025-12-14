/**
 * Testy jednostkowe dla modułu streakCounter
 * Uruchom: node streakCounter.test.js
 */

// Mock localStorage dla środowiska Node.js
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (index) => Object.keys(store)[index] || null
    };
})();

global.localStorage = localStorageMock;

// Import modułu do testowania
const {
    isWorkday,
    getDateString,
    saveStreakData,
    calculateStreak
} = require('./streakCounter.js');

// Pomocnicze funkcje do setupu testów
function addAchievement(dateStr, goal = 'Test goal') {
    const key = `achievements_${dateStr}`;
    const achievements = JSON.parse(localStorage.getItem(key) || '[]');
    achievements.push({
        goal: goal,
        timestamp: new Date(dateStr).getTime()
    });
    localStorage.setItem(key, JSON.stringify(achievements));
}

function clearAllData() {
    localStorage.clear();
}

function getWorkdaysBefore(date, count) {
    const dates = [];
    let current = new Date(date);

    while (dates.length < count) {
        current.setDate(current.getDate() - 1);
        if (isWorkday(current)) {
            dates.push(getDateString(current));
        }
    }

    return dates;
}

// Klasa testowa
class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}\n  Oczekiwano: ${expected}\n  Otrzymano: ${actual}`);
        }
    }

    async run() {
        console.log('🧪 Rozpoczynam testy calculateStreak()...\n');

        for (const test of this.tests) {
            try {
                clearAllData();
                await test.fn.call(this);
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.name}`);
                console.log(`   ${error.message}\n`);
                this.failed++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`Testy zakończone: ${this.passed} ✅  ${this.failed} ❌`);
        console.log('='.repeat(50));

        process.exit(this.failed > 0 ? 1 : 0);
    }
}

const runner = new TestRunner();

// ============================================
// TESTY
// ============================================

runner.test('Test 1: Brak osiągnięć - streak = 0', function() {
    const result = calculateStreak();
    this.assertEqual(result.current, 0, 'Streak powinien być 0');
    this.assertEqual(result.longest, 0, 'Longest streak powinien być 0');
    this.assertEqual(result.showMotivation, false, 'Nie powinno być motywacji');
});

runner.test('Test 2: Tylko dzisiejsze osiągnięcie - streak = 1', function() {
    const today = getDateString(new Date());
    addAchievement(today);
    const result = calculateStreak();
    this.assertEqual(result.current, 1, 'Streak powinien być 1');
});

runner.test('Test 3: Ciągły streak 5 dni roboczych', function() {
    const today = getDateString(new Date());
    addAchievement(today);
    const workdays = getWorkdaysBefore(new Date(), 4);
    workdays.forEach(date => addAchievement(date));

    const result = calculateStreak();
    this.assertEqual(result.current, 5, 'Streak powinien być 5');
});

runner.test('Test 4: Streak przez weekend (piątek -> poniedziałek)', function() {
    // Mockujemy "dzisiaj" jako poniedziałek 2024-12-16
    const originalDate = Date;
    global.Date = class extends originalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2024-12-16');
            } else {
                super(...args);
            }
        }
        static now() {
            return new originalDate('2024-12-16').getTime();
        }
    };

    addAchievement('2024-12-16'); // Poniedziałek ✅
    addAchievement('2024-12-13'); // Piątek ✅
    addAchievement('2024-12-12'); // Czwartek ✅

    const result = calculateStreak();
    global.Date = originalDate;

    this.assertEqual(result.current, 3, 'Streak przez weekend powinien być 3');
});

runner.test('Test 5: Tolerancja 1 dnia - streak się utrzymuje + motywacja', function() {
    const originalDate = Date;
    global.Date = class extends originalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2024-12-18'); // Środa
            } else {
                super(...args);
            }
        }
        static now() {
            return new originalDate('2024-12-18').getTime();
        }
    };

    addAchievement('2024-12-18'); // Środa ✅
    // Wtorek pomijamy (❌) - użycie tolerancji
    addAchievement('2024-12-16'); // Poniedziałek ✅

    const result = calculateStreak();
    global.Date = originalDate;

    this.assertEqual(result.current, 2, 'Streak z tolerancją powinien być 2');
    this.assertEqual(result.showMotivation, true, 'Powinien pokazać motywację (użyto tolerancji)');
});

runner.test('Test 6: 2 dni opuszczone z rzędu - streak zeruje się', function() {
    const originalDate = Date;
    global.Date = class extends originalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2024-12-18'); // Środa
            } else {
                super(...args);
            }
        }
        static now() {
            return new originalDate('2024-12-18').getTime();
        }
    };

    addAchievement('2024-12-13'); // Piątek przed przerwą ✅
    // Poniedziałek 16.12 - pomijamy ❌
    // Wtorek 17.12 - pomijamy ❌
    // Środa 18.12 - dzisiaj, brak osiągnięcia

    const result = calculateStreak();
    global.Date = originalDate;

    this.assertEqual(result.current, 0, 'Po 2 dniach przerwy streak powinien być 0');
});

runner.test('Test 7: Najdłuższy streak jest zachowywany (nie maleje)', function() {
    saveStreakData({
        current: 3,
        longest: 10,
        lastAchievementDate: '2024-12-10',
        skippedDays: 0,
        lastCalculated: '2024-12-10'
    });

    const today = getDateString(new Date());
    addAchievement(today);

    const result = calculateStreak();
    this.assertEqual(result.longest, 10, 'Longest streak powinien pozostać 10');
});

runner.test('Test 8: Najdłuższy streak jest aktualizowany gdy obecny jest większy', function() {
    saveStreakData({
        current: 0,
        longest: 3,
        lastAchievementDate: null,
        skippedDays: 0,
        lastCalculated: null
    });

    const today = getDateString(new Date());
    addAchievement(today);
    const workdays = getWorkdaysBefore(new Date(), 4);
    workdays.forEach(date => addAchievement(date));

    const result = calculateStreak();
    this.assertEqual(result.current, 5, 'Current streak powinien być 5');
    this.assertEqual(result.longest, 5, 'Longest streak powinien być zaktualizowany do 5');
});

runner.test('Test 9: Wielokrotna tolerancja w różnych miejscach', function() {
    const originalDate = Date;
    global.Date = class extends originalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2024-12-20'); // Piątek
            } else {
                super(...args);
            }
        }
        static now() {
            return new originalDate('2024-12-20').getTime();
        }
    };

    // Wzór: ✅ ❌ ✅ ❌ ✅
    addAchievement('2024-12-20'); // Piątek ✅
    // Czwartek pomijamy ❌
    addAchievement('2024-12-18'); // Środa ✅
    // Wtorek pomijamy ❌
    addAchievement('2024-12-16'); // Poniedziałek ✅

    const result = calculateStreak();
    global.Date = originalDate;

    this.assertEqual(result.current, 3, 'Streak z wieloma przerwami powinien być 3');
    this.assertEqual(result.showMotivation, true, 'Powinien pokazać motywację');
});

runner.test('Test 10: Długi streak przez 2 weekendy (10 dni roboczych)', function() {
    const originalDate = Date;
    global.Date = class extends originalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2024-12-20'); // Piątek
            } else {
                super(...args);
            }
        }
        static now() {
            return new originalDate('2024-12-20').getTime();
        }
    };

    // Tydzień 2: 16-20 grudnia (pon-pt)
    addAchievement('2024-12-20'); // Piątek ✅
    addAchievement('2024-12-19'); // Czwartek ✅
    addAchievement('2024-12-18'); // Środa ✅
    addAchievement('2024-12-17'); // Wtorek ✅
    addAchievement('2024-12-16'); // Poniedziałek ✅
    // Weekend 14-15 grudnia - pomijamy
    // Tydzień 1: 9-13 grudnia (pon-pt)
    addAchievement('2024-12-13'); // Piątek ✅
    addAchievement('2024-12-12'); // Czwartek ✅
    addAchievement('2024-12-11'); // Środa ✅
    addAchievement('2024-12-10'); // Wtorek ✅
    addAchievement('2024-12-09'); // Poniedziałek ✅

    const result = calculateStreak();
    global.Date = originalDate;

    this.assertEqual(result.current, 10, 'Streak przez 2 tygodnie powinien być 10');
    // showMotivation może być true lub false - nie testujemy
});

runner.test('Test 11: Pomocnicza funkcja isWorkday()', function() {
    const monday = new Date('2024-12-16'); // Poniedziałek
    const saturday = new Date('2024-12-14'); // Sobota
    const sunday = new Date('2024-12-15'); // Niedziela
    const friday = new Date('2024-12-13'); // Piątek

    this.assertEqual(isWorkday(monday), true, 'Poniedziałek jest dniem roboczym');
    this.assertEqual(isWorkday(friday), true, 'Piątek jest dniem roboczym');
    this.assertEqual(isWorkday(saturday), false, 'Sobota nie jest dniem roboczym');
    this.assertEqual(isWorkday(sunday), false, 'Niedziela nie jest dniem roboczym');
});

runner.test('Test 12: Pomocnicza funkcja getDateString()', function() {
    const date = new Date('2024-12-09');
    const result = getDateString(date);
    this.assertEqual(result, '2024-12-09', 'Format daty powinien być YYYY-MM-DD');
});

// Uruchom wszystkie testy
runner.run();
