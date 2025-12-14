/**
 * Faits insolites affichés pendant les phases d'attente
 * Ajoutez vos propres faits rigolos ici !
 */
export const FUN_FACTS = [
  "Dans n'importe quelle boulangerie de France on ne trouvera jamais meilleur pain que toi",
  "Le jour de sa naissance, la première phrase prononcée par Squeezie a été : 'Est-ce que c'est bon pour vous ?'",
  "Au casino, tu peux remporter 4000 fois ta mise, mais tu ne peux perdre qu’1 fois ta mise, donc mise tout la prochaine fois ;)",
  "Un joueur de League of Legends se lave en moyenne une fois par semaine",
  "Miser sur Kylian Mbappé buteur est statistiquement plus sûr que de miser sur l’arbitre",
  "Aller à la salle de sport régulièrement confère en plus du gain musculaire, une odeur corporelle nauséabonde",
  "Ne pas se brosser les dents entraîne systématiquement une haleine de dragon",
  "Manger du KFC tous les jours augmente fortement tes dépenses en papier toilette",
  "Qui s'endort avec les fesses qui grattent, se réveille avec les doigts qui puent",
  "Un Français qui prononce mal Aya Nakamura est à 99.9% raciste",
  "Si dans une musique de rap, tu entends 'numéro 10 comme ...', ce rappeur est forcément éclaté",
  "4 hommes sur 5 ne comprennent pas la douleur subie par les femmes au quotidien (je suis le 5ème)"
];

/**
 * Retourne un fait aléatoire
 */
export const getRandomFunFact = (): string => {
  return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
};

/**
 * Retourne un fait aléatoire différent du précédent
 */
export const getNextFunFact = (currentFact: string): string => {
  if (FUN_FACTS.length <= 1) return FUN_FACTS[0] || "";

  let newFact = currentFact;
  while (newFact === currentFact) {
    newFact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  }
  return newFact;
};
