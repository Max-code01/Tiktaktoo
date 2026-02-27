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

// Timer-Variablen für Modus "Zeitbombe"
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

// --- CHEAT-CODE LOGIK (für mehrere Codes) ---
const cheatCodes = {
    // Sequenz: [POWER], Effekt: +10 Punkte
    'P': { code: 'POWER', index: 1, action: () => {
        if (aktuellerSpieler === "X") punktestand.X += 10; else punktestand.O += 10;
        zeigePunktestand();
        speicherePunktestand();
        zeigeToast(`CHEAT AKTIVIERT: ${aktuellerSpieler} hat 10 Punkte erhalten! ✨`, 'success');
    }},
    // Sequenz: [MAX], Effekt: Sofortiger Sieg
    'M': { code: 'MAX', index: 1, action: () => {
        beendeSpiel(`Spieler ${aktuellerSpieler} gewinnt per Cheat! 🏆`);
    }},
    // Sequenz: [OOF], Effekt: Punktestand zurücksetzen
    'O': { code: 'OOF', index: 1, action: () => {
        punktestand = { X: 0, O: 0, Unentschieden: 0 };
        zeigePunktestand();
        speicherePunktestand();
        zeigeToast("CHEAT AKTIVIERT: Punktestände zurückgesetzt! 👻", 'info');
    }},
    // Sequenz: [SWAP], Effekt: Spieler wechseln
    'S': { code: 'SWAP', index: 1, action: () => {
        aktuellerSpieler = aktuellerSpieler === GEGNER_MARKER ? KI_MARKER : GEGNER_MARKER;
        aktualisiereSpielerAnzeige();
        aktualisiereStatus(`Spieler ${aktuellerSpieler} ist am Zug (per Cheat)`);
        starteTimer(); 
        macheKiZug(); 
        zeigeToast(`CHEAT AKTIVIERT: Spieler zu ${aktuellerSpieler} gewechselt! 🔄`, 'info');
    }}
};
let aktuelleCheatKeys = {}; // Speichert den aktuellen Status für jeden Code


// --- 2. HILFS- & UX-FUNKTIONEN ---

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
}
function aktualisiereStatus(nachricht) { statusNachricht.textContent = nachricht; }
function schliesseModal() { modal.classList.add('hidden'); }
function zeigeModal(text) { modalText.textContent = text; modal.classList.remove('hidden'); }

// --- DYNAMISCHE FELDGENERIERUNG & ANZEIGE ---

function generiereSpielfeld() {
    spielfeldElement.innerHTML = '';
    
    // Setze CSS Klasse für Feldgröße
    spielfeldElement.classList.remove('drei-x-drei', 'neun-x-neun');
    if (feldGroesse === 3) {
        spielfeldElement.classList.add('drei-x-drei');
    } else if (feldGroesse === 9) {
        spielfeldElement.classList.add('neun-x-neun');
    }
    
    // Generiere die Zellen
    for (let i = 0; i < feldGroesse * feldGroesse; i++) {
        const zelle = document.createElement('div');
        zelle.className = 'zelle';
        zelle.setAttribute('data-index', i);
        zelle.addEventListener('click', zelleGeklickt);
        spielfeldElement.appendChild(zelle);
    }
    
    // Setze den initialen Zustand
    spielfeldZustand = Array(feldGroesse * feldGroesse).fill("");
}

function aktualisiereSpielerAnzeige() {
    labelX.classList.remove('aktiver-spieler');
    labelO.classList.remove('aktiver-spieler');

    if (aktuellerSpieler === "X") {
        labelX.classList.add('aktiver-spieler');
    } else {
        labelO.classList.add('aktiver-spieler');
    }
    
    zellen().forEach(zelle => {
        zelle.classList.remove('x-hover', 'o-hover', 'leer');
        if (zelle.textContent === "") {
            zelle.classList.add('leer');
            zelle.classList.add(aktuellerSpieler.toLowerCase() + '-hover');
        }
    });
}

// --- TIMER LOGIK FÜR ZEITBOMBE ---
function starteTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (spielModus !== 'zeitbombe' || aktuellerSpieler === KI_MARKER) {
        timerContainer.classList.remove('aktiv');
        return;
    }
    
    timerContainer.classList.add('aktiv');
    timerWert.textContent = MAX_TIME;
    timerWert.className = '';

    let zeit = MAX_TIME;
    timerInterval = setInterval(() => {
        zeit--;
        timerWert.textContent = zeit.toString().padStart(2, '0');

        if (zeit <= 2) { timerWert.classList.add('kritisch'); } 
        else if (zeit <= 4) { timerWert.classList.add('warnung'); }

        if (zeit <= 0) {
            clearInterval(timerInterval);
            beendeSpiel(`Spieler ${aktuellerSpieler} hat die Zeit überschritten! Gegner gewinnt. 💣`);
        }
    }, 1000);
}

function stoppeTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerContainer.classList.remove('aktiv');
}


// --- 3. KI- & GEWINNLOGIK ---

function findeLeereZellen(brett) {
    return brett.map((wert, index) => (wert === "" ? index : null)).filter(index => index !== null);
}

// Minimax-Algorithmus (NUR FÜR 3x3)
function pruefeGewinnerFuerMinimax(spieler, brett) {
    return gewinnKombinationen_3x3.some(kombi => {
        const [a, b, c] = kombi;
        return brett[a] === spieler && brett[b] === spieler && brett[c] === spieler;
    });
}

function minimax(neuesBrett, spieler) {
    const leereFelder = findeLeereZellen(neuesBrett);

    if (pruefeGewinnerFuerMinimax(GEGNER_MARKER, neuesBrett)) { return { score: -10 }; }
    if (pruefeGewinnerFuerMinimax(KI_MARKER, neuesBrett)) { return { score: 10 }; }
    if (leereFelder.length === 0) { return { score: 0 }; }

    let zuege = [];

    for (const index of leereFelder) {
        let zug = { index: index };
        neuesBrett[index] = spieler;

        let ergebnis = minimax(neuesBrett, spieler === KI_MARKER ? GEGNER_MARKER : KI_MARKER);
        zug.score = ergebnis.score;

        neuesBrett[index] = "";
        zuege.push(zug);
    }

    let besterZug;
    let besterScore = spieler === KI_MARKER ? -Infinity : Infinity;

    for (let i = 0; i < zuege.length; i++) {
        if (spieler === KI_MARKER) {
            if (zuege[i].score > besterScore) {
                besterScore = zuege[i].score;
                besterZug = i;
            }
        } else {
            if (zuege[i].score < besterScore) {
                besterScore = zuege[i].score;
                besterZug = i;
            }
        }
    }

    return zuege[besterZug];
}

function macheEasyZug() {
    const leereFelder = findeLeereZellen(spielfeldZustand);
    if (leereFelder.length === 0) return -1;
    return leereFelder[Math.floor(Math.random() * leereFelder.length)];
}

function macheKiZug() {
    if (!spielAktiv || !kiModusCheckbox.checked || aktuellerSpieler !== KI_MARKER) {
        return;
    }
    
    if (feldGroesse !== 3 && kiSchwierigkeit === 'hard') {
        kiSchwierigkeit = 'easy';
        kiSchwierigkeitSelect.value = 'easy';
        zeigeToast("Minimax KI ist nur in 3x3 verfügbar. Auf Einfach umgestellt.", 'warnung');
    }

    spielfeldElement.style.cursor = 'wait';
    
    setTimeout(() => {
        let besterIndex = -1;

        if (kiSchwierigkeit === 'hard') {
            const besterZugObjekt = minimax([...spielfeldZustand], KI_MARKER);
            besterIndex = besterZugObjekt.index;
        } else {
            besterIndex = macheEasyZug();
        }
        
        spielfeldElement.style.cursor = 'pointer';

        if (besterIndex !== -1 && besterIndex !== undefined) {
            macheZug(besterIndex);
        }
    }, 300); 
}

// -----------------------------------------------------------
// GEWINNPRÜFUNG FÜR N x N FELDER (DYNAMISCH)
// -----------------------------------------------------------
function gewinnPruefenDynamisch(index, brett, laenge, breite) {
    const spieler = brett[index];
    if (!spieler) return null;

    const reihe = Math.floor(index / breite);
    const spalte = index % breite;
    
    const richtungen = [ [0, 1], [1, 0], [1, 1], [1, -1] ];

    for (const [dr, dc] of richtungen) {
        for (let startOffset = -(laenge - 1); startOffset <= 0; startOffset++) {
            let zaehler = 0;
            let gewinnKombi = [];

            for (let i = 0; i < laenge; i++) {
                const r = reihe + (startOffset + i) * dr;
                const c = spalte + (startOffset + i) * dc;
                const neuerIndex = r * breite + c;

                if (r >= 0 && r < breite && c >= 0 && c < breite && brett[neuerIndex] === spieler) {
                    zaehler++;
                    gewinnKombi.push(neuerIndex);
                } else {
                    gewinnKombi = [];
                    break; 
                }
            }

            if (zaehler === laenge) {
                return { spieler: spieler, kombi: gewinnKombi };
            }
        }
    }
    return null;
}

