import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import config from '../config.js';

export default {
    name: 'warnings',
    aliases: ['warns'],
    description: 'View or reset user warnings',
    
    async execute({ sock, msg, args, userSettings, getUserWarnings, resetUserWarnings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, '❌ This command can only be used in groups.', { quoted: msg });
        }

        const action = args[0]?.toLowerCase();
        
        if (action === 'reset') {
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            
            if (mentions.length > 0) {
                // Reset pour un utilisateur spécifique
                const targetUser = mentions[0];
                resetUserWarnings(targetUser);
                
                await sendReply(sock, jid, 
                    formatSuccess(`✅ Warnings reset for @${targetUser.split('@')[0]}`), // ⭐ MODIFICATION: Supprimer session
                    { quoted: msg, mentions: [targetUser] }
                );
            } else {
                // Reset pour tous les utilisateurs du groupe
                resetUserWarnings();
                await sendReply(sock, jid, 
                    formatSuccess(`✅ All warnings reset in this group`), // ⭐ MODIFICATION: Supprimer session
                    { quoted: msg }
                );
            }
            return;
        }

        // Afficher les avertissements d'un utilisateur
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        
        if (mentions.length > 0) {
            const targetUser = mentions[0];
            const warnings = getUserWarnings(targetUser);
            
            const warningText = `⚠️ **Warnings for @${targetUser.split('@')[0]}**\n\n` +
                              `🔗 Anti-Link: ${warnings.antilink || 0}/3\n` +
                              `🚫 Anti-Spam: ${warnings.antispam || 0}/3\n\n` +
                              `💡 Use ${userSettings.prefix}warnings reset @user to reset`; // ⭐ MODIFICATION: Supprimer session
            
            await sendReply(sock, jid, warningText, { 
                quoted: msg,
                mentions: [targetUser]
            });
        } else {
            // Afficher l'aide si aucun utilisateur n'est mentionné
            await sendReply(sock, jid, 
                `⚠️ **Warnings System**\n\n` +
                `**Usage:**\n` +
                `${userSettings.prefix}warnings @user - Check user warnings\n` +
                `${userSettings.prefix}warnings reset @user - Reset user warnings\n` +
                `${userSettings.prefix}warnings reset - Reset all warnings`, // ⭐ MODIFICATION: Supprimer session
                { quoted: msg }
            );
        }
    }
};