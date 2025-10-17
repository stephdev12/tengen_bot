import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import MessageStore from '../messageStore.js';
import { downloadContentFromMessage } from 'baileys';
import { writeFile } from 'fs/promises';
import config from '../config.js';

export default {
    name: 'antidelete',
    aliases: ['ad', 'antisupp'],
    description: 'Enable/disable anti-delete system',
    
    async execute({ sock, msg, args, userSettings, whatsappManager }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION: Utiliser config.owner
        
        const action = args[0]?.toLowerCase();
        
        if (!action || !['on', 'off', 'status', 'enable', 'disable'].includes(action)) {
            return await sendReply(sock, jid, 
                formatError('Usage: antidelete <on|off|status>'), 
                { quoted: msg }
            );
        }

        try {
            if (action === 'status') {
                const antideleteEnabled = userSettings.antidelete_enabled || false;
                const statusText = `AntiDelete Status:\n\n` +
                                 `> Status: ${antideleteEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n` +
                                 `> Description: ${antideleteEnabled ? 'Monitoring and saving deleted messages' : 'System inactive'}`;
                
                return await sendReply(sock, jid, statusText, { quoted: msg });
            }

            const shouldEnable = ['on', 'enable'].includes(action);
            
            if (userSettings.antidelete_enabled === shouldEnable) {
                const alreadyText = `AntiDelete is already ${shouldEnable ? 'enabled' : 'disabled'}`;
                return await sendReply(sock, jid, formatError(alreadyText), { quoted: msg });
            }

            // ⭐ MODIFICATION: Mettre à jour directement les settings
            await Database.updateUserSettings({
                antidelete_enabled: shouldEnable
            });

            const resultText = `✅ AntiDelete ${shouldEnable ? 'enabled' : 'disabled'}\n` +
                              `> Description: ${shouldEnable ? 'Now monitoring and saving deleted messages' : 'System deactivated'}`;

            await sendReply(sock, jid, resultText, { quoted: msg });

            console.log(`🔧 Antidelete ${shouldEnable ? 'enabled' : 'disabled'}`);

        } catch (error) {
            console.error(`❌ Antidelete command error:`, error);
            await sendReply(sock, jid, 
                formatError(`Database error: ${error.message}`), 
                { quoted: msg }
            );
        }
    }
};

