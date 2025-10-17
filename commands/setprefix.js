import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'setprefix',
    description: 'Change your bot prefix',
    
    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 3) {
            return sendReply(sock, jid, 
                formatError(`Prefix must be 1-3 characters\nCurrent: ${userSettings.prefix}`),
                { quoted: msg }
            );
        }

        try {
            // ⭐ MODIFICATION: Mettre à jour directement les settings
            await Database.updateUserSettings({ prefix: newPrefix });
            
            // Confirmation avec le NOUVEAU prefix dans le message
            await sendReply(sock, jid, 
                formatSuccess(`Prefix changed to: \`${newPrefix}\``), 
                { quoted: msg }
            );
            
            console.log(`✅ Prefix changed: ${userSettings.prefix} -> ${newPrefix}`);
            
        } catch (error) {
            console.error('Error updating prefix:', error);
            await sendReply(sock, jid, 
                formatError('Database error. Please try again.'), 
                { quoted: msg }
            );
        }
    }
};