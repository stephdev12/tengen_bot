import dotenv from 'dotenv';
dotenv.config();

const config = {
    // Configuration de base
    prefix: process.env.BOT_PREFIX || '!',
    owner: process.env.BOT_OWNER || '', // Sera défini via pairing code
    ownerName: process.env.BOT_OWNER_NAME || 'User',
    
    // Session
    sessionDir: process.env.SESSION_DIR || 'session',
    
    // Serveur
    port: process.env.PORT || 3000,
    
    // Fonctionnalités (activées par défaut)
    anticall: process.env.ANTICALL !== 'false',
    autostatus: process.env.AUTOSTATUS === 'true',
    antidelete: process.env.ANTIDELETE !== 'false',
    autoreact: process.env.AUTOREACT === 'true',
    autowrite: process.env.AUTOWRITE === 'true',
    
    // Protection groupes (activées par défaut)
    antilink: process.env.ANTILINK !== 'false',
    antispam: process.env.ANTISPAM !== 'false',
    antimention: process.env.ANTIMENTION !== 'false',
    antitag: process.env.ANTITAG !== 'false',
    antidemote: process.env.ANTIDEMOTE !== 'false',
    antipromote: process.env.ANTIPROMOTE !== 'false',
    
   
    // Seuils protection
    antilinkThreshold: parseInt(process.env.ANTILINK_THRESHOLD) || 3,
    antispamThreshold: parseInt(process.env.ANTISPAM_THRESHOLD) || 5,


    updateZipUrl: process.env.UPDATE_ZIP_URL || "https://github.com/mruniquehacker/Knightbot-MD/archive/refs/heads/main.zip",
};

export default config;