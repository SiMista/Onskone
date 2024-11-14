// backend/models/game.js
const mongoose = require('mongoose');

// Game id generator
function generategameCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
} 

const gameSchema = new mongoose.Schema({
  gameCode: {
    type: String,
    required: true,
    default: () => generategameCode()   // Génère un ID unique par défaut
  },
  hostPlayer: {
    type: mongoose.Schema.Types.ObjectId,
  },
  players: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
  }],
  currentRound: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
  },
  status: {
    type: String,
    enum: ['waiting', 'inProgress', 'finished'],
    default: 'waiting',
  },
});

const Game = mongoose.model('Game', gameSchema);
module.exports = Game;
