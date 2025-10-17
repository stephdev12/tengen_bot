import { sendReply, formatError } from '../lib/helpers.js';
import axios from 'axios';

const API_KEITH = 'https://apis-keith.vercel.app';

export default {
    name: 'tools',
    aliases: ['fancy', 'encrypt', 'encrypt2', 'tempmail', 'getmail', 'tools'],
    description: 'Outils divers : texte fancy, encryption, email temporaire',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const query = args.join(' ').trim();

        try {
            switch (commandName) {
                case 'fancy':
                    await handleFancy(sock, msg, args, phoneNumber);
                    break;
                    
                case 'encrypt':
                    await handleEncrypt(sock, msg, query, phoneNumber);
                    break;
                    
                case 'encrypt2':
                    await handleEncrypt2(sock, msg, query, phoneNumber);
                    break;
                    
                case 'tempmail':
                    await handleTempMail(sock, msg, phoneNumber);
                    break;
                    
                case 'getmail':
                    await handleGetMail(sock, msg, query, phoneNumber);
                    break;
                    
                case 'tools':
                    await sock.sendMessage(jid, { react: { text: '🛠️', key: msg.key } });
                    break;
                    
                default:
                    await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            }
        } catch (error) {
            console.error(`❌ Erreur ${commandName}:`, error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        }
    }
};

// Fonction de requête API
async function makeRequest(url) {
    try {
        const response = await axios.get(url, { timeout: 30000 });
        return response.data;
    } catch (error) {
        throw new Error(`API error: ${error.response?.status || error.message}`);
    }
}

// HANDLERS DES OUTILS

async function handleFancy(sock, msg, args, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    if (args.length === 0) {
        await sendReply(sock, jid, 
            `✨ *Usage Fancy*\n\n` +
            `!fancy styles <texte> - Voir tous les styles\n` +
            `!fancy <texte> <numéro> - Appliquer un style\n\n` +
            `Exemple: !fancy hello 3`, 
            { quoted: msg }
        );
        return;
    }

    // Commande !fancy styles
    if (args[0].toLowerCase() === 'styles') {
        const text = args.slice(1).join(' ');
        
        if (!text) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return;
        }

        await sock.sendMessage(jid, { react: { text: '📋', key: msg.key } });

        try {
            const data = await makeRequest(`${API_KEITH}/fancytext/styles?q=${encodeURIComponent(text)}`);
            
            if (!data.styles || !data.styles.length) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return;
            }

            let message = ` *Styles disponibles (${data.count})*\n\n`;
            
            // Afficher les 10 premiers styles
            data.styles.slice(0, 10).forEach((style, index) => {
                message += `${index + 1}. ${style.name}\n`;
                message += `   ${style.result}\n\n`;
            });

            if (data.styles.length > 10) {
                message += `... et ${data.styles.length - 10} styles supplémentaires\n\n`;
            }

            message += `Utilisez: !fancy <texte> <numéro>\n`;
            message += `Exemple: !fancy ${text} 5\n\n`;
            ;

            await sendReply(sock, jid, message, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        }
        return;
    }

    // Commande !fancy <texte> <numéro>
    if (args.length < 2) {
        await sendReply(sock, jid, 
            `❌ *Usage incorrect*\n\n` +
            `!fancy <texte> <numéro>\n` +
            `Exemple: !fancy hello 3\n\n` +
            `Pour voir les styles: !fancy styles hello`, 
            { quoted: msg }
        );
        return;
    }

    const text = args.slice(0, -1).join(' ');
    const styleNumber = args[args.length - 1];

    // Vérifier que le dernier argument est un nombre
    if (isNaN(styleNumber)) {
        await sendReply(sock, jid, 
            `❌ *Numéro de style invalide*\n\n` +
            `Le dernier argument doit être un nombre\n` +
            `Exemple: !fancy hello 3\n\n` +
            `Pour voir les styles: !fancy styles hello`, 
            { quoted: msg }
        );
        return;
    }

    await sock.sendMessage(jid, { react: { text: '✨', key: msg.key } });

    try {
        const data = await makeRequest(`${API_KEITH}/fancytext?q=${encodeURIComponent(text)}&style=${styleNumber}`);
        
        if (!data.result) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return;
        }

        await sendReply(sock, jid, `${data.result}`, { quoted: msg });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    }
}

async function handleEncrypt(sock, msg, code, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    if (!code) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return;
    }

    await sock.sendMessage(jid, { react: { text: '🔐', key: msg.key } });

    try {
        const data = await makeRequest(`${API_KEITH}/tools/encrypt?q=${encodeURIComponent(code)}`);
        
        if (!data.status || !data.result) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return;
        }

        const encryptedCode = data.result.length > 2000 ? data.result.substring(0, 2000) + '...' : data.result;
        
        await sendReply(sock, jid, 
            `🔐 Encrypted\n\n\`\`\`javascript\n${encryptedCode}\n\`\`\`\n`, 
            { quoted: msg }
        );
        
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    }
}

async function handleEncrypt2(sock, msg, code, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    if (!code) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return;
    }

    await sock.sendMessage(jid, { react: { text: '🔒', key: msg.key } });

    try {
        const data = await makeRequest(`${API_KEITH}/tools/encrypt2?q=${encodeURIComponent(code)}`);
        
        if (!data.status || !data.result) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return;
        }

        const encryptedCode = data.result.length > 2000 ? data.result.substring(0, 2000) + '...' : data.result;
        
        await sendReply(sock, jid, 
            `🔒 Encrypted V2\n\n\`\`\`javascript\n${encryptedCode}\n\`\`\`\n`, 
            { quoted: msg }
        );
        
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    }
}

async function handleTempMail(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;

    await sock.sendMessage(jid, { react: { text: '📧', key: msg.key } });

    try {
        const data = await makeRequest(`${API_KEITH}/tempmail`);
        
        if (!data.status || !data.result || !data.result[0]) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return;
        }

        const [email, session, timestamp] = data.result;
        
        await sendReply(sock, jid, 
            `📧 ${email}\n🔑 ${session}\n⏰ ${timestamp}`, 
            { quoted: msg }
        );
        
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    }
}

async function handleGetMail(sock, msg, sessionId, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    if (!sessionId) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        return;
    }

    await sock.sendMessage(jid, { react: { text: '📨', key: msg.key } });

    try {
        const data = await makeRequest(`${API_KEITH}/get_inbox_tempmail?q=${encodeURIComponent(sessionId)}`);
        
        if (!data.status) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return;
        }

        let message = `📨 Inbox\n\n`;
        
        if (data.emails && data.emails.length > 0) {
            data.emails.forEach((email, index) => {
                message += `📧 ${index + 1}\n`;
                message += `👤 ${email.from || 'Unknown'}\n`;
                message += `📋 ${email.subject || 'No subject'}\n`;
                message += `⏰ ${email.date || 'Unknown'}\n`;
                message += `---\n`;
            });
        } else {
            message += `📭 No emails\n`;
        }
        
        message += `\n> TECH & VERSE`;

        await sendReply(sock, jid, message, { quoted: msg });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
    }
}

// Pas besoin de handleButtonResponse pour cette commande
export async function handleButtonResponse() {}