// ===== Alphabet Fußball-Quiz mit TheSportsDB =====
const API = "https://www.thesportsdb.com/api/v1/json/1/";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let allPlayers = [];
let usedPlayers = [];
let guessedLetters = [];
let availableLetters = [];
let scores = [];
let currentPlayer = 0;
let currentLetterIndex = 0;
let numPlayers = 2;
let posFilters = [];
let requireFullName = false;
let errorMargin = 1;
let modeSameLetter = true;
let gameActive = false;
let playerNames = [];
let positionsMap = {
  Goalkeeper: ['Goalkeeper', 'Keeper', 'GK'],
  Defender: ['Defender', 'CB', 'LB', 'RB', 'DF'],
  Midfielder: ['Midfielder', 'CM', 'LM', 'RM', 'CDM', 'CAM', 'MF'],
  Forward: ['Forward', 'Attacker', 'ST', 'CF', 'LW', 'RW', 'FW']
};

const $ = id => document.getElementById(id);

const screens = {
  settings: $("settings-screen"),
  game: $("game-screen"),
  end: $("end-screen")
};
const modal = $("modal");

window.onload = () => {
  fetchLeagues();
  $("start-btn").onclick = startGame;
  $("submit-btn").onclick = checkGuess;
  $("pass-btn").onclick = passTurn;
  $("restart-btn").onclick = restartGame;
};

function switchScreen(screen) {
  Object.values(screens).forEach(d => d.style.display = "none");
  screens[screen].style.display = "block";
  closeModal();
}

// === SETTINGS ===
async function fetchLeagues() {
  $("league-select").innerHTML = '<option>Lade Ligen...</option>';
  const res = await fetch(API + "all_leagues.php");
  const data = await res.json();
  // Nur populäre Fußballligen (nur soccer, nicht eSports usw.)
  const filtered = data.leagues.filter(l => l.strSport === "Soccer" && l.idLeague && l.strLeague);
  filtered.sort((a, b) => a.strLeague.localeCompare(b.strLeague));
  $("league-select").innerHTML = filtered.map(l =>
    `<option value="${l.idLeague}">${l.strLeague}</option>`
  ).join("");
}

function showModal(html, time=0) {
  modal.innerHTML = `<div class="box">${html}</div>`;
  modal.style.display = "flex";
  if (time) setTimeout(closeModal, time);
}
function closeModal() {
  modal.style.display = "none";
}

function getCheckedPositions() {
  return Array.from(document.querySelectorAll(".pos-filter:checked")).map(cb => cb.value);
}

$("mode-same-letter").onchange = e => {
  modeSameLetter = e.target.checked;
};

$("full-name-required").onchange = e => {
  requireFullName = e.target.checked;
};

$("error-margin").oninput = e => {
  errorMargin = Number(e.target.value);
};

document.querySelectorAll(".pos-filter").forEach(cb => {
  cb.onchange = () => posFilters = getCheckedPositions();
});

function setupPlayers() {
  numPlayers = Math.max(2, Math.min(10, Number($("num-players").value)));
  playerNames = [];
  for(let i=1;i<=numPlayers;i++) playerNames.push("Spieler " + i);
  scores = Array(numPlayers).fill(0);
}

// === SPIELSTART ===
async function startGame() {
  setupPlayers();
  $("settings-warning").textContent = "";

  const leagueId = $("league-select").value;
  if (!leagueId) {
    $("settings-warning").textContent = "Bitte wähle eine Liga.";
    return;
  }

  posFilters = getCheckedPositions();
  requireFullName = $("full-name-required").checked;
  modeSameLetter = $("mode-same-letter").checked;
  errorMargin = Number($("error-margin").value);

  showModal("Lade Spieler, bitte warten...");
  allPlayers = [];
  usedPlayers = [];
  guessedLetters = [];
  availableLetters = [];
  currentPlayer = 0;
  currentLetterIndex = 0;
  gameActive = false;

  // Lade alle Teams der Liga
  const teams = await fetchTeams(leagueId);
  if (!teams.length) {
    closeModal();
    $("settings-warning").textContent = "Keine Teams in dieser Liga gefunden!";
    return;
  }

  // Lade alle Spieler für alle Teams
  for (let team of teams) {
    const teamPlayers = await fetchPlayers(team.idTeam);
    allPlayers.push(...teamPlayers.map(p => ({...p, strTeam: team.strTeam})));
  }
  // Entferne Spieler ohne Namen oder Position
  allPlayers = allPlayers.filter(p => p.strPlayer && p.strPosition);

  // Positionsfilter anwenden
  if (posFilters.length) {
    allPlayers = allPlayers.filter(p =>
      posFilters.some(f => positionsMap[f]?.includes(p.strPosition) || p.strPosition.includes(f))
    );
  }

  if (!allPlayers.length) {
    closeModal();
    $("settings-warning").textContent = "Keine passenden Spieler in dieser Liga gefunden!";
    return;
  }

  // Verfügbare Buchstaben bestimmen
  availableLetters = alphabet.filter(letter =>
    allPlayers.some(p => getNamePart(p).toUpperCase().startsWith(letter))
  );

  if (!availableLetters.length) {
    closeModal();
    $("settings-warning").textContent = "Kein Spieler für einen Buchstaben gefunden.";
    return;
  }

  closeModal();
  switchScreen("game");
  gameActive = true;
  currentPlayer = 0;
  currentLetterIndex = 0;
  guessedLetters = [];
  updateUI();
}

