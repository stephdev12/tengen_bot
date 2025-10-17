import { sendReply, formatError, font } from '../lib/helpers.js';
import axios from 'axios';
import yts from 'yt-search';

const API_KEITH = 'https://apis-keith.vercel.app/download';
const API_SIPUT = 'https://api.siputzx.my.id/api';

// Stockage temporaire pour les choix
const pendingChoices = new Map();

export default {
    name: 'download',
    aliases: ['facebook', 'fb', 'instagram', 'ig', 'applemusic', 'am', 
              'pinterest', 'pin', 'savefrom', 'sf', 'soundcloud', 'sc', 'spotify', 'sp', 
              'tiktok', 'tt', 'play', 'song', 'ytmp4', 'instastory', 'porn', 'hentai', 'twitter', 'x'],
    description: 'Téléchargement de médias depuis diverses plateformes',

    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const body = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '';
        
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();
        const query = args.join(' ').trim();

        try {
            switch (commandName) {
                case 'facebook':
                case 'fb':
                    await handleFacebook(sock, msg, query, phoneNumber);
                    break;
                    
                case 'instagram':
                case 'ig':
                    await handleInstagram(sock, msg, query, phoneNumber);
                    break;
                    
                case 'applemusic':
                case 'am':
                    await handleAppleMusic(sock, msg, query, phoneNumber);
                    break;
                    
                case 'pinterest':
                case 'pin':
                    await handlePinterest(sock, msg, query, phoneNumber);
                    break;
                    
                case 'savefrom':
                case 'sf':
                    await handleSaveFrom(sock, msg, query, phoneNumber);
                    break;
                    
                case 'soundcloud':
                case 'sc':
                    await handleSoundCloud(sock, msg, query, phoneNumber);
                    break;
                    
                case 'spotify':
                case 'sp':
                    await handleSpotify(sock, msg, query, phoneNumber);
                    break;
                    
                case 'tiktok':
                case 'tt':
                    await handleTikTok(sock, msg, query, phoneNumber);
                    break;
                    
                case 'play':
                case 'song':
                    await handlePlay(sock, msg, query, phoneNumber);
                    break;
                    
                case 'ytmp4':
                    await handleYtmp4(sock, msg, query, phoneNumber);
                    break;
                    
                case 'instastory':
                    await handleInstaStory(sock, msg, query, phoneNumber);
                    break;
                    
                case 'porn':
                    await handlePorn(sock, msg, query, phoneNumber);
                    break;
                    
                case 'hentai':
                    await handleHentai(sock, msg, phoneNumber);
                    break;
                    
                case 'twitter':
                case 'x':
                    await handleTwitter(sock, msg, query, phoneNumber);
                    break;
                    
                default:
                    await sendReply(sock, jid, formatError('Commande inconnue'), { quoted: msg });
            }
        } catch (error) {
            console.error(`❌ Erreur ${commandName}:`, error.message);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sendReply(sock, jid, formatError(error.message), { quoted: msg });
        }
    }
};

// Fonction de requête API ultra-simple
async function makeRequest(url) {
    try {
        const response = await axios.get(url, { timeout: 30000 });
        return response.data;
    } catch (error) {
        throw new Error(`API error: ${error.response?.status || error.message}`);
    }
}

// Gestionnaire pour les boutons interactifs
async function handleButtonResponse(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const buttonId = msg.message.buttonsResponseMessage?.selectedButtonId;
    
    if (!buttonId) return;

    const pendingData = pendingChoices.get(sender);
    if (!pendingData) return;

    pendingChoices.delete(sender);

    try {
        await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

        if (buttonId.startsWith('sf_')) {
            const type = buttonId.replace('sf_', '');
            await processSaveFrom(sock, msg, pendingData.url, type, phoneNumber);
        }
        
    } catch (error) {
        await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
        await sendReply(sock, jid, formatError(error.message), { quoted: msg });
    }
}

// HANDLERS

