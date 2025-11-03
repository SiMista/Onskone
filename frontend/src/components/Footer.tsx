// src/components/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="w-full py-5 text-center text-white text-xs select-none">
            <a className="no-underline mx-2.5" href="url">Signaler un problème</a> |
            <a className="no-underline mx-2.5" href="url">Conditions d'utilisations</a> |
            <a className="no-underline mx-2.5" href="url">Confidentialité</a> |
            <a className="no-underline mx-2.5" href="url">Contacts</a>
        </footer>
    )
};

export default Footer;