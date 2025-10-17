import fs from 'fs';
import path from 'path';
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import { safeReact } from '../lib/safeSend.js';
import config from '../config.js';

const CONFIG_DIR = path.join(process.cwd(), 'data', 'autoreact');

// Default emojis
const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

function getUserConfig() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    
    if (!fs.existsSync(userConfigPath)) {
        fs.writeFileSync(userConfigPath, JSON.stringify({ 
            groups: {} // Group configuration
        }, null, 2));
    }
    
    return JSON.parse(fs.readFileSync(userConfigPath));
}

function saveUserConfig(configData) {
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    fs.writeFileSync(userConfigPath, JSON.stringify(configData, null, 2));
}

export default {
    name: 'autoreact',
    aliases: ['autoreaction', 'autoreact'],
    description: 'Enable/disable automatic reactions in groups',
    usage: 'autoreact <on/off> [emojis]',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');

        if (!isGroup) {
            return await sendReply(sock, jid, formatError('❌ This command can only be used in groups'), { quoted: msg });
        }

        const action = args[0]?.toLowerCase();
        
        if (!action || !['on', 'off', 'status', 'emojis'].includes(action)) {
            return await sendReply(sock, jid, formatError('❌ Usage: autoreact <on/off/status/emojis>'), { quoted: msg });
        }

        try {
            // Charger la configuration utilisateur
            const userConfig = getUserConfig();
            const groupConfig = userConfig.groups[jid] || { enabled: false, emojis: [...DEFAULT_EMOJIS] };

            if (action === 'status') {
                const statusText = `🤖 **AutoReact Status**\n\n` +
                                 `Status: ${groupConfig.enabled ? '✅ ENABLED' : '❌ DISABLED'}\n` +
                                 `Emojis: ${groupConfig.emojis.join(' ')}`;
                
                return await sendReply(sock, jid, statusText, { quoted: msg });
            }

            if (action === 'emojis') {
                const emojis = args.slice(1);
                if (emojis.length === 0) {
                    return await sendReply(sock, jid, formatError('❌ Usage: autoreact emojis 😂 👍 ❤️'), { quoted: msg });
                }

                groupConfig.emojis = emojis;
                userConfig.groups[jid] = groupConfig;
                saveUserConfig(userConfig);

                return await sendReply(sock, jid, formatSuccess(`✅ AutoReact emojis updated:\n${emojis.join(' ')}`), { quoted: msg });
            }

            if (action === 'on') {
                groupConfig.enabled = true;
                userConfig.groups[jid] = groupConfig;
                saveUserConfig(userConfig);

                await sendReply(sock, jid, formatSuccess(`✅ AutoReact enabled\n\nEmojis: ${groupConfig.emojis.join(' ')}`), { quoted: msg });
                
                // Réagir au message de commande
                await safeReact(sock, jid, msg, '✅');
                return;
            }

            if (action === 'off') {
                groupConfig.enabled = false;
                userConfig.groups[jid] = groupConfig;
                saveUserConfig(userConfig);

                await sendReply(sock, jid, formatSuccess('❌ AutoReact disabled'), { quoted: msg });
                await safeReact(sock, jid, msg, '❌');
                return;
            }

        } catch (error) {
            console.error(`❌ AutoReact command error:`, error);
            await sendReply(sock, jid, formatError(`Error: ${error.message}`), { quoted: msg });
        }
    }
};

// ⭐ FONCTION POUR GÉRER LES RÉACTIONS AUTOMATIQUES
export async function handleAutoReact(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        if (!jid.endsWith('@g.us')) return;

        // Charger la configuration utilisateur
        const userConfig = getUserConfig();
        const groupConfig = userConfig.groups[jid];

        if (!groupConfig || !groupConfig.enabled) return;

        // Ignorer les commandes du bot
        const messageText = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || '';
        
        if (messageText.startsWith('!') || messageText.startsWith('/')) return;

        // Choisir un emoji aléatoire
        const randomEmoji = groupConfig.emojis[Math.floor(Math.random() * groupConfig.emojis.length)];
        
        // Réagir au message
        await safeReact(sock, jid, msg, randomEmoji);

    } catch (error) {
        console.error(`❌ AutoReact handler error:`, error.message);
    }
}