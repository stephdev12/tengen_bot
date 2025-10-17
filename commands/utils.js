import { sendReply, formatError, formatSuccess } from '../lib/helpers.js';
import { downloadMediaMessage } from 'baileys';

export default {
    name: 'utils',
    aliases: ['getpp', 'pp', 'profilepic', 'avatar', 'setpp', 'jid', 'idch'],
    description: 'Commandes utilitaires diverses',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            switch (commandName) {
                case 'getpp':
                case 'pp':
                case 'profilepic':
                case 'avatar':
                    await handleGetPP(sock, msg, args, phoneNumber);
                    break;
                    
                case 'setpp':
                    await handleSetPP(sock, msg, phoneNumber);
                    break;
                    
                case 'jid':
                    await handleJID(sock, msg, phoneNumber);
                    break;
                    
                case 'idch':
                    await handleIDCH(sock, msg, phoneNumber);
                    break;
            }
        } catch (error) {
            console.error(`❌ [${phoneNumber}] Erreur ${commandName}:`, error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sendReply(sock, jid, formatError(`Erreur: ${error.message}`), { quoted: msg });
        }
    }
};

// ========== GETPP - Récupérer photo de profil ==========
async function handleGetPP(sock, msg, args, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        let targetJid = null;
        let targetName = '';
        let isGroupPic = false;

        // CAS 1: Dans un groupe sans arguments → Photo du groupe
        if (isGroup && args.length === 0 && !msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            targetJid = jid;
            isGroupPic = true;
            
            try {
                const metadata = await sock.groupMetadata(jid);
                targetName = metadata.subject;
            } catch (err) {
                targetName = 'Groupe';
            }
        }
        // CAS 2: Réponse à un message → Photo de l'utilisateur cité
        else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quotedParticipant = msg.message.extendedTextMessage.contextInfo.participant;
            targetJid = quotedParticipant;
            targetName = quotedParticipant.split('@')[0];
        }
        // CAS 3: Mention d'un utilisateur → Photo de l'utilisateur mentionné
        else if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            const mentionedJid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            targetJid = mentionedJid;
            targetName = mentionedJid.split('@')[0];
        }
        // CAS 4: Numéro fourni en argument
        else if (args.length > 0) {
            let number = args[0].replace(/[^0-9]/g, '');
            if (number.length < 8) {
                return await sendReply(sock, jid, formatError('Numéro invalide. Format: !getpp 237xxxxxxxxx'), { quoted: msg });
            }
            targetJid = number + '@s.whatsapp.net';
            targetName = number;
        }
        // CAS 5: En privé sans arguments → Photo de l'interlocuteur
        else if (!isGroup) {
            targetJid = jid;
            targetName = jid.split('@')[0];
        }
        // CAS 6: Aucune cible identifiable
        else {
            const helpMsg = `📸 *GetPP - Usage*\n\n` +
                           `• Dans un groupe: !getpp → Photo du groupe\n` +
                           `• Répondre à un message: !getpp → Photo de l'utilisateur\n` +
                           `• Mentionner: !getpp @user → Photo de l'utilisateur\n` +
                           `• Numéro: !getpp 237xxx → Photo du contact\n\n`
                          ;
            return await sendReply(sock, jid, helpMsg, { quoted: msg });
        }

        // Réaction de chargement
        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        // Récupérer la photo de profil
        let ppUrl = null;
        try {
            ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (err) {
            if (err.message.includes('404') || err.message.includes('not-found')) {
                await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
                return await sendReply(sock, jid, 
                    `❌ ${isGroupPic ? 'Ce groupe' : targetName} n'a pas de photo de profil.\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴`, 
                    { quoted: msg }
                );
            }
            throw err;
        }

        if (!ppUrl) {
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            return await sendReply(sock, jid, 
                ` ${isGroupPic ? 'Ce groupe' : targetName} n'a pas de photo de profil.\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴`, 
                { quoted: msg }
            );
        }

        // Envoyer la photo
        await sock.sendMessage(jid, {
            image: { url: ppUrl },
            caption: `> pp: ${targetName}`
        }, { quoted: msg });

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        console.log(`✅ [${phoneNumber}] Photo de profil récupérée: ${targetName}`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur getpp:`, error.message);
        throw error;
    }
}

// ========== SETPP - Définir photo de profil ==========
async function handleSetPP(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        // Vérifier qu'on répond à un message avec image
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMessage = quotedMessage?.imageMessage;

        if (!imageMessage) {
            return await sendReply(sock, jid, 
                formatError('> repndez a une image'), 
                { quoted: msg }
            );
        }

        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        // Télécharger l'image
        const buffer = await downloadMediaMessage(
            { message: quotedMessage },
            'buffer',
            {},
            { 
                logger: { level: 'silent', log: () => {} },
                reuploadRequest: sock.updateMediaMessage
            }
        );

        // Définir comme photo de profil
        if (isGroup) {
            // Pour un groupe
            await sock.updateProfilePicture(jid, buffer);
            await sendReply(sock, jid, 
                formatSuccess('> profile phote update'), 
                { quoted: msg }
            );
        } else {
            // Pour le bot lui-même
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            await sock.updateProfilePicture(botJid, buffer);
            await sendReply(sock, jid, 
                formatSuccess(' profile phote update'), 
                { quoted: msg }
            );
        }

        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        console.log(`✅ [${phoneNumber}] Photo de profil mise à jour`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur setpp:`, error.message);
        
        if (error.message.includes('forbidden') || error.message.includes('403')) {
            return await sendReply(sock, jid, 
                formatError('❌ Permission refusée. Le bot doit être admin pour changer la photo du groupe.\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴'), 
                { quoted: msg }
            );
        }
        
        throw error;
    }
}

