const { ipcRenderer } = require('electron');
const confetti = require('canvas-confetti');

const timerDisplay = document.getElementById('timerDisplay');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const goalInput = document.getElementById('goalInput');
const progressCircle = document.getElementById('progressCircle');
const increaseBy10Btn = document.getElementById('increaseBy10');
const decreaseBy10Btn = document.getElementById('decreaseBy10');
const increaseBy1Btn = document.getElementById('increaseBy1');
const decreaseBy1Btn = document.getElementById('decreaseBy1');

let timeLeft = 50 * 60; // Default 50 minutes in seconds
let totalTime = timeLeft;
let timerId = null;
let isRunning = false;
let distractionCheckHidden = false;

const circumference = 2 * Math.PI * 90;

function formatTime(seconds) {
    // If there's at least one full minute left, show only whole minutes (no seconds).
    if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        // use narrow no-break space (U+202F) to reduce visual gap between number and unit
        return `${mins}\u202Fmin`;
    }

    // If less than a minute remains, show seconds counting down.
    return `${seconds}\u202Fsek.`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(timeLeft);
    const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
    progressCircle.style.strokeDashoffset = circumference * (1 - progress);
}

function getMinutesFromTime() {
    return Math.ceil(timeLeft / 60);
}

function setTimeFromMinutes(minutes) {
    const clampedMinutes = Math.max(1, Math.min(999, minutes));
    timeLeft = clampedMinutes * 60;
    totalTime = timeLeft;
    updateDisplay();
    updateArrowButtons();
}

function updateArrowButtons() {
    const currentMinutes = getMinutesFromTime();

    // Disable decrease buttons if at minimum
    decreaseBy10Btn.disabled = currentMinutes <= 10;
    decreaseBy1Btn.disabled = currentMinutes <= 1;

    // Disable increase buttons if at maximum
    increaseBy10Btn.disabled = currentMinutes >= 990;
    increaseBy1Btn.disabled = currentMinutes >= 999;
}

function showTimerControls() {
    document.querySelector('.arrow-buttons-left').classList.remove('hidden');
    document.querySelector('.arrow-buttons-right').classList.remove('hidden');
}

function hideTimerControls() {
    document.querySelector('.arrow-buttons-left').classList.add('hidden');
    document.querySelector('.arrow-buttons-right').classList.add('hidden');
}

function getTodayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `achievements_${year}-${month}-${day}`;
}

function saveAchievement(goalText) {
    const key = getTodayKey();
    const achievements = JSON.parse(localStorage.getItem(key) || '[]');

    achievements.push({
        goal: goalText,
        timestamp: Date.now()
    });

    localStorage.setItem(key, JSON.stringify(achievements));
}

function loadTodayAchievements() {
    const key = getTodayKey();
    const achievements = JSON.parse(localStorage.getItem(key) || '[]');

    // Update count badge
    document.getElementById('achievementsCount').textContent = achievements.length;

    // Update list
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';

    achievements.forEach(achievement => {
        const li = document.createElement('li');
        li.className = 'achievement-item';
        li.textContent = achievement.goal;
        list.appendChild(li);
    });

    // Show section if there are achievements
    if (achievements.length > 0) {
        document.getElementById('achievementsSection').style.display = 'block';
    }
}

function setInputsDisabled(disabled) {
    goalInput.disabled = disabled;

    if (disabled) {
        hideTimerControls();
    } else {
        showTimerControls();
        updateArrowButtons();
    }
}

function showGoalDisplay() {
    const goalText = goalInput.value.trim();
    if (goalText) {
        document.getElementById('goalDisplay').textContent = goalText;
        goalInput.style.display = 'none';
        document.getElementById('goalDisplay').style.display = 'block';
        document.getElementById('goalLabel').style.display = 'none';
    }
}

function hideGoalDisplay() {
    goalInput.style.display = 'block';
    document.getElementById('goalDisplay').style.display = 'none';
    document.getElementById('goalLabel').style.display = 'block';
}

