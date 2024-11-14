// backend/models/player.js
const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  isHost: {
    type: Boolean,
    default: false,
  },
  /* Peut-être dans le cas où le mec est deconnecté ? jsp
    gameCode: {
    type: String,
    ref: 'GameCode',
  },
  */
  // peut-être le score
});

const Player = mongoose.model('Player', playerSchema);
module.exports = Player;
