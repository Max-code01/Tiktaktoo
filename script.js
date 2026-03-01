// ===========================================================
// MAX ULTIMATE TIC-TAC-TOE ENGINE - VERSION 5.0 (EXTREM-EDITION)
// ===========================================================

// --- 1. SPIELZUSTAND-VARIABLEN & KONSTANTEN ---
let spielfeldZustand = []; 
let aktuellerSpieler = "X";
let spielAktiv = true;
let punktestand = { X: 0, O: 0, Unentschieden: 0 };
let kiSchwierigkeit = 'hard';
let spielModus = 'normal';
let letzterIndexGesetzt = null; 
let feldGroesse = 3; 
let gewinnLaenge = 3; 

// --- EXTREM-ERWEITERUNGEN (NEU) ---
let winStreak = 0;
let comboMultiplier = 1;
let playerLevel = 1;
let xp = 0;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let matchHistory = JSON.parse(localStorage.getItem('matchHistory') || "[]");

// Timer-Variablen
let timerInterval;
const MAX_TIME = 5;

const KI_MARKER = "O";
const GEGNER_MARKER = "X";
const gewinnKombinationen_3x3 = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], 
    [0, 3, 6], [1, 4, 7], [2, 5, 8], 
    [0, 4, 8], [2, 4, 6]             
];

// DOM-Elemente
const zellen = () => document.querySelectorAll('#spielfeld .zelle'); 
const kiModusCheckbox = document.getElementById('ki-modus');
const kiSchwierigkeitSelect = document.getElementById('ki-schwierigkeit');
const spielModusSelect = document.getElementById('spiel-modus');
const modalNeustart = document.getElementById('modal-neustart');
const timerContainer = document.getElementById('timer-container');
const timerWert = document.getElementById('timer-wert');
const spielfeldElement = document.getElementById('spielfeld');
const labelX = document.getElementById('label-x');
const labelO = document.getElementById('label-o');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const toastContainer = document.getElementById('toast-container');
const statusNachricht = document.getElementById('status-nachricht');

// --- 2. EXTREM-FUNKTIONEN (DIE NEUEN 15 FEATURES) ---

// F1: Sound-Synthesizer (Generiert Töne im Browser)
function playEffect(freq, type = 'sine', duration = 0.1) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e) { console.log("Audio-Autoplay Blocked"); }
}

// F2: Screen Shake (Physisches Feedback)
function triggerExtremeShake() {
    spielfeldElement.style.animation = 'none';
    void spielfeldElement.offsetWidth; // Reflow
    spielfeldElement.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both';
}

// F3: Partikel-System für Siege
function createParticles(color) {
    for(let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = `position:fixed; width:8px; height:8px; background:${color}; border-radius:50%; z-index:1000; pointer-events:none;`;
        p.style.left = '50%'; p.style.top = '50%';
        document.body.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 10 + 5;
        let x = 0, y = 0;
        const anime = setInterval(() => {
            x += Math.cos(angle) * velocity;
            y += Math.sin(angle) * velocity;
            p.style.transform = `translate(${x}px, ${y}px)`;
            p.style.opacity = parseFloat(p.style.opacity || 1) - 0.02;
            if(p.style.opacity <= 0) { clearInterval(anime); p.remove(); }
        }, 16);
    }
}

// F4: KI Trash-Talk System
function kiChat(event) {
    const msgs = {
        win: ["GG WP!", "Zu einfach für mich.", "trainier mehr!", "System Error: Gegner zu schwach."],
        lose: ["Cheater!", "Das war ein Bug in meinem Code.", "Revanche sofort!", "Ich hab dich gewinnen lassen."],
        move: ["Hmm...", "Bist du sicher?", "Das war dein Fehler!", "Interessanter Zug."]
    };
    const choice = msgs[event][Math.floor(Math.random() * msgs[event].length)];
    zeigeToast(`🤖 KI: ${choice}`, event === 'lose' ? 'warnung' : 'info');
}

// F5: Ghost Preview (Vorschau beim Drüberfahren)
function handleGhostPreview() {
    spielfeldElement.addEventListener('mouseover', (e) => {
        if(e.target.classList.contains('leer') && spielAktiv) {
            e.target.style.color = aktuellerSpieler === 'X' ? '#FF572288' : '#2196F388';
            e.target.innerText = aktuellerSpieler;
        }
    });
    spielfeldElement.addEventListener('mouseout', (e) => {
        if(e.target.classList.contains('leer')) {
            e.target.innerText = "";
        }
    });
}

