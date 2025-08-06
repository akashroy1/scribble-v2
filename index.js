  // index.js
  const express = require('express');
  const http = require('http');
  const { Server } = require('socket.io');
  const { scribbleWords } = require('./words')

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  let wordInd = Math.floor(Math.random() * 100);
  let currentWord = scribbleWords[wordInd];
  console.log(currentWord);
  let wordMask = '';
  let roundTime = 120;
  let timer;

  app.use(express.static('public')); // serve frontend files

  // --- Helper to mask word ---
  function maskWord(word) {
    return word.split('').map(() => '_').join(' ');
  }

  // --- Broadcast round start and timer ---
  function startRound() {
    wordMask = maskWord(currentWord);
    let timeLeft = roundTime;

    // Notify clients of new round
    io.emit('roundData', { wordMask, wordLength: currentWord.length, timeLeft });

    // Clear previous interval if any
    if (timer) clearInterval(timer);

    // Timer logic
    timer = setInterval(() => {
      timeLeft--;
      io.emit('timer', { timeLeft });

      if (timeLeft <= 0) {
        clearInterval(timer);
        io.emit('timer', { timeLeft: 0 });
        // Optionally: Emit round-end event or prepare next word/round
      }
    }, 1000);
  }

  let players = {};

  io.on('connection', (socket) => {
    socket.on('registerName', (name) => {
      players[socket.id] = { name, score: 0, isDrawing: false };
      io.emit('playersUpdate', Object.values(players)); // send updated player list
    });

    socket.emit('roundData', { wordMask, wordLength: currentWord.length, timeLeft: roundTime });
    socket.on('startRound', startRound);
    // Listen for drawing data from clients
    socket.on('drawing', (data) => {
      // Broadcast to other clients
      socket.broadcast.emit('drawing', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      delete players[socket.id];
      io.emit('playersUpdate', Object.values(players));
    });

    // Clear Board Logic
    socket.on('clear-board', () => {
      io.emit('clear-board');
    });

    socket.on('guess', (msg) => {
      const player = players[socket.id];
      // Check if correct
      if (msg.toLowerCase() === currentWord.toLowerCase()) {
        players[socket.id].score+=10;
        io.emit('playersUpdate', Object.values(players));
        io.emit('chat', {player, msg: "Guessed the word correct.", correct:true});
        // Optionally: Choose a new word, next turn, etc.
      } else {
        io.emit('chat', {player, msg, correct:false});
      }
    });

  });
  startRound();

  server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