// ========== JID - Obtenir JID d'un groupe ==========
async function handleJID(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    try {
        if (!isGroup) {
            return await sendReply(sock, jid, 
                formatError('❌ Cette commande fonctionne uniquement dans les groupes\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴'), 
                { quoted: msg }
            );
        }

        // Récupérer les métadonnées du groupe
        const metadata = await sock.groupMetadata(jid);

        const response = ` *_INFORMATIONS DU GROUPE_*\n\n` +
                        `Nom: ${metadata.subject}\n` +
                        `JID: \`${jid}\`\n` +
                        `Membres: ${metadata.participants.length}\n` +
                        `Créé: ${new Date(metadata.creation * 1000).toLocaleDateString()}\n` +
                        `Propriétaire: ${metadata.owner ? '@' + metadata.owner.split('@')[0] : 'Inconnu'}` 
                       ;

        await sendReply(sock, jid, response, { 
            quoted: msg,
            mentions: metadata.owner ? [metadata.owner] : []
        });

        console.log(`✅ [${phoneNumber}] JID du groupe récupéré: ${jid}`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur jid:`, error.message);
        throw error;
    }
}

// ========== IDCH - Obtenir JID d'une chaîne ==========
async function handleIDCH(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;
    const isNewsletter = jid.includes('@newsletter');

    try {
        if (!isNewsletter) {
            return await sendReply(sock, jid, 
                formatError('❌ Cette commande fonctionne uniquement dans les chaînes WhatsApp\n\n> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴'), 
                { quoted: msg }
            );
        }

        // Extraire l'ID de la chaîne
        const channelId = jid.split('@')[0];

        const response = `*Informations channel*\n\n` +
                        `Channel JID: \`${jid}\`\n` +
                        `Channel ID: \`${channelId}\`\n\n` 
                       
                       ;

        await sendReply(sock, jid, response, { quoted: msg });

        console.log(`✅ [${phoneNumber}] JID de la chaîne récupéré: ${jid}`);

    } catch (error) {
        console.error(`❌ [${phoneNumber}] Erreur idch:`, error.message);
        throw error;
    }
}