async function startTimer() {
    // Check distractions ONLY when starting a new session (not pause/resume)
    if (!isRunning && timeLeft === totalTime) {
        if (!checkDistractionsBeforeStart()) {
            return; // Modal was shown, wait for user response
        }
        // If we got here, distraction check was skipped
        await showMotivationAndStart();
    } else {
        // Resume/pause logic (no motivation needed)
        proceedWithTimerStart();
    }
}

function resetTimer() {
    clearInterval(timerId);
    isRunning = false;
    stopMusic();
    // restore timer to default value
    setTimeFromMinutes(50);
    timerDisplay.classList.remove('running', 'paused');
    startBtn.textContent = 'Start';
    setInputsDisabled(false);
    hideGoalDisplay();
    progressCircle.style.strokeDashoffset = circumference;

    // Allow computer to sleep when reset
    ipcRenderer.send('stop-power-save-blocker');
}

function showAchievementModal() {
    const goalText = goalInput.value.trim() || 'Sesja Deep Work';
    document.getElementById('modalGoalText').textContent = goalText;
    document.getElementById('achievementModal').style.display = 'flex';
}

function hideAchievementModal() {
    document.getElementById('achievementModal').style.display = 'none';
}

let confettiCanvasEl = null;
let myConfetti = null;
let confettiIntervalId = null;

function ensureConfettiCanvas() {
    const container = document.querySelector('.container');
    if (!container) return null;

    // Ensure the container is positioned so the absolutely-positioned canvas is relative to it
    const cs = getComputedStyle(container);
    if (!cs || cs.position === 'static') {
        container.style.position = 'relative';
    }

    // If canvas already exists and is inside container, reuse it
    if (confettiCanvasEl && container.contains(confettiCanvasEl)) {
        return container;
    }

    // Create canvas overlay inside the container
    confettiCanvasEl = document.createElement('canvas');
    confettiCanvasEl.style.position = 'absolute';
    confettiCanvasEl.style.top = '0';
    confettiCanvasEl.style.left = '0';
    confettiCanvasEl.style.width = '100%';
    confettiCanvasEl.style.height = '100%';
    confettiCanvasEl.style.pointerEvents = 'none';
    confettiCanvasEl.style.zIndex = '2147483647'; // ensure it's on top of everything in the container
    confettiCanvasEl.className = 'confetti-canvas';

    container.appendChild(confettiCanvasEl);

    // Bind canvas-confetti to the canvas so origin coords are relative to the container
    myConfetti = confetti.create(confettiCanvasEl, { resize: true, useWorker: true });

    return container;
}

function celebrateWithConfetti() {
    const container = ensureConfettiCanvas();
    if (!container || !myConfetti) return;

    const bursts = 4; // fire 4 times
    const intervalMs = 1000; // 1000ms between bursts
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    // Clear any existing interval to avoid overlapping celebrations
    if (confettiIntervalId) {
        clearInterval(confettiIntervalId);
        confettiIntervalId = null;
    }

    let fired = 0;
    confettiIntervalId = setInterval(function () {
        if (fired >= bursts) {
            clearInterval(confettiIntervalId);
            confettiIntervalId = null;
            return;
        }

        fired += 1;

        // particle count can taper a bit as bursts proceed
        const particleCount = Math.max(12, Math.floor(60 * (1 - (fired - 1) / bursts)));

        // Random origin inside container (values 0..1 are relative to canvas size)
        const originX = Math.random();
        const originY = Math.random();

        myConfetti({
            ...defaults,
            particleCount,
            origin: { x: originX, y: originY },
            colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1']
        });
    }, intervalMs);
}

function handleAchievementYes() {
    const goalText = goalInput.value.trim();
    if (goalText) {
        saveAchievement(goalText);
        loadTodayAchievements();
        updateStreakBadge();
    }
    hideAchievementModal();
    celebrateWithConfetti();
}

function handleAchievementNo() {
    hideAchievementModal();
}

