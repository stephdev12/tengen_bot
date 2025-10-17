import fs from 'fs';
import path from 'path';
import { sendReply, formatError, formatSuccess } from '../lib/helpers.js';
import { downloadContentFromMessage } from 'baileys';
import config from '../config.js';

export default {
    name: 'save',
    aliases: ['savestatus', 'downloadstatus'],
    description: 'Download and save a status',
    usage: 'save (reply to a status)',

    async execute({ sock, msg }) {
        const jid = msg.key.remoteJid;
        const phoneNumber = config.owner;
        
        if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            return await sendReply(sock, jid, formatError('❌ Please reply to a status message'), { quoted: msg });
        }

        const quotedMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        
        try {
            await sendReply(sock, jid, formatSuccess('> 📥 Downloading status...'), { quoted: msg });

            let buffer, mimeType, fileName, mediaType;

            if (quotedMessage.imageMessage) {
                mediaType = 'image';
                mimeType = quotedMessage.imageMessage.mimetype || 'image/jpeg';
                fileName = `status_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;
                const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
                buffer = await streamToBuffer(stream);
            } 
            else if (quotedMessage.videoMessage) {
                mediaType = 'video';
                mimeType = quotedMessage.videoMessage.mimetype || 'video/mp4';
                fileName = `status_${Date.now()}.${mimeType.split('/')[1] || 'mp4'}`;
                const stream = await downloadContentFromMessage(quotedMessage.videoMessage, 'video');
                buffer = await streamToBuffer(stream);
            }
            else {
                return await sendReply(sock, jid, formatError('❌ Unsupported status type'), { quoted: msg });
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('Download failed');
            }

            // Save file
            const saveDir = path.join(process.cwd(), 'saved_status');
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }
            
            const filePath = path.join(saveDir, fileName);
            fs.writeFileSync(filePath, buffer);

            // ⭐ MODIFICATION: Envoyer au owner au lieu de l'expéditeur
            const ownerJid = `${config.owner}@s.whatsapp.net`;
            const sender = msg.key.participant || msg.key.remoteJid;
            const senderName = sender.split('@')[0];
            
            const caption = `📥 *Status Downloaded*\n\n` +
                          `👤 *From:* @${senderName}\n` +
                          `💬 *Chat:* ${jid.endsWith('@g.us') ? 'Group' : 'Private'}\n` +
                          `📁 *Type:* ${mediaType.toUpperCase()}\n` +
                          `⏰ *Time:* ${new Date().toLocaleString()}`;

            // Confirmation à l'expéditeur
            await sendReply(sock, jid, formatSuccess('✅ Status downloaded and sent to owner'), { quoted: msg });

            // Envoyer le média au owner
            if (mediaType === 'image') {
                await sock.sendMessage(ownerJid, {
                    image: { url: filePath },
                    caption: caption,
                    mentions: [sender]
                });
            } else {
                await sock.sendMessage(ownerJid, {
                    video: { url: filePath },
                    caption: caption,
                    mentions: [sender]
                });
            }

            console.log(`💾 Status saved and sent to owner: ${fileName}`);

        } catch (error) {
            console.error(`❌ Save status error:`, error);
            await sendReply(sock, jid, formatError(`❌ Save failed: ${error.message}`), { quoted: null });
        }
    }
};

async function streamToBuffer(stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}