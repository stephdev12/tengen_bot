import fs from 'fs';
import path from 'path';
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import config from '../config.js';

const CONFIG_DIR = path.join(process.cwd(), 'data', 'autostatus');

function getUserConfig() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    
    if (!fs.existsSync(userConfigPath)) {
        fs.writeFileSync(userConfigPath, JSON.stringify({ 
            viewEnabled: false,
            reactEnabled: false,
            reactEmoji: '❤️'
        }, null, 2));
    }
    
    return JSON.parse(fs.readFileSync(userConfigPath));
}

function saveUserConfig(configData) {
    const userConfigPath = path.join(CONFIG_DIR, `${config.owner}.json`);
    fs.writeFileSync(userConfigPath, JSON.stringify(configData, null, 2));
}

export default {
    name: 'autostatus',
    aliases: ['autostatusview', 'autostatusreact'],
    description: 'Manage automatic status viewing and reactions',
    usage: 'autostatus <view/react> <on/off> [emoji]',

    async execute({ sock, msg, args }) {
        const jid = msg.key.remoteJid;
     
        const action = args[0]?.toLowerCase();
        const subAction = args[1]?.toLowerCase();
        
        if (!action || !['view', 'react', 'status'].includes(action)) {
            return await sendReply(sock, jid, formatError('❌ Usage: autostatus <view/react> <on/off> [emoji]'), { quoted: msg });
        }

        const autostatusConfig = getUserConfig();

        if (action === 'status') {
            const statusText = `👁️AutoStatus Settings:\n\n` +
                             ` View Status: ${autostatusConfig.viewEnabled ? '✅ ON' : '❌ OFF'}\n` +
                             ` React Status: ${autostatusConfig.reactEnabled ? '✅ ON' : '❌ OFF'}\n` +
                             ` React Emoji: ${autostatusConfig.reactEmoji}\n`;
            return await sendReply(sock, jid, statusText, { quoted: msg });
        }

        if (action === 'view') {
            if (!subAction || !['on', 'off'].includes(subAction)) {
                return await sendReply(sock, jid, formatError('❌ Usage: autostatus view <on/off>'), { quoted: msg });
            }

            const shouldEnable = subAction === 'on';
            autostatusConfig.viewEnabled = shouldEnable;
            saveUserConfig(autostatusConfig);

            const resultText = ` ✅ AutoStatus View ${shouldEnable ? 'enabled' : 'disabled'}`;
            await sendReply(sock, jid, formatSuccess(resultText), { quoted: msg });
            console.log(`👁️ Autostatus view ${shouldEnable ? 'enabled' : 'disabled'}`);
        }

        if (action === 'react') {
            if (!subAction || !['on', 'off', 'emoji'].includes(subAction)) {
                return await sendReply(sock, jid, formatError('❌ Usage: autostatus react <on/off/emoji>'), { quoted: msg });
            }

            if (subAction === 'emoji') {
                const newEmoji = args[2];
                if (!newEmoji) {
                    return await sendReply(sock, jid, formatError('❌ Please provide an emoji'), { quoted: msg });
                }
                
                autostatusConfig.reactEmoji = newEmoji;
                saveUserConfig(autostatusConfig);
                
                const successText = `✅ Reaction emoji updated to: ${newEmoji}`;
                return await sendReply(sock, jid, formatSuccess(successText), { quoted: msg });
            }

            const shouldEnable = subAction === 'on';
            autostatusConfig.reactEnabled = shouldEnable;
            saveUserConfig(autostatusConfig);

            const resultText = `✅ AutoStatus React ${shouldEnable ? 'enabled' : 'disabled'}\nEmoji: ${autostatusConfig.reactEmoji}`;
            await sendReply(sock, jid, formatSuccess(resultText), { quoted: msg });
            console.log(`❤️ Autostatus react ${shouldEnable ? 'enabled' : 'disabled'}`);
        }
    }
};

// ⭐ FONCTION POUR GÉRER LES STATUS AUTOMATIQUES
async function handleAutoStatus(sock, status) {
    try {
        const autostatusConfig = getUserConfig();
        
        if (!autostatusConfig.viewEnabled && !autostatusConfig.reactEnabled) {
            return;
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Handle status messages
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                
                // View status if enabled
                if (autostatusConfig.viewEnabled) {
                    await sock.readMessages([msg.key]);
                }
                
                // React to status if enabled
                if (autostatusConfig.reactEnabled) {
                    await reactToStatus(sock, msg.key, autostatusConfig.reactEmoji);
                }
                return;
            }
        }

        // Handle direct status
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            if (autostatusConfig.viewEnabled) {
                await sock.readMessages([status.key]);
            }
            if (autostatusConfig.reactEnabled) {
                await reactToStatus(sock, status.key, autostatusConfig.reactEmoji);
            }
            return;
        }

    } catch (error) {
        console.error(`❌ Autostatus error:`, error.message);
    }
}

// ⭐ FONCTION POUR RÉAGIR AUX STATUS
async function reactToStatus(sock, statusKey, emoji) {
    try {
        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: emoji
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
            }
        );
    } catch (error) {
        console.error('❌ Status reaction error:', error.message);
    }
}

// ⭐ EXPORTER LES FONCTIONS
export { handleAutoStatus };