function handleAchievementExtend() {
    // Close the modal
    hideAchievementModal();

    // Set timer to 5 minutes (300 seconds)
    timeLeft = 5 * 60;
    totalTime = timeLeft;
    updateDisplay();

    // Automatically start the timer (without distraction check)
    isRunning = true;
    timerDisplay.classList.add('running');
    timerDisplay.classList.remove('paused');
    startBtn.textContent = 'Pauza';
    setInputsDisabled(true);
    showGoalDisplay();

    ipcRenderer.send('start-power-save-blocker');

    timerId = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            clearInterval(timerId);
            isRunning = false;
            timerDisplay.classList.remove('running');
            startBtn.textContent = 'Start';
            setInputsDisabled(false);

            ipcRenderer.send('stop-power-save-blocker');
            stopMusic();
            playAlertSound();

            new Notification('Deep Work', {
                body: goalInput.value || 'Sesja zakończona!',
                icon: null
            });

            // Show achievement modal again after the 5-minute session
            showAchievementModal();
        }
    }, 1000);
}

// ============================================
// DISTRACTION CHECK MODAL FUNCTIONS
// ============================================

function loadDistractionCheckPreference() {
    const saved = localStorage.getItem('hideDistractionCheck');
    distractionCheckHidden = saved === 'true';
}

function saveDistractionCheckPreference(hide) {
    localStorage.setItem('hideDistractionCheck', hide ? 'true' : 'false');
    distractionCheckHidden = hide;
}

function showDistractionModal() {
    document.getElementById('hideDistractionCheck').checked = false;
    document.getElementById('distractionModal').style.display = 'flex';
}

function hideDistractionModal() {
    document.getElementById('distractionModal').style.display = 'none';
}

function checkDistractionsBeforeStart() {
    if (isRunning) {
        return true;
    }

    if (distractionCheckHidden) {
        return true;
    }

    showDistractionModal();
    return false;
}

async function handleDistractionYes() {
    const checkbox = document.getElementById('hideDistractionCheck');
    if (checkbox.checked) {
        saveDistractionCheckPreference(true);
    }
    hideDistractionModal();
    await showMotivationAndStart();
}

function handleDistractionNo() {
    const checkbox = document.getElementById('hideDistractionCheck');
    if (checkbox.checked) {
        saveDistractionCheckPreference(true);
    }
    hideDistractionModal();
}

// ============================================
// AI MOTIVATIONAL MESSAGE FUNCTIONS
// ============================================

const motivationOverlay = document.getElementById('motivationOverlay');
const motivationText = document.getElementById('motivationText');

/**
 * Show motivational message overlay
 */
function showMotivationOverlay(message) {
    if (!motivationOverlay || !motivationText) return;

    motivationText.textContent = message;
    motivationOverlay.style.display = 'flex';
}

/**
 * Hide motivational message overlay
 */
function hideMotivationOverlay() {
    if (!motivationOverlay) return;
    motivationOverlay.style.display = 'none';
}

/**
 * Show motivation and start timer
 */
async function showMotivationAndStart() {
    const goalText = goalInput.value.trim();

    // Check if AI motivation is enabled (API key configured)
    if (typeof hasApiKey === 'function' && hasApiKey()) {
        try {
            // Start timer immediately in background
            proceedWithTimerStart();

            // Fetch motivational message
            const message = await getMotivationalMessage(goalText);

            if (message) {
                // Show overlay with message
                showMotivationOverlay(message);

                // Hide overlay after 5 seconds
                setTimeout(() => {
                    hideMotivationOverlay();
                }, 5000);
            }
        } catch (error) {
            console.error('Error showing motivation:', error);
            // Timer already started, just continue
        }
    } else {
        // No API key configured, start timer directly
        proceedWithTimerStart();
    }
}

