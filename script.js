// script.js

// === CONFIG ===
const API_BASE_URL = 'https://football-proxy-f5z0.onrender.com/proxy';
const API_TOKEN = 'fd5cb7c3e0364eed9cfcaaeea699e9c3';

// === STATE ===
let leagues = [];
let teams = [];
let players = [];

// === DOM ELEMENTS ===
const leagueSelect = document.getElementById('select-league');
const warningDiv = document.getElementById('warning-message');

// === INIT ===
document.addEventListener('DOMContentLoaded', loadLeagues);

// === FUNCTIONS ===
async function loadLeagues() {
  try {
    leagueSelect.innerHTML = '<option>Lade Ligen...</option>';

    const res = await fetch(`${API_BASE_URL}?url=${encodeURIComponent('https://api.football-data.org/v4/competitions')}`, {
  headers: { 'X-Auth-Token': API_TOKEN }
});

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    leagues = data.competitions;


    renderLeagueOptions();
  } catch (err) {
    warningDiv.textContent = 'Fehler beim Laden der Ligen: ' + err.message;
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

  try {
    const res = await fetch(`${API_BASE_URL}?url=${encodeURIComponent(`https://api.football-data.org/v4/competitions/${leagueId}/teams`)}`, {
  headers: { 'X-Auth-Token': API_TOKEN }
});

    const data = await res.json();
    teams = data.teams || [];

    // Demo-Ausgabe
    console.log(`Lade Spieler aus ${teams.length} Teams...`);
    warningDiv.textContent = `Gefundene Teams: ${teams.length}`;

    // Optional: Spieler laden
    // await loadPlayersFromTeams();

  } catch (err) {
    warningDiv.textContent = 'Fehler beim Laden der Teams: ' + err.message;
  }
  document.getElementById('start-game-btn').addEventListener('click', startGame);

function startGame() {
  // Hide settings, show game screen
  document.getElementById('settings-screen').style.display = "none";
  document.getElementById('game-screen').style.display = "block";
  document.getElementById('end-screen').style.display = "none";

  // Setze hier alle nötigen Variablen für den Spielstart
  document.getElementById('current-player-name').textContent = "Spieler 1";
  document.getElementById('current-letter').textContent = "A";
  document.getElementById('timer').textContent = "30";
  // usw. ... Du kannst die echte Logik nach Bedarf einfügen!
}

});
