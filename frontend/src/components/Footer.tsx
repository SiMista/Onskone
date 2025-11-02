// src/components/Footer.tsx
import React from 'react';

const Footer: React.FC = () => {
    const styles = {
        width: '100%',
        padding: '20px 0',
        textAlign: 'center' as const,
        bottom: 0,
        left: 0,
        color: 'white',
        fontSize: '12px',
        // Unselectable text
        userSelect: 'none' as const,
    };

    const linkStyles = {
        color: 'inherit',
        textDecoration: 'none',
        margin: '0 10px',
    };

    return (
        <footer style={styles}>
            <a style={linkStyles} href="url">Signaler un problème</a> |
            <a style={linkStyles} href="url">Conditions d'utilisations</a> |
            <a style={linkStyles} href="url">Confidentialité</a> |
            <a style={linkStyles} href="url">Contacts</a>
        </footer>
    )
};

export default Footer;