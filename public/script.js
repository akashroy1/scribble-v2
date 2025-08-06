const socket = io();
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
let drawing = false;

const currentWordDiv = document.querySelector('.current-word');
const timeRemainingDiv = document.querySelector('.time-remaining');
const playerListDiv = document.querySelector('.players-list');
const nameModal = document.getElementById('nameModal');
const nicknameInput = document.getElementById('nicknameInput');
const joinBtn = document.getElementById('joinBtn');

let playerName = '';

function joinGame() {
    playerName = nicknameInput.value.trim() || 'Anonymous';
    socket.emit('registerName', playerName);
    nameModal.style.display = 'none';
}
joinBtn.onclick = joinGame;
nicknameInput.onkeydown = (e) => {
    if (e.key === 'Enter') joinGame();
};

function updateTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');
    timeRemainingDiv.textContent = `⏰ Time Remaining: ${mins}:${secs}`;
}

canvas.addEventListener('mousedown', () => drawing = true);
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);
canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const x = e.offsetX, y = e.offsetY;
    ctx.lineTo(x, y);
    ctx.stroke();
    // Emit drawing event to server
    socket.emit('drawing', { x, y });
});

socket.on('drawing', (data) => {
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
});

// Player List Update
socket.on('playersUpdate', (players) => {
  playerListDiv.innerHTML = '';
  players.forEach(player => {
    const userDiv = document.createElement('div');
    userDiv.className = 'user-item';
    userDiv.innerHTML = `
      <div class="user-name">
        ${player.name}
        ${player.isDrawing ? '<span class="drawing-indicator">✏️ Drawing</span>' : ''}
      </div>
      <div class="user-score">Score: ${player.score} points</div>
    `;
    playerListDiv.appendChild(userDiv);
  });
});

// Listen for round data (update word mask & timer)
socket.on('roundData', ({ wordMask, wordLength, timeLeft }) => {
    currentWordDiv.textContent = `Current Word: ${wordMask} (${wordLength} letters)`;
    updateTime(timeLeft);
});

// Listen for timer tick updates
socket.on('timer', ({ timeLeft }) => {
    updateTime(timeLeft);
});


document.getElementById('clear').onclick = () => {
    socket.emit('clear-board');
};

socket.on('clear-board', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

const chat = document.getElementById('chat');
const guessInput = document.getElementById('guess');

// Send guess to server
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && guessInput.value.trim()) {
        socket.emit('guess', guessInput.value.trim());
        guessInput.value = '';
    }
});

// Display chat messages
socket.on('chat', ({player, msg, correct}) => {
    const el = document.createElement('div');
    const now = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    el.className = 'message';
    el.innerHTML = `
      <div class="message-user">${player.name} <span class="message-time">${now}</span></div>
      <div class="message-text">${msg}</div>
    `;
    if(correct){
        el.style.backgroundColor = '#89F587';
    }
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
});

socket.on('chat-message', (msg)=>{
    const el = document.createElement('div');
    el.innerHTML = msg;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
})