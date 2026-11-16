
const $ = id => document.getElementById(id);

const settings = {
    easy: { time: 120, units: 5, floods: 8, penalty: 20 },
    medium: { time: 100, units: 4, floods: 11, penalty: 50, lives: 5 },
    hard: { time: 85, units: 3, floods: 14, penalty: 75, lives: 3 }
};

const descriptions = {
    flood: "Identify potential river inundation and coordinate rescue operations.",
    coastal: "Identify water expansion around low-lying coastal terrain.",
    urban: "Analyse complex radar returns near built-up areas.",
    agri: "Distinguish potentially flooded farmland from ordinary land."
};

let level = "easy";
let scenario = "flood";
let cells = [];
let selected = null;
let target = null;

let score = 0;
let time = 120;
let units = 5;
let correct = 0;
let wrong = 0;
let rescued = 0;
let completed = 0;

let running = false;
let timer = null;
let leaderboard = [];

const achievements = new Set();
let audioEnabled = Boolean(window.AudioContext || window.webkitAudioContext);
let voiceEnabled = Boolean(
    window.speechSynthesis && window.SpeechSynthesisUtterance
);
let audioContext = null;
let musicTimer = null;
let musicStep = 0;

function getAudioContext() {
    const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) return null;

    if (!audioContext) {
        audioContext = new AudioContextConstructor();
    }

    return audioContext;
}

function scheduleTone(context, frequency, duration, waveform, volume) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

function playTone(frequency, duration = 0.16, waveform = "sine", volume = 0.06) {
    if (!audioEnabled) return;

    const context = getAudioContext();

    if (!context || context.state !== "running") return;

    scheduleTone(context, frequency, duration, waveform, volume);
}

function playMusicStep() {
    if (!audioEnabled || !running) return;

    const context = getAudioContext();

    if (!context || context.state !== "running") return;

    const melody = [0, 7, 12, 7, 4, 11, 7, 4, 2, 9, 14, 9, 4, 7, 11, 7];
    const note = 130.81 * Math.pow(2, melody[musicStep % melody.length] / 12);

    scheduleTone(context, note, 0.36, "triangle", 0.026);

    if (musicStep % 4 === 0) {
        scheduleTone(context, note / 2, 0.7, "sine", 0.014);
    }

    musicStep++;
}

function startMusic() {
    if (!audioEnabled || !running || musicTimer !== null) return;

    const context = getAudioContext();

    if (!context) {
        console.error("Web Audio is not supported in this browser.");
        return;
    }

    const startLoop = () => {
        if (!audioEnabled || !running || musicTimer !== null) return;

        musicStep = 0;
        playMusicStep();
        musicTimer = setInterval(playMusicStep, 420);
    };

    if (context.state === "suspended") {
        context.resume().then(startLoop).catch(error => {
            console.error("Unable to start mission audio:", error);
        });
    } else {
        startLoop();
    }
}

function stopMusic() {
    if (musicTimer !== null) {
        clearInterval(musicTimer);
        musicTimer = null;
    }
}

function speak(text) {
    if (!voiceEnabled || !window.speechSynthesis ||
        !window.SpeechSynthesisUtterance) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = 1;
    utterance.pitch = 1.05;
    utterance.volume = 0.85;

    window.speechSynthesis.speak(utterance);
}

function updateAudioControls() {
    const soundButton = $("audioToggle");
    const voiceButton = $("voiceToggle");

    soundButton.textContent = audioEnabled ? "♪ SOUND ON" : "♪ SOUND OFF";
    soundButton.setAttribute("aria-pressed", String(audioEnabled));
    soundButton.classList.toggle("audio-active", audioEnabled);

    voiceButton.textContent = voiceEnabled ? "VOICE ON" : "VOICE OFF";
    voiceButton.setAttribute("aria-pressed", String(voiceEnabled));
    voiceButton.classList.toggle("audio-active", voiceEnabled);
}

function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