function proceedWithTimerStart() {
    if (!isRunning) {
        if (timeLeft > 0) {
            isRunning = true;
            timerDisplay.classList.add('running');
            timerDisplay.classList.remove('paused');
            startBtn.textContent = 'Pauza';
            setInputsDisabled(true);
            showGoalDisplay();

            ipcRenderer.send('start-power-save-blocker');

            timerId = setInterval(() => {
                timeLeft--;
                updateDisplay();

                if (timeLeft <= 0) {
                    clearInterval(timerId);
                    isRunning = false;
                    timerDisplay.classList.remove('running');
                    startBtn.textContent = 'Start';
                    setInputsDisabled(false);

                    ipcRenderer.send('stop-power-save-blocker');
                    stopMusic();
                    playAlertSound();

                    new Notification('Deep Work', {
                        body: goalInput.value || 'Sesja zakończona!',
                        icon: null
                    });

                    showAchievementModal();
                }
            }, 1000);
        }
    } else {
        clearInterval(timerId);
        isRunning = false;
        timerDisplay.classList.remove('running');
        timerDisplay.classList.add('paused');
        startBtn.textContent = 'Wznów';

        ipcRenderer.send('stop-power-save-blocker');
    }
}

function toggleAchievements() {
    const container = document.getElementById('achievementsContainer');
    const icon = document.getElementById('toggleIcon');
    const isExpanded = container.classList.contains('expanded');

    if (isExpanded) {
        container.classList.remove('expanded');
        icon.classList.remove('expanded');
        container.style.display = 'none';
    } else {
        container.style.display = 'block';
        // Small delay to allow display change before animation
        setTimeout(() => {
            container.classList.add('expanded');
            icon.classList.add('expanded');
        }, 10);
    }
}

startBtn.addEventListener('click', startTimer);
resetBtn.addEventListener('click', resetTimer);
document.getElementById('modalYesBtn').addEventListener('click', handleAchievementYes);
document.getElementById('modalNoBtn').addEventListener('click', handleAchievementNo);
document.getElementById('modalExtendBtn').addEventListener('click', handleAchievementExtend);
document.getElementById('achievementsToggle').addEventListener('click', toggleAchievements);

// Streak panel event listeners
document.getElementById('streakBadge').addEventListener('click', toggleStreakPanel);
document.getElementById('streakPanelClose').addEventListener('click', () => {
    document.getElementById('streakPanel').style.display = 'none';
});

// Distraction Check Modal Event Listeners
document.getElementById('modalDistractionYesBtn').addEventListener('click', handleDistractionYes);
document.getElementById('modalDistractionNoBtn').addEventListener('click', handleDistractionNo);

// Arrow button event listeners
increaseBy10Btn.addEventListener('click', () => {
    if (!isRunning) {
        const currentMinutes = getMinutesFromTime();
        setTimeFromMinutes(currentMinutes + 10);
    }
});

decreaseBy10Btn.addEventListener('click', () => {
    if (!isRunning) {
        const currentMinutes = getMinutesFromTime();
        setTimeFromMinutes(currentMinutes - 10);
    }
});

increaseBy1Btn.addEventListener('click', () => {
    if (!isRunning) {
        const currentMinutes = getMinutesFromTime();
        setTimeFromMinutes(currentMinutes + 1);
    }
});

decreaseBy1Btn.addEventListener('click', () => {
    if (!isRunning) {
        const currentMinutes = getMinutesFromTime();
        setTimeFromMinutes(currentMinutes - 1);
    }
});

// Window controls
document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('maximizeBtn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

// Close button + confirmation modal
const closeBtn = document.getElementById('closeBtn');
const closeConfirmModal = document.getElementById('closeConfirmModal');
const closeConfirmYesBtn = document.getElementById('closeConfirmYesBtn');
const closeConfirmNoBtn = document.getElementById('closeConfirmNoBtn');

function showCloseConfirmModal() {
    if (closeConfirmModal) {
        closeConfirmModal.style.display = 'flex';
        if (closeConfirmYesBtn) closeConfirmYesBtn.focus();
    }
}

function hideCloseConfirmModal() {
    if (closeConfirmModal) {
        closeConfirmModal.style.display = 'none';
    }
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        if (isRunning) {
            showCloseConfirmModal();
        } else {
            ipcRenderer.send('close-window');
        }
    });
}

