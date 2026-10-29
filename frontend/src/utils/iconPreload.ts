import { addCollection } from '@iconify/react';
import fluentEmoji from '../generated/fluentEmoji.json';

// Emojis Fluent Flat embarqués : <Icon> les rend de façon synchrone dès le
// premier paint, sans fetch API Iconify (donc aucun saut de mise en page).
addCollection(fluentEmoji);
