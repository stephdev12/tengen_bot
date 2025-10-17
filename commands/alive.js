import { sendReply } from '../lib/helpers.js';

export default {
    name: 'alive',
    description: 'Check bot status',
    aliases: ['status', 'ping'],
    
    async execute({ sock, msg, phoneNumber, whatsappManager }) {
        try {
            const jid = msg.key.remoteJid;
            
            if (!sock || !sock.user) {
                console.log(`Alive command: Socket not ready for ${phoneNumber}`);
                return;
            }

            const uptime = process.uptime();
            const hrs = Math.floor(uptime / 3600);
            const mins = Math.floor((uptime % 3600) / 60);
            const secs = Math.floor(uptime % 60);
            
            const sessions = whatsappManager.getActiveSessionsCount();
            
            const statusText = `Online: ${hrs}h ${mins}m ${secs}s\n\nActive`;

            await sendReply(sock, jid, statusText, { quoted: null });
        } catch (error) {
            console.error('Alive command error:', error.message);
        }
    }
};