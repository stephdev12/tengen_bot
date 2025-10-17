import fs from 'fs';
import path from 'path';
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import { safePresence } from '../lib/safeSend.js';
import Database from '../lib/database.js';
import config from '../config.js';

const CONFIG_DIR = path.join(process.cwd(), 'data', 'autowrite');

function getUserConfig() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    
    if (!fs.existsSync(userConfigPath)) {
        fs.writeFileSync(userConfigPath, JSON.stringify({ 
            enabled: false 
        }, null, 2));
    }
    
    return JSON.parse(fs.readFileSync(userConfigPath));
}

function saveUserConfig(configData) {
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    fs.writeFileSync(userConfigPath, JSON.stringify(configData, null, 2));
}

export default {
    name: 'autowrite',
    aliases: ['autotype', 'fakewrite'],
    description: 'Enable/disable automatic typing simulation',
    usage: 'autowrite <on/off>',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
        
        const action = args[0]?.toLowerCase();
        
        if (!action || !['on', 'off', 'status'].includes(action)) {
            return await sendReply(sock, jid, formatError('❌ Usage: autowrite <on/off/status>'), { quoted: msg });
        }

        const autowriteConfig = getUserConfig();

        if (action === 'status') {
            const status = autowriteConfig.enabled ? 'enabled' : 'disabled';
            return await sendReply(sock, jid, `✍️ Autowrite status: ${status}`, { quoted: msg });
        }

        const shouldEnable = action === 'on';
        
        if (autowriteConfig.enabled === shouldEnable) {
            const alreadyText = `❌ Autowrite is already ${shouldEnable ? 'enabled' : 'disabled'}`;
            return await sendReply(sock, jid, formatError(alreadyText), { quoted: msg });
        }

        autowriteConfig.enabled = shouldEnable;
        saveUserConfig(autowriteConfig);

        const resultText = ` ✅ Autowrite ${shouldEnable ? 'enabled' : 'disabled'}`;

        await sendReply(sock, jid, formatSuccess(resultText), { quoted: msg });
        console.log(`✍️ Autowrite ${shouldEnable ? 'enabled' : 'disabled'}`);
    }
};

// ⭐ FONCTION SIMPLIFIÉE COMME DANS L'ANCIEN CODE
export async function handleAutowriteMessage(sock, msg) {
    try {
        const jid = msg.key.remoteJid;
        
        // ⭐ MÊME LOGIQUE QUE L'ANCIEN AUTOREACT
        if (!jid || jid === 'status@broadcast' || msg.key.fromMe) {
            return;
        }
        
        const autowriteConfig = getUserConfig();
        if (!autowriteConfig.enabled) return;

        // ⭐ NE PAS FAIRE AUTOWRITE SUR LES COMMANDES
        const body = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || '';
        
        const userSettings = await Database.getUserSettings();
        const isCommand = body.startsWith(userSettings.prefix);
        
        if (isCommand) return;

        // ⭐ SIMULATION D'ÉCRITURE SIMPLE
        await safePresence(sock, jid, 'composing');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await safePresence(sock, jid, 'paused');
        
    } catch (error) {
        // Silent fail exactement comme dans l'ancien code
    }
}