function updateStats() {
    $("score").textContent = score;
    $("time").textContent = time + "s";
    $("units").textContent = units;
    $("completed").textContent = completed + "/36";

    $("correct").textContent = correct;
    $("wrong").textContent = wrong;
    $("rescued").textContent = rescued;

    const percent = Math.round(completed / 36 * 100);

    $("progressBar").style.width = percent + "%";
    $("progressText").textContent = percent + "%";
}

function unlockAchievement(number) {
    if (achievements.has(number)) return;

    achievements.add(number);

    const names = [
        "First Contact",
        "Radar Expert",
        "Rescue Hero",
        "Perfect Analyst",
        "Earth Guardian",
        "Master Intelligence"
    ];

    const badge = $("badge" + number);

    badge.classList.add("unlocked");
    badge.innerHTML =
        "🏅 <b>" + names[number - 1] +
        "</b><p>Achievement unlocked!</p>";
}

function generateMission() {
    const totalFloods = settings[level].floods;

    const floodPositions = shuffle(
        Array.from({ length: 36 }, (_, i) => i)
    ).slice(0, totalFloods);

    const floodSet = new Set(floodPositions);

    cells = Array.from({ length: 36 }, (_, i) => {

        const isFlood = floodSet.has(i);

        let db = isFlood
            ? -(16 + Math.random() * 6)
            : -(5 + Math.random() * 7);

        // Some overlapping signatures make classification harder.
        if (Math.random() < 0.15) {
            db = isFlood
                ? -(10 + Math.random() * 4)
                : -(13 + Math.random() * 4);
        }

        return {
            id: i,
            flood: isFlood,
            db: Math.round(db * 10) / 10,
            answer: null,
            rescued: false
        };
    });
}

function renderGrid() {
    const grid = $("radarGrid");
    grid.innerHTML = "";

    cells.forEach(cell => {

        const button = document.createElement("button");

        const row = String.fromCharCode(
            65 + Math.floor(cell.id / 6)
        );

        const col = cell.id % 6 + 1;

        const label = row + col;

        button.className = "tile";

        if (selected === cell.id) {
            button.classList.add("selected");
        }

        if (cell.answer === "flood") {
            button.classList.add("flood");
        }

        if (cell.answer === "safe") {
            button.classList.add("safe");
        }

        button.innerHTML =
            "<span>" + label + "</span>" +
            "<span>" + (
                cell.answer === null ? "SCAN" :
                cell.rescued ? "RESCUED" :
                cell.answer.toUpperCase()
            ) + "</span>";

        button.disabled = !running || cell.answer !== null;

        button.addEventListener("click", () => {
            selectSector(cell.id);
        });

        grid.appendChild(button);
    });
}

function selectSector(id) {
    if (!running) return;

    const cell = cells[id];

    if (cell.answer !== null) return;

    selected = id;

    const row = String.fromCharCode(
        65 + Math.floor(id / 6)
    );

    const col = id % 6 + 1;

    $("sectorName").textContent = row + col;
    $("dbValue").innerHTML = cell.db.toFixed(1) + " <small>dB</small>";

    if (cell.db <= -15) {
        $("interpretation").textContent =
            "Very low backscatter: possible open-water signature.";
    } else if (cell.db <= -11) {
        $("interpretation").textContent =
            "Moderate-to-low backscatter: ambiguous signature.";
    } else {
        $("interpretation").textContent =
            "Higher backscatter: may indicate land, vegetation or rough surfaces.";
    }

    $("floodBtn").disabled = false;
    $("safeBtn").disabled = false;

    $("message").textContent =
        "Sector " + row + col + " selected. Analyse its backscatter.";

    $("rescueTarget").textContent = "Awaiting classification.";
    $("deployBtn").disabled = true;

    renderGrid();
}

