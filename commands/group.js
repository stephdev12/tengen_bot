import { sendReply, formatError, formatSuccess } from '../lib/helpers.js';
import { isAdmin } from '../lib/isAdmin.js';
import Database from '../lib/database.js';
import config from '../config.js';

export default {
    name: 'group',
    aliases: ['gname', 'gdesc', 'kick', 'add', 'promote', 'demote', 'purge', 'kickall',
              'lock', 'unlock', 'grouplink', 'antidemote', 'antipromote', 'demoteall', 'autopromote'],
    description: 'Commandes de gestion de groupe complètes',
    adminOnly: true,

    async execute({ sock, msg, args, userSettings, groupSettings, jid, whatsappManager }) {
        const phoneNumber = config.owner; // ⭐ MODIFICATION: Utiliser config.owner
        
        // Récupérer la commande utilisée depuis le message original
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        
        if (!jid.endsWith('@g.us')) {
            return sendReply(sock, jid, formatError('Cette commande fonctionne uniquement dans les groupes'), { quoted: msg });
        }

        try {
            
            switch (commandName) {
                case 'gname':
                    await handleGroupName(sock, msg, args);
                    break;
                    
                case 'gdesc':
                    await handleGroupDesc(sock, msg, args);
                    break;
                    
                case 'kick':
                    await handleKick(sock, msg, args);
                    break;
                    
                case 'add':
                    await handleAdd(sock, msg, args);
                    break;
                    
                case 'promote':
                    await handlePromote(sock, msg, args);
                    break;
                    
                case 'demote':
                    await handleDemote(sock, msg, args);
                    break;
                    
                case 'purge':
                    await handlePurge(sock, msg);
                    break;
                    
                case 'kickall':
                    await handleKickAll(sock, msg);
                    break;
                    
                case 'lock':
                    await handleLock(sock, msg);
                    break;
                    
                case 'unlock':
                    await handleUnlock(sock, msg);
                    break;
                    
                case 'grouplink':
                    await handleGroupLink(sock, msg);
                    break;
                    
                case 'antidemote':
                    await handleAntiDemote(sock, msg, args, groupSettings);
                    break;
                    
                case 'antipromote':
                    await handleAntiPromote(sock, msg, args, groupSettings);
                    break;
                    
                case 'demoteall':
                    await handleDemoteAll(sock, msg);
                    break;
                    
                case 'autopromote':
                    await handleAutoPromote(sock, msg);
                    break;
                    
                default:
                    await sendReply(sock, jid, formatError(`Commande de groupe inconnue: ${commandName}`), { quoted: msg });
            }
            
        } catch (error) {
            console.error(`❌ Erreur commande groupe '${commandName}':`, error.message);
            
            if (error.data === 403) {
                await sendReply(sock, jid, formatError('Le bot doit être admin pour exécuter cette action'), { quoted: msg });
            } else {
                await sendReply(sock, jid, formatError(`Erreur: ${error.message}`), { quoted: msg });
            }
        }
    }
};

// ========== FONCTIONS DE GESTION ==========

async function getTargetUser(msg) {
    // Vérifier si c'est une réponse à un message
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedParticipant = msg.message.extendedTextMessage.contextInfo.participant;
        if (quotedParticipant) {
            return quotedParticipant;
        }
    }
    
    // Sinon vérifier les mentions
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    return mentionedJid[0] || null;
}

