const API_BASE_URL = 'https://football-proxy-f5z0.onrender.com/proxy';
const API_TOKEN = 'fd5cb7c3e0364eed9cfcaaeea699e9c3';

let leagues = [], teams = [], players = [];
let guessedPlayers = [];
let scores = [];
let currentAlphabet = [];
let currentLetterIndex = 0;
let currentPlayerIndex = 0;
let timerInterval = null;
let timeLeft = 30;
let numPlayers = 2;
let errorMargin = 1;
let sameLetterMode = true;

const leagueSelect = document.getElementById('select-league');
const warningDiv = document.getElementById('warning-message');
const startGameBtn = document.getElementById('start-game-btn');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const passTurnBtn = document.getElementById('pass-turn-btn');
const restartGameBtn = document.getElementById('restart-game-btn');
const scoreboardDiv = document.getElementById('scoreboard');
const alphabetDiv = document.getElementById('alphabet-display');

const modal = document.getElementById('modal');
const modalMsg = document.getElementById('modal-message');
const modalClose = document.getElementById('modal-close');

function showModal(msg) {
  modalMsg.textContent = msg;
  modal.style.display = "flex";
}
modalClose.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if(e.target==modal) modal.style.display="none"; };

function switchScreen(s) {
  ['settings-screen','game-screen','end-screen'].forEach(id=>{
    document.getElementById(id).classList.remove('active');
  });
  document.getElementById(s).classList.add('active');
}
document.addEventListener('DOMContentLoaded', ()=>{
  switchScreen('settings-screen');
  loadLeagues();
});

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
    leagueSelect.innerHTML = '<option value="">Liga wählen</option>';
    leagues.forEach(league => {
      const opt = document.createElement('option');
      opt.value = league.id;
      opt.textContent = league.name;
      leagueSelect.appendChild(opt);
    });
  } catch (err) {
    warningDiv.textContent = 'Fehler beim Laden der Ligen: ' + err.message;
    warningDiv.style.display = "block";
  }
}

startGameBtn.addEventListener('click', startGame);
submitGuessBtn.addEventListener('click', handleSubmitGuess);
passTurnBtn.addEventListener('click', passTurn);
restartGameBtn.addEventListener('click', restartGame);

async function startGame() {
  numPlayers = parseInt(document.getElementById('num-players').value) || 2;
  scores = Array(numPlayers).fill(0);
  guessedPlayers = [];
  errorMargin = parseInt(document.getElementById('errormargin').value) || 0;
  sameLetterMode = document.getElementById('mode').value === 'same';
  let excludeQXY = document.getElementById('exclude-qxy').checked;
  currentAlphabet = [];
  for(let i=65; i<=90; i++){
    let l=String.fromCharCode(i);
    if(excludeQXY && ["Q","X","Y"].includes(l)) continue;
    currentAlphabet.push(l);
  }
  currentLetterIndex = 0; currentPlayerIndex = 0;
  const leagueId = leagueSelect.value;
  if(!leagueId) return showModal("Bitte eine Liga wählen!");
  warningDiv.textContent = "Lade Teams und Spieler...";
  warningDiv.style.display = "block";
  players = [];
  try {
    const teamRes = await fetch(`${API_BASE_URL}?url=${encodeURIComponent(`https://api.football-data.org/v4/competitions/${leagueId}/teams`)}`, {
      headers: { 'X-Auth-Token': API_TOKEN }
    });
    const teamData = await teamRes.json();
    teams = teamData.teams || [];
    for(const team of teams) {
      if (!team.squad) continue;
      team.squad.forEach(player=>{
        players.push({
          name: player.name,
          position: player.position||"",
          team: team.name||"",
        });
      });
    }
    if(!players.length) {
      warningDiv.textContent = "Keine Spieler für diese Liga gefunden!";
      warningDiv.style.display = "block";
      setTimeout(restartGame, 3000);
      return;
    }
    warningDiv.textContent = "";
    warningDiv.style.display = "none";
  } catch (e) {
    warningDiv.textContent = "Fehler beim Laden der Teams/Spieler: "+e.message;
    warningDiv.style.display = "block";
    setTimeout(restartGame, 3000);
    return;
  }
  switchScreen('game-screen');
  showCurrentStatus();
  updateScoreboard();
  renderAlphabet();
  timeLeft = parseInt(document.getElementById('time-limit').value)||30;
  document.getElementById('timer').textContent = timeLeft;
  startTurnTimer();
}
function showCurrentStatus() {
  document.getElementById('current-player-name').textContent = "Spieler " + (currentPlayerIndex+1);
  document.getElementById('current-letter').textContent = currentAlphabet[currentLetterIndex];
  renderGuessedPlayers();
  updateScoreboard();
  renderAlphabet();
}

