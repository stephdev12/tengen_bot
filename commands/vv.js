import { sendReply, formatError } from '../lib/helpers.js';
import { downloadContentFromMessage } from 'baileys';

export default {
    name: 'vv',
    aliases: ['viewonce', 'revealonce'],
    description: 'Reveal view once messages',
    usage: 'vv (reply to a view once message)',

    async execute({ sock, msg, phoneNumber }) {
        const jid = msg.key.remoteJid;
        
        if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            return await sendReply(sock, jid, formatError('❌ Please reply to a view once message'), { quoted: msg });
        }

        const quotedMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        
        const quotedImage = quotedMessage.imageMessage;
        const quotedVideo = quotedMessage.videoMessage;

        try {
            if (quotedImage && quotedImage.viewOnce) {
                console.log(`🔍 [${phoneNumber}] Revealing view once: IMAGE`);
                
                const stream = await downloadContentFromMessage(quotedImage, 'image');
                let buffer = Buffer.from([]);
                
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                
                if (buffer.length === 0) {
                    throw new Error('Empty buffer - cannot download image');
                }

                const revealCaption = `> View Once Image Revealed\n${quotedImage.caption ? `Caption: ${quotedImage.caption}` : '' }\n\n'> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴'`;

                await sock.sendMessage(jid, {
                    image: buffer,
                    fileName: 'view_once_revealed.jpg',
                    caption: revealCaption
                }, { quoted: null });

                console.log(`✅ [${phoneNumber}] View once image revealed successfully`);
                return;
            }

            if (quotedVideo && quotedVideo.viewOnce) {
                console.log(`🔍 [${phoneNumber}] Revealing view once: VIDEO`);
                
                const stream = await downloadContentFromMessage(quotedVideo, 'video');
                let buffer = Buffer.from([]);
                
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                
                if (buffer.length === 0) {
                    throw new Error('Empty buffer - cannot download video');
                }

                const revealCaption = `> View Once Video Revealed\n${quotedVideo.caption ? `Caption: ${quotedVideo.caption}` : ''}`;

                await sock.sendMessage(jid, {
                    video: buffer,
                    fileName: 'view_once_revealed.mp4',
                    caption: revealCaption
                }, { quoted: msg });

                console.log(`✅ [${phoneNumber}] View once video revealed successfully`);
                return;
            }

            await sendReply(sock, jid, formatError('❌ Invalid view once message'), { quoted: msg });

        } catch (error) {
            console.error(`❌ [${phoneNumber}] View once reveal error:`, error);
            
            let errorMsg = '❌ Failed to reveal view once message';
            
            if (error.message.includes('Empty buffer')) {
                errorMsg = '❌ Media download failed - file may be expired';
            } else if (error.message.includes('not found')) {
                errorMsg = '❌ Media expired or not found';
            } else if (error.message.includes('download')) {
                errorMsg = '❌ Download failed';
            }
            
            await sendReply(sock, jid, formatError(`${errorMsg}\nError: ${error.message}`), { quoted: msg });
        }
    }
};