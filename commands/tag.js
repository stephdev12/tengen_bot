// tag.js
import { sendReply, formatError } from '../lib/helpers.js';

export default {
    name: 'tag',
    aliases: ['tagall', 'hidetag'],
    description: 'Commandes de mention de groupe',
    

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, formatError('Cette commande fonctionne uniquement dans les groupes'), { quoted: msg });
        }

        try {
            if (commandName === 'tagall') {
                await handleTagAll(sock, msg, args, phoneNumber);
            } else if (commandName === 'tag' || commandName === 'hidetag') {
                await handleHideTag(sock, msg, args, phoneNumber);
            }
        } catch (error) {
            console.error(`? [${phoneNumber}] Erreur ${commandName}:`, error.message);
            await sendReply(sock, jid, formatError(error.message), { quoted: msg });
        }
    }
};

// ========== TAGALL - Mention visible de tous ==========
async function handleTagAll(sock, msg, args, phoneNumber) {
    const jid = msg.key.remoteJid;

    try {
        
        const groupMetadata = await sock.groupMetadata(jid);
        const participants = groupMetadata.participants;

      
        const mentions = participants.map(p => p.id);

     
        const customMessage = args.join(' ').trim();

        
        let messageText = '';
        
        if (customMessage) {
            messageText = `${customMessage}\n\n`;
        }

        // Ajouter toutes les mentions
        messageText += '> ❍\n';
        messageText += '> MENTION  \n';
        messageText += '> ❍\n\n';

        participants.forEach((participant, index) => {
            messageText += `${index + 1}. @${participant.id.split('@')[0]}\n`;
        });

        messageText += `\n> Total: ${participants.length} membres\n`;
        messageText += `\n> by _*STEPHDEV*_`;

        // Envoyer le message avec les mentions
        await sock.sendMessage(jid, {
            text: messageText,
            mentions: mentions
        }, { quoted: msg });

        console.log(`? [${phoneNumber}] TagAll: ${participants.length} membres mentionn��s`);

    } catch (error) {
        console.error(`? [${phoneNumber}] TagAll error:`, error.message);
        throw new Error('Impossible de r��cup��rer les membres du groupe');
    }
}

// ========== TAG (HIDETAG) - Mention silencieuse ==========
async function handleHideTag(sock, msg, args, phoneNumber) {
    const jid = msg.key.remoteJid;

    try {
        // R��cup��rer les m��tadonn��es du groupe
        const groupMetadata = await sock.groupMetadata(jid);
        const participants = groupMetadata.participants;

        // Cr��er la liste des mentions
        const mentions = participants.map(p => p.id);

        // V��rifier si c'est une r��ponse �� un message
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMessage?.conversation || 
                          quotedMessage?.extendedTextMessage?.text || 
                          quotedMessage?.imageMessage?.caption ||
                          quotedMessage?.videoMessage?.caption || '';

        let messageToSend;

        if (quotedText) {
            // Si c'est une r��ponse, utiliser le texte du message cit��
            messageToSend = quotedText;
        } else {
            // Sinon, utiliser le message personnalis��
            const customMessage = args.join(' ').trim();
            messageToSend = customMessage || '? Mention silencieuse';
        }

        // Supprimer le message de commande
        try {
            await sock.sendMessage(jid, { delete: msg.key });
        } catch (error) {
            console.log(`?? [${phoneNumber}] Impossible de supprimer le message de commande`);
        }

        // Attendre un peu avant d'envoyer le nouveau message
        await new Promise(resolve => setTimeout(resolve, 500));

        // Envoyer le message avec mentions cach��es
        if (quotedMessage?.imageMessage) {
            // Si le message cit�� est une image
            await sock.sendMessage(jid, {
                image: { url: await sock.downloadMediaMessage(msg.message.extendedTextMessage.contextInfo) },
                caption: messageToSend,
                mentions: mentions
            });
        } else if (quotedMessage?.videoMessage) {
            // Si le message cit�� est une vid��o
            await sock.sendMessage(jid, {
                video: { url: await sock.downloadMediaMessage(msg.message.extendedTextMessage.contextInfo) },
                caption: messageToSend,
                mentions: mentions
            });
        } else {
            // Message texte normal
            await sock.sendMessage(jid, {
                text: messageToSend,
                mentions: mentions
            });
        }

        console.log(`? [${phoneNumber}] HideTag: ${participants.length} membres mentionn��s silencieusement`);

    } catch (error) {
        console.error(`? [${phoneNumber}] HideTag error:`, error.message);
        throw new Error('Impossible d\'envoyer la mention silencieuse');
    }
}