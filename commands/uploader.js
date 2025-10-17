import axios from 'axios';
import { sendReply, formatError } from '../lib/helpers.js';

const UPLOAD_API = 'https://apis-starlights-team.koyeb.app/starlight';

export default {
    name: 'upload',
    aliases: ['upload', 'mirror', 'host'],
    description: 'Upload et conversion de médias en URLs',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const url = args[0]?.trim();

        // Vérifier si on a une URL ou un média cité
        let mediaUrl = url;
        
        if (!mediaUrl && quoted) {
            // Essayer d'extraire l'URL du média cité
            if (quoted.videoMessage) {
                mediaUrl = await getMediaUrl(sock, quoted.videoMessage, 'video');
            } else if (quoted.audioMessage) {
                mediaUrl = await getMediaUrl(sock, quoted.audioMessage, 'audio');
            } else if (quoted.imageMessage) {
                mediaUrl = await getMediaUrl(sock, quoted.imageMessage, 'image');
            }
        }

        if (!mediaUrl) {
            await sendReply(sock, jid, formatError('Veuillez fournir une URL ou répondre à un média'), { quoted: msg });
            return;
        }

        try {
            await sock.sendMessage(jid, { react: { text: '📤', key: msg.key } });
            await handleUpload(sock, msg, mediaUrl, phoneNumber);
        } catch (error) {
            console.error(`❌ Erreur upload:`, error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sendReply(sock, jid, formatError(error.message), { quoted: msg });
        }
    }
};

// Obtenir l'URL d'un média WhatsApp
async function getMediaUrl(sock, mediaMessage, type) {
    // Pour l'instant, on retourne null car WhatsApp ne fournit pas d'URLs directes
    // On pourrait implémenter l'upload vers un service temporaire
    return null;
}

// Gérer l'upload vers différents services
async function handleUpload(sock, msg, mediaUrl, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    // Essayer les différents services d'upload
    const services = [
        { name: 'kitc', url: `${UPLOAD_API}/uploader-kitc?url=${encodeURIComponent(mediaUrl)}` },
        { name: 'uguu', url: `${UPLOAD_API}/uploader-uguu?url=${encodeURIComponent(mediaUrl)}` },
        { name: 'tmp', url: `${UPLOAD_API}/uploader-tmp?url=${encodeURIComponent(mediaUrl)}` },
        { name: 'put', url: `${UPLOAD_API}/uploader-put?url=${encodeURIComponent(mediaUrl)}` }
    ];

    let uploadedUrl = null;
    let serviceName = '';

    for (const service of services) {
        try {
            const response = await axios.get(service.url, { timeout: 30000 });
            
            if (response.data?.url) {
                uploadedUrl = response.data.url;
                serviceName = service.name;
                break;
            }
        } catch (error) {
            console.log(`❌ Service ${service.name} échoué:`, error.message);
            continue;
        }
    }

    if (!uploadedUrl) {
        throw new Error('Tous les services d\'upload ont échoué');
    }

    await sock.sendMessage(jid, {
        text: `📤 *Upload Réussi!*\n\n🔗 *Service:* ${serviceName.toUpperCase()}\n🌐 *URL:* ${uploadedUrl}\n\n> TECH & VERSE`
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}