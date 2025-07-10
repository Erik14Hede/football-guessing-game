// === KONFIG ===
const API_BASE_URL = 'https://football-proxy-f5z0.onrender.com/proxy';
const API_TOKEN = 'fd5cb7c3e0364eed9cfcaaeea699e9c3';

// === SPIELSTATE ===
let leagues = [];
let teams = [];
let players = [];
let guessedPlayers = [];
let scores = [];
let currentAlphabet = [];
let currentLetterIndex = 0;
let currentPlayerIndex = 0;
let timerInterval = null;
let timeLeft = 30;
let numPlayers = 2;
let errorMargin = 1; // für Levenshtein
let sameLetterMode = true; // Modus: Alle beim selben Buchstaben?

// === DOM ===
const leagueSelect = document.getElementById('select-league');
const warningDiv = document.getElementById('warning-message');
const startGameBtn = document.getElementById('start-game-btn');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const passTurnBtn = document.getElementById('pass-turn-btn');
const restartGameBtn = document.getElementById('restart-game-btn');

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settings-screen').style.display = "block";
  document.getElementById('game-screen').style.display = "none";
  document.getElementById('end-screen').style.display = "none";
  // SPIELMODUS-Auswahl einbauen (Dropdown oder Checkbox!)
  addModeSelector();
  addErrorMarginInput();
  loadLeagues();
});

