// backend/routes/player.js
const express = require('express');
const router = express.Router();
const Player = require('../models/player');

router.post('/create', async (req, res) => {
  try {
    const { name } = req.body;
    const newPlayer = new Player({ name });
    await newPlayer.save();
    res.status(201).json({ newPlayer });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création du joueur' });
  }
});

router.get('/getall')

module.exports = router;
