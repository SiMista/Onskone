// backend/routes/game.js
const express = require('express');
const router = express.Router();
const Game = require('../models/game');
const Player = require('../models/player');

// Route pour créer une nouvelle partie
router.post('/create', async (req, res) => {
  try {
    const { hostName } = req.body;    

    const player = new Player({ name: hostName, isHost: true });
    await player.save();

    // Création de la partie
    const newGame = new Game({
      hostPlayer: player._id, 
      players: [player._id],
    });
    await newGame.save();

    // Répondre avec le code de la partie
    res.status(201).json({ player: player, gameCode: newGame.gameCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création de la partie' });
  }
});


// Route pour rejoindre une partie
router.post('/join/:gameCode', async (req, res) => {
  const { gameCode } = req.params;
  const { name } = req.body; // Nom du joueur à partir du body

  try {
    const game = await Game.findOne({ gameCode });
    if (!game) {
      return res.status(404).json({ message: 'Partie non trouvée' });
    }

    // Crée un nouveau joueur et l'associe à la partie
    const player = new Player({ name });
    await player.save();

    game.players.push(player)
    await game.save()
    
    res.status(200).json({ message: 'Joueur ajouté avec succès', player });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la tentative de rejoindre la partie' });
  }
});

// Route pour récupérer toutes les parties
router.get('/', async (req, res) => {
  try {
    const games = await Game.find().populate('players', 'name'); // .populate pour inclure les informations des joueurs (par exemple, leur nom)

    if (!games || games.length === 0) {
      return res.status(404).json({ message: 'Aucune partie trouvée' });
    }

    res.status(200).json(games);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des parties' });
  }
});

module.exports = router;