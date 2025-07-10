// script.js

// === CONFIG ===
const API_BASE_URL = 'https://football-proxy-f5z0.onrender.com/proxy';
const API_TOKEN = 'fd5cb7c3e0364eed9cfcaaeea699e9c3';

// === STATE ===
let leagues = [];
let teams = [];
let players = [];
let timerInterval = null;
let currentPlayerIndex = 0;
let timeLeft = 30;

// === DOM ELEMENTS ===
const leagueSelect = document.getElementById('select-league');
const warningDiv = document.getElementById('warning-message');
const startGameBtn = document.getElementById('start-game-btn');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const passTurnBtn = document.getElementById('pass-turn-btn');
const restartGameBtn = document.getElementById('restart-game-btn');

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  // Sichtbarkeit sicherstellen!
  document.getElementById('settings-screen').style.display = "block";
  document.getElementById('game-screen').style.display = "none";
  document.getElementById('end-screen').style.display = "none";
  loadLeagues();
});

// === FUNCTIONS ===
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

leagueSelect.addEventListener('change', async e => {
  const leagueId = e.target.value;
  if (!leagueId) return;

  warningDiv.textContent = 'Lade Teams...';
  warningDiv.style.display = "block";

  try {
    const res = await fetch(`${API_BASE_URL}?url=${encodeURIComponent(`https://api.football-data.org/v4/competitions/${leagueId}/teams`)}`, {
      headers: { 'X-Auth-Token': API_TOKEN }
    });

    const data = await res.json();
    teams = data.teams || [];

    // Demo-Ausgabe
    console.log(`Lade Spieler aus ${teams.length} Teams...`);
    warningDiv.textContent = `Gefundene Teams: ${teams.length}`;
    warningDiv.style.display = "block";
  } catch (err) {
    warningDiv.textContent = 'Fehler beim Laden der Teams: ' + err.message;
    warningDiv.style.display = "block";
  }
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

  currentPlayerIndex = 0;
  document.getElementById('current-player-name').textContent = "Spieler 1";
  document.getElementById('current-letter').textContent = "A";
  timeLeft = parseInt(document.getElementById('time-limit').value) || 30;
  document.getElementById('timer').textContent = timeLeft;

  startTurnTimer();
}

function startTurnTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      alert("⏱️ Zeit abgelaufen!");
      // Hier kannst du z.B. automatisch zum nächsten Spieler springen
    }
  }, 1000);
}

// Beispiel-Handler für Raten und Passen (müssen noch Logik bekommen!)
function handleSubmitGuess() {
  alert("Hier kommt später die Rate-Logik hin.");
}

function passTurn() {
  alert("Hier kommt später die Pass-Logik hin.");
}

function restartGame() {
  clearInterval(timerInterval);
  document.getElementById('settings-screen').style.display = "block";
  document.getElementById('game-screen').style.display = "none";
  document.getElementById('end-screen').style.display = "none";
  warningDiv.style.display = "none";
  loadLeagues();
}