if (closeConfirmYesBtn) {
    closeConfirmYesBtn.addEventListener('click', () => {
        // ensure we clean up running session before closing the window
        try {
            resetTimer();
        } catch (e) {
            // ignore cleanup errors
        }
        ipcRenderer.send('close-window');
    });
}

if (closeConfirmNoBtn) {
    closeConfirmNoBtn.addEventListener('click', hideCloseConfirmModal);
}

if (closeConfirmModal) {
    closeConfirmModal.addEventListener('click', (e) => {
        if (e.target === closeConfirmModal) {
            hideCloseConfirmModal();
        }
    });
}

// allow closing the confirmation modal with Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && closeConfirmModal && closeConfirmModal.style.display === 'flex') {
        hideCloseConfirmModal();
    }
});

if (Notification.permission === 'default') {
    Notification.requestPermission();
}

function playAlertSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Five short, uplifting melodies (frequencies in Hz).
    // Each tune includes notes, per-note duration, gap and oscillator type to vary timbre.
    const tunes = [
        { notes: [523.25, 659.25, 783.99, 1046.50], noteDuration: 0.20, noteGap: 0.05, type: 'sine' }, // C major arpeggio
        { notes: [392.00, 493.88, 523.25, 659.25, 783.99], noteDuration: 0.18, noteGap: 0.04, type: 'triangle' }, // rising motif
        { notes: [880.00, 987.77, 1046.50, 1318.51], noteDuration: 0.15, noteGap: 0.03, type: 'square' }, // bright fanfare
        { notes: [523.25, 659.25, 880.00, 1046.50, 1318.51], noteDuration: 0.14, noteGap: 0.03, type: 'sine' }, // upbeat arpeggio
        { notes: [659.25, 783.99, 987.77, 1174.66, 1318.51], noteDuration: 0.16, noteGap: 0.04, type: 'triangle' } // pentatonic-ish rise
    ];

    // Pick a random tune
    const tune = tunes[Math.floor(Math.random() * tunes.length)];

    // Helper to play one pass of the tune with a given offset
    function playPass(offset = 0) {
        tune.notes.forEach((freq, i) => {
            const startTime = audioCtx.currentTime + offset + i * (tune.noteDuration + tune.noteGap);

            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = tune.type;
            oscillator.frequency.setValueAtTime(freq, startTime);

            // simple attack & release envelope
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
            gainNode.gain.linearRampToValueAtTime(0, startTime + tune.noteDuration);

            oscillator.start(startTime);
            oscillator.stop(startTime + tune.noteDuration);
        });
    }

    // Play the selected tune twice with a small pause between passes for emphasis
    playPass(0);
    const passLength = tune.notes.length * (tune.noteDuration + tune.noteGap);
    setTimeout(() => playPass(1), Math.max(300, passLength * 1000 + 120));
}

// New: scale UI based on window size so internal elements scale together
function updateScale() {
    const baseW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-w')) || 380;
    const baseH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-h')) || 480;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // use a small margin so UI doesn't touch window edges
    const margin = 24 * 2; // left+right padding approximated
    const scale = Math.max(0.5, Math.min((w - margin) / baseW, (h - margin) / baseH)) * 1.2;
    document.documentElement.style.setProperty('--ui-scale', scale);
}

window.addEventListener('resize', updateScale);
// set initial stroke dasharray and offset
progressCircle.style.strokeDasharray = circumference;
progressCircle.style.strokeDashoffset = circumference;
updateScale();

// Theme switching functionality
function setTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

// Load theme on page load
loadTheme();

// ============================================
// SETTINGS PANEL FUNCTIONS
// ============================================

