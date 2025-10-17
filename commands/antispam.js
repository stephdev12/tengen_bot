import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'antispam',
    description: 'Toggle anti-spam protection',
    
    async execute({ sock, msg, groupSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, '❌ This command can only be used in groups.', { quoted: msg });
        }

        const updates = { antispam_enabled: !groupSettings.antispam_enabled };
        const message = `> Anti-spam protection ${updates.antispam_enabled ? 'enabled' : 'disabled'}`;

        // ⭐ MODIFICATION: Supprimer phoneNumber
        await Database.updateGroupSettings(jid, updates);
        
        sendReply(sock, jid, formatSuccess(`${message}`), { quoted: null });
    }
};