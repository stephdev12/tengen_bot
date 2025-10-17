import { sendReply } from '../lib/helpers.js';

export default {
    name: 'ping',
    description: 'Check bot latency',
    
    async execute({ sock, msg, phoneNumber }) {
        try {
            const jid = msg.key.remoteJid;
            const start = Date.now();
            
            await sock.sendMessage(jid, { 
                react: { text: '👾', key: msg.key } 
            });
            
            const latency = Date.now() - start;
            
            // Déterminer l'état de la latence avec des emojis différents
            let statusEmoji = '⚡';
            if (latency > 1000) statusEmoji = '🐢';
            if (latency > 2000) statusEmoji = '😴';
            
            const pingText = `> *PONG!* ${statusEmoji}\n\n> Latence: ${latency}ms`;
            
            // Envoyer avec sendReply mais avec image et caption
            await sock.sendMessage(jid, {
                image: {
                    url: 'https://i.postimg.cc/02qx1vK8/icons-Uzui-Tengen.jpg' // Remplace par ton image
                },
                caption: pingText
            }, { quoted: null });
            
        } catch (error) {
            console.error(`❌ Ping command error for ${phoneNumber}:`, error);
        
        }
    }
};