// === FUNKTIONEN ===
async function loadLeagues() {
  try {
    leagueSelect.innerHTML = '<option>Lade Ligen...</option>';
    warningDiv.style.display = "none";
    const res = await fetch(`${API_BASE_URL}?url=${encodeURIComponent('https://api.football-data.org/v4/competitions')}`, {
      headers: { 'X-Auth-Token': API_TOKEN }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    leagues = data.competitions;
    renderLeagueOptions();
  } catch (err) {
    warningDiv.textContent = 'Fehler beim Laden der Ligen: ' + err.message;
    warningDiv.style.display = "block";
  }
}

function renderLeagueOptions() {
  leagueSelect.innerHTML = '<option value="">Liga wählen</option>';
  leagues.forEach(league => {
    const opt = document.createElement('option');
    opt.value = league.id;
    opt.textContent = league.name;
    leagueSelect.appendChild(opt);
  });
}

// Zusätzliche Felder für Modus und Fehler-Toleranz einbauen:
function addModeSelector() {
  if (document.getElementById('mode-selector')) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <label>
      <input type="radio" name="mode" id="mode-same" checked /> Alle raten für denselben Buchstaben
    </label>
    <label>
      <input type="radio" name="mode" id="mode-seq" /> Immer zum nächsten Buchstaben
    </label>
  `;
  div.style.margin = "1em 0";
  div.id = "mode-selector";
  document.getElementById('settings-screen').insertBefore(div, startGameBtn);
  document.getElementById('mode-same').addEventListener('change', () => sameLetterMode = true);
  document.getElementById('mode-seq').addEventListener('change', () => sameLetterMode = false);
}

function addErrorMarginInput() {
  if (document.getElementById('errormargin')) return;
  const div = document.createElement('div');
  div.innerHTML = `
    <label>
      Tippfehlertoleranz (Levenshtein, z. B. 0-3): 
      <input type="number" id="errormargin" min="0" max="5" value="1" style="width:40px" />
    </label>
  `;
  div.style.margin = "1em 0";
  document.getElementById('settings-screen').insertBefore(div, startGameBtn);
  document.getElementById('errormargin').addEventListener('change', (e) => {
    errorMargin = parseInt(e.target.value) || 0;
  });
}

leagueSelect.addEventListener('change', async e => {
  // Optional: Spieler aus der Liga laden, falls du die echte Spielerprüfung willst.
});

// ==== SPIELSTART ====
startGameBtn.addEventListener('click', startGame);
submitGuessBtn.addEventListener('click', handleSubmitGuess);
passTurnBtn.addEventListener('click', passTurn);
restartGameBtn.addEventListener('click', restartGame);

function startGame() {
  document.getElementById('settings-screen').style.display = "none";
  document.getElementById('game-screen').style.display = "block";
  document.getElementById('end-screen').style.display = "none";
  
  numPlayers = parseInt(document.getElementById('num-players').value) || 2;
  scores = Array(numPlayers).fill(0);
  guessedPlayers = [];
  errorMargin = parseInt(document.getElementById('errormargin').value) || 0;
  sameLetterMode = document.getElementById('mode-same').checked;

  // Alphabet anlegen
  const excludeQXY = document.getElementById('exclude-qxy').checked;
  currentAlphabet = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    if (excludeQXY && ["Q", "X", "Y"].includes(letter)) continue;
    currentAlphabet.push(letter);
  }
  currentLetterIndex = 0;
  currentPlayerIndex = 0;

  showCurrentStatus();
  timeLeft = parseInt(document.getElementById('time-limit').value) || 30;
  document.getElementById('timer').textContent = timeLeft;
  startTurnTimer();
}

function showCurrentStatus() {
  document.getElementById('current-player-name').textContent = "Spieler " + (currentPlayerIndex + 1);
  document.getElementById('current-letter').textContent = currentAlphabet[currentLetterIndex];
  renderGuessedPlayers();
}

function handleSubmitGuess() {
  const input = document.getElementById('player-guess-input');
  const guess = input.value.trim();
  if (!guess) {
    alert("Bitte einen Spielernamen eingeben!");
    return;
  }

  // === HIER: Optionale ECHTE Spieler-Prüfung mit Levenshtein-Distanz ===
  // Beispiel-Prüfung gegen DUMMY-SPIELERLISTE (ersetzbar durch API-Players!):
  // z.B.:
  //   players = [ { name: "Alaba" }, { name: "Bellingham" }, ...]
  //   -> Du könntest hier echte Spieler checken:
  //   const validPlayer = players.find(p => 
  //      p.name.toUpperCase().startsWith(currentAlphabet[currentLetterIndex]) &&
  //      levenshtein(p.name.toLowerCase(), guess.toLowerCase()) <= errorMargin
  //   );
  //   if (!validPlayer) { alert("Falsch!"); return; }
  // Für DEMO akzeptieren wir alles, was mit dem richtigen Buchstaben anfängt:

  if (!guess.toUpperCase().startsWith(currentAlphabet[currentLetterIndex])) {
    alert("Der Name muss mit " + currentAlphabet[currentLetterIndex] + " beginnen!");
    return;
  }

  // Überprüfen, ob Spieler schon geraten wurde
  if (guessedPlayers.some(entry => entry.guess.toLowerCase() === guess.toLowerCase())) {
    alert("Der Spieler wurde schon geraten!");
    return;
  }

  guessedPlayers.push({ player: currentPlayerIndex + 1, guess, letter: currentAlphabet[currentLetterIndex] });
  scores[currentPlayerIndex]++;
  input.value = '';
  nextTurn();
}

function passTurn() {
  guessedPlayers.push({ player: currentPlayerIndex + 1, guess: "(kein Name)", letter: currentAlphabet[currentLetterIndex] });
  nextTurn();
}

function nextTurn() {
  clearInterval(timerInterval);

  if (sameLetterMode) {
    // Nächster Spieler, selber Buchstabe
    currentPlayerIndex = (currentPlayerIndex + 1) % numPlayers;
    if (currentPlayerIndex === 0) {
      // Wenn alle für diesen Buchstaben dran waren, gehe zum nächsten Buchstaben
      currentLetterIndex++;
    }
  } else {
    // Immer zum nächsten Buchstaben UND Spieler
    currentLetterIndex++;
    currentPlayerIndex = (currentPlayerIndex + 1) % numPlayers;
  }

  if (currentLetterIndex >= currentAlphabet.length) {
    endGame();
    return;
  }

  showCurrentStatus();
  timeLeft = parseInt(document.getElementById('time-limit').value) || 30;
  document.getElementById('timer').textContent = timeLeft;
  startTurnTimer();
}

function renderGuessedPlayers() {
  const ul = document.getElementById('guessed-players-list');
  ul.innerHTML = '';
  guessedPlayers.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `(${entry.letter}) Spieler ${entry.player}: ${entry.guess}`;
    ul.appendChild(li);
  });
}

function endGame() {
  document.getElementById('game-screen').style.display = "none";
  document.getElementById('end-screen').style.display = "block";
  let maxScore = Math.max(...scores);
  let winners = [];
  scores.forEach((score, idx) => {
    if (score === maxScore) winners.push("Spieler " + (idx+1));
  });
  document.getElementById('winner-message').textContent = winners.join(' & ') + " gewinnt mit " + maxScore + " Punkten!";
}

function restartGame() {
  clearInterval(timerInterval);
  document.getElementById('settings-screen').style.display = "block";
  document.getElementById('game-screen').style.display = "none";
  document.getElementById('end-screen').style.display = "none";
  warningDiv.style.display = "none";
  loadLeagues();
  guessedPlayers = [];
}

function startTurnTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("⏱️ Zeit abgelaufen!");
      nextTurn();
    }
  }, 1000);
}

// === LEVENSHTEIN-ABSTAND ===
function levenshtein(a, b) {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[bn][an];
}
