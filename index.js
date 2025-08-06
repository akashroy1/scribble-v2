const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { scribbleWords } = require('./words')

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ROUND_DURATION = 120;

app.use(express.static('public'));

// Function to get a random word
function getarandomword() {
  let wordInd = Math.floor(Math.random() * 100);
  return scribbleWords[wordInd];
}

// Helper fuction to mask word
function maskWord(word) {
  return word.split('').map(() => '_').join(' ');
}

// Get next player who will draw in a round-robin fashion
function getNextDrawer() {
  if (playerOrder.length === 0) return null;
  currentDrawerIndex = (currentDrawerIndex + 1) % playerOrder.length;
  return playerOrder[currentDrawerIndex];
}

// Broadcast round start and timer
function startRound() {
  if (playerOrder.length === 0) return;

  currentWord = getarandomword();
  wordMask = maskWord(currentWord);
  let timeLeft = ROUND_DURATION;
  const drawerId = getNextDrawer();

  // Update player's drawing status
  for (const id in players) {
    players[id].isDrawing = (id === drawerId);
  }
  io.emit('playersUpdate', Object.values(players));

  // Send round info to all clients
  io.emit('roundData', {
    wordMask: maskWord(currentWord),
    wordLength: currentWord.length,
    timeLeft,
    drawerId,
    drawerName: players[drawerId]?.name || 'Unknown',
  });

  if (roundTimer) clearInterval(roundTimer);
  roundTimer = setInterval(() => {
    timeLeft--;
    io.emit('timer', { timeLeft });

    if (timeLeft <= 0) {
      clearInterval(roundTimer);
      io.emit('chat-message', `⏰ Time's up! The word was: ${currentWord}`);
      io.emit('clear-board');

      // Start next round after 5 seconds
      setTimeout(startRound, 5000);
    }
    
  }, 1000);
}

let players = {};
let playerOrder = [];
let currentDrawerIndex = -1;
let currentWord = getarandomword();
console.log(currentWord);
let roundTimer = null;
let wordMask = '';


io.on('connection', (socket) => {
  
  socket.on('registerName', (name) => {
    players[socket.id] = { name, score: 0, isDrawing: false };
    playerOrder.push(socket.id);
    io.emit('playersUpdate', Object.values(players));
    // Start the first round if not started yet
    if (!roundTimer) {
      startRound();
    }
  });

  // socket.emit('roundData', { wordMask, wordLength: currentWord.length, timeLeft: ROUND_DURATION });
  // socket.on('startRound', startRound);
  
  // Listen for drawing data from clients
  socket.on('drawing', (data) => {
    // Broadcast to other clients
    if (players[socket.id]?.isDrawing) {
      socket.broadcast.emit('drawing', data);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    delete players[socket.id];
    playerOrder = playerOrder.filter(id => id !== socket.id);

    io.emit('playersUpdate', Object.values(players));

    // If disconnected player was the drawer, advance round
    if (socket.id === playerOrder[currentDrawerIndex]) {
      clearInterval(roundTimer);
      startRound();
    }

    // If no players left, clear timer
    if (playerOrder.length === 0) {
      clearInterval(roundTimer);
      roundTimer = null;
    }
  });

  // Clear Board Logic
  socket.on('clear-board', () => {
    io.emit('clear-board');
  });

  socket.on('guess', (msg) => {
    const player = players[socket.id];
    // Check if correct
    if (msg.toLowerCase() === currentWord.toLowerCase()) {
      const drawerId = playerOrder[currentDrawerIndex];
      if (drawerId) players[drawerId].score += 5;
      players[socket.id].score += 10;

      io.emit('playersUpdate', Object.values(players));
      io.emit('chat', { player, msg: "Guessed the word correct.", correct: true });
      
      // clearInterval(roundTimer);
      // io.emit('clear-board');
      // startRound();
    } else {
      io.emit('chat', { player, msg, correct: false });
    }
  });

});

// startRound();

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