function classifySector(answer) {
    if (!running || selected === null) return;

    const cell = cells[selected];
    const row = String.fromCharCode(
        65 + Math.floor(cell.id / 6)
    );
    const col = cell.id % 6 + 1;
    const sectorLabel = row + col;

    const isCorrect =
        (answer === "flood") === cell.flood;

    cell.answer = answer;

    completed++;

    if (isCorrect) {
        correct++;

        const points = answer === "flood" ? 100 : 25;

        score += points;

        unlockAchievement(1);

        $("message").textContent =
            "CORRECT! +" + points + " EIP";

        playTone(523.25, 0.14, "sine", 0.07);
        setTimeout(() => playTone(659.25, 0.2, "sine", 0.07), 110);
        speak(
            "Correct. Sector " + sectorLabel +
            " classified as " + answer + "."
        );
    } else {
        wrong++;

        score = Math.max(
            0,
            score - settings[level].penalty
        );

        $("message").textContent =
            "INCORRECT! -" +
            settings[level].penalty +
            " EIP. Review the radar signature.";

        playTone(196, 0.28, "sawtooth", 0.045);
        speak(
            "Incorrect. Sector " + sectorLabel +
            " is " + (cell.flood ? "flooded." : "safe.")
        );
    }

    if (correct >= 10) unlockAchievement(2);

    selected = null;

    $("sectorName").textContent = "NO SECTOR";
    $("dbValue").innerHTML = "-- <small>dB</small>";

    $("floodBtn").disabled = true;
    $("safeBtn").disabled = true;

    if (answer === "flood" && cell.flood) {

        target = cell.id;

        $("rescueTarget").textContent =
            "Confirmed candidate: " + row + col;

        $("deployBtn").disabled = units <= 0;

    } else {

        target = null;

        $("rescueTarget").textContent =
            "No rescue deployment available.";

        $("deployBtn").disabled = true;
    }

    updateStats();
    renderGrid();

    if (level !== "easy" &&
        wrong >= settings[level].lives) {

        finishMission(
            false,
            "Too many incorrect decisions. Mission failed."
        );

        return;
    }

    if (completed === 36) {
        finishMission(
            true,
            "All observation sectors have been classified."
        );
    }
}

function deployRescue() {
    if (!running || target === null || units <= 0) return;

    const cell = cells[target];

    if (!cell || cell.rescued) return;

    cell.rescued = true;

    units--;
    rescued++;
    score += 150;

    if (rescued >= 3) unlockAchievement(3);
    if (score >= 1500) unlockAchievement(6);

    $("rescueFeedback").textContent =
        "Rescue deployment successful! +150 EIP. " +
        units + " units remaining.";

    $("message").textContent =
        "Rescue operation successfully dispatched.";

    playTone(783.99, 0.16, "triangle", 0.07);
    setTimeout(() => playTone(987.77, 0.22, "triangle", 0.07), 120);
    speak("Rescue unit deployed successfully.");

    $("deployBtn").disabled = true;

    target = null;

    updateStats();
    renderGrid();
}

function finishMission(success, message) {
    if (!running) return;

    running = false;
    document.body.classList.remove("mission-active");

    clearInterval(timer);
    timer = null;
    stopMusic();

    if (success) {
        playTone(523.25, 0.22, "sine", 0.07);
        setTimeout(() => playTone(659.25, 0.22, "sine", 0.07), 150);
        setTimeout(() => playTone(783.99, 0.4, "sine", 0.07), 300);
        speak("Mission accomplished. All sectors have been classified.");
    } else {
        playTone(164.81, 0.55, "sawtooth", 0.05);
        speak("Mission ended. " + message);
    }

    $("startBtn").disabled = false;
    $("startBtn").textContent = "MISSION ENDED";

    $("resultTitle").textContent =
        success ? "MISSION ACCOMPLISHED" : "MISSION ENDED";

    $("finalScore").textContent = score + " EIP";

    $("resultText").textContent = message;

    $("resultStats").textContent =
        "Correct decisions: " + correct +
        " | Errors: " + wrong +
        " | Rescues: " + rescued +
        " | Classified: " + completed + "/36";

    $("results").classList.remove("hidden");

    if (success) unlockAchievement(5);
    if (wrong === 0 && success) unlockAchievement(4);
    if (score >= 1500) unlockAchievement(6);

    leaderboard.push({
        score: score,
        level: level,
        scenario: scenario
    });

    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 5);

    renderLeaderboard();
    updateStats();
}