const settingsPanel = document.getElementById('settingsPanel');
const settingsBtn = document.getElementById('settingsBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const darkThemeBtn = document.getElementById('darkThemeBtn');
const lightThemeBtn = document.getElementById('lightThemeBtn');
const askDistractionCheckbox = document.getElementById('askDistractionCheckbox');

// Show settings panel
function showSettingsPanel() {
    // Load current settings state
    syncSettingsPanelState();
    settingsPanel.style.display = 'flex';
}

// Hide settings panel
function hideSettingsPanel() {
    settingsPanel.style.display = 'none';
}

// Sync settings panel with current preferences
function syncSettingsPanelState() {
    // Sync theme buttons
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeButtonStates(currentTheme);

    // Sync distraction checkbox
    // When checked = modal WILL show (hideDistractionCheck = false)
    // When unchecked = modal will NOT show (hideDistractionCheck = true)
    askDistractionCheckbox.checked = !distractionCheckHidden;

    // Sync AI API key
    loadAiApiKey();
}

// Update theme button visual states
function updateThemeButtonStates(theme) {
    if (theme === 'light') {
        lightThemeBtn.classList.add('active');
        darkThemeBtn.classList.remove('active');
    } else {
        darkThemeBtn.classList.add('active');
        lightThemeBtn.classList.remove('active');
    }
}

// Handle theme change from settings panel
function handleSettingsThemeChange(newTheme) {
    setTheme(newTheme);
    updateThemeButtonStates(newTheme);
}

// Handle distraction checkbox change
function handleDistractionCheckboxChange() {
    const shouldAsk = askDistractionCheckbox.checked;
    // When checked (should ask) -> hideDistractionCheck = false
    // When unchecked (don't ask) -> hideDistractionCheck = true
    saveDistractionCheckPreference(!shouldAsk);
}

// Close settings panel when clicking outside
function handleSettingsPanelClick(event) {
    if (event.target === settingsPanel) {
        hideSettingsPanel();
    }
}

// Event listeners for settings panel
settingsBtn.addEventListener('click', showSettingsPanel);
settingsCloseBtn.addEventListener('click', hideSettingsPanel);
settingsPanel.addEventListener('click', handleSettingsPanelClick);

// Theme button event listeners
darkThemeBtn.addEventListener('click', () => handleSettingsThemeChange('dark'));
lightThemeBtn.addEventListener('click', () => handleSettingsThemeChange('light'));

// Distraction checkbox event listener
askDistractionCheckbox.addEventListener('change', handleDistractionCheckboxChange);

// ============================================
// AI MOTIVATION API KEY MANAGEMENT
// ============================================

const aiApiKeyInput = document.getElementById('aiApiKeyInput');

// Load API key from localStorage
function loadAiApiKey() {
    const apiKey = localStorage.getItem('openai_api_key');
    if (apiKey && aiApiKeyInput) {
        aiApiKeyInput.value = apiKey;
    }
}

// Save API key to localStorage
function saveAiApiKey() {
    const apiKey = aiApiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
    } else {
        localStorage.removeItem('openai_api_key');
    }
}

// Event listener for API key input
if (aiApiKeyInput) {
    aiApiKeyInput.addEventListener('blur', saveAiApiKey);
    aiApiKeyInput.addEventListener('change', saveAiApiKey);
}

// ============================================
// MUSIC PLAYER IMPLEMENTATION
// ============================================

