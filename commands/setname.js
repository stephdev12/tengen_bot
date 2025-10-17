import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'setname',
    description: 'Change your bot name',
    
    async execute({ sock, msg, args, userSettings }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner; // ⭐ MODIFICATION
        
        const newName = args.join(' ');
        if (!newName || newName.length < 2 || newName.length > 30) {
            return sendReply(sock, jid, 
                formatError(`Name must be 2-30 characters\nCurrent: ${userSettings.bot_name}`),
                { quoted: msg }
            );
        }

        try {
            // ⭐ MODIFICATION: Mettre à jour directement les settings
            await Database.updateUserSettings({ bot_name: newName });
            
            await sendReply(sock, jid, 
                formatSuccess(`Bot name changed to: ${newName}`), 
                { quoted: msg }
            );
            
            console.log(`✅ Bot name changed: ${newName}`);
            
        } catch (error) {
            console.error('Error updating name:', error);
            await sendReply(sock, jid, 
                formatError('Database error. Please try again.'), 
                { quoted: msg }
            );
        }
    }
};