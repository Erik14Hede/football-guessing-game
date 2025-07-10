// --- Utilities ---
function showModal(msg) {
  document.getElementById("modal-content").innerHTML = msg;
  document.getElementById("modal").style.display = "flex";
}
function hideModal() {
  document.getElementById("modal").style.display = "none";
}
function levenshtein(a, b) {
  const an = a.length; const bn = b.length;
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
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// --- Game State ---
let allPlayers = [];
let gamePlayers = [];
let availablePlayers = [];
let guessedNames = [];
let guessedPlayersForLetter = {};
let settings = {};
let score = [];
let curLetterIdx = 0;
let curPlayerIdx = 0;
let timer = null;
let timerTime = 0;
let isGameActive = false;

// --- Setup ---
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const sameLetterCheck = document.getElementById("same-letter");
const leagueSelect = document.getElementById("select-league");
const errorMarginInput = document.getElementById("error-margin");
const scoreboardDiv = document.getElementById("scoreboard");
const setupWarning = document.getElementById("setup-warning");
const setupLoading = document.getElementById("setup-loading");
const posChecks = [...document.querySelectorAll('.pos')];

startBtn.onclick = async () => {
  settings = {
    numPlayers: Math.max(1, Math.min(10, parseInt(document.getElementById("num-players").value) || 2)),
    league: leagueSelect.value,
    positions: posChecks.filter(p => p.checked).map(p => p.value),
    fullName: document.getElementById("full-name").checked,
    errorMargin: Math.max(0, Math.min(3, parseInt(errorMarginInput.value))),
    sameLetter: sameLetterCheck.checked
  };
  setupWarning.textContent = "";
  setupLoading.textContent = "Lade Spieler...";
  startBtn.disabled = true;

  // --- Spieler laden ---
  try {
    allPlayers = await fetchAllPlayers(settings.league, settings.positions);
    if (!allPlayers.length) throw new Error("Keine Spieler gefunden!");

    // Nachname extrahieren, fallback ist voller Name
    allPlayers.forEach(p => {
      const parts = (p.name||"").split(" ");
      p.lastname = parts.length > 1 ? parts[parts.length-1] : p.name;
    });

    // Alphabet filtern, wo es keine Spieler gibt
    const usableAlphabet = alphabet.filter(l =>
      allPlayers.some(p => (settings.fullName ? p.name : p.lastname).toUpperCase().startsWith(l))
    );
    if (usableAlphabet.length < 8) {
      setupWarning.textContent = "⚠️ Zu wenig unterschiedliche Buchstaben für diese Liga/Filter!";
      setupLoading.textContent = "";
      startBtn.disabled = false;
      return;
    }

    gamePlayers = shuffle([...Array(settings.numPlayers).keys()].map(i => "Spieler " + (i+1)));
    availablePlayers = allPlayers;
    guessedNames = [];
    guessedPlayersForLetter = {};
    score = Array(settings.numPlayers).fill(0);
    curLetterIdx = 0;
    curPlayerIdx = 0;
    isGameActive = true;

    setupScreen.style.display = "none";
    gameScreen.style.display = "";
    updateGameUI();
    startTurn();
  } catch (err) {
    setupWarning.textContent = "Fehler: " + err.message;
  }
  setupLoading.textContent = "";
  startBtn.disabled = false;
};

// --- Spieler holen ---
async function fetchAllPlayers(league, positions) {
  // 1. Alle Teams der Liga laden
  const url = `https://www.thesportsdb.com/api/v1/json/123/search_all_teams.php?l=${encodeURIComponent(league)}`;
  const teamsRes = await fetch(url);
  const teamsData = await teamsRes.json();
  const teams = teamsData.teams || [];
  let all = [];
  for (const team of teams) {
    // 2. Für jedes Team alle Spieler laden
    const squadRes = await fetch(`https://www.thesportsdb.com/api/v1/json/123/lookup_all_players.php?id=${team.idTeam}`);
    const squadData = await squadRes.json();
    const players = (squadData.player || []).filter(p =>
      positions.length ? positions.includes(mapPosition(p.strPosition)) : true
    );
    all = all.concat(players.map(p => ({
      name: p.strPlayer,
      position: mapPosition(p.strPosition),
      team: team.strTeam
    })));
    await new Promise(r => setTimeout(r, 130)); // nicht zu viele Anfragen/s
  }
  // Nur Spieler mit Name
  return all.filter(p => p.name);
}

function mapPosition(pos) {
  // Mappen auf Hauptpositionen
  if (!pos) return "";
  pos = pos.toLowerCase();
  if (pos.includes("keeper") || pos.startsWith("gk")) return "Goalkeeper";
  if (pos.includes("def") || pos.includes("back")) return "Defender";
  if (pos.includes("mid")) return "Midfielder";
  if (pos.includes("forw") || pos.includes("strik") || pos.includes("wing")) return "Forward";
  return "";
}

// --- Game Logic ---
function updateGameUI() {
  // Alphabet anzeigen
  const used = Object.keys(guessedPlayersForLetter);
  const curLetter = getCurrentLetter();
  document.getElementById("alphabet-bar").innerHTML = alphabet.map(l =>
    `<span class="${used.includes(l) ? "done" : ""}${curLetter === l ? " active" : ""}">${l}</span>`
  ).join("");
  // Status
  document.getElementById("status-current-letter").textContent =
    "Buchstabe: " + curLetter;
  document.getElementById("status-current-player").textContent =
    " | " + gamePlayers[curPlayerIdx];
  document.getElementById("timer").textContent = "";
  // Guessed list
  document.getElementById("guessed-list").innerHTML =
    (guessedPlayersForLetter[curLetter] || []).map(
      (entry, i) =>
        `<div>${entry.playerName} (${entry.byPlayer})</div>`
    ).join("");
  // Scoreboard
  let html = `<table>`;
  for (let i = 0; i < gamePlayers.length; i++) {
    html += `<tr><td>${gamePlayers[i]}</td><td style="text-align:right">${score[i]}</td></tr>`;
  }
  html += `</table>`;
  scoreboardDiv.innerHTML = html;
  // Clear input
  document.getElementById("player-input").value = "";
}

function getCurrentLetter() {
  // Buchstabe für diese Runde
  if (settings.sameLetter) return alphabet[curLetterIdx];
  return alphabet[(curLetterIdx + curPlayerIdx) % alphabet.length];
}

function nextTurn() {
  // Wenn alle Buchstaben benutzt => Ende
  if (Object.keys(guessedPlayersForLetter).length >= alphabet.length) {
    endGame();
    return;
  }
  if (settings.sameLetter) {
    curPlayerIdx = (curPlayerIdx + 1) % settings.numPlayers;
    if (curPlayerIdx === 0) curLetterIdx++;
    // Skip Buchstaben ohne Spieler
    while (
      curLetterIdx < alphabet.length &&
      !availablePlayers.some(p => (settings.fullName ? p.name : p.lastname).toUpperCase().startsWith(alphabet[curLetterIdx]))
    ) curLetterIdx++;
    if (curLetterIdx >= alphabet.length) {
      endGame();
      return;
    }
  } else {
    curLetterIdx++;
    if (curLetterIdx >= alphabet.length) {
      endGame();
      return;
    }
  }
  updateGameUI();
  startTurn();
}

function startTurn() {
  updateGameUI();
}

document.getElementById("guess-btn").onclick = () => tryGuess();
document.getElementById("player-input").addEventListener("keydown", e => {
  if (e.key === "Enter") tryGuess();
});
document.getElementById("pass-btn").onclick = () => {
  showModal("Passen. Kein Punkt.");
  guessedPlayersForLetter[getCurrentLetter()] = guessedPlayersForLetter[getCurrentLetter()] || [];
  guessedPlayersForLetter[getCurrentLetter()].push({
    playerName: "(gepasst)", byPlayer: gamePlayers[curPlayerIdx]
  });
  nextTurn();
};
restartBtn.onclick = () => { location.reload(); };

function tryGuess() {
  if (!isGameActive) return;
  const input = document.getElementById("player-input").value.trim();
  if (!input) return showModal("Bitte gib einen Spielernamen ein!");

  const curLetter = getCurrentLetter();
  const candidates = availablePlayers.filter(p =>
    (settings.fullName ? p.name : p.lastname).toUpperCase().startsWith(curLetter)
  );
  if (!candidates.length) {
    showModal("Für diesen Buchstaben gibt es keinen Spieler!");
    return nextTurn();
  }
  // Prüfen ob schon geraten (unabhängig von Groß/Klein)
  if ((guessedPlayersForLetter[curLetter] || []).some(g =>
    g.playerName.toLowerCase() === input.toLowerCase()
  )) {
    return showModal("Dieser Spieler wurde schon geraten!");
  }

  // Fehlertoleranz prüfen
  let found = null, bestDist = 99;
  for (const p of candidates) {
    const testValue = settings.fullName ? p.name : p.lastname;
    const dist = levenshtein(testValue.toLowerCase(), input.toLowerCase());
    if (dist <= settings.errorMargin && dist < bestDist) {
      found = p;
      bestDist = dist;
    }
  }
  if (found) {
    showModal(`✅ Richtig! ${found.name} (${found.team}, ${found.position})`);
    score[curPlayerIdx]++;
    guessedPlayersForLetter[curLetter] = guessedPlayersForLetter[curLetter] || [];
    guessedPlayersForLetter[curLetter].push({ playerName: found.name, byPlayer: gamePlayers[curPlayerIdx] });
    nextTurn();
  } else {
    showModal("❌ Kein passender Spieler gefunden!");
  }
}

function endGame() {
  isGameActive = false;
  updateGameUI();
  showModal("🏁 Spiel beendet!<br><br>" + scoreboardDiv.innerHTML);
  document.getElementById("restart-btn").style.display = "";
}

// Modal Handling global (für html-button)
window.hideModal = hideModal;