// ⭐ MODIFICATION: Supprimer phoneNumber de toutes les fonctions
async function handleGroupName(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const newName = args.join(' ');
    
    if (!newName) {
        return sendReply(sock, jid, formatError('Usage: !gname [nouveau nom]'), { quoted: msg });
    }
    
    await sock.groupUpdateSubject(jid, newName);
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleGroupDesc(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const newDesc = args.join(' ');
    
    if (!newDesc) {
        return sendReply(sock, jid, formatError('Usage: !gdesc [nouvelle description]'), { quoted: msg });
    }
    
    await sock.groupUpdateDescription(jid, newDesc);
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleKick(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const target = await getTargetUser(msg);
    
    if (!target) {
        return sendReply(sock, jid, formatError('Mentionnez un utilisateur ou répondez à son message'), { quoted: msg });
    }
    
    await sock.groupParticipantsUpdate(jid, [target], 'remove');
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleAdd(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const userToAdd = args[0]?.replace(/[^0-9]/g, '');
    
    if (!userToAdd) {
        return sendReply(sock, jid, formatError('Usage: !add [numéro]'), { quoted: msg });
    }
    
    await sock.groupParticipantsUpdate(jid, [`${userToAdd}@s.whatsapp.net`], 'add');
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handlePromote(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const target = await getTargetUser(msg);
    
    if (!target) {
        return sendReply(sock, jid, formatError('Mentionnez un utilisateur ou répondez à son message'), { quoted: msg });
    }
    
    await sock.groupParticipantsUpdate(jid, [target], 'promote');
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleDemote(sock, msg, args) {
    const jid = msg.key.remoteJid;
    const target = await getTargetUser(msg);
    
    if (!target) {
        return sendReply(sock, jid, formatError('Mentionnez un utilisateur ou répondez à son message'), { quoted: msg });
    }
    
    await sock.groupParticipantsUpdate(jid, [target], 'demote');
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handlePurge(sock, msg) {
    const jid = msg.key.remoteJid;
    
    await sock.sendMessage(jid, { react: { text: '💀', key: msg.key } });
    
    const groupMetadata = await sock.groupMetadata(jid);
    const membersToKick = groupMetadata.participants
        .filter(p => !p.admin)
        .map(p => p.id);
    
    if (membersToKick.length === 0) {
        return sendReply(sock, jid, formatError('Aucun membre à expulser'), { quoted: msg });
    }
    
    // PURGE RAPIDE - Tous d'un coup
    await sock.groupParticipantsUpdate(jid, membersToKick, 'remove');
    
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    console.log(`🔥 Purge: ${membersToKick.length} membres expulsés en une fois`);
}

async function handleKickAll(sock, msg) {
    const jid = msg.key.remoteJid;
    
    await sock.sendMessage(jid, { react: { text: '⚠️', key: msg.key } });
    
    const groupMetadata = await sock.groupMetadata(jid);
    const membersToKick = groupMetadata.participants
        .filter(p => !p.admin)
        .map(p => p.id);
    
    if (membersToKick.length === 0) {
        return sendReply(sock, jid, formatError('Aucun membre à expulser'), { quoted: msg });
    }
    
    // KICKALL PROGRESSIF - Un par un avec délai
    let kickedCount = 0;
    for (const member of membersToKick) {
        try {
            await sock.groupParticipantsUpdate(jid, [member], 'remove');
            kickedCount++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 seconde entre chaque
        } catch (error) {
            console.error(`❌ Erreur expulsion ${member}:`, error.message);
        }
    }
    
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    console.log(`👋 KickAll: ${kickedCount}/${membersToKick.length} membres expulsés`);
}

async function handleLock(sock, msg) {
    const jid = msg.key.remoteJid;
    await sock.groupSettingUpdate(jid, 'announcement');
    await sock.sendMessage(jid, { react: { text: '🔒', key: msg.key } });
}

async function handleUnlock(sock, msg) {
    const jid = msg.key.remoteJid;
    await sock.groupSettingUpdate(jid, 'not_announcement');
    await sock.sendMessage(jid, { react: { text: '🔓', key: msg.key } });
}

async function handleGroupLink(sock, msg) {
    const jid = msg.key.remoteJid;
    const code = await sock.groupInviteCode(jid);
    const link = `https://chat.whatsapp.com/${code}`;
    
    await sendReply(sock, jid, `🔗 Lien du groupe:\n${link}`, { quoted: msg });
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function handleAntiDemote(sock, msg, args, groupSettings) {
    const jid = msg.key.remoteJid;
    const action = args[0]?.toLowerCase();
    
    if (!action) {
        const status = groupSettings.antidemote_enabled ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ';
        return sendReply(sock, jid, `🛡️ Anti-Demote: ${status}\n\nUsage: !antidemote <on/off>`, { quoted: msg });
    }
    
    if (action === 'on') {
        await Database.updateGroupSettings(jid, { antidemote_enabled: true });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } else if (action === 'off') {
        await Database.updateGroupSettings(jid, { antidemote_enabled: false });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    }
}

// ⭐ MODIFICATION: Supprimer phoneNumber
async function handleAntiPromote(sock, msg, args, groupSettings) {
    const jid = msg.key.remoteJid;
    const action = args[0]?.toLowerCase();
    
    if (!action) {
        const status = groupSettings.antipromote_enabled ? '✅ ACTIVÉ' : '❌ DÉSACTIVÉ';
        return sendReply(sock, jid, `🛡️ Anti-Promote: ${status}\n\nUsage: !antipromote <on/off>`, { quoted: msg });
    }
    
    if (action === 'on') {
        await Database.updateGroupSettings(jid, { antipromote_enabled: true });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    } else if (action === 'off') {
        await Database.updateGroupSettings(jid, { antipromote_enabled: false });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    }
}

async function handleDemoteAll(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    await sock.sendMessage(jid, { react: { text: '⚡', key: msg.key } });
    
    const groupMetadata = await sock.groupMetadata(jid);
    const adminsToDemote = groupMetadata.participants
        .filter(p => p.admin && p.id !== sender) // Exclure l'expéditeur
        .map(p => p.id);
    
    if (adminsToDemote.length === 0) {
        return sendReply(sock, jid, formatError('Aucun admin à rétrograder'), { quoted: msg });
    }
    
    await sock.groupParticipantsUpdate(jid, adminsToDemote, 'demote');
    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
    
    console.log(`👤 DemoteAll: ${adminsToDemote.length} admins rétrogradés`);
}

async function handleAutoPromote(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    try {
        await sock.sendMessage(jid, { react: { text: '🔓', key: msg.key } });
        
        // Attendre un peu pour éviter les conflits
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await sock.groupParticipantsUpdate(jid, [sender], 'promote');
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        
        console.log(`🔑 AutoPromote: ${sender.split('@')[0]} s'est auto-promu`);
    } catch (error) {
        console.error(`❌ AutoPromote error:`, error.message);
        await sendReply(sock, jid, formatError('Impossible de s\'auto-promouvoir (le bot doit être admin)'), { quoted: msg });
    }
}