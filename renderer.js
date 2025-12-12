const { ipcRenderer } = require('electron');

const timerDisplay = document.getElementById('timerDisplay');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const minutesInput = document.getElementById('minutesInput');
const goalInput = document.getElementById('goalInput');
const progressCircle = document.getElementById('progressCircle');

let timeLeft = getInputTime();
let totalTime = timeLeft;
let timerId = null;
let isRunning = false;

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

function getInputTime() {
    const minutes = parseInt(minutesInput.value) || 0;
    return minutes * 60;
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

function cleanOldAchievements() {
    const today = getTodayKey();
    const keysToRemove = [];

    // Find all achievement keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('achievements_') && key !== today) {
            keysToRemove.push(key);
        }
    }

    // Remove old keys (older than 30 days)
    keysToRemove.forEach(key => {
        const dateStr = key.replace('achievements_', '');
        const keyDate = new Date(dateStr);
        const daysDiff = (Date.now() - keyDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 30) {
            localStorage.removeItem(key);
        }
    });
}

function setInputsDisabled(disabled) {
    minutesInput.disabled = disabled;
    goalInput.disabled = disabled;
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

function startTimer() {
    if (!isRunning) {
        if (timeLeft === 0) {
            timeLeft = getInputTime();
            totalTime = timeLeft;
        }
        if (timeLeft > 0) {
            isRunning = true;
            timerDisplay.classList.add('running');
            timerDisplay.classList.remove('paused');
            startBtn.textContent = 'Pauza';
            setInputsDisabled(true);
            showGoalDisplay();

            // Prevent computer from going to sleep
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

                    // Allow computer to sleep again
                    ipcRenderer.send('stop-power-save-blocker');

                    // Stop music when timer ends
                    stopMusic();

                    playAlertSound();

                    new Notification('Deep Work', {
                        body: goalInput.value || 'Sesja zakończona!',
                        icon: null
                    });

                    // Show achievement modal
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

        // Allow computer to sleep when paused
        ipcRenderer.send('stop-power-save-blocker');
    }
}

function resetTimer() {
    clearInterval(timerId);
    isRunning = false;
    stopMusic();
    // restore minutes input to default value and reinitialize timer
    minutesInput.value = 50;
    timeLeft = getInputTime();
    totalTime = timeLeft;
    timerDisplay.classList.remove('running', 'paused');
    startBtn.textContent = 'Start';
    setInputsDisabled(false);
    hideGoalDisplay();
    updateDisplay();
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

function handleAchievementYes() {
    const goalText = goalInput.value.trim();
    if (goalText) {
        saveAchievement(goalText);
        loadTodayAchievements();
    }
    hideAchievementModal();
}

function handleAchievementNo() {
    hideAchievementModal();
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
document.getElementById('achievementsToggle').addEventListener('click', toggleAchievements);

// Window controls
document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
});

document.getElementById('maximizeBtn').addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
});

minutesInput.addEventListener('input', () => {
    if (!isRunning) {
        timeLeft = getInputTime();
        totalTime = timeLeft;
        updateDisplay();
    }
});

if (Notification.permission === 'default') {
    Notification.requestPermission();
}

function playAlertSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.2;
    const noteGap = 0.05;
    
    notes.forEach((freq, i) => {
        const startTime = audioCtx.currentTime + i * (noteDuration + noteGap);
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0, startTime + noteDuration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + noteDuration);
    });
    
    setTimeout(() => {
        const startTime = audioCtx.currentTime;
        notes.forEach((freq, i) => {
            const noteStart = startTime + i * (noteDuration + noteGap);
            
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, noteStart);
            
            gainNode.gain.setValueAtTime(0, noteStart);
            gainNode.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
            gainNode.gain.linearRampToValueAtTime(0, noteStart + noteDuration);
            
            oscillator.start(noteStart);
            oscillator.stop(noteStart + noteDuration);
        });
    }, 600);
}

// New: scale UI based on window size so internal elements scale together
function updateScale() {
    const baseW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-w')) || 380;
    const baseH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-h')) || 480;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // use a small margin so UI doesn't touch window edges
    const margin = 24 * 2; // left+right padding approximated
    const scale = Math.max(0.5, Math.min((w - margin) / baseW, (h - margin) / baseH));
    document.documentElement.style.setProperty('--ui-scale', scale);
}

window.addEventListener('resize', updateScale);
// set initial stroke dasharray and offset
progressCircle.style.strokeDasharray = circumference;
progressCircle.style.strokeDashoffset = circumference;
updateScale();

// Theme switching functionality
const themeBtn = document.getElementById('themeBtn');

function setTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeBtn.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeBtn.textContent = '🌙';
    }
    localStorage.setItem('theme', theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

themeBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
});

// Load theme on page load
loadTheme();

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
    { id: 6, name: 'Ocean Waves', category: 'Nature', file: 'music/nature/ocean-waves.mp3', icon: '🌊' },
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

// Initialize music player on page load
initMusicPlayer();

// Load achievements on page load
loadTodayAchievements();
cleanOldAchievements();

updateDisplay();