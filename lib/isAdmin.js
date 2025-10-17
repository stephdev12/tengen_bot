import NodeCache from 'node-cache';
import Database from './database.js';
import sudoManager from './sudoManager.js';
import config from '../config.js';

// Cache pour les métadonnées des groupes (expire après 30 minutes)
const groupMetadataCache = new NodeCache({ stdTTL: 1800 });
const pendingRequests = new Map();
const rateLimitCache = new NodeCache({ stdTTL: 60 });

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getGroupMetadataWithCache(sock, chatId) {
    try {
        const cached = groupMetadataCache.get(chatId);
        if (cached) return cached;

        if (pendingRequests.has(chatId)) {
            return await pendingRequests.get(chatId);
        }

        const requestCount = rateLimitCache.get(chatId) || 0;
        if (requestCount > 5) {
            const backoffTime = Math.min(1000 * (requestCount - 5), 30000);
            await wait(backoffTime);
        }

        const requestPromise = (async () => {
            try {
                rateLimitCache.set(chatId, requestCount + 1);
                const metadata = await sock.groupMetadata(chatId);
                groupMetadataCache.set(chatId, metadata);
                return metadata;
            } catch (error) {
                if (error.data === 429) {
                    await wait(5000);
                    const metadata = await sock.groupMetadata(chatId);
                    groupMetadataCache.set(chatId, metadata);
                    return metadata;
                }
                if (cached) {
                    console.log("Erreur API, utilisation du cache");
                    return cached;
                }
                throw error;
            }
        })();

        pendingRequests.set(chatId, requestPromise);
        const result = await requestPromise;
        pendingRequests.delete(chatId);

        return result;
    } catch (error) {
        console.error('Erreur métadonnées groupe:', error);
        throw error;
    }
}

const getParticipantInfo = async (sock, chatId, userIdentifier) => {
    const groupMetadata = await getGroupMetadataWithCache(sock, chatId);
    const participants = groupMetadata.participants;
    const participant = participants.find(p =>
        [p.jid, p.lid, p.id].some(id => id === userIdentifier ||
        (typeof userIdentifier === 'string' && id && id.includes(userIdentifier.split('@')[0])))
    );
    return participant || {};
};

/**
 * Vérifie si un utilisateur est un administrateur du groupe.
 */
async function isAdmin(sock, jid, user) {
    try {
        const participantInfo = await getParticipantInfo(sock, jid, user);
        if (participantInfo && (participantInfo.jid || participantInfo.id)) {
            return !!participantInfo.admin;
        }

        const metadata = await getGroupMetadataWithCache(sock, jid);
        const participants = metadata.participants.map(p => ({
            id: p.id,
            lid: p.lid || null,
            admin: p.admin || null,
        }));

        const participant = participants.find(p =>
            p.id === user ||
            p.lid === user ||
            (p.id && p.id.includes(user.split('@')[0])) ||
            (p.lid && p.lid.includes(user.split('@')[0]))
        );

        if (participant) {
            return !!participant.admin;
        }
        return false;
    } catch (error) {
        console.error("Erreur critique dans la fonction isAdmin:", error);
        return false;
    }
}

/**
 * Vérifie si l'expéditeur est le propriétaire du bot.
 */
function isOwner(msg) {
    // Si le message vient du bot lui-même
    if (msg.key.fromMe) return true;

    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNumber = sender.split('@')[0].split(':')[0];

    // Dans un PV, le remoteJid est le numéro de l'expéditeur
    // Dans un groupe, le participant est l'expéditeur
    const isPrivateChat = msg.key.remoteJid.endsWith('@s.whatsapp.net');
    
    if (isPrivateChat) {
        // En PV, le remoteJid est directement le numéro de l'expéditeur
        const remoteJidNumber = msg.key.remoteJid.split('@')[0];
        return remoteJidNumber === config.owner;
    } else {
        // En groupe, utiliser le participant
        return senderNumber === config.owner;
    }
}

/**
 * Vérifie si l'utilisateur est premium
 */
async function isPremium(userJid) {
    try {
        return await Database.isPremiumUser(userJid);
    } catch (error) {
        console.error('❌ Error checking premium status:', error);
        return false;
    }
}

/**
 * Vérifie si l'utilisateur est sudo
 */
function isSudoUser(userJid) {
    try {
        return sudoManager.isSudoUser(userJid);
    } catch (error) {
        console.error('❌ Error checking sudo status:', error);
        return false;
    }
}

/**
 * Vérifie si l'utilisateur peut utiliser le bot en mode privé
 */
function canUseInPrivateMode(msg) {
    // 1. Le propriétaire peut toujours utiliser
    if (isOwner(msg)) {
        return true;
    }
    
    // 2. Récupérer le JID de l'expéditeur
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // 3. Vérifier si l'utilisateur est sudo
    return isSudoUser(sender);
}

/**
 * Vérifie les permissions pour l'exécution des commandes
 */
async function checkPermissions({ sock, msg, userSettings, commandName }) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const isGroup = jid.endsWith('@g.us');

    try {
        // Vérifier le mode d'accès
        const mode = userSettings.bot_mode || 'public';
        if (mode === 'private') {
            // En mode privé, seul le propriétaire et les utilisateurs sudo peuvent utiliser les commandes
            if (!canUseInPrivateMode(msg)) {
                return { allowed: false, reason: 'ACCESS_DENIED', silent: true };
            }
        }

        // Commandes réservées au propriétaire (sudo ne peut pas les utiliser)
        const ownerCommands = ['setprefix', 'setname', 'private', 'public', 'sudo', 'addsudo', 'makesudo', 'delsudo', 'removesudo', 'unsudo'];
        if (ownerCommands.includes(commandName) && !isOwner(msg)) {
            return { allowed: false, reason: 'OWNER_ONLY' };
        }

        // Commandes réservées aux utilisateurs premium
        const premiumCommands = ['broadcast', 'autoreply', 'backup', 'restore', 'stats'];
        if (premiumCommands.includes(commandName)) {
            const userIsPremium = await isPremium(sender);
            if (!userIsPremium) {
                return { allowed: false, reason: 'PREMIUM_ONLY' };
            }
        }

        // Commandes réservées aux admins dans les groupes
        const adminCommands = ['protection', 'greet', 'warnings', 'mute', 'unmute', 'promote', 'demote'];
        if (isGroup && adminCommands.includes(commandName)) {
            const userIsAdmin = await isAdmin(sock, jid, sender);
            if (!userIsAdmin) {
                return { allowed: false, reason: 'ADMIN_ONLY' };
            }
        }

        return { allowed: true };
    } catch (error) {
        console.error('❌ Permission check error:', error);
        // En cas d'erreur, autoriser l'exécution pour éviter de bloquer le bot
        return { allowed: true };
    }
}

export {
    isAdmin,
    isOwner,
    isPremium,
    isSudoUser,
    canUseInPrivateMode,
    checkPermissions
};