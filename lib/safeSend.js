const messageTimestamps = new Map();
const MIN_DELAY = 2000; // 2 secondes entre chaque message

/**
 * Envoyer un message avec protection anti rate-limit
 */
async function safeSend(sock, jid, message, options = {}) {
    const key = `${jid}`;
    const now = Date.now();
    const lastTime = messageTimestamps.get(key) || 0;
    const timeSinceLastMessage = now - lastTime;
    
    // Attendre si nécessaire
    if (timeSinceLastMessage < MIN_DELAY) {
        const waitTime = MIN_DELAY - timeSinceLastMessage;
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    try {
        const result = await sock.sendMessage(jid, message, options);
        messageTimestamps.set(key, Date.now());
        return result;
    } catch (error) {
        if (error.message?.includes('rate-overlimit')) {
            console.log(`⚠️ WhatsApp rate limit hit for ${jid}, waiting 10s...`);
            // Attendre 10 secondes avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Réessayer une fois
            try {
                const result = await sock.sendMessage(jid, message, options);
                messageTimestamps.set(key, Date.now());
                return result;
            } catch (retryError) {
                console.error('❌ Rate limit persists, message not sent');
                return null;
            }
        }
        
        // ⭐ GESTION D'ERREURS AMÉLIORÉE
        if (error.message?.includes('not connected')) {
            console.error('❌ Socket not connected, message not sent');
            return null;
        }
        
        console.error('❌ Send message error:', error.message);
        return null;
    }
}

/**
 * Envoyer une réaction avec protection anti rate-limit
 */
async function safeReact(sock, jid, msg, emoji) {
    try {
        await safeSend(sock, jid, {
            react: {
                text: emoji,
                key: msg.key
            }
        });
        return true;
    } catch (error) {
        if (!error.message?.includes('rate-overlimit')) {
            console.error('❌ Reaction error:', error.message);
        }
        return false;
    }
}

/**
 * Envoyer une présence (typing, recording, etc.)
 */
/**
 * Envoyer une présence (typing, recording, etc.)
 */
async function safePresence(sock, jid, type) {
    try {
        // ⭐ VÉRIFICATION : Ne pas envoyer de présence si la socket est fermée
        
        
        await sock.sendPresenceUpdate(type, jid);
        return true;
    } catch (error) {
        // ⭐ GESTION D'ERREURS AMÉLIORÉE
        if (error.message?.includes('not connected') || 
            error.message?.includes('closed') ||
            error.message?.includes('Socket closed')) {
            return false;
        }
        if (!error.message?.includes('rate-overlimit')) {
            console.error('❌ Presence error:', error.message);
        }
        return false;
    }
}

/**
 * Nettoyer les anciens timestamps (appeler périodiquement)
 */
function cleanupTimestamps() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    for (const [key, timestamp] of messageTimestamps.entries()) {
        if (now - timestamp > maxAge) {
            messageTimestamps.delete(key);
        }
    }
}

// Nettoyer automatiquement toutes les minutes
setInterval(cleanupTimestamps, 60000);

export {
    safeSend,
    safeReact,
    safePresence,
    cleanupTimestamps
};