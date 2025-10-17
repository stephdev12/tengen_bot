import { isOwner } from '../lib/isAdmin.js';

// Numéros autorisés pour la commande verse
const AUTHORIZED_NUMBERS = ['237698711207', '237650471093'];

export default {
    name: 'verse',
    description: 'Vérifier les bots connectés (réaction seulement)',
    
    async execute({ sock, msg, phoneNumber, whatsappManager }) { // ⭐ AJOUT du paramètre whatsappManager
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNumber = sender.split('@')[0];

        try {
            // Vérifier si le numéro est autorisé
            const isAuthorized = AUTHORIZED_NUMBERS.includes(senderNumber);
            const isBotOwner = isOwner(msg, phoneNumber);
            
            if (!isAuthorized && !isBotOwner) {
                console.log(`🚫 Accès refusé pour verse: ${senderNumber}`);
                return; // Ignorer silencieusement
            }

            // ⭐ CORRECTION : Utiliser l'instance existante passée en paramètre
            const activeSessions = whatsappManager.getActiveSessionsCount();
            const allSessions = whatsappManager.getAllSessionsInfo();

            console.log(`🔍 Commande verse exécutée par ${senderNumber}`);
            console.log(`📊 Sessions actives: ${activeSessions}`);

            // Envoyer une réaction seulement (emoji œil)
            await sock.sendMessage(jid, {
                react: {
                    text: "👀", // Emoji œil pour "je vois"
                    key: msg.key
                }
            });

            // Log détaillé pour l'admin
            if (AUTHORIZED_NUMBERS.includes(senderNumber)) {
                console.log(`📋 Détail des sessions pour ${senderNumber}:`, {
                    activeSessions,
                    sessions: Object.keys(allSessions)
                });
            }

        } catch (error) {
            console.error(`❌ Erreur commande verse pour ${phoneNumber}:`, error);
            // Ne rien envoyer en cas d'erreur - réaction silencieuse seulement
        }
    }
};