function gewinnPruefenHaupt(index) {
    let gewinnLaengeAktuell = (spielModus === 'gomoku') ? 5 : 3;
    
    let ergebnis = gewinnPruefenDynamisch(index, spielfeldZustand, gewinnLaengeAktuell, feldGroesse);
    
    if (ergebnis) {
        const siegText = spielModus === 'misere' ? `Spieler ${ergebnis.spieler} hat gewonnen` : `Spieler ${ergebnis.spieler} hat gewonnen! 🎉`;
        beendeSpiel(siegText, ergebnis.kombi);
        return true;
    }

    // Unentschieden prüfen
    if (!spielfeldZustand.includes("")) {
        if (spielModus === 'blocker') {
            beendeSpiel("Blocker-Sieg"); 
        } else {
            beendeSpiel("Unentschieden! 🤝");
        }
        return true;
    }
    
    return false;
}

function beendeSpiel(ergebnisText, gewinnKombi = null) {
    stoppeTimer();
    spielAktiv = false;
    spielfeldElement.classList.add('deaktiviert');
    
    let sieger = null;
    let verlierer = null;

    // Normale Gewinnprüfung (X gewinnt, O gewinnt)
    if (ergebnisText.includes("X hat gewonnen") || ergebnisText.includes("X gewinnt!")) {
        sieger = "X"; verlierer = "O";
    } else if (ergebnisText.includes("O hat gewonnen") || ergebnisText.includes("O gewinnt!")) {
        sieger = "O"; verlierer = "X";
    } 
    // Spezielle Modus-Regeln
    else if (spielModus === 'misere' && ergebnisText.includes("gewonnen")) {
        sieger = (aktuellerSpieler === "X") ? "O" : "X"; 
        verlierer = aktuellerSpieler;
        ergebnisText = `Spieler ${verlierer} hat verloren! Spieler ${sieger} gewinnt! 🥳`;
    } 
    else if (spielModus === 'blocker' && ergebnisText === "Blocker-Sieg") {
        sieger = "O"; verlierer = "X";
        ergebnisText = "Spieler O (Blocker) hat gewonnen, da das Feld voll ist! 🛡️";
    }
    else if (spielModus === 'zeitbombe' && ergebnisText.includes("überschritten")) {
        verlierer = aktuellerSpieler;
        sieger = (aktuellerSpieler === "X") ? "O" : "X";
    }
    else if (ergebnisText.includes("Cheat")) {
        sieger = aktuellerSpieler;
    }

    if (sieger) {
        if (sieger === "X") punktestand.X++; else punktestand.O++;
    } else {
        punktestand.Unentschieden++;
    }
    
    zeigePunktestand();
    speicherePunktestand();
    zeigeModal(ergebnisText); 

    if (gewinnKombi) {
        gewinnKombi.forEach(index => {
            zellen()[index].classList.add('gewinner');
        });
    }
}


// --- 4. ZENTRALE ZUG-FUNKTION ---

function istAngrenzend(index1, index2) {
    const breite = feldGroesse;
    const r1 = Math.floor(index1 / breite);
    const c1 = index1 % breite;
    const r2 = Math.floor(index2 / breite);
    const c2 = index2 % breite;
    return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}

function macheZug(index) {
    stoppeTimer();
    
    let markerZuSetzenn = aktuellerSpieler;

    // Modus: Tausch (Nur 3x3)
    if (spielModus === 'tausch' && feldGroesse === 3 && Math.random() < 0.5) {
        markerZuSetzenn = aktuellerSpieler === GEGNER_MARKER ? KI_MARKER : GEGNER_MARKER;
        zeigeToast(`Achtung: Marker wurde zu ${markerZuSetzenn} getauscht!`, 'info');
    }

    // Zug ausführen
    spielfeldZustand[index] = markerZuSetzenn;
    zellen()[index].innerHTML = `<span>${markerZuSetzenn}</span>`;
    zellen()[index].classList.add(markerZuSetzenn.toLowerCase());

    // Speichern des letzten Index für Entfernungs-Modus
    letzterIndexGesetzt = index;
    
    if (gewinnPruefenHaupt(index)) {
        return;
    }

    // Spieler wechseln
    aktuellerSpieler = aktuellerSpieler === GEGNER_MARKER ? KI_MARKER : GEGNER_MARKER;
    aktualisiereSpielerAnzeige();
    aktualisiereStatus(`Spieler ${aktuellerSpieler} ist am Zug`);
    
    // Timer und KI starten
    starteTimer();
    macheKiZug();
}


