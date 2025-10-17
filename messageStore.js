// messageStore.js - Version single-user
class MessageStore {
    constructor() {
        this.messageCache = new Map();
        this.setupCleanupInterval();
    }

    // ⭐ MODIFICATION: Supprimer phoneNumber
    async storeMessage(msg, content = '', mediaInfo = null) {
        try {
            const messageId = msg.key.id;
            const sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = msg.key.remoteJid.endsWith('@g.us');

            const messageData = {
                messageId,
                sender,
                jid: msg.key.remoteJid,
                content,
                mediaType: mediaInfo?.type || null,
                mediaPath: mediaInfo?.path || null,
                isViewOnce: mediaInfo?.isViewOnce || false,
                isGroup,
                timestamp: new Date().toISOString()
            };

            // ⭐ MODIFICATION: Utiliser messageId comme clé unique
            this.messageCache.set(messageId, messageData);

            // Limiter la taille du cache
            if (this.messageCache.size > 1000) {
                const firstKey = this.messageCache.keys().next().value;
                this.messageCache.delete(firstKey);
            }

            console.log(`💾 Message stored: ${messageId}`);
            return messageData;

        } catch (error) {
            console.error(`❌ Message storage error:`, error.message);
            return null;
        }
    }

    // ⭐ MODIFICATION: Supprimer phoneNumber
    getMessage(messageId) {
        return this.messageCache.get(messageId) || null;
    }

    // ⭐ MODIFICATION: Supprimer phoneNumber
    deleteMessage(messageId) {
        const message = this.messageCache.get(messageId);
        
        if (message && message.mediaPath) {
            // Nettoyer le fichier média si nécessaire
            try {
                import('fs').then(fs => {
                    if (fs.existsSync(message.mediaPath)) {
                        fs.unlinkSync(message.mediaPath);
                    }
                });
            } catch (e) {
                // Ignorer les erreurs de suppression
            }
        }
        
        this.messageCache.delete(messageId);
    }

    // Nettoyage automatique du cache
    setupCleanupInterval() {
        setInterval(() => {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            for (const [messageId, message] of this.messageCache.entries()) {
                if (new Date(message.timestamp).getTime() < oneHourAgo) {
                    this.deleteMessage(messageId);
                }
            }
        }, 30 * 60 * 1000); // Toutes les 30 minutes
    }
}

const messageStore = new MessageStore();
export default messageStore;