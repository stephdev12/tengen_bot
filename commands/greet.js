import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'greet',
    aliases: ['welcome', 'goodbye'],
    description: 'Manage welcome and goodbye messages',
    
    async execute({ sock, msg, args, groupSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, '❌ This command can only be used in groups.', { quoted: msg });
        }

        // ⭐ MODIFICATION: Récupérer la commande utilisée directement
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || '';
        
        const commandName = body.slice(groupSettings.prefix?.length || '!'.length).trim().split(/\s+/)[0].toLowerCase();

        const action = args[0]?.toLowerCase();
        
        // ⭐ MODIFICATION: Si la commande est "welcome" ou "goodbye" directement
        if (commandName === 'welcome' || commandName === 'goodbye') {
            let updates = {};
            let message = '';

            if (commandName === 'welcome') {
                if (action === 'off') {
                    updates.welcome_enabled = false;
                    message = '❌ Welcome messages disabled';
                } else {
                    updates.welcome_enabled = !groupSettings.welcome_enabled;
                    message = `Welcome messages ${updates.welcome_enabled ? 'enabled' : 'disabled'}`;
                }
            } 
            else if (commandName === 'goodbye') {
                if (action === 'off') {
                    updates.goodbye_enabled = false;
                    message = '❌ Goodbye messages disabled';
                } else {
                    updates.goodbye_enabled = !groupSettings.goodbye_enabled;
                    message = `Goodbye messages ${updates.goodbye_enabled ? 'enabled' : 'disabled'}`;
                }
            }

            // ⭐ MODIFICATION: Supprimer phoneNumber
            await Database.updateGroupSettings(jid, updates);
            
            return sendReply(sock, jid, formatSuccess(message), { quoted: msg });
        }

        // ⭐ MODIFICATION: Version originale pour "greet"
        if (!action) {
            const status = `👋 **Greet Settings**\n\n` +
                         `Welcome: ${groupSettings.welcome_enabled ? '✅ ON' : '❌ OFF'}\n` +
                         `Goodbye: ${groupSettings.goodbye_enabled ? '✅ ON' : '❌ OFF'}\n\n` +
                         `**Usage:**\n` +
                         `!welcome - Toggle welcome\n` +
                         `!welcome off - Disable welcome\n` +
                         `!goodbye - Toggle goodbye\n` +
                         `!goodbye off - Disable goodbye\n` +
                         `!greet both - Toggle both`;
            
            return sendReply(sock, jid, status, { quoted: msg });
        }

        let updates = {};
        let message = '';

        switch (action) {
            case 'welcome':
                updates.welcome_enabled = !groupSettings.welcome_enabled;
                message = `Welcome messages ${updates.welcome_enabled ? 'enabled' : 'disabled'}`;
                break;
                
            case 'goodbye':
                updates.goodbye_enabled = !groupSettings.goodbye_enabled;
                message = `Goodbye messages ${updates.goodbye_enabled ? 'enabled' : 'disabled'}`;
                break;
                
            case 'both':
                updates.welcome_enabled = !groupSettings.welcome_enabled;
                updates.goodbye_enabled = !groupSettings.goodbye_enabled;
                message = `Both messages ${updates.welcome_enabled ? 'enabled' : 'disabled'}`;
                break;
                
            default:
                return sendReply(sock, jid, '❌ Invalid option. Use: welcome, goodbye, or both', { quoted: msg });
        }

        // ⭐ MODIFICATION: Supprimer phoneNumber
        await Database.updateGroupSettings(jid, updates);
        
        sendReply(sock, jid, formatSuccess(message), { quoted: msg });
    }
};