// commands/delsudo.js
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import sudoManager from '../lib/sudoManager.js';
import { isOwner } from '../lib/isAdmin.js';
import config from '../config.js';

export default {
    name: 'delsudo',
    aliases: ['removesudo', 'unsudo'],
    description: 'Remove sudo privileges from a user',
    usage: 'delsudo @user or delsudo (reply to user message) or delsudo (to list)',
    
    async execute({ sock, msg, args, jid, isGroup }) {
        try {
            const phoneNumber = config.owner;
            
            // Vérifier si c'est le propriétaire
            if (!isOwner(msg)) { // ⭐ MODIFICATION: Supprimer phoneNumber
                return await sock.sendMessage(jid, {
                    image: {
                        url: 'https://example.com/error-image.jpg'
                    },
                    caption: formatError('❌ *PERMISSION DENIED*\n\nOnly the bot owner can use this command.')
                }, { quoted: null });
            }
            
            let targetUserJid = '';
            
            // Méthode 1: Mention dans le message
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length > 0) {
                targetUserJid = mentions[0];
            }
            // Méthode 2: Réponse à un message
            else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
                targetUserJid = msg.message.extendedTextMessage.contextInfo.participant;
            }
            // Méthode 3: Réponse à un message (stanzaId pour les LID)
            else if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo;
                targetUserJid = quotedMsg.participant || quotedMsg.remoteJid;
            }
            // Méthode 4: Argument direct
            else if (args[0]) {
                const cleanNumber = args[0].replace(/[^0-9]/g, '');
                if (cleanNumber.length > 0) {
                    targetUserJid = cleanNumber + '@s.whatsapp.net';
                }
            }
            // Méthode 5: Liste tous les sudo users
            else if (args.length === 0) {
                // ⭐ MODIFICATION: Supprimer phoneNumber
                const sudoUsers = sudoManager.getSudoUsers();
                
                if (sudoUsers.length === 0) {
                    return await sock.sendMessage(jid, {
                        image: {
                            url: 'https://example.com/error-image.jpg'
                        },
                        caption: formatError('🔍 *NO SUDO USERS*\n\nNo sudo users found in the database.')
                    }, { quoted: null });
                }
                
                let userList = '🔐 *SUDO USERS LIST*\n\n';
                sudoUsers.forEach((userJid, index) => {
                    const displayId = userJid.split('@')[0];
                    const idType = userJid.includes('@lid') ? '(LID)' : '';
                    userList += `${index + 1}. ${displayId} ${idType}\n`;
                });
                
                userList += `\n📊 Total: ${sudoUsers.length} sudo user(s)`;
                userList += `\n\n🗑️ Use: delsudo @user to remove`;
                
                return await sock.sendMessage(jid, {
                    image: {
                        url: 'https://example.com/list-image.jpg'
                    },
                    caption: userList
                }, { quoted: null });
            }
            else {
                return await sock.sendMessage(jid, {
                    image: {
                        url: 'https://i.postimg.cc/tg8QrNNj/Uzui-Tengen-with-his-three-wives.jpg'
                    },
                    caption: formatError('❌ *USAGE*\n\n• delsudo @user\n• Reply to user message with: delsudo\n• Use delsudo alone to list all sudo users')
                }, { quoted: null });
            }
            
            // Vérifier que l'utilisateur cible est valide
            if (!targetUserJid || (!targetUserJid.includes('@s.whatsapp.net') && !targetUserJid.includes('@lid'))) {
                return await sock.sendMessage(jid, {
                    image: {
                        url: 'https://i.postimg.cc/tg8QrNNj/Uzui-Tengen-with-his-three-wives.jpg'
                    },
                    caption: formatError('❌ *INVALID USER*\n\nPlease specify a valid user.')
                }, { quoted: null });
            }
            
            // ⭐ MODIFICATION: Supprimer phoneNumber
            const success = sudoManager.removeSudoUser(targetUserJid);
            
            if (success) {
                const displayNumber = targetUserJid.split('@')[0];
                
                await sock.sendMessage(jid, {
                    image: {
                        url: 'https://i.postimg.cc/tg8QrNNj/Uzui-Tengen-with-his-three-wives.jpg'
                    },
                    caption: formatSuccess(`> 🗑️ _*SUDO PRIVILEGES REMOVED*_\n\n👤 User: ${displayNumber}!`)
                }, { quoted: null });
                
            } else {
                await sock.sendMessage(jid, {
                    image: {
                        url: 'https://i.postimg.cc/tg8QrNNj/Uzui-Tengen-with-his-three-wives.jpg'
                    },
                    caption: formatError('❌ *USER NOT SUDO*\n\nThis user does not have sudo privileges.\nNo action required.')
                }, { quoted: null });
            }
            
        } catch (error) {
            console.error(`❌ Delsudo command error:`, error); // ⭐ MODIFICATION: Supprimer phoneNumber
            
            await sock.sendMessage(jid, {
                image: {
                    url: 'https://i.postimg.cc/tg8QrNNj/Uzui-Tengen-with-his-three-wives.jpg'
                },
                caption: formatError(`💥 *COMMAND ERROR*\n\nError: ${error.message}\n\nPlease try again or contact support.`)
            }, { quoted: null });
        }
    }
};