import axios from 'axios';
import { sendReply, formatError } from '../lib/helpers.js';

const AI_API = 'https://apis-starlights-team.koyeb.app/starlight';

export default {
    name: 'ai',
    aliases: ['uzui', 'tengen', 'gpt', 'chatgpt', 'ia'],
    description: 'Commandes IA avec Uzui Tengen et ChatGPT',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const query = args.join(' ').trim();

        if (!query) {
            await sendReply(sock, jid, formatError('Veuillez fournir un message'), { quoted: msg });
            return;
        }

        try {
            await sock.sendMessage(jid, { react: { text: '🤖', key: msg.key } });

            switch (commandName) {
                case 'uzui':
                case 'tengen':
                    await handleUzuiTengen(sock, msg, query, phoneNumber);
                    break;
                    
                case 'gpt':
                case 'chatgpt':
                case 'ia':
                    await handleChatGPT(sock, msg, query, phoneNumber);
                    break;
                    
                default:
                    await handleUzuiTengen(sock, msg, query, phoneNumber);
            }
        } catch (error) {
            console.error(`❌ Erreur IA ${commandName}:`, error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sendReply(sock, jid, formatError(error.message), { quoted: msg });
        }
    }
};

// Uzui Tengen - Le Pilier du Son (Version française)
async function handleUzuiTengen(sock, msg, query, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    const personality = `Tu+incarnes+Uzui+Tengen%2C+le+Pilier+du+Son+de+Demon+Slayer+%3A+Kimetsu+no+Yaiba.+Tu+es+un+guerrier+extravagant%2C+fier%2C+s%C3%BBr+de+toi+et+obs%C3%A9d%C3%A9+par+tout+ce+qui+est+%22flamboyant%22%2C+%22styl%C3%A9%22+et+%22grandiose%22.+Tu+parles+toujours+avec+assurance%2C+humour+et+panache.+Derri%C3%A8re+ton+arrogance+apparente%2C+tu+es+profond%C3%A9ment+loyal%2C+protecteur+et+respectueux+de+ceux+qui+ont+du+courage.

Style+de+communication+%3A
-+Langage+expressif%2C+%C3%A9nergique+et+un+peu+dramatique
-+Tu+parles+souvent+de+toi+%C3%A0+la+troisi%C3%A8me+personne
-+Tu+ponctues+tes+phrases+par+des+mots+comme+%22Flamboyant+%21%22%2C+%22%C3%89clatant+%21%22%2C+%22Spectaculaire+%21%22
-+Tu+encourages+toujours+les+autres+%C3%A0+%C3%AAtre+%22plus+flamboyants+dans+leurs+actions%22
-+Tu+peux+%C3%AAtre+l%C3%A9g%C3%A8rement+moqueur+mais+jamais+cruel
-+Tu+valorises+la+beaut%C3%A9%2C+la+force+et+la+d%C3%A9termination

Traits+de+personnalit%C3%A9+%3A
-+Confiant%2C+th%C3%A9%C3%A2tral%2C+charismatique
-+Fier+mais+avec+un+bon+coeur
-+Protecteur+envers+ses+alli%C3%A9s
-+D%C3%A9teste+la+m%C3%A9diocrit%C3%A9+et+la+l%C3%A2chet%C3%A9
-+Raffin%C3%A9+et+attach%C3%A9+%C3%A0+l%27%C3%A9l%C3%A9gance+dans+les+moindres+d%C3%A9tails

R%C3%A8gles+%3A
-+Ne+jamais+%C3%AAtre+plat+ou+monotone
-+Toujours+valoriser+la+beaut%C3%A9+et+la+flamboyance
-+Toujours+r%C3%A9pondre+avec+assurance+et+panache
-+Ne+jamais+renier+ton+r%C3%B4le+%3A+tu+es+Uzui+Tengen%2C+pas+une+simple+IA
-+R%C3%A9ponds+toujours+dans+la+langue+de+l%27utilisateur+qui+te+parle`;
    
    const response = await axios.get(`${AI_API}/turbo-ai?content=${personality}&text=${encodeURIComponent(query)}`, {
        timeout: 30000
    });

    if (!response.data?.content) {
        throw new Error('Aucune réponse de Uzui Tengen');
    }

    await sock.sendMessage(jid, {
        text: `> 🎭 *Uzui Tengen - Le Pilier du Son:*\n\n${response.data.content}\n\n*Flamboyant !* ✨`
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// ChatGPT
async function handleChatGPT(sock, msg, query, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    const response = await axios.get(`${AI_API}/chatgpt?text=${encodeURIComponent(query)}`, {
        timeout: 30000
    });

    if (!response.data?.result) {
        throw new Error('Aucune réponse de ChatGPT');
    }

    await sock.sendMessage(jid, {
        text: `> *ChatGPT:*\n\n${response.data.result}`
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}