// ⭐ MODIFICATION: Supprimer phoneNumber des paramètres
async function storeMessage(msg, sock) {
    try {
        const userSettings = await Database.getUserSettings();
        const antideleteEnabled = userSettings.antidelete_enabled;
        
        if (!antideleteEnabled || !msg.key?.id) return;

        let content = '';
        let mediaInfo = null;
        let isViewOnce = false;

        const viewOnceContainer = msg.message?.viewOnceMessageV2?.message || 
                                msg.message?.viewOnceMessage?.message;

        // Gérer les messages view-once
        if (viewOnceContainer) {
            if (viewOnceContainer.imageMessage) {
                mediaInfo = await downloadAndStoreMedia(msg.key.id, viewOnceContainer.imageMessage, 'image', true);
                content = viewOnceContainer.imageMessage.caption || '';
                isViewOnce = true;
            } else if (viewOnceContainer.videoMessage) {
                mediaInfo = await downloadAndStoreMedia(msg.key.id, viewOnceContainer.videoMessage, 'video', true);
                content = viewOnceContainer.videoMessage.caption || '';
                isViewOnce = true;
            }
        } 
        
        // Gérer les messages normaux
        else if (msg.message?.conversation) {
            content = msg.message.conversation;
        } else if (msg.message?.extendedTextMessage?.text) {
            content = msg.message.extendedTextMessage.text;
        } else if (msg.message?.imageMessage) {
            mediaInfo = await downloadAndStoreMedia(msg.key.id, msg.message.imageMessage, 'image');
            content = msg.message.imageMessage.caption || '';
        } else if (msg.message?.videoMessage) {
            mediaInfo = await downloadAndStoreMedia(msg.key.id, msg.message.videoMessage, 'video');
            content = msg.message.videoMessage.caption || '';
        } else if (msg.message?.stickerMessage) {
            mediaInfo = await downloadAndStoreMedia(msg.key.id, msg.message.stickerMessage, 'sticker');
        } else if (msg.message?.audioMessage) {
            mediaInfo = await downloadAndStoreMedia(msg.key.id, msg.message.audioMessage, 'audio');
        }

        // ⭐ MODIFICATION: Stocker sans phoneNumber
        await MessageStore.storeMessage(msg, content, mediaInfo);

        // ⭐ TRANSFÉRER LES MESSAGES VIEW-ONCE AU PROPRIÉTAIRE
        if (isViewOnce && mediaInfo) {
            await forwardViewOnceToOwner(sock, msg, mediaInfo);
        }

    } catch (error) {
        console.error(`❌ Message storage error:`, error.message);
    }
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function downloadAndStoreMedia(messageId, mediaMessage, mediaType, isViewOnce = false) {
    try {
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
        const buffer = await streamToBuffer(stream);
        
        if (buffer.length === 0) {
            throw new Error('Empty buffer');
        }

        // Déterminer l'extension du fichier
        const extensions = {
            image: 'jpg',
            video: 'mp4',
            sticker: 'webp',
            audio: mediaMessage.mimetype?.includes('ogg') ? 'ogg' : 'mp3'
        };

        const ext = extensions[mediaType] || 'bin';
        const mediaPath = `./tmp/${messageId}.${ext}`;
        
        await writeFile(mediaPath, buffer);

        return {
            type: mediaType,
            path: mediaPath,
            isViewOnce
        };

    } catch (error) {
        console.error(`❌ Media download error:`, error.message);
        return null;
    }
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function forwardViewOnceToOwner(sock, msg, mediaInfo) {
    try {
        const ownerJid = `${config.owner}@s.whatsapp.net`;
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderName = sender.split('@')[0];
        
        const viewOnceMessage = ` View-Once ${mediaInfo.type.toUpperCase()} Detected\n\n` +
                              `From: @${senderName}\n` +
                              `Time: ${new Date().toLocaleString()}`;

        const mediaOptions = {
            caption: viewOnceMessage,
            mentions: [sender]
        };

        if (mediaInfo.type === 'image') {
            await sock.sendMessage(ownerJid, { image: { url: mediaInfo.path }, ...mediaOptions });
        } else if (mediaInfo.type === 'video') {
            await sock.sendMessage(ownerJid, { video: { url: mediaInfo.path }, ...mediaOptions });
        }

        console.log(`🔍 View-once ${mediaInfo.type} forwarded to owner`);

    } catch (error) {
        console.error(`❌ View-once transfer error:`, error.message);
    }
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function handleMessageRevocation(revocationMsg, sock) {
    try {
        // Vérifier si l'antidelete est activé
        const userSettings = await Database.getUserSettings();
        const antideleteEnabled = userSettings.antidelete_enabled;
        
        if (!antideleteEnabled) return;

        const messageId = revocationMsg.message?.protocolMessage?.key?.id;
        if (!messageId) return;

        const originalMessage = MessageStore.getMessage(messageId);
        
        if (!originalMessage) {
            console.log(`ℹ️ Deleted message not found: ${messageId}`);
            return;
        }

        const deletedBy = revocationMsg.key.participant || revocationMsg.key.remoteJid;
        const ownerJid = `${config.owner}@s.whatsapp.net`;
        
        // Vérifier si c'est le bot qui a supprimé le message
        if (deletedBy.includes(sock.user.id.split('@')[0])) return;

        await sendDeleteNotification(sock, originalMessage, deletedBy, ownerJid);
        
        // Supprimer du cache
        MessageStore.deleteMessage(messageId);

    } catch (error) {
        console.error(`❌ Revocation handling error:`, error.message);
    }
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function sendDeleteNotification(sock, originalMessage, deletedBy, ownerJid) {
    try {
        const sender = originalMessage.sender;
        const senderName = sender.split('@')[0];
        const deletedByName = deletedBy.split('@')[0];
        
        let groupName = '';
        if (originalMessage.isGroup) {
            try {
                const metadata = await sock.groupMetadata(originalMessage.jid);
                groupName = metadata?.subject || 'Unknown Group';
            } catch (err) {
                groupName = 'Unknown Group';
            }
        }

        const time = new Date().toLocaleString('en-US', {
            timeZone: 'UTC',
            hour12: false,
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const deleteNotification = `*DELETED MESSAGE DETECTED*\n\n` +
            `*> From:* @${senderName}\n\n` +
            `*> Deleted by:* @${deletedByName}\n\n` +
            `*> Location:* ${originalMessage.isGroup ? 'Group' : 'Private Chat'}\n\n` +
            `*> Group/Chat:* ${groupName || 'Private Chat'}\n\n` +
            `*message:* ${originalMessage.content || '[Media or special message]'}\n\n` +
            `> _Saved by Antidelete System_`;

        // Envoyer la notification
        await sock.sendMessage(ownerJid, {
            text: deleteNotification,
            mentions: [deletedBy, sender]
        });

        // Gestion des médias supprimés
        if (originalMessage.mediaType && originalMessage.mediaPath) {
            await sendRecoveredMedia(sock, ownerJid, originalMessage, sender, deletedByName);
        }

        console.log(`✅ Deleted message processed: ${originalMessage.messageId}`);

    } catch (error) {
        console.error(`❌ Delete notification error:`, error.message);
    }
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function sendRecoveredMedia(sock, ownerJid, originalMessage, sender, deletedByName) {
    try {
        const senderName = sender.split('@')[0];
        const mediaCaption = `Deleted ${originalMessage.mediaType.toUpperCase()} Recovered\n\n` +
                           `From: @${senderName}\n` +
                           `Deleted by: @${deletedByName}`;

        const mediaOptions = {
            caption: mediaCaption,
            mentions: [sender]
        };

        switch (originalMessage.mediaType) {
            case 'image':
                await sock.sendMessage(ownerJid, {
                    image: { url: originalMessage.mediaPath },
                    ...mediaOptions
                });
                break;
            case 'video':
                await sock.sendMessage(ownerJid, {
                    video: { url: originalMessage.mediaPath },
                    ...mediaOptions
                });
                break;
            case 'sticker':
                await sock.sendMessage(ownerJid, {
                    sticker: { url: originalMessage.mediaPath }
                });
                await sock.sendMessage(ownerJid, {
                    text: mediaCaption,
                    mentions: [sender]
                });
                break;
            case 'audio':
                await sock.sendMessage(ownerJid, {
                    audio: { url: originalMessage.mediaPath },
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    ...mediaOptions
                });
                break;
        }

        console.log(`📎 ${originalMessage.mediaType} media recovered and sent`);

    } catch (error) {
        console.error(`❌ Recovered media send error:`, error.message);
    }
}

async function streamToBuffer(stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

export { storeMessage, handleMessageRevocation };