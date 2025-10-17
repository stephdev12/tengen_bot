import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'antimention',
    aliases: ['antigroupmention'],
    description: 'Prevent group mentions in status and messages',
    
    async execute({ sock, msg, args, groupSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, '❌ This command can only be used in groups.', { quoted: msg });
        }

        const action = args[0]?.toLowerCase();
        
        if (!action) {
            const status = `
🚫 **Anti-Mention Protection**

Status: ${groupSettings.antimention_enabled ? '✅ ACTIVE' : '❌ INACTIVE'}

This feature:
• Detects group mentions in status updates
• Detects group mentions in messages  
• Automatically deletes violating content

Usage:
!antimention - Enable protection
!antimention off - Disable protection
            `;
            return sendReply(sock, jid, status, { quoted: msg });
        }

        if (action === 'off') {
            // ⭐ MODIFICATION: Supprimer phoneNumber
            await Database.updateGroupSettings(jid, { antimention_enabled: false });
            return sendReply(sock, jid, formatSuccess('❌ Anti-mention protection disabled'), { quoted: msg });
        } else {
            // ⭐ MODIFICATION: Supprimer phoneNumber
            await Database.updateGroupSettings(jid, { antimention_enabled: true });
            return sendReply(sock, jid, formatSuccess('> ✅ Anti-mention protection enabled'), { quoted: null });
        }
    }
};