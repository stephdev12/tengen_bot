import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger la base de données
import Database from './database.js';

function font(text) {
    if (!text || typeof text !== 'string') {
        return text || '';
    }
    const normalChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const fancyChars = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
    
    return text.split('').map(char => {
        const index = normalChars.indexOf(char);
        return index !== -1 ? fancyChars[index] : char;
    }).join('');
}

function formatMessage(text) {
    if (!text || typeof text !== 'string') {
        return '> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴';
    }
    
    try {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const formatted = lines.map(line => `> ${line} `).join('\n');
        return `${formatted}\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴`;
    } catch (error) {
        console.error('Format message error:', error);
        return `${text}\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴`;
    }
}

function buildAdReplyContext() {
    return {
        externalAdReply: {
            title: "𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴",
            body: "BY STEPHDEV",
            thumbnailUrl: 'https://files.catbox.moe/k6ta18.jpg',
            sourceUrl: 'https://whatsapp.com/channel/0029Vb6DrnUHAdNQtz2GC307',
            mediaType: 1,
            mediaUrl: 'https://whatsapp.com/channel/0029Vb6DrnUHAdNQtz2GC307',
            renderLargerThumbnail: false
        }
    };
}

async function sendReply(sock, to, text, options = {}) {
    try {
        if (!sock || typeof sock.sendMessage !== 'function') {
            console.error('sock.sendMessage is not a function - Socket may be disconnected');
            return false;
        }
        
        if (!text || typeof text !== 'string') {
            text = 'Empty message';
        }
        
        const messageOptions = {
            text: formatMessage(text),
            contextInfo: buildAdReplyContext()
        };
        
        if (options.mentions && Array.isArray(options.mentions) && options.mentions.length > 0) {
            messageOptions.mentions = options.mentions;
            messageOptions.contextInfo.mentionedJid = options.mentions;
        }

        const messageConfig = {};
        
        if (options.quoted && options.quoted.key) {
            messageConfig.quoted = options.quoted;
        }

        await sock.sendMessage(to, messageOptions, messageConfig);
        
        return true;
    } catch (error) {
        console.error('sendReply error:', error.message);
        return false;
    }
}

async function sendMessage(sock, to, text, options = {}) {
    try {
        if (!sock || typeof sock.sendMessage !== 'function') {
            console.error('sock.sendMessage is not a function - Socket may be disconnected');
            return false;
        }
        
        const messageOptions = {
            text: text,
            contextInfo: buildAdReplyContext()
        };
        
        if (options.mentions && Array.isArray(options.mentions) && options.mentions.length > 0) {
            messageOptions.mentions = options.mentions;
            messageOptions.contextInfo.mentionedJid = options.mentions;
        }

        const messageConfig = {};
        
        if (options.quoted && options.quoted.key) {
            messageConfig.quoted = options.quoted;
        }

        await sock.sendMessage(to, messageOptions, messageConfig);
        
        return true;
    } catch (error) {
        console.error('sendMessage error:', error.message);
        return false;
    }
}

function formatError(text) {
    if (!text || typeof text !== 'string') {
        return 'Error';
    }
    return ` ${text}`;
}

function formatSuccess(text) {
    if (!text || typeof text !== 'string') {
        return 'Success';
    }
    return `${text}`;
}

function formatHelp(text) {
    if (!text || typeof text !== 'string') {
        return 'Help';
    }
    return `${text}`;
}

// Mise à jour des paramètres de session
async function updateSessionSettings(updates) {
    try {
        await Database.updateUserSettings(updates);
        console.log('✅ Session settings updated:', Object.keys(updates));
        return true;
    } catch (error) {
        console.error('❌ Error updating session settings:', error.message);
        return false;
    }
}

export {
    font,
    sendReply,
    sendMessage,
    formatError,
    formatSuccess,
    formatHelp,
    updateSessionSettings,
    buildAdReplyContext
};