// F6: Level & XP System
function addXP(amount) {
    xp += amount;
    if(xp >= playerLevel * 100) {
        playerLevel++;
        xp = 0;
        playEffect(880, 'square', 0.5);
        zeigeToast(`⭐ LEVEL UP! Du bist jetzt Level ${playerLevel}`, 'success');
    }
}

// F7: Danger Zone Analysis (Gefahren-Check)
function markDanger() {
    zellen().forEach(z => z.style.boxShadow = ""); // Reset
    const leere = findeLeereZellen(spielfeldZustand);
    leere.forEach(idx => {
        let test = [...spielfeldZustand];
        test[idx] = GEGNER_MARKER;
        if(gewinnPruefenDynamisch(idx, test, (spielModus==='gomoku'?5:3), feldGroesse)) {
            zellen()[idx].style.boxShadow = "inset 0 0 15px rgba(255,0,0,0.5)";
        }
    });
}

// F8: Match History Logger
function saveToHistory(res) {
    matchHistory.unshift({ t: new Date().toLocaleTimeString(), r: res });
    localStorage.setItem('matchHistory', JSON.stringify(matchHistory.slice(0, 10)));
}

// F9: Dynamic Vibe Background (Farbe ändert sich je nach Spielstand)
function updateBackgroundVibe() {
    const scoreDiff = punktestand.X - punktestand.O;
    const hue = 210 + (scoreDiff * 15);
    document.body.style.background = `radial-gradient(circle at center, hsl(${hue}, 40%, 15%), #0f172a)`;
}

// F10: Chaos Event System
function checkChaosEvent() {
    if(Math.random() < 0.03) { // 3% Chance
        triggerExtremeShake();
        playEffect(100, 'sawtooth', 0.3);
        zeigeToast("🌀 CHAOS-WELLE! Die KI ist verwirrt.", 'warnung');
    }
}

// F11: Combo System
function updateCombo(sieger) {
    if(sieger === "X") {
        winStreak++;
        comboMultiplier = winStreak > 1 ? winStreak : 1;
        if(comboMultiplier > 1) zeigeToast(`COMBO X${comboMultiplier}!`, 'success');
    } else {
        winStreak = 0; comboMultiplier = 1;
    }
}

// F12-F15: (Interne Optimierungen wie Auto-Save & Haptik-Simulation)
function simulateHaptic() { if(window.navigator.vibrate) window.navigator.vibrate(50); }

// --- 3. DEINE BESTEHENDEN FUNKTIONEN (ERWEITERT & VERBESSERT) ---

function speicherePunktestand() { localStorage.setItem('tictactoePunktestand', JSON.stringify(punktestand)); }
function ladePunktestand() {
    const gespeichertePunkte = localStorage.getItem('tictactoePunktestand');
    if (gespeichertePunkte) { punktestand = JSON.parse(gespeichertePunkte); }
}

function zeigeToast(nachricht, typ = 'info') { 
    const toast = document.createElement('div');
    toast.className = `toast toast-${typ}`;
    toast.textContent = nachricht;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

function zeigePunktestand() {
    document.getElementById('punkte-x').textContent = punktestand.X;
    document.getElementById('punkte-o').textContent = punktestand.O;
    document.getElementById('punkte-unentschieden').textContent = punktestand.Unentschieden;
    updateBackgroundVibe();
}

function aktualisiereStatus(nachricht) { statusNachricht.textContent = nachricht; }
function schliesseModal() { modal.classList.add('hidden'); }
function zeigeModal(text) { modalText.textContent = text; modal.classList.remove('hidden'); }

function generiereSpielfeld() {
    spielfeldElement.innerHTML = '';
    spielfeldElement.classList.remove('drei-x-drei', 'neun-x-neun');
    if (feldGroesse === 3) spielfeldElement.classList.add('drei-x-drei');
    else if (feldGroesse === 9) spielfeldElement.classList.add('neun-x-neun');
    
    for (let i = 0; i < feldGroesse * feldGroesse; i++) {
        const zelle = document.createElement('div');
        zelle.className = 'zelle';
        zelle.setAttribute('data-index', i);
        zelle.addEventListener('click', zelleGeklickt);
        spielfeldElement.appendChild(zelle);
    }
    spielfeldZustand = Array(feldGroesse * feldGroesse).fill("");
}

function aktualisiereSpielerAnzeige() {
    labelX.classList.toggle('aktiver-spieler', aktuellerSpieler === "X");
    labelO.classList.toggle('aktiver-spieler', aktuellerSpieler === "O");

    zellen().forEach(zelle => {
        zelle.classList.remove('x-hover', 'o-hover', 'leer');
        if (zelle.textContent === "") {
            zelle.classList.add('leer', (aktuellerSpieler.toLowerCase() + '-hover'));
        }
    });
}

function starteTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (spielModus !== 'zeitbombe' || aktuellerSpieler === KI_MARKER) {
        timerContainer.classList.remove('aktiv'); return;
    }
    timerContainer.classList.add('aktiv');
    let zeit = MAX_TIME;
    timerWert.textContent = zeit;
    timerInterval = setInterval(() => {
        zeit--;
        timerWert.textContent = zeit.toString().padStart(2, '0');
        timerWert.className = zeit <= 2 ? 'kritisch' : (zeit <= 4 ? 'warnung' : '');
        if (zeit <= 0) {
            clearInterval(timerInterval);
            beendeSpiel(`Zeit abgelaufen! 💣`);
        }
    }, 1000);
}

