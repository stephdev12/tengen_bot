import { font } from '../lib/helpers.js';
import fs from 'fs';
import path from 'path';

export default {
    name: 'menu',
    aliases: ['menu', 'commands'],
    description: 'Show all available commands',
    
    async execute({ sock, msg, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const nameBot = `
╭━━━━━━━━━━━━━━━
┃       ❍  𝚃𝙴𝙽𝙶𝙴𝙽 ❍
╰━━━━━━━━━━━━━━━`
        const menuText = `

╭━━━━━━━━━━━━━━━
┃welcome : ${userSettings.bot_name}
┃prefix :  ${userSettings.prefix}
┃version : 2.1.0
╰━━━━━━━━━━━━━━━

╭━━━❍ *_general_*
┃ • menu
┃ • setname <new name>
┃ • setprefix <new prefix>
┃ • alive
┃ • ping
┃ • private
┃ • public
┃ • sudo
┃ • delsudo
┃ • sudolist
╰━━━━━━━━━━━━━━━

╭━━━❍ *_IA_*
┃ • gpt
┃ • tengen
╰━━━━━━━━━━━━━━━

╭━━━❍ *_props_*
┃ • antimention
┃ • antilink
┃ • antispam
┃ • antitag
┃ • autoreact 
┃ • autostatus 
┃ • autowrite 
┃ • antidelete 
┃ • vv
┃ • save
┃ • verse
┃ • welcome
┃ • goodbye
┃ • idch
┃ • warnings
╰━━━━━━━━━━━━━━━

╭━━━❍ *_media_*
┃ • store <nom>
┃ • ad <nom>
┃ • vd <nom>
┃ • list
┃ • sticker / s
┃ • getpp
┃ • setpp
┃ • toimg
┃ • tovid
╰━━━━━━━━━━━━━━━

╭━━━❍ *_groups_*
┃ • gname
┃ • gdesc
┃ • kick
┃ • add
┃ • promote
┃ • demote
┃ • purge
┃ • tag
┃ • tagall
┃ • jid
┃ • kickall
┃ • lock
┃ • unlock
┃ • grouplink
┃ • antidemote
┃ • antipromote
┃ • demoteall
┃ • autopromote
╰━━━━━━━━━━━━━━━

╭━━━❍ *_downloader_*
┃ • facebook / fb
┃ • instagram / ig
┃ • applemusic / am
┃ • pinterest / pin
┃ • savefrom / sf
┃ • soundcloud / sc
┃ • spotify / sp
┃ • tiktok / tt
┃ • play / song
┃ • ytmp4
┃ • instastory
┃ • hentai
╰━━━━━━━━━━━━━━━

╭━━━❍ *_tools_*
┃ • fancy
┃ • encrypt
┃ • encrypt2
┃ • tempmail
┃ • getmail
╰━━━━━━━━━━━━━━━

   © BY *STEPHDEV*

        `;

        try {
            const finalMenu = `${nameBot}\n${font(menuText)}`;

            
            const imagePath = './media/menu.jpg';  
            const audioPath = './media/menu.mp3';  

            
            if (!fs.existsSync(imagePath)) {
                console.error(`вЭМ [${phoneNumber}] Fichier vid√©o introuvable: ${imagePath}`);
                throw new Error('Fichier vid√©o menu introuvable');
            }

            if (!fs.existsSync(audioPath)) {
                console.error(`вЭМ [${phoneNumber}] Fichier audio introuvable: ${audioPath}`);
                throw new Error('Fichier audio menu introuvable');
            }

            
            await sock.sendMessage(jid, { react: { text: 'вЩЯпЄП', key: msg.key } });

           
            await sock.sendMessage(jid, {
                image: {
                    url: imagePath  
                },
                caption: finalMenu,
               
            }, { quoted: null });

            console.log(`вЬЕ [${phoneNumber}] Vid√©o menu envoy√©e`);

            await new Promise(resolve => setTimeout(resolve, 1000));

            await sock.sendMessage(jid, {
                audio: {
                    url: audioPath  
                },
                mimetype: 'audio/mpeg',
                ptt: false  
            }, { quoted: null });

            console.log(`вЬЕ [${phoneNumber}] Audio menu envoy√©`);

        } catch (error) {
            console.error(`вЭМ [${phoneNumber}] Erreur envoi menu m√©dia:`, error.message);
            
           
            try {
                await sock.sendMessage(jid, { 
                    text: font(menuText) 
                }, { quoted: null });
                console.log(`вЬЕ [${phoneNumber}] Menu envoy√© en mode texte (fallback)`);
            } catch (fallbackError) {
                console.error(`вЭМ [${phoneNumber}] Erreur m√™me en fallback:`, fallbackError.message);
            }
        }
    }
};