function renderLeaderboard() {
    const board = $("leaderboard");

    if (leaderboard.length === 0) {
        board.innerHTML =
            '<p class="subtext">No completed missions yet.</p>';
        return;
    }

    board.innerHTML = leaderboard.map((item, index) => {

        return `
            <div class="leaderboard-row">
                <span>${index + 1}. ${item.level.toUpperCase()} ·
                ${item.scenario.toUpperCase()}</span>
                <b>${item.score} EIP</b>
            </div>
        `;
    }).join("");
}

function launchMission() {
    if (running) return;

    clearInterval(timer);

    level = $("difficulty").value;
    scenario = $("scenario").value;

    generateMission();

    score = 0;
    time = settings[level].time;
    units = settings[level].units;

    correct = 0;
    wrong = 0;
    rescued = 0;
    completed = 0;

    selected = null;
    target = null;

    running = true;
    document.body.classList.add("mission-active");
    startMusic();
    speak("Mission launched. Analyse all 36 sectors.");

    $("results").classList.add("hidden");

    $("startBtn").disabled = true;
    $("startBtn").textContent = "MISSION ACTIVE";

    $("brief").textContent = descriptions[scenario];

    $("message").textContent =
        "Mission launched. Analyse all 36 sectors.";

    $("rescueFeedback").textContent =
        "Rescue units available: " + units;

    $("sectorName").textContent = "NO SECTOR";
    $("dbValue").innerHTML = "-- <small>dB</small>";

    $("interpretation").textContent =
        "Select a sector to inspect its radar signature.";

    $("floodBtn").disabled = true;
    $("safeBtn").disabled = true;
    $("deployBtn").disabled = true;

    updateStats();
    renderGrid();

    timer = setInterval(() => {

        time--;

        updateStats();

        if (time <= 0) {
            finishMission(
                false,
                "Mission time expired. Some sectors remain unclassified."
            );
        }

    }, 1000);
}

function resetMission() {
    clearInterval(timer);
    timer = null;
    stopMusic();

    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    running = false;
    document.body.classList.remove("mission-active");
    selected = null;
    target = null;

    score = 0;
    time = settings[$("difficulty").value].time;
    units = settings[$("difficulty").value].units;

    correct = 0;
    wrong = 0;
    rescued = 0;
    completed = 0;

    $("radarGrid").innerHTML = "";

    $("results").classList.add("hidden");

    $("startBtn").disabled = false;
    $("startBtn").textContent = "LAUNCH MISSION →";

    $("sectorName").textContent = "NO SECTOR";
    $("dbValue").innerHTML = "-- <small>dB</small>";

    $("interpretation").textContent = "Awaiting observation...";

    $("message").textContent = "Ready for a new mission.";

    $("rescueTarget").textContent = "No rescue target selected.";

    $("rescueFeedback").textContent =
        "Correctly identify a flood sector to unlock deployment.";

    $("floodBtn").disabled = true;
    $("safeBtn").disabled = true;
    $("deployBtn").disabled = true;

    updateStats();
}

$("startBtn").addEventListener("click", launchMission);

$("floodBtn").addEventListener("click", () => {
    classifySector("flood");
});

$("safeBtn").addEventListener("click", () => {
    classifySector("safe");
});

$("deployBtn").addEventListener("click", deployRescue);

$("againBtn").addEventListener("click", resetMission);

$("audioToggle").addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    updateAudioControls();

    if (audioEnabled) {
        startMusic();
    } else {
        stopMusic();
    }
});

$("voiceToggle").addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    updateAudioControls();

    if (!voiceEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
});

$("difficulty").addEventListener("change", event => {
    const selectedLevel = event.target.value;
    time = settings[selectedLevel].time;
    $("time").textContent = time + "s";
});

$("scenario").addEventListener("change", event => {
    $("brief").textContent = descriptions[event.target.value];
});

if (!window.AudioContext && !window.webkitAudioContext) {
    $("audioToggle").disabled = true;
    $("audioToggle").title = "Web Audio is not supported in this browser.";
}

if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    $("voiceToggle").disabled = true;
    $("voiceToggle").title = "Speech is not supported in this browser.";
}

updateAudioControls();
resetMission();
renderLeaderboard();
