// backend/models/round.js
const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  questions_proposed: [{
    type: String,
    required: true,
  }],
  question_selected: {
    type: String,
    required: false,
  },
  answers: [{
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    answer: String,
  }],
  chef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
  },
  status: {
    type: String,
    enum: ['waitingForAnswers', 'inProgress', 'finished'],
    default: 'waitingForAnswers',
  },
});

const Round = mongoose.model('Round', roundSchema);
module.exports = Round;
