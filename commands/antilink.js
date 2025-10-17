import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'antilink',
    description: 'Toggle anti-link protection',
    
    async execute({ sock, msg, groupSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, '❌ This command can only be used in groups.', { quoted: msg });
        }

        const updates = { antilink_enabled: !groupSettings.antilink_enabled };
        const message = `Anti-link protection ${updates.antilink_enabled ? 'enabled' : 'disabled'}`;

        // ⭐ MODIFICATION: Supprimer phoneNumber
        await Database.updateGroupSettings(jid, updates);
        
        sendReply(sock, jid, formatSuccess(`${message}`), { quoted: null });
    }
};