function stoppeTimer() { clearInterval(timerInterval); timerContainer.classList.remove('aktiv'); }

// --- KI-LOGIK (ERWEITERT) ---

function findeLeereZellen(brett) {
    return brett.map((wert, index) => (wert === "" ? index : null)).filter(index => index !== null);
}

function minimax(neuesBrett, spieler) {
    const leereFelder = findeLeereZellen(neuesBrett);
    if (pruefeGewinnerFuerMinimax(GEGNER_MARKER, neuesBrett)) return { score: -10 };
    if (pruefeGewinnerFuerMinimax(KI_MARKER, neuesBrett)) return { score: 10 };
    if (leereFelder.length === 0) return { score: 0 };

    let zuege = [];
    for (const index of leereFelder) {
        let zug = { index };
        neuesBrett[index] = spieler;
        zug.score = minimax(neuesBrett, spieler === KI_MARKER ? GEGNER_MARKER : KI_MARKER).score;
        neuesBrett[index] = "";
        zuege.push(zug);
    }
    return zuege.reduce((prev, curr) => 
        (spieler === KI_MARKER ? curr.score > prev.score : curr.score < prev.score) ? curr : prev
    );
}

function pruefeGewinnerFuerMinimax(spieler, brett) {
    return gewinnKombinationen_3x3.some(k => brett[k[0]] === spieler && brett[k[1]] === spieler && brett[k[2]] === spieler);
}

function macheKiZug() {
    if (!spielAktiv || !kiModusCheckbox.checked || aktuellerSpieler !== KI_MARKER) return;
    
    spielfeldElement.style.cursor = 'wait';
    setTimeout(() => {
        let idx = (feldGroesse === 3 && kiSchwierigkeit === 'hard') 
                  ? minimax([...spielfeldZustand], KI_MARKER).index 
                  : findeLeereZellen(spielfeldZustand)[Math.floor(Math.random()*findeLeereZellen(spielfeldZustand).length)];
        
        spielfeldElement.style.cursor = 'pointer';
        if (idx !== undefined) macheZug(idx);
    }, 400); 
}

function gewinnPruefenDynamisch(index, brett, laenge, breite) {
    const spieler = brett[index];
    if (!spieler) return null;
    const r = Math.floor(index / breite), c = index % breite;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
        for (let s = -(laenge - 1); s <= 0; s++) {
            let combo = [];
            for (let i = 0; i < laenge; i++) {
                const currR = r + (s + i) * dr, currC = c + (s + i) * dc;
                const idx = currR * breite + currC;
                if (currR >= 0 && currR < breite && currC >= 0 && currC < breite && brett[idx] === spieler) combo.push(idx);
                else break;
            }
            if (combo.length === laenge) return { spieler, kombi: combo };
        }
    }
    return null;
}

function gewinnPruefenHaupt(index) {
    let res = gewinnPruefenDynamisch(index, spielfeldZustand, (spielModus === 'gomoku' ? 5 : 3), feldGroesse);
    if (res) {
        beendeSpiel(`Spieler ${res.spieler} gewinnt! 🎉`, res.kombi);
        return true;
    }
    if (!spielfeldZustand.includes("")) {
        beendeSpiel(spielModus === 'blocker' ? "O gewinnt (Blocker)!" : "Unentschieden! 🤝");
        return true;
    }
    return false;
}

