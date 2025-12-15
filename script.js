// --- Token System Helper ---
    function getCssVar(variableName) {
        return getComputedStyle(document.body).getPropertyValue(variableName).trim();
    }

    // --- Configuration & State ---
    const DATA_KEY = 'habit_tracker_data_v2';
    const CONFIG_KEY = 'habit_tracker_config_v2';
    const THEME_KEY = 'habit_tracker_theme';

    // --- Firebase Cloud Sync ---
    // This app loads Firebase config from a Netlify Function at:
    //   /.netlify/functions/firebase-config
    // That function reads FIREBASE_* variables from Netlify (or from .env when using `netlify dev`).
    // If you are NOT using Netlify Functions locally, you can temporarily paste your config here.
    let FIREBASE_CONFIG = {
        apiKey: "",
        authDomain: "",
        projectId: "",
        appId: ""
    };

    const CLOUD_SYNC_ID_KEY = 'habit_tracker_cloud_sync_id_v1';
    const CLOUD_SYNC_ENABLED_KEY = 'habit_tracker_cloud_sync_enabled_v1';
    const CLOUD_CLIENT_ID_KEY = 'habit_tracker_cloud_client_id_v1';

    const cloudSync = {
        enabled: false,
        syncId: null,
        clientId: localStorage.getItem(CLOUD_CLIENT_ID_KEY) || null,
        docRef: null,
        unsubscribe: null,
        pendingPushTimer: null,
        isApplyingRemote: false,
        lastRemoteUpdatedAtMs: 0,
    };

    if (!cloudSync.clientId) {
        const fallbackId = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        cloudSync.clientId = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') ? globalThis.crypto.randomUUID() : fallbackId;
        localStorage.setItem(CLOUD_CLIENT_ID_KEY, cloudSync.clientId);
    }

    // --- Smooth horizontal scroll (Monthly Tracker) ---
    let trackerSmoothScrollInitialized = false;
    function initSmoothTrackerScroll() {
        if (trackerSmoothScrollInitialized) return;
        const wrapper = document.querySelector('.tracker-wrapper');
        if (!wrapper) return;
        trackerSmoothScrollInitialized = true;

        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let targetScrollLeft = wrapper.scrollLeft;
        let tween = null;
        const quickTo = (!reduceMotion && typeof gsap !== 'undefined' && gsap && typeof gsap.quickTo === 'function')
            ? gsap.quickTo(wrapper, 'scrollLeft', { duration: 0.75, ease: 'power2.out' })
            : null;

        const clamp = (value) => {
            const max = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
            return Math.min(max, Math.max(0, value));
        };

        const animateTo = (next) => {
            targetScrollLeft = clamp(next);
            if (reduceMotion || typeof gsap === 'undefined') {
                wrapper.scrollLeft = targetScrollLeft;
                return;
            }

            if (quickTo) {
                quickTo(targetScrollLeft);
                return;
            }

            if (tween) tween.kill();
            tween = gsap.to(wrapper, {
                scrollLeft: targetScrollLeft,
                duration: 0.75,
                ease: 'power2.out',
                overwrite: true,
            });
        };

        // --- Motion blur (simulated) ---
        let rafId = 0;
        let lastX = wrapper.scrollLeft;
        let lastT = performance.now();
        let idleTimer = 0;

        const setFx = (blurPx, skewDeg) => {
            wrapper.style.setProperty('--scroll-blur', `${blurPx.toFixed(2)}px`);
            wrapper.style.setProperty('--scroll-skew', `${skewDeg.toFixed(2)}deg`);
        };

        const stopFx = () => {
            wrapper.classList.remove('is-scrolling');
            setFx(0, 0);
            if (rafId) cancelAnimationFrame(rafId);
            rafId = 0;
        };

        const tickFx = () => {
            const now = performance.now();
            const x = wrapper.scrollLeft;
            const dt = Math.max(8, now - lastT);
            const dx = x - lastX;

            // px/ms => scale to a small blur amount.
            const speed = Math.abs(dx) / dt;
            const blur = Math.min(1.25, speed * 18);
            const skew = Math.max(-2.2, Math.min(2.2, (dx / dt) * 22));

            setFx(blur, skew);
            lastX = x;
            lastT = now;

            rafId = requestAnimationFrame(tickFx);
        };

        const startFx = () => {
            if (reduceMotion) return;
            wrapper.classList.add('is-scrolling');
            if (!rafId) {
                lastX = wrapper.scrollLeft;
                lastT = performance.now();
                rafId = requestAnimationFrame(tickFx);
            }
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(stopFx, 120);
        };

        wrapper.addEventListener('scroll', () => {
            // Keep target in sync if user drags scrollbar/touches.
            if (!tween || !tween.isActive()) targetScrollLeft = wrapper.scrollLeft;
            startFx();
        }, { passive: true });

        wrapper.addEventListener('wheel', (e) => {
            // Smooth only horizontal intent:
            // - trackpad horizontal (deltaX)
            // - Shift+wheel (deltaY becomes horizontal)
            const hasHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            const delta = hasHorizontal ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
            if (!delta) return;

            e.preventDefault();
            // Clamp extreme deltas so we animate smoothly even on fast wheels.
            const clampedDelta = Math.max(-240, Math.min(240, delta));
            animateTo(targetScrollLeft + clampedDelta);
            startFx();
        }, { passive: false });
    }
    
    // Expanded Pastel Palette
    const pastelPalette = [
        '#9b9cea', // Purple
        '#a0e7e5', // Teal
        '#fbcfe8', // Pink
        '#90cdf4', // Blue
        '#f6ad55', // Orange
        '#68d391', // Mint
        '#7f9cf5', // Indigo
        '#f687b3', // Rose
        '#f6e05e', // Amber
        '#4fd1c5'  // Cyan
    ];
    
    // Updated Default Habits with more color variety
    const defaultHabits = [
        { id: 'h1', name: 'Morning Run', color: '#68d391' },
        { id: 'h2', name: 'Read 30 Mins', color: '#a0e7e5' },
        { id: 'h3', name: 'Meditation', color: '#fbcfe8' },
        { id: 'h4', name: 'Drink 3L Water', color: '#90cdf4' },
        { id: 'h5', name: 'No Sugar', color: '#f687b3' },
        { id: 'h6', name: 'Journal', color: '#f6ad55' },
        { id: 'h7', name: 'Learn Spanish', color: '#9b9cea' }
    ];

    let currentDate = new Date();
    let selectedMonth = currentDate.getMonth(); 
    let selectedYear = currentDate.getFullYear();
    
    let appData = JSON.parse(localStorage.getItem(DATA_KEY)) || {};
    let habits = JSON.parse(localStorage.getItem(CONFIG_KEY)) || defaultHabits;

    // Chart Instances
    let charts = {};

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', async () => {
        // Always open on the current month/year
        currentDate = new Date();
        selectedMonth = currentDate.getMonth();
        selectedYear = currentDate.getFullYear();

        const footerYear = document.getElementById('footerYear');
        if (footerYear) footerYear.textContent = String(new Date().getFullYear());

        const savedTheme = localStorage.getItem(THEME_KEY);
        // Default to dark mode if no theme is saved, or if it's explicitly 'dark'
        if (savedTheme === 'dark' || !savedTheme) {
            document.body.classList.add('dark-mode');
        }

        updateThemeToggleIcon();

        await loadFirebaseConfigFromNetlify();

        autoConnectCloudSyncIfEnabled();

        initDateSelectors();
        initSwatches();
        renderDashboard();

        // Enhance the monthly tracker horizontal scrolling.
        initSmoothTrackerScroll();
    });

    async function loadFirebaseConfigFromNetlify() {
        // If config is already present, don't fetch.
        if (isFirebaseConfigured()) {
            updateCloudSyncButtonLabel();
            return;
        }

        // Only Netlify-hosted sites (or `netlify dev`) will have this endpoint.
        const url = '/.netlify/functions/firebase-config';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        try {
            const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
            if (!res.ok) {
                updateCloudSyncButtonLabel();
                return;
            }
            const cfg = await res.json();
            if (!cfg || typeof cfg !== 'object') {
                updateCloudSyncButtonLabel();
                return;
            }

            FIREBASE_CONFIG = {
                apiKey: cfg.apiKey || '',
                authDomain: cfg.authDomain || '',
                projectId: cfg.projectId || '',
                appId: cfg.appId || ''
            };
        } catch (e) {
            // ignore
        } finally {
            clearTimeout(timeout);
            updateCloudSyncButtonLabel();
        }
    }

    function isFirebaseConfigured() {
        return Boolean(
            FIREBASE_CONFIG &&
            FIREBASE_CONFIG.apiKey &&
            FIREBASE_CONFIG.projectId &&
            FIREBASE_CONFIG.appId
        );
    }

    async function copyText(text) {
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {
            // ignore
        }
        prompt('Copy this:', text);
        return false;
    }

    function updateCloudSyncButtonLabel() {
        const btn = document.getElementById('cloudSyncBtn');
        if (!btn) return;

        if (!isFirebaseConfigured()) {
            btn.textContent = '☁️ Sync';
            btn.title = 'Cloud sync not configured (add Firebase config in script.js)';
            return;
        }

        btn.textContent = cloudSync.enabled ? '☁️ Synced' : '☁️ Sync';
        btn.title = cloudSync.enabled ? 'Cloud sync is ON' : 'Cloud sync across devices';
    }

    async function ensureFirebaseReady() {
        if (!isFirebaseConfigured()) return false;
        if (typeof firebase === 'undefined') return false;

        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }

        const auth = firebase.auth();
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }
        return true;
    }

    function generateSyncId() {
        const bytes = new Uint8Array(16);
        if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
            globalThis.crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function scheduleCloudPush() {
        if (!cloudSync.enabled || cloudSync.isApplyingRemote) return;
        if (!cloudSync.docRef) return;

        if (cloudSync.pendingPushTimer) clearTimeout(cloudSync.pendingPushTimer);
        cloudSync.pendingPushTimer = setTimeout(() => {
            pushLocalToCloud().catch(() => {});
        }, 800);
    }

    async function pushLocalToCloud() {
        if (!cloudSync.enabled || !cloudSync.docRef) return;
        const payload = {
            schemaVersion: 1,
            habits,
            appData,
            updatedAtMs: Date.now(),
            updatedBy: cloudSync.clientId,
        };
        await cloudSync.docRef.set(payload, { merge: true });
    }

    function applyCloudData(data) {
        if (!data || typeof data !== 'object') return;
        if (!data.habits || !data.appData) return;

        cloudSync.isApplyingRemote = true;
        habits = Array.isArray(data.habits) ? data.habits : habits;
        appData = (data.appData && typeof data.appData === 'object') ? data.appData : appData;
        saveHabits();
        saveData();
        cloudSync.isApplyingRemote = false;

        renderDashboard(false);
    }

    async function connectCloudSync(syncId, { silent = false } = {}) {
        const ok = await ensureFirebaseReady();
        if (!ok) {
            alert('Cloud sync is not ready. Add Firebase config in script.js and run on a local server (not file://).');
            return;
        }

        const db = firebase.firestore();
        cloudSync.syncId = syncId;
        cloudSync.docRef = db.collection('habit_tracker_sync_v1').doc(syncId);

        if (cloudSync.unsubscribe) cloudSync.unsubscribe();
        cloudSync.unsubscribe = cloudSync.docRef.onSnapshot((snap) => {
            if (!snap.exists) return;
            const data = snap.data() || {};
            if (data.updatedBy && data.updatedBy === cloudSync.clientId) return;
            const remoteUpdatedAtMs = (typeof data.updatedAtMs === 'number') ? data.updatedAtMs : 0;
            if (remoteUpdatedAtMs && remoteUpdatedAtMs <= cloudSync.lastRemoteUpdatedAtMs) return;

            cloudSync.lastRemoteUpdatedAtMs = remoteUpdatedAtMs;
            applyCloudData(data);
        });

        cloudSync.enabled = true;
        localStorage.setItem(CLOUD_SYNC_ID_KEY, syncId);
        localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, '1');
        updateCloudSyncButtonLabel();

        const snap = await cloudSync.docRef.get();
        if (!snap.exists) {
            await pushLocalToCloud();
            return;
        }

        const remote = snap.data() || {};
        if (!silent) {
            const useCloud = confirm('Cloud data found.\n\nOK = use cloud data on this device\nCancel = overwrite cloud with this device data');
            if (useCloud) applyCloudData(remote);
            else await pushLocalToCloud();
        } else {
            // Silent reconnect: always converge to the latest cloud state.
            applyCloudData(remote);
        }
    }

    function disconnectCloudSync() {
        if (cloudSync.unsubscribe) cloudSync.unsubscribe();
        if (cloudSync.pendingPushTimer) clearTimeout(cloudSync.pendingPushTimer);
        cloudSync.unsubscribe = null;
        cloudSync.docRef = null;
        cloudSync.enabled = false;
        cloudSync.syncId = null;
        cloudSync.pendingPushTimer = null;
        cloudSync.lastRemoteUpdatedAtMs = 0;
        localStorage.removeItem(CLOUD_SYNC_ENABLED_KEY);
        updateCloudSyncButtonLabel();
    }

    function autoConnectCloudSyncIfEnabled() {
        updateCloudSyncButtonLabel();
        const enabled = localStorage.getItem(CLOUD_SYNC_ENABLED_KEY) === '1';
        const syncId = localStorage.getItem(CLOUD_SYNC_ID_KEY);
        if (!enabled || !syncId) return;
        if (!isFirebaseConfigured()) return;
        connectCloudSync(syncId, { silent: true }).catch(() => {
            updateCloudSyncButtonLabel();
        });
    }

    async function openCloudSync() {
        if (window.location.protocol === 'file:') {
            alert('Cloud sync needs a web origin.\n\nPlease run this app with a local server (http://localhost) instead of opening index.html directly.');
            return;
        }

        if (!isFirebaseConfigured()) {
            alert('Cloud sync is not configured yet.\n\nOpen script.js and paste your Firebase config into FIREBASE_CONFIG.');
            return;
        }

        if (cloudSync.enabled && cloudSync.syncId) {
            const action = prompt(
                `Cloud sync is ON.\n\nSync Code:\n${cloudSync.syncId}\n\nType:\n- copy (to copy code)\n- disconnect (to turn off)`,
                'copy'
            );
            if (!action) return;
            const a = action.trim().toLowerCase();
            if (a.startsWith('c')) {
                await copyText(cloudSync.syncId);
                alert('Sync code copied.');
            } else if (a.startsWith('d')) {
                const ok = confirm('Turn off cloud sync on this device?');
                if (ok) disconnectCloudSync();
            }
            return;
        }

        const input = prompt('Enter Sync Code to join an existing sync.\nLeave blank to create a new one:', localStorage.getItem(CLOUD_SYNC_ID_KEY) || '');
        if (input === null) return;
        const trimmed = input.trim();
        const syncId = trimmed || generateSyncId();

        await connectCloudSync(syncId, { silent: false });

        if (!trimmed) {
            await copyText(syncId);
            alert('New sync created. Sync code copied.\n\nOn your other device, open ☁️ Sync and paste this code to join.');
        }
    }

    function updateThemeToggleIcon() {
        const btn = document.getElementById('themeToggleBtn');
        if (!btn) return;
        const isDark = document.body.classList.contains('dark-mode');
        // Per request: show sun when in dark mode, moon when in light mode.
        btn.textContent = isDark ? '☀️' : '🌙';
    }

    function scrollTrackerToToday() {
        const today = new Date();
        if (today.getMonth() !== selectedMonth || today.getFullYear() !== selectedYear) return;

        const wrapper = document.querySelector('.tracker-wrapper');
        const todayHeaderCell = document.querySelector('#tableHeaderRow th.is-today');
        const stickyFirstHeaderCell = document.querySelector('#tableHeaderRow th:first-child');
        if (!wrapper || !todayHeaderCell) return;

        // Defer until layout is ready, then center the column inside the horizontal scroller.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const wrapperRect = wrapper.getBoundingClientRect();
                const cellRect = todayHeaderCell.getBoundingClientRect();
                const stickyWidth = stickyFirstHeaderCell ? stickyFirstHeaderCell.getBoundingClientRect().width : 0;

                // Center within the date area (exclude the sticky first column from the centering math).
                const visibleLeft = wrapperRect.left + stickyWidth;
                const visibleWidth = Math.max(0, wrapperRect.width - stickyWidth);
                const visibleCenterX = visibleLeft + (visibleWidth / 2);
                const cellCenterX = cellRect.left + (cellRect.width / 2);

                const delta = cellCenterX - visibleCenterX;
                const maxScrollLeft = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
                const nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, wrapper.scrollLeft + delta));
                wrapper.scrollLeft = nextScrollLeft;
            });
        });
    }

    function initSwatches() {
        const container = document.getElementById('swatchContainer');
        const colorInput = document.getElementById('newHabitColor');
        
        pastelPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch';
            swatch.style.backgroundColor = color;
            swatch.onclick = () => {
                colorInput.value = color;
                // Visual selection feedback
                document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
            };
            container.appendChild(swatch);
        });
        
        // Randomly select one on load
        const randomColor = pastelPalette[Math.floor(Math.random() * pastelPalette.length)];
        colorInput.value = randomColor;
    }

    // --- Data Persistence ---
    function saveData() {
        localStorage.setItem(DATA_KEY, JSON.stringify(appData));
        scheduleCloudPush();
    }
    function saveHabits() {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(habits));
        scheduleCloudPush();
    }

    // --- Core Features ---
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
        updateThemeToggleIcon();
        renderDashboard(false); 
    }

    function exportData() {
        const data = { habits, appData, exportDate: new Date() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    function importData(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.habits && imported.appData) {
                    if(confirm("This will overwrite your current data. Continue?")) {
                        habits = imported.habits;
                        appData = imported.appData;
                        saveData();
                        saveHabits();
                        renderDashboard();
                        alert("Import successful!");
                    }
                } else {
                    alert("Invalid file format.");
                }
            } catch (err) {
                alert("Error reading file.");
            }
        };
        reader.readAsText(file);
        input.value = '';
    }

    function addHabit() {
        const input = document.getElementById('newHabitInput');
        const colorInput = document.getElementById('newHabitColor');
        const name = input.value.trim();
        
        if (!name) return alert("Please enter a habit name.");
        
        const newId = 'h-' + Date.now();
        habits.push({ id: newId, name: name, color: colorInput.value }); // Added to end of array now
        saveHabits();
        input.value = '';
        input.focus(); // Focus back for quick adding
        
        // Randomize color for next habit
        const randomColor = pastelPalette[Math.floor(Math.random() * pastelPalette.length)];
        colorInput.value = randomColor;
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
        
        renderDashboard();
    }
    
    function deleteHabit(id) {
        if(confirm("Delete this habit and history?")) {
            habits = habits.filter(h => h.id !== id);
            delete appData[id];
            saveData();
            saveHabits();
            renderDashboard();
        }
    }

    function resetData() {
        if(confirm("Clear ALL data and reset to defaults?")) {
            localStorage.clear();
            location.reload(); 
        }
    }

    function handleEnter(e) { if (e.key === 'Enter') addHabit(); }

    function initDateSelectors() {
        const monthSelect = document.getElementById('monthSelect');
        const yearSelect = document.getElementById('yearSelect');
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = m;
            if (i === selectedMonth) opt.selected = true;
            monthSelect.appendChild(opt);
        });

        for (let y = selectedYear - 2; y <= selectedYear + 2; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.text = y;
            if (y === selectedYear) opt.selected = true;
            yearSelect.appendChild(opt);
        }

        const updateDate = () => {
            selectedMonth = parseInt(monthSelect.value);
            selectedYear = parseInt(yearSelect.value);
            renderDashboard();
        };

        monthSelect.addEventListener('change', updateDate);
        yearSelect.addEventListener('change', updateDate);
    }

    function getDaysInMonth(month, year) { return new Date(year, month + 1, 0).getDate(); }

    // --- Animation Logic: Confetti ---
    function triggerConfetti(x, y, color) {
        const container = document.getElementById('confetti-container');
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const p = document.createElement('div');
            p.classList.add('particle');
            p.style.backgroundColor = color;
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 60 + 20;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            
            p.animate([
                { transform: 'translate(0,0) scale(1)', opacity: 1 },
                { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
                fill: 'forwards'
            });
            
            container.appendChild(p);
            setTimeout(() => p.remove(), 600);
        }
    }

    function toggleHabit(habitId, day, event) {
        const m = (selectedMonth + 1).toString().padStart(2, '0');
        const d = day.toString().padStart(2, '0');
        const dateStr = `${selectedYear}-${m}-${d}`;

        if (!appData[habitId]) appData[habitId] = [];
        
        const index = appData[habitId].indexOf(dateStr);
        const isAdding = index === -1;
        
        if (isAdding) {
            appData[habitId].push(dateStr);
            if (event) {
                const habit = habits.find(h => h.id === habitId);
                const color = habit ? habit.color : '#9b9cea';
                triggerConfetti(event.clientX, event.clientY, color);
            }
        } else {
            appData[habitId].splice(index, 1);
        }

        saveData();
        renderDashboard(false);
    }

    // --- Stats & Rendering ---

    function calculateStats(habitId, daysInMonth) {
        const completedDates = appData[habitId] || [];
        let monthTotal = 0;
        const prefix = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;
        completedDates.forEach(date => {
            if(date.startsWith(prefix)) monthTotal++;
        });

        const sortedDates = [...completedDates].sort();
        const timeStamps = sortedDates.map(d => new Date(d).getTime());
        
        let currentStreak = 0;
        let longestStreak = 0;
        const today = new Date().setHours(0,0,0,0);
        
        if (timeStamps.length > 0) {
            let lastDate = timeStamps[timeStamps.length-1];
            if (lastDate === today || lastDate === today - 86400000) {
                currentStreak = 1;
                for (let i = timeStamps.length - 1; i > 0; i--) {
                    if ((timeStamps[i] - timeStamps[i-1]) === 86400000) currentStreak++;
                    else break;
                }
            }
        }

        let temp = 0;
        for (let i = 0; i < timeStamps.length; i++) {
            if (i === 0) temp = 1;
            else if ((timeStamps[i] - timeStamps[i-1]) === 86400000) temp++;
            else temp = 1;
            if (temp > longestStreak) longestStreak = temp;
        }

        return { monthTotal, currentStreak, longestStreak, percentage: (monthTotal/daysInMonth)*100 };
    }

    function getDayOfWeekData() {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const counts = [0, 0, 0, 0, 0, 0, 0];
        
        Object.values(appData).forEach(dates => {
            dates.forEach(dateStr => {
                const d = new Date(dateStr);
                if(d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
                    counts[d.getDay()]++; 
                }
            });
        });
        return { labels: days, data: counts };
    }

    function renderDashboard(fullRender = true) {
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
        const thead = document.getElementById('tableHeaderRow');
        const tbody = document.getElementById('tableBody');
        
        // 1. Render Table
        thead.innerHTML = '<th>Habit</th>';
        for(let i=1; i<=daysInMonth; i++) {
            const date = new Date(selectedYear, selectedMonth, i);
            const isToday = date.setHours(0,0,0,0) === new Date().setHours(0,0,0,0);
            thead.innerHTML += `<th class="${isToday ? 'is-today' : ''}">${i}</th>`;
        }
        thead.innerHTML += '<th class="stat-col">Total</th><th class="stat-col">Streak</th><th class="stat-col">Best</th>';

        tbody.innerHTML = '';
        
        const dailyCounts = new Array(daysInMonth).fill(0);
        let totalPossible = (habits.length || 1) * daysInMonth; 
        let totalAchieved = 0;
        const habitPerformances = [];

        if (habits.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${daysInMonth+4}" style="padding:40px; color:var(--text-secondary)">No habits yet. Add one below!</td></tr>`;
        }

        habits.forEach(habit => {
            const stats = calculateStats(habit.id, daysInMonth);
            habitPerformances.push({ ...habit, score: stats.percentage });
            totalAchieved += stats.monthTotal;

            const tr = document.createElement('tr');
            
            // Name
            tr.innerHTML = `
                <td style="border-left: 4px solid ${habit.color}">
                    <div class="habit-name-wrapper">
                        <span>${habit.name}</span>
                        <button class="delete-habit-btn" onclick="deleteHabit('${habit.id}')" title="Delete Habit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </td>`;
            
            // Days
            for(let i=1; i<=daysInMonth; i++) {
                const m = (selectedMonth + 1).toString().padStart(2, '0');
                const d = i.toString().padStart(2, '0');
                const dateStr = `${selectedYear}-${m}-${d}`;
                const isChecked = appData[habit.id] && appData[habit.id].includes(dateStr);
                
                if (isChecked) dailyCounts[i-1]++;

                const checkboxStyle = isChecked ? `background-color: ${habit.color}; border-color: ${habit.color};` : '';

                tr.innerHTML += `
                    <td class="check-cell ${isChecked ? 'active' : ''}" onclick="toggleHabit('${habit.id}', ${i}, event)">
                        <div class="custom-checkbox" style="${checkboxStyle}"></div>
                    </td>
                `;
            }

            // Stats
            tr.innerHTML += `
                <td class="stat-col" style="color:${habit.color}">${stats.monthTotal}</td>
                <td class="stat-col">🔥 ${stats.currentStreak}</td>
                <td class="stat-col">🏆 ${stats.longestStreak}</td>
            `;
            tbody.appendChild(tr);
        });

        // On initial load (and other full renders), keep the tracker focused on today's date.
        if (fullRender) {
            scrollTrackerToToday();
        }

        // 2. Render Top Habits
        const topHabitsList = document.getElementById('topHabitsList');
        topHabitsList.innerHTML = '';
        habitPerformances.sort((a, b) => b.score - a.score);
        habitPerformances.slice(0, 6).forEach(h => {
            const li = document.createElement('li');
            li.className = 'habit-rank-item';
            li.innerHTML = `
                <span style="display:flex; align-items:center; gap:8px;">
                    <span style="width:10px; height:10px; border-radius:50%; background:${h.color}"></span>
                    ${h.name}
                </span> 
                <span class="rank-score" style="color:${h.color}">${Math.round(h.score)}%</span>`;
            topHabitsList.appendChild(li);
        });

        // 3. Render Charts
        updateCharts(daysInMonth, dailyCounts, totalAchieved, totalPossible);
    }

    function updateCharts(daysInMonth, dailyCounts, totalAchieved, totalPossible) {
        const cGrid = getCssVar('--chart-grid');
        const cText = getCssVar('--chart-text');
        const cLine = getCssVar('--chart-line');
        const cFill = getCssVar('--chart-fill');
        const cRadarBorder = getCssVar('--chart-radar-border');
        const cRadarFill = getCssVar('--chart-radar-fill');
        const cDonutEmpty = getCssVar('--chart-donut-empty');
        const cBrand = getCssVar('--brand-primary');

        const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
            plugins: { legend: { labels: { color: cText } } },
            scales: {
                y: { beginAtZero: true, grid: { color: cGrid }, ticks: { color: cText } },
                x: { grid: { display: false }, ticks: { color: cText } }
            }
        };

        /* 1. Line Chart */
        const lineCtx = document.getElementById('lineChart').getContext('2d');
        
        // Create Gradient
        const lineGradient = lineCtx.createLinearGradient(0, 0, 0, 400);
        lineGradient.addColorStop(0, cLine);
        lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        if (charts.line) charts.line.destroy();
        charts.line = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Habits Completed',
                    data: dailyCounts,
                    borderColor: cLine,
                    backgroundColor: lineGradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: cLine,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: { ...commonOptions, plugins: { legend: { display: false } } }
        });

        // 2. Donut Chart
        const donutCtx = document.getElementById('donutChart').getContext('2d');
        if (charts.donut) charts.donut.destroy();
        charts.donut = new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: ['Done', 'Left'],
                datasets: [{
                    data: [totalAchieved, totalPossible - totalAchieved],
                    backgroundColor: [cBrand, cDonutEmpty],
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '75%', 
                animation: { animateScale: true, animateRotate: true },
                plugins: { legend: { display: false } } 
            }
        });

        // 3. Radar Chart
        const radarData = getDayOfWeekData();
        const radarCtx = document.getElementById('radarChart').getContext('2d');
        if (charts.radar) charts.radar.destroy();
        charts.radar = new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: radarData.labels,
                datasets: [{
                    label: 'Consistency',
                    data: radarData.data,
                    backgroundColor: cRadarFill,
                    borderColor: cRadarBorder,
                    pointBackgroundColor: cRadarBorder,
                    pointBorderColor: cRadarBorder
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: cGrid },
                        grid: { color: cGrid },
                        pointLabels: { color: cText },
                        ticks: { display: false, backdropColor: 'transparent' }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // 4. Bar Chart
        const weeks = [0, 0, 0, 0, 0];
        dailyCounts.forEach((count, index) => {
            const weekIdx = Math.floor(index / 7);
            if (weeks[weekIdx] !== undefined) weeks[weekIdx] += count;
        });

        const barCtx = document.getElementById('barChart').getContext('2d');
        
        // Create Bar Gradient
        const barGradient = barCtx.createLinearGradient(0, 0, 0, 300);
        barGradient.addColorStop(0, cBrand);
        barGradient.addColorStop(1, cRadarFill);

        if (charts.bar) charts.bar.destroy();
        charts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
                datasets: [{
                    label: 'Total',
                    data: weeks.filter(w => w >= 0),
                    backgroundColor: barGradient, 
                    borderRadius: 8,
                    hoverBackgroundColor: cBrand
                }]
            },
            options: {
                ...commonOptions,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { display: false }, ticks: { color: cText } },
                    x: { grid: { display: false }, ticks: { color: cText } }
                }
            }
        });
    }
