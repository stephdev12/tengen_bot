import { sendReply } from '../lib/helpers.js';

export default {
    name: 'alive',
    description: 'Check bot status',
    aliases: ['status', 'ping'],
    
    async execute({ sock, msg}) {
        try {
            const jid = msg.key.remoteJid;
            
            
            const uptime = process.uptime();
            const hrs = Math.floor(uptime / 3600);
            const mins = Math.floor((uptime % 3600) / 60);
            const secs = Math.floor(uptime % 60);
            
            
            
            const statusText = `Online: ${hrs}h ${mins}m ${secs}s\n\nActive`;

            await sendReply(sock, jid, statusText, { quoted: null });
        } catch (error) {
            console.error('Alive command error:', error.message);
        }
    }
};