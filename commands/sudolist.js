// commands/sudolist.js
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import sudoManager from '../lib/sudoManager.js';
import { isOwner } from '../lib/isAdmin.js';
import config from '../config.js';

export default {
    name: 'sudolist',
    aliases: ['listsudo', 'sudos'],
    description: 'List all sudo users for this session',
    usage: 'sudolist',
    
    async execute({ sock, msg, args, jid }) {
        try {
            const phoneNumber = config.owner;
            
            // Vérifier si c'est le propriétaire
            if (!isOwner(msg)) { // ⭐ MODIFICATION: Supprimer phoneNumber
                return await sendReply(sock, jid, 
                    formatError('❌ Only the bot owner can use this command'), 
                    { quoted: msg }
                );
            }
            
            // ⭐ MODIFICATION: Supprimer phoneNumber
            const sudoUsers = sudoManager.getSudoUsers();
            
            if (sudoUsers.length === 0) {
                return await sendReply(sock, jid, 
                    formatError('❌ No sudo users found\n\n💡 Use: sudo @user to add'), 
                    { quoted: msg }
                );
            }
            
            let userList = '🔐 *Sudo Users List*\n';
            userList += `━━━━━━━━━━━━━━━\n\n`;
            
            sudoUsers.forEach((userJid, index) => {
                const displayId = userJid.split('@')[0];
                const idType = userJid.includes('@lid') ? '(LID)' : '';
                userList += `${index + 1}. ${displayId} ${idType}\n`;
            });
            
            userList += `\n━━━━━━━━━━━━━━━`;
            userList += `\n📊 Total: ${sudoUsers.length} sudo user(s)`;
            userList += `\n\n💡 Commands:`;
            userList += `\n• sudo @user - Add sudo`;
            userList += `\n• delsudo @user - Remove sudo`;
            
            await sendReply(sock, jid, userList, { quoted: msg });
            
        } catch (error) {
            console.error(`❌ Sudolist command error:`, error); // ⭐ MODIFICATION: Supprimer phoneNumber
            await sendReply(sock, jid, formatError(`Error: ${error.message}`), { quoted: msg });
        }
    }
};