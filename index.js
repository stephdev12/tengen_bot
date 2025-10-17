import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import chalk from 'chalk';
import whatsappManager from './whatsappManager.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const startTime = Date.now();
let restartCount = 0;
const MAX_RESTARTS = 5;

async function connectBot() {
    try {
        console.log(chalk.cyan('🚀 Démarrage du bot...'));
        
        await whatsappManager.createSession({
            onConnected: async () => {
                console.log(chalk.green("✅ Bot connecté avec succès"));
                // Le message de bienvenue est déjà envoyé par whatsappManager.sendWelcomeMessage()
            },
            
            onQr: (qr) => {
                console.log(chalk.yellow('📱 QR Code généré - Scannez avec WhatsApp'));
            },
            
            onPairingCode: (code, brand) => {
                console.log(chalk.yellow.bold(`\n🔑 Code de Pairing: ${code}\n`));
                if (brand) {
                    console.log(chalk.cyan(`🏷️  Marque: ${brand}`));
                }
            },
            
            onError: (error) => {
                console.error(chalk.red('❌ Erreur de connexion:'), error.message);
            },
            
            onDisconnected: (reason) => {
                console.log(chalk.red(`🔌 Déconnecté: ${reason}`));
            }
        });

    } catch (error) {
        console.error(chalk.red("\n💥 Erreur fatale: "), error);
        
        if (restartCount < MAX_RESTARTS) {
            restartCount++;
            console.log(chalk.yellow(`🔄 Redémarrage dans 5 secondes... (${restartCount}/${MAX_RESTARTS})\n`));
            setTimeout(connectBot, 5000);
        } else {
            console.log(chalk.red("🚨 Nombre maximum de tentatives atteint ! Redémarrage manuel requis."));
        }
    }
}

// Démarrer le bot
connectBot();

// Serveur HTTP pour keep-alive
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🤖 Bot WhatsApp en fonctionnement!');
}).listen(config.port, () => {
    console.log(chalk.blue(`🌐 Serveur démarré sur le port ${config.port}`));
});

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n🛑 Arrêt du bot...'));
    await whatsappManager.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n🛑 Arrêt du bot...'));
    await whatsappManager.cleanup();
    process.exit(0);
});