const musicPlayer = document.getElementById('musicPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const loopBtn = document.getElementById('loopBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const trackName = document.getElementById('trackName');
const trackCategory = document.getElementById('trackCategory');
const trackList = document.getElementById('trackList');
const musicToggle = document.getElementById('musicToggle');
const musicPlayerContainer = document.getElementById('musicPlayerContainer');
const musicToggleIcon = document.getElementById('musicToggleIcon');

// Music library structure
const musicLibrary = [
    { id: 1, name: 'Space Drift', category: 'Ambient', file: 'music/ambient/space-drift.mp3', icon: '🌌' },
    { id: 2, name: 'Deep Ocean', category: 'Ambient', file: 'music/ambient/deep-ocean.mp3', icon: '🌊' },
    { id: 3, name: 'Study Beats 1', category: 'Lo-fi', file: 'music/lofi/study-beats-1.mp3', icon: '🎧' },
    { id: 4, name: 'Study Beats 2', category: 'Lo-fi', file: 'music/lofi/study-beats-2.mp3', icon: '🎧' },
    { id: 5, name: 'Rain Forest', category: 'Nature', file: 'music/nature/rain-forest.mp3', icon: '🌲' },
];

let currentTrackIndex = 0;
let isPlayingMusic = false;
let isLooping = true;

// Initialize music player
function initMusicPlayer() {
    // Populate track list
    musicLibrary.forEach((track, index) => {
        const trackItem = document.createElement('div');
        trackItem.className = 'track-item';
        trackItem.dataset.index = index;
        trackItem.innerHTML = `
            <span class="track-item-icon">${track.icon}</span>
            <div style="flex: 1;">
                <div class="track-item-text">${track.name}</div>
                <div class="track-item-category">${track.category}</div>
            </div>
        `;
        trackItem.addEventListener('click', () => selectTrack(index));
        trackList.appendChild(trackItem);
    });

    // Load saved preferences
    loadMusicPreferences();

    // Set initial track
    updateTrackDisplay();
}

// Load preferences from localStorage
function loadMusicPreferences() {
    const savedVolume = localStorage.getItem('musicVolume');
    const savedTrackIndex = localStorage.getItem('musicTrackIndex');
    const savedLoop = localStorage.getItem('musicLoop');

    if (savedVolume !== null) {
        const volume = parseInt(savedVolume);
        volumeSlider.value = volume;
        volumeValue.textContent = volume + '%';
        musicPlayer.volume = volume / 100;
    } else {
        musicPlayer.volume = 0.5;
    }

    if (savedTrackIndex !== null) {
        currentTrackIndex = parseInt(savedTrackIndex);
    }

    if (savedLoop !== null) {
        isLooping = savedLoop === 'true';
        updateLoopButton();
    }
}

// Save preferences to localStorage
function saveMusicPreferences() {
    localStorage.setItem('musicVolume', volumeSlider.value);
    localStorage.setItem('musicTrackIndex', currentTrackIndex);
    localStorage.setItem('musicLoop', isLooping);
}

// Toggle music player visibility
function toggleMusicPlayer() {
    const isExpanded = musicPlayerContainer.classList.contains('expanded');

    if (isExpanded) {
        musicPlayerContainer.classList.remove('expanded');
        musicToggleIcon.classList.remove('expanded');
        musicPlayerContainer.style.display = 'none';
    } else {
        musicPlayerContainer.style.display = 'block';
        setTimeout(() => {
            musicPlayerContainer.classList.add('expanded');
            musicToggleIcon.classList.add('expanded');
        }, 10);
    }
}

// Select track
function selectTrack(index) {
    currentTrackIndex = index;
    const wasPlaying = isPlayingMusic;

    if (isPlayingMusic) {
        musicPlayer.pause();
    }

    loadTrack();
    updateTrackDisplay();
    saveMusicPreferences();

    if (wasPlaying) {
        playMusic();
    }
}

// Load track
function loadTrack() {
    const track = musicLibrary[currentTrackIndex];
    try {
        const path = require('path');
        const { remote } = require('electron');
        const app = remote ? remote.app : require('@electron/remote').app;
        const appPath = app.getAppPath();

        const musicPath = path.join(appPath, track.file);
        musicPlayer.src = musicPath;
        musicPlayer.load();
    } catch (error) {
        console.error('Error loading track:', error);
        // Fallback: try relative path
        musicPlayer.src = track.file;
        musicPlayer.load();
    }
}

// Update track display
function updateTrackDisplay() {
    const track = musicLibrary[currentTrackIndex];
    trackName.textContent = track.name;
    trackCategory.textContent = track.category;

    // Update active track in list
    document.querySelectorAll('.track-item').forEach((item, index) => {
        if (index === currentTrackIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Play/Pause music
function togglePlayPause() {
    if (isPlayingMusic) {
        pauseMusic();
    } else {
        playMusic();
    }
}

// Play music
function playMusic() {
    if (!musicPlayer.src) {
        loadTrack();
    }

    musicPlayer.play().then(() => {
        isPlayingMusic = true;
        playPauseBtn.textContent = '⏸';
        playPauseBtn.classList.add('playing');
    }).catch(error => {
        console.error('Error playing music:', error);
    });
}

// Pause music
function pauseMusic() {
    musicPlayer.pause();
    isPlayingMusic = false;
    playPauseBtn.textContent = '▶';
    playPauseBtn.classList.remove('playing');
}

// Stop music (used when timer ends)
function stopMusic() {
    musicPlayer.pause();
    musicPlayer.currentTime = 0;
    isPlayingMusic = false;
    playPauseBtn.textContent = '▶';
    playPauseBtn.classList.remove('playing');
}

// Next track
function nextTrack() {
    currentTrackIndex = (currentTrackIndex + 1) % musicLibrary.length;
    selectTrack(currentTrackIndex);
}

// Previous track
function previousTrack() {
    currentTrackIndex = (currentTrackIndex - 1 + musicLibrary.length) % musicLibrary.length;
    selectTrack(currentTrackIndex);
}

// Toggle loop
function toggleLoop() {
    isLooping = !isLooping;
    updateLoopButton();
    saveMusicPreferences();
}

// Update loop button appearance
function updateLoopButton() {
    if (isLooping) {
        loopBtn.classList.add('loop-active');
        loopBtn.title = 'Loop: ON';
        loopBtn.dataset.loop = 'true';
    } else {
        loopBtn.classList.remove('loop-active');
        loopBtn.title = 'Loop: OFF';
        loopBtn.dataset.loop = 'false';
    }
}

// Handle track end
function handleTrackEnd() {
    if (isLooping) {
        musicPlayer.currentTime = 0;
        playMusic();
    } else {
        nextTrack();
    }
}

// Volume control
function updateVolume() {
    const volume = volumeSlider.value;
    musicPlayer.volume = volume / 100;
    volumeValue.textContent = volume + '%';
    saveMusicPreferences();
}

// Event listeners
musicToggle.addEventListener('click', toggleMusicPlayer);
playPauseBtn.addEventListener('click', togglePlayPause);
nextTrackBtn.addEventListener('click', nextTrack);
prevTrackBtn.addEventListener('click', previousTrack);
loopBtn.addEventListener('click', toggleLoop);
volumeSlider.addEventListener('input', updateVolume);
musicPlayer.addEventListener('ended', handleTrackEnd);

// ============================================
// STREAK COUNTER UI FUNCTIONS
// ============================================
// Core logic is in streakCounter.js

// Update streak badge display
function updateStreakBadge() {
    const streakData = calculateStreak();
    const streakCountElement = document.getElementById('streakCount');

    if (streakCountElement) {
        streakCountElement.textContent = streakData.current;
    }
}

// Toggle streak panel visibility
function toggleStreakPanel() {
    const panel = document.getElementById('streakPanel');
    const isVisible = panel.style.display === 'block';

    if (isVisible) {
        panel.style.display = 'none';
    } else {
        // Update panel content before showing
        const streakData = calculateStreak();

        document.getElementById('currentStreak').textContent = `${streakData.current} dni`;
        document.getElementById('longestStreak').textContent = `${streakData.longest} dni`;

        const motivationElement = document.getElementById('streakMotivation');
        if (streakData.showMotivation) {
            motivationElement.style.display = 'block';
        } else {
            motivationElement.style.display = 'none';
        }

        panel.style.display = 'block';
    }
}

// Initialize music player on page load
initMusicPlayer();

// Load achievements on page load
loadTodayAchievements();

// Initialize streak counter
updateStreakBadge();

// Load distraction check preference
loadDistractionCheckPreference();

updateDisplay();
updateArrowButtons();
showTimerControls();

// Listen for transition control from main process
ipcRenderer.on('disable-transitions', () => {
    const container = document.querySelector('.container');
    if (container) {
        container.style.transition = 'none';
    }
});

ipcRenderer.on('enable-transitions', () => {
    const container = document.querySelector('.container');
    if (container) {
        container.style.transition = 'transform 120ms linear';
    }
});