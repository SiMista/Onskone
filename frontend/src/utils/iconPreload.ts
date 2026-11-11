import { addCollection } from '@iconify/react';
import fluentEmoji from '../generated/fluentEmoji.json';

// Emojis Fluent Flat embarqués : pas de fetch API Iconify, et rendus dès le premier
// paint (aucun saut de mise en page) À CONDITION de passer par components/Icon.tsx,
// qui force `ssr` (l'<Icon> brut d'Iconify attend son montage avant de s'afficher).
addCollection(fluentEmoji);