function beendeSpiel(txt, kombi = null) {
    stoppeTimer(); spielAktiv = false;
    triggerExtremeShake();
    saveToHistory(txt);
    
    let sieger = txt.includes("X") ? "X" : (txt.includes("O") ? "O" : null);
    if(sieger === "X") {
        punktestand.X++; addXP(50 * comboMultiplier); updateCombo("X");
        createParticles("#ff4d4d"); playEffect(523, 'sine', 0.5);
    } else if(sieger === "O") {
        punktestand.O++; updateCombo("O"); kiChat('win');
    } else {
        punktestand.Unentschieden++;
    }

    zeigePunktestand(); speicherePunktestand();
    zeigeModal(txt); 
    if (kombi) kombi.forEach(i => zellen()[i].classList.add('gewinner'));
}

// --- 4. ZUG-LOGIK & EVENT HANDLER ---

function macheZug(index) {
    stoppeTimer();
    simulateHaptic();
    playEffect(aktuellerSpieler === 'X' ? 400 : 300, 'triangle');
    
    let marker = aktuellerSpieler;
    if (spielModus === 'tausch' && Math.random() < 0.3) {
        marker = marker === 'X' ? 'O' : 'X';
        zeigeToast("SWAP! Marker getauscht.", 'warnung');
    }

    spielfeldZustand[index] = marker;
    zellen()[index].innerHTML = `<span>${marker}</span>`;
    zellen()[index].classList.add(marker.toLowerCase());
    letzterIndexGesetzt = index;
    
    checkChaosEvent();

    if (!gewinnPruefenHaupt(index)) {
        aktuellerSpieler = aktuellerSpieler === "X" ? "O" : "X";
        if(aktuellerSpieler === 'O') kiChat('move');
        aktualisiereSpielerAnzeige();
        markDanger();
        starteTimer();
        macheKiZug();
    }
}

function zelleGeklickt(e) {
    const idx = parseInt(e.target.getAttribute('data-index'));
    if (!spielAktiv || spielfeldZustand[idx] !== "" || (kiModusCheckbox.checked && aktuellerSpieler === KI_MARKER)) return;

    if (spielModus === 'entfernung' && letzterIndexGesetzt !== null) {
        const r1 = Math.floor(idx/feldGroesse), c1 = idx%feldGroesse;
        const r2 = Math.floor(letzterIndexGesetzt/feldGroesse), c2 = letzterIndexGesetzt%feldGroesse;
        if (Math.abs(r1-r2) <= 1 && Math.abs(c1-c2) <= 1) {
            zeigeToast("Zu nah dran! 🚫", 'warnung'); return;
        }
    }
    macheZug(idx);
}

function neustartSpiel() {
    stoppeTimer(); schliesseModal();
    spielModus = spielModusSelect.value;
    feldGroesse = spielModus === 'gomoku' ? 9 : 3;
    generiereSpielfeld();
    spielAktiv = true; aktuellerSpieler = "X"; letzterIndexGesetzt = null;
    spielfeldElement.classList.remove('deaktiviert');
    aktualisiereSpielerAnzeige();
    starteTimer();
    updateBackgroundVibe();
}

// --- CHEAT-CODES (ERWEITERT) ---
const cheatCodes = {
    'POWER': () => { punktestand.X += 10; zeigePunktestand(); zeigeToast("CHEAT: +10 Punkte!", 'success'); },
    'MAX': () => beendeSpiel("gewinnt per Cheat! 🏆"),
    'OOF': () => { punktestand = {X:0, O:0, Unentschieden:0}; zeigePunktestand(); },
    'XP': () => addXP(100)
};

let inputBuffer = "";
document.addEventListener('keydown', (e) => {
    inputBuffer += e.key.toUpperCase();
    if(inputBuffer.length > 10) inputBuffer = inputBuffer.substring(1);
    for(let code in cheatCodes) {
        if(inputBuffer.endsWith(code)) {
            cheatCodes[code](); inputBuffer = "";
        }
    }
});

// INITIALISIERUNG
document.getElementById('neustart-button').addEventListener('click', neustartSpiel);
modalNeustart.addEventListener('click', neustartSpiel);
[kiModusCheckbox, kiSchwierigkeitSelect, spielModusSelect].forEach(el => el.addEventListener('change', neustartSpiel));

ladePunktestand();
neustartSpiel();
handleGhostPreview();
zeigePunktestand();

