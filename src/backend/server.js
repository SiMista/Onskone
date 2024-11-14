// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const gameRoutes = require('./routes/game');
const playerRoutes = require('./routes/player');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/game', gameRoutes);
app.use('/api/player', playerRoutes);

mongoose.connect('mongodb+srv://simeondeiva:Jchp85i4ytciV724@onskone-cluster.diokb.mongodb.net/onskone')
  .then(() => console.log('Connexion à MongoDB réussie'))
  .catch((err) => console.log('Erreur de connexion MongoDB :', err));

app.listen(5000, () => {
  console.log('Serveur en écoute sur le port 5000');
});