function handleSubmitGuess() {
  const input = document.getElementById('player-guess-input');
  const guess = input.value.trim();
  const currentLetter = currentAlphabet[currentLetterIndex];
  if (!guess) return showModal("Bitte einen Spielernamen eingeben!");
  const candidates = players.filter(p =>
    p.name.toUpperCase().startsWith(currentLetter)
    && !guessedPlayers.some(gp => gp.name.toLowerCase() === p.name.toLowerCase())
  );
  let found = null;
  for (let c of candidates) {
    if (levenshtein(c.name.toLowerCase(), guess.toLowerCase()) <= errorMargin) {
      found = c; break;
    }
  }
  if (!found) return showModal("Kein passender Spieler gefunden oder Name zu stark abweichend!");
  guessedPlayers.push({
    player: currentPlayerIndex + 1,
    name: found.name,
    team: found.team,
    letter: currentLetter,
    guess: guess,
  });
  scores[currentPlayerIndex]++;
  input.value = '';
  showModal("✅ Richtig! "+found.name+" ("+found.team+")");
  setTimeout(()=>{ modal.style.display = "none"; nextTurn(); },1200);
}

function passTurn() {
  const currentLetter = currentAlphabet[currentLetterIndex];
  guessedPlayers.push({
    player: currentPlayerIndex + 1,
    name: "(kein Name)",
    team: "",
    letter: currentLetter,
    guess: "",
  });
  showModal("Runde gepasst!");
  setTimeout(()=>{ modal.style.display = "none"; nextTurn(); },1000);
}

function nextTurn() {
  clearInterval(timerInterval);
  if(sameLetterMode) {
    currentPlayerIndex = (currentPlayerIndex+1)%numPlayers;
    if(currentPlayerIndex===0) currentLetterIndex++;
  } else {
    currentLetterIndex++;
    currentPlayerIndex = (currentPlayerIndex+1)%numPlayers;
  }
  if(currentLetterIndex >= currentAlphabet.length) { endGame(); return; }
  showCurrentStatus();
  timeLeft = parseInt(document.getElementById('time-limit').value)||30;
  document.getElementById('timer').textContent = timeLeft;
  startTurnTimer();
}

function renderGuessedPlayers() {
  const ul = document.getElementById('guessed-players-list');
  ul.innerHTML = '';
  guessedPlayers.forEach(entry => {
    const li = document.createElement('li');
    if(entry.name === "(kein Name)") {
      li.textContent = `(${entry.letter}) Spieler ${entry.player} passt.`;
    } else {
      li.textContent = `(${entry.letter}) Spieler ${entry.player}: ${entry.name} (${entry.team})`;
    }
    ul.appendChild(li);
  });
}
function updateScoreboard() {
  let html = "";
  scores.forEach((s, i) => {
    html += `Spieler ${i+1}: <b>${s}</b>&nbsp;&nbsp;`;
  });
  scoreboardDiv.innerHTML = html;
}
function renderAlphabet() {
  alphabetDiv.innerHTML = '';
  currentAlphabet.forEach((l, idx)=>{
    const s = document.createElement('span');
    s.textContent = l;
    if(idx < currentLetterIndex) s.className = "done";
    else if(idx===currentLetterIndex) s.className = "current";
    alphabetDiv.appendChild(s);
  });
}

function endGame() {
  switchScreen('end-screen');
  let maxScore = Math.max(...scores);
  let winners = [];
  scores.forEach((score, idx) => { if(score === maxScore) winners.push("Spieler "+(idx+1)); });
  document.getElementById('winner-message').textContent = winners.join(' & ') + " gewinnt mit " + maxScore + " Punkten!";
}
function restartGame() {
  clearInterval(timerInterval);
  switchScreen('settings-screen');
  warningDiv.style.display = "none";
  loadLeagues();
  guessedPlayers = [];
  scores = [];
  updateScoreboard();
}

function startTurnTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if(timeLeft <= 0) {
      clearInterval(timerInterval);
      showModal("⏱️ Zeit abgelaufen!");
      setTimeout(()=>{ modal.style.display = "none"; passTurn(); },1000);
    }
  }, 1000);
}
function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  if(an === 0) return bn; if(bn === 0) return an;
  const matrix = Array.from({ length: bn+1 }, (_, i) => [i]);
  for(let j=0; j<=an; j++) matrix[0][j] = j;
  for(let i=1; i<=bn; i++)
    for(let j=1; j<=an; j++)
      matrix[i][j] = b.charAt(i-1) === a.charAt(j-1)
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
  return matrix[bn][an];
}