async function handleFacebook(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL Facebook requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    // Essayer plusieurs APIs pour Facebook
    let data;
    
    // Essayer d'abord l'API alldl
    try {
        data = await makeRequest(`${API_KEITH}/alldl?url=${encodeURIComponent(url)}`);
        if (data.status && data.result?.data?.links?.video?.length) {
            const video = data.result.data.links.video[0];
            await sock.sendMessage(jid, {
                video: { url: video.url },
                caption: '📥 Downloaded video\n\n> TECH & VERSE'
            }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            return;
        }
    } catch (error) {
        // Continuer avec l'API suivante
    }

    // Essayer l'API video
    try {
        data = await makeRequest(`${API_KEITH}/video?url=${encodeURIComponent(url)}`);
        if (data.status && data.result) {
            await sock.sendMessage(jid, {
                video: { url: data.result },
                caption: '📥 Downloaded video\n\n> TECH & VERSE'
            }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            return;
        }
    } catch (error) {
        // Continuer
    }

    throw new Error('Vidéo Facebook non trouvée');
}

async function handleInstagram(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL Instagram requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_SIPUT}/d/igdl?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.data?.length) throw new Error('Média non trouvé');

    const media = data.data[0];
    const isVideo = media.url.includes('.mp4');
    
    await sock.sendMessage(jid, {
        [isVideo ? 'video' : 'image']: { url: media.url },
        caption: '📥 Downloaded media\n\n> TECH & VERSE'
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleAppleMusic(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL Apple Music requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_SIPUT}/d/musicapple?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.data?.mp3DownloadLink) throw new Error('Musique non trouvée');

    // Envoyer d'abord les infos
    await sock.sendMessage(jid, {
        image: { url: data.data.artworkUrl || data.data.coverImage },
        caption: `🎵 ${data.data.songTitle || 'Titre inconnu'}\n🎤 ${data.data.artist || 'Artiste inconnu'}\n\n> TECH & VERSE`
    }, { quoted: msg });

    // Puis l'audio
    await sock.sendMessage(jid, {
        audio: { url: data.data.mp3DownloadLink },
        mimetype: 'audio/mpeg'
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handlePinterest(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL Pinterest requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    // Essayer d'abord pindl3
    let data;
    try {
        data = await makeRequest(`${API_KEITH}/pindl3?url=${encodeURIComponent(url)}`);
        if (data.status && data.result) {
            const mediaUrl = data.result.video || data.result.image;
            if (mediaUrl) {
                const isVideo = data.result.video;
                
                await sock.sendMessage(jid, {
                    [isVideo ? 'video' : 'image']: { url: mediaUrl },
                    caption: '📥 Downloaded media\n\n> TECH & VERSE'
                }, { quoted: msg });
                await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
                return;
            }
        }
    } catch (error) {
        // Continuer avec l'autre API
    }

    // Essayer l'API pinterest normale
    data = await makeRequest(`${API_KEITH}/pinterest?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.result?.download?.url) throw new Error('Média non trouvé');

    const isVideo = data.result.download.type === 'video';
    
    await sock.sendMessage(jid, {
        [isVideo ? 'video' : 'image']: { url: data.result.download.url },
        caption: '📥 Downloaded media\n\n> TECH & VERSE'
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// SAVEFOR - LOGIQUE SIMPLE
async function handleSaveFrom(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    
    if (!url) throw new Error('URL requise');

    pendingChoices.set(sender, { url, timestamp: Date.now() });
    
    setTimeout(() => {
        if (pendingChoices.has(sender)) pendingChoices.delete(sender);
    }, 120000);

    const buttons = [
        { buttonId: 'sf_video', buttonText: { displayText: font('🎬 Video') }, type: 1 },
        { buttonId: 'sf_audio', buttonText: { displayText: font('🎵 Audio') }, type: 1 }
    ];

    await sock.sendMessage(jid, {
        text: '> choose:',
        buttons,
        headerType: 1
    }, { quoted: msg });
}

async function processSaveFrom(sock, msg, url, type, phoneNumber) {
    const jid = msg.key.remoteJid;

    let data;
    if (type === 'video') {
        // Essayer plusieurs APIs pour video
        try {
            data = await makeRequest(`${API_KEITH}/video?url=${encodeURIComponent(url)}`);
            if (data.status && data.result) {
                await sock.sendMessage(jid, {
                    video: { url: data.result },
                    caption: '> Downloaded video\n\n> TECH & VERSE'
                }, { quoted: msg });
                return;
            }
        } catch (error) {
            // Continuer
        }

        try {
            data = await makeRequest(`${API_KEITH}/ytmp4?url=${encodeURIComponent(url)}`);
            if (data.status && data.result?.url) {
                await sock.sendMessage(jid, {
                    video: { url: data.result.url },
                    caption: `> 📥 ${data.result.filename || 'YouTube Video'}\n\n> TECH & VERSE`
                }, { quoted: msg });
                return;
            }
        } catch (error) {
            // Continuer
        }

        throw new Error('Aucune vidéo trouvée');
    } else {
        // Pour audio
        data = await makeRequest(`${API_KEITH}/dlmp3?url=${encodeURIComponent(url)}`);
        if (data.status && data.result?.data?.downloadUrl) {
            // Envoyer d'abord les infos
            await sock.sendMessage(jid, {
                image: { url: data.result.data.thumbnail },
                caption: `> ${data.result.data.title}\n> ${Math.floor(data.result.data.duration / 60)}:${(data.result.data.duration % 60).toString().padStart(2, '0')}\n\n> TECH & VERSE`
            }, { quoted: msg });

            // Puis l'audio
            await sock.sendMessage(jid, {
                audio: { url: data.result.data.downloadUrl },
                mimetype: 'audio/mpeg',
                ptt:false
            }, { quoted: msg });
            return;
        }
        throw new Error('Aucun audio trouvé');
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleSoundCloud(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL SoundCloud requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_SIPUT}/d/soundcloud?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.data?.url) throw new Error('Audio non trouvé');

    // Envoyer d'abord les infos
    await sock.sendMessage(jid, {
        image: { url: data.data.thumbnail },
        caption: `> 🎵 ${data.data.title}\n> ${data.data.user}\n\n> TECH & VERSE`
    }, { quoted: msg });

    // Puis l'audio
    await sock.sendMessage(jid, {
        audio: { url: data.data.url },
        mimetype: 'audio/mpeg'
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleSpotify(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL Spotify requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_SIPUT}/d/spotifyv2?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.data?.mp3DownloadLink) throw new Error('Musique non trouvée');

    // Envoyer d'abord les infos
    await sock.sendMessage(jid, {
        image: { url: data.data.coverImage },
        caption: `> 🎵 ${data.data.songTitle}\n🎤 ${data.data.artist}\n\n> TECH & VERSE`
    }, { quoted: msg });

    // Puis l'audio
    await sock.sendMessage(jid, {
        audio: { url: data.data.mp3DownloadLink },
        mimetype: 'audio/mpeg'
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleTikTok(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL TikTok requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    // Essayer plusieurs APIs TikTok
    let data;
    
    // Essayer tiktokdl3 d'abord
    try {
        data = await makeRequest(`${API_KEITH}/tiktokdl3?url=${encodeURIComponent(url)}`);
        if (data.status && data.result?.downloadUrls?.mp4?.length) {
            const videoUrl = data.result.downloadUrls.mp4[0];
            await sock.sendMessage(jid, {
                video: { url: videoUrl },
                caption: `> ${data.result.title || 'TikTok Video'}\n\n> TECH & VERSE`
            }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            return;
        }
    } catch (error) {
        // Continuer
    }

    // Essayer tiktokdl2
    try {
        data = await makeRequest(`${API_KEITH}/tiktokdl2?url=${encodeURIComponent(url)}`);
        if (data.status && data.result?.results?.length) {
            const videoResult = data.result.results.find(r => r.text.includes('without watermark'));
            if (videoResult) {
                await sock.sendMessage(jid, {
                    video: { url: videoResult.href },
                    caption: `> ${data.result.metadata?.title || 'TikTok Video'}\n\n> TECH & VERSE`
                }, { quoted: msg });
                await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
                return;
            }
        }
    } catch (error) {
        // Continuer
    }

    // Essayer tiktokdl
    try {
        data = await makeRequest(`${API_KEITH}/tiktokdl?url=${encodeURIComponent(url)}`);
        if (data.status && data.result?.nowm) {
            await sock.sendMessage(jid, {
                video: { url: data.result.nowm },
                caption: `> ${data.result.title || 'TikTok Video'}\n\n> TECH & VERSE`
            }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            return;
        }
    } catch (error) {
        // Continuer
    }

    throw new Error('Vidéo TikTok non trouvée');
}

async function handlePlay(sock, msg, query, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!query) throw new Error('Titre requis');

    await sock.sendMessage(jid, { react: { text: '🎵', key: msg.key } });

    const { videos } = await yts(query);
    if (!videos?.length) throw new Error('Aucun résultat trouvé');

    const video = videos[0];

    const response = await makeRequest(`${API_KEITH}/dlmp3?url=${video.url}`);
    if (!response?.result?.data?.downloadUrl) throw new Error('Échec extraction audio');

    // Envoyer d'abord les infos avec thumbnail
    await sock.sendMessage(jid, {
        image: { url: video.thumbnail },
        caption: `> 🎵 ${video.title}\n> 👤 ${video.author.name}\n\n> TECH & VERSE`
    }, { quoted: msg });

    // Puis l'audio
    await sock.sendMessage(jid, {
        audio: { url: response.result.data.downloadUrl },
        mimetype: 'audio/mpeg'
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// NOUVELLES COMMANDES

async function handleYtmp4(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL YouTube requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    // Essayer plusieurs APIs
    let data;
    try {
        data = await makeRequest(`${API_KEITH}/video?url=${encodeURIComponent(url)}`);
        if (data.status && data.result) {
            await sock.sendMessage(jid, {
                video: { url: data.result },
                caption: '📥 Downloaded video\n\n> TECH & VERSE'
            }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            return;
        }
    } catch (error) {
        // Continuer
    }

    try {
        data = await makeRequest(`${API_KEITH}/ytmp4?url=${encodeURIComponent(url)}`);
        if (data.status && data.result?.url) {
            await sock.sendMessage(jid, {
                video: { url: data.result.url },
                caption: `> 📥 ${data.result.filename || 'YouTube Video'}\n\n> TECH & VERSE`
            }, { quoted: msg });
            await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
            return;
        }
    } catch (error) {
        // Continuer
    }

    throw new Error('Vidéo non trouvée');
}

async function handleInstaStory(sock, msg, username, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!username) throw new Error('Nom d\'utilisateur Instagram requis');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_KEITH}/instastories?q=${encodeURIComponent(username)}`);
    
    if (!data.status || !data.result?.items?.length) throw new Error('Aucune story trouvée');

    const stories = data.result.items.slice(0, 5); // Limiter à 5 stories
    
    for (const story of stories) {
        if (story.type === 'image') {
            await sock.sendMessage(jid, {
                image: { url: story.url },
                caption: '> 📥 Instagram Story\n\n> TECH & VERSE'
            }, { quoted: msg });
        } else if (story.type === 'video') {
            await sock.sendMessage(jid, {
                video: { url: story.url },
                caption: '> 📥 Instagram Story\n\n> TECH & VERSE'
            }, { quoted: msg });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handlePorn(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL pornographique requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_KEITH}/porn?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.result?.downloads) throw new Error('Vidéo non trouvée');

    const videoUrl = data.result.downloads.highQuality || data.result.downloads.lowQuality;
    
    await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: `> 📥 ${data.result.videoInfo?.title || 'Porn Video'}\n\n> TECH & VERSE`
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleHentai(sock, msg, phoneNumber) {
    const jid = msg.key.remoteJid;

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_KEITH}/hentaivid`);
    
    if (!data.status || !data.result?.length) throw new Error('Aucune vidéo hentai trouvée');

    // Sélectionner une vidéo aléatoire
    const randomVideo = data.result[Math.floor(Math.random() * data.result.length)];
    
    const videoUrl = randomVideo.media?.video_url || randomVideo.media?.fallback_url;
    
    if (!videoUrl) throw new Error('Lien vidéo non disponible');

    await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: `🎬 ${randomVideo.title}\n📁 ${randomVideo.category}\n👁️ ${randomVideo.views_count} vues\n\n> TECH & VERSE`
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

async function handleTwitter(sock, msg, url, phoneNumber) {
    const jid = msg.key.remoteJid;
    if (!url) throw new Error('URL Twitter requise');

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    const data = await makeRequest(`${API_KEITH}/twitter?url=${encodeURIComponent(url)}`);
    
    if (!data.status || !data.result) throw new Error('Vidéo Twitter non trouvée');

    const videoUrl = data.result.video_hd || data.result.video_sd;
    
    if (!videoUrl) throw new Error('Lien vidéo non disponible');

    await sock.sendMessage(jid, {
        video: { url: videoUrl },
        caption: `🐦 ${data.result.desc || 'Twitter Video'}\n\n> TECH & VERSE`
    }, { quoted: msg });

    await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
}

// Exporter la fonction de gestion des boutons
export { handleButtonResponse };