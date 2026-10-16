import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { hideBootSplashWhenReady } from './utils/bootSplash';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
);

// Écran de chargement posé dans index.html : retiré quand l'appli est prête.
hideBootSplashWhenReady();