async function fetchTeams(leagueId) {
  const res = await fetch(API + `lookup_all_teams.php?id=${leagueId}`);
  const data = await res.json();
  return (data.teams || []);
}
async function fetchPlayers(teamId) {
  const res = await fetch(API + `lookup_all_players.php?id=${teamId}`);
  const data = await res.json();
  return (data.player || []);
}

function getNamePart(p) {
  if (requireFullName) return (p.strPlayer || "");
  // Nur Nachname
  const parts = (p.strPlayer || "").split(" ");
  return parts.length ? parts[parts.length - 1] : p.strPlayer;
}

// === SPIEL-UI ===
function updateUI() {
  if (!gameActive) return;
  $("player-turn").textContent = playerNames[currentPlayer];
  $("current-letter").textContent = availableLetters[currentLetterIndex];
  $("guess-input").value = "";
  $("last-guess").innerHTML = "";
  renderScoreboard();
  renderAlphabet();
}
function renderScoreboard() {
  $("scoreboard").innerHTML = scores.map((s, i) =>
    `${playerNames[i]}: <b>${s}</b>`
  ).join(" &nbsp; ");
}
function renderAlphabet() {
  $("alphabet-row").innerHTML = availableLetters.map((l, i) => {
    let cls = "";
    if (guessedLetters.includes(l)) cls = "done";
    else if (i === currentLetterIndex) cls = "current";
    return `<span class="${cls}">${l}</span>`;
  }).join("");
}

// === RATEN ===
function checkGuess() {
  if (!gameActive) return;
  const guess = $("guess-input").value.trim();
  if (!guess) {
    showModal("Bitte gib einen Namen ein.", 1200);
    return;
  }
  const letter = availableLetters[currentLetterIndex];
  // Finde Spieler, die noch nicht geraten wurden und mit Buchstaben starten
  let candidates = allPlayers.filter(p =>
    getNamePart(p).toUpperCase().startsWith(letter)
      && !usedPlayers.includes(p.idPlayer)
  );
  let match = null;
  for (let p of candidates) {
    if (levenshtein(getNamePart(p).toLowerCase(), guess.toLowerCase()) <= errorMargin) {
      match = p;
      break;
    }
  }
  if (match) {
    usedPlayers.push(match.idPlayer);
    guessedLetters.push(letter);
    scores[currentPlayer]++;
    showModal(`✅ Richtig: ${match.strPlayer} <br><small>(${match.strTeam || ''}, ${match.strPosition})</small>`, 1400);
    setTimeout(nextTurn, 1500);
  } else {
    showModal("❌ Falsch. Versuche es nochmal!", 1200);
    $("last-guess").textContent = `Kein gültiger Spieler gefunden für "${guess}" (${letter})`;
  }
}

function passTurn() {
  showModal("Passen...", 900);
  setTimeout(nextTurn, 900);
}

function nextTurn() {
  // Nächster Spieler/Buchstabe je nach Modus
  if (modeSameLetter) {
    currentPlayer = (currentPlayer + 1) % numPlayers;
    if (currentPlayer === 0) {
      currentLetterIndex++;
    }
  } else {
    currentLetterIndex++;
    currentPlayer = (currentPlayer + 1) % numPlayers;
  }
  if (currentLetterIndex >= availableLetters.length) {
    endGame();
    return;
  }
  updateUI();
}

function endGame() {
  gameActive = false;
  switchScreen("end");
  let maxScore = Math.max(...scores);
  let winners = scores.map((s, i) => s === maxScore ? playerNames[i] : null).filter(Boolean);
  $("winner").innerHTML = `Gewonnen: <b>${winners.join(' & ')}</b> mit ${maxScore} Punkten!<br><br>${scores.map((s, i) => `${playerNames[i]}: ${s}`).join("<br>")}`;
}

function restartGame() {
  closeModal();
  switchScreen("settings");
  fetchLeagues();
}

// === TOOLS ===
function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  let matrix = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[bn][an];
}