// --- 5. EVENT HANDLER ---

function zelleGeklickt(event) {
    const geklickteZelle = event.target;
    const geklickterIndex = parseInt(geklickteZelle.getAttribute('data-index'));

    // 1. Guard-Checks
    if (!spielAktiv || spielfeldZustand[geklickterIndex] !== "" || (kiModusCheckbox.checked && aktuellerSpieler === KI_MARKER)) {
        return; 
    }

    // 2. Modus: Entfernungs-Check (Nur 3x3)
    if (spielModus === 'entfernung' && feldGroesse === 3 && letzterIndexGesetzt !== null) {
        const istZugErlaubt = findeLeereZellen(spielfeldZustand).some(i => !istAngrenzend(i, letzterIndexGesetzt));

        if (istZugErlaubt && istAngrenzend(geklickterIndex, letzterIndexGesetzt)) {
            zeigeToast("Du musst weiter entfernt setzen (keine angrenzende Zelle)! 🚫", 'info');
            return; 
        }
    }
    
    // 3. Zug machen
    macheZug(geklickterIndex);
}

function setzeModusKonfiguration(modus) {
    if (modus === 'gomoku') {
        feldGroesse = 9;
        gewinnLaenge = 5;
    } else {
        feldGroesse = 3;
        gewinnLaenge = 3;
    }
}

function neustartSpiel() {
    stoppeTimer();
    schliesseModal();
    
    spielModus = spielModusSelect.value;
    setzeModusKonfiguration(spielModus);
    generiereSpielfeld(); 

    spielAktiv = true;
    aktuellerSpieler = "X"; 
    letzterIndexGesetzt = null;
    
    // Setze alle Cheat-Sequenzen zurück
    Object.keys(cheatCodes).forEach(startKey => {
        aktuelleCheatKeys[startKey] = null;
    });

    spielfeldElement.classList.remove('deaktiviert');

    aktualisiereSpielerAnzeige();
    aktualisiereStatus(`Spieler X ist am Zug`);
    starteTimer();
}


// --- 6. EVENT LISTENER & INITIALISIERUNG ---

document.getElementById('neustart-button').addEventListener('click', neustartSpiel);
modalNeustart.addEventListener('click', neustartSpiel);
kiModusCheckbox.addEventListener('change', neustartSpiel); 
kiSchwierigkeitSelect.addEventListener('change', neustartSpiel);
spielModusSelect.addEventListener('change', neustartSpiel);


// NEUER CHEAT CODE LISTENER
Object.keys(cheatCodes).forEach(startKey => {
    aktuelleCheatKeys[startKey] = null; // Initialisiere alle auf null
});

document.addEventListener('keydown', (e) => {
    const gedrueckterKey = e.key.toUpperCase();
    let istErfolgreich = false;

    for (const startKey in cheatCodes) {
        let codeData = cheatCodes[startKey];
        let code = codeData.code;
        
        // Starte eine neue Sequenz (wenn der erste Buchstabe gedrückt wird)
        if (gedrueckterKey === code[0] && aktuelleCheatKeys[startKey] === null) {
             aktuelleCheatKeys[startKey] = gedrueckterKey;
        }

        // Setze die Sequenz fort
        if (aktuelleCheatKeys[startKey] && gedrueckterKey === code[aktuelleCheatKeys[startKey].length]) {
            aktuelleCheatKeys[startKey] += gedrueckterKey;
            
            // Prüfe, ob die Sequenz komplett ist
            if (aktuelleCheatKeys[startKey] === code) {
                codeData.action(); 
                istErfolgreich = true;
            }
        } else if (aktuelleCheatKeys[startKey] && gedrueckterKey !== code[aktuelleCheatKeys[startKey].length]) {
            // Falsche Taste gedrückt, Sequenz zurücksetzen, es sei denn es ist der Startbuchstabe eines anderen Codes.
            aktuelleCheatKeys[startKey] = null;
        }
    }

    if (istErfolgreich) {
        // Alle Sequenzen nach erfolgreicher Eingabe zurücksetzen
        Object.keys(cheatCodes).forEach(startKey => {
            aktuelleCheatKeys[startKey] = null; 
        });
    }
});


// Initialisierung beim Laden der Seite
ladePunktestand();
kiSchwierigkeit = kiSchwierigkeitSelect.value;
spielModus = spielModusSelect.value;
neustartSpiel(); 
zeigePunktestand();