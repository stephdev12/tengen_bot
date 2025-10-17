import { downloadContentFromMessage } from 'baileys';
import fs from 'fs/promises';
import path from 'path';

export default {
    name: 'convert',
    aliases: ['toimg', 'tovid', 'sticker2img', 'sticker2vid'],
    description: 'Convertit les stickers en image ou vidéo',
    
    async execute({ sock, msg, args, phoneNumber, userSettings }) {
        const jid = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted || !quoted.stickerMessage) {
            await sock.sendMessage(jid, { 
                text: '❌ Répondez à un sticker avec !toimg ou !tovid' 
            }, { quoted: msg });
            return;
        }

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const commandName = body.slice(userSettings.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        try {
            await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

            // Télécharger le sticker
            const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (!buffer || buffer.length === 0) {
                throw new Error('Impossible de télécharger le sticker');
            }

            // Déterminer le type de conversion
            if (commandName === 'toimg' || commandName === 'sticker2img') {
                await convertToImage(sock, msg, buffer, phoneNumber);
            } else if (commandName === 'tovid' || commandName === 'sticker2vid') {
                await convertToVideo(sock, msg, buffer, phoneNumber);
            } else {
                await sock.sendMessage(jid, { 
                    text: '❌ Commande invalide. Utilisez !toimg ou !tovid' 
                }, { quoted: msg });
            }

        } catch (error) {
            console.error(`❌ Erreur conversion:`, error);
            await sock.sendMessage(jid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(jid, { 
                text: `❌ Erreur: ${error.message}` 
            }, { quoted: msg });
        }
    }
};

// Convertir en image
async function convertToImage(sock, msg, buffer, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    try {
        // Vérifier si c'est un sticker animé
        const isAnimated = await checkIfAnimatedWebP(buffer);
        
        if (isAnimated) {
            // Extraire le premier frame du WebP animé
            const firstFrame = await extractFirstFrameFromWebP(buffer);
            if (firstFrame) {
                await sock.sendMessage(jid, {
                    image: firstFrame,
                    caption: '> convert\n\n> TECH & VERSE'
                }, { quoted: msg });
            } else {
                // Fallback: envoyer le WebP directement
                await sock.sendMessage(jid, {
                    image: buffer,
                    caption: '> convert\n\n> TECH & VERSE'
                }, { quoted: msg });
            }
        } else {
            // Sticker statique normal
            await sock.sendMessage(jid, {
                image: buffer,
                caption: '> convert\n\n> TECH & VERSE'
            }, { quoted: msg });
        }
        
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        
    } catch (error) {
        console.error('❌ Erreur conversion image:', error);
        throw new Error('Échec de la conversion en image');
    }
}

// Convertir en vidéo - VERSION SIMPLIFIÉE ET FONCTIONNELLE
async function convertToVideo(sock, msg, buffer, phoneNumber) {
    const jid = msg.key.remoteJid;
    
    try {
        // Vérifier si c'est un sticker animé
        const isAnimated = await checkIfAnimatedWebP(buffer);
        
        if (isAnimated) {
            console.log('🎬 Conversion sticker animé...');
            
            // Méthode simple: convertir en WebM (mieux supporté)
            const videoBuffer = await convertToWebM(buffer);
            
            if (videoBuffer) {
                await sock.sendMessage(jid, {
                    video: videoBuffer,
                    caption: '> convert\n\n> TECH & VERSE'
                }, { quoted: msg });
            } else {
                throw new Error('Impossible de convertir le sticker animé');
            }
            
        } else {
            // Sticker statique - méthode simple et fiable
            console.log('📹 Conversion sticker statique...');
            const videoBuffer = await createSimpleVideo(buffer);
            
            await sock.sendMessage(jid, {
                video: videoBuffer,
                caption: '> convert\n\n> TECH & VERSE'
            }, { quoted: msg });
        }
        
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        
    } catch (error) {
        console.error('❌ Erreur conversion vidéo:', error);
        throw new Error('Échec de la conversion: ' + error.message);
    }
}

// Vérifier si le WebP est animé
async function checkIfAnimatedWebP(buffer) {
    try {
        if (buffer.length < 20) return false;
        
        const riffHeader = buffer.toString('ascii', 0, 4);
        if (riffHeader !== 'RIFF') return false;
        
        const webpHeader = buffer.toString('ascii', 8, 12);
        if (webpHeader !== 'WEBP') return false;
        
        // Chercher les chunks d'animation
        const bufferStr = buffer.toString('hex');
        return bufferStr.includes('414e494d') || bufferStr.includes('414e4d46'); // ANIM ou ANMF
    } catch (error) {
        return false;
    }
}

// Extraire le premier frame d'un WebP animé
async function extractFirstFrameFromWebP(buffer) {
    try {
        const sharp = await import('sharp');
        const firstFrame = await sharp.default(buffer, { 
            animated: true,
            page: 0 
        })
        .png()
        .toBuffer();
        return firstFrame;
    } catch (error) {
        console.log('⚠️ Extraction frame échouée');
        return null;
    }
}

// Convertir en WebM (format vidéo bien supporté)
async function convertToWebM(buffer) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const tempDir = await ensureTempDir();
    const tempWebP = path.join(tempDir, 'convert_input.webp');
    const tempWebM = path.join(tempDir, 'convert_output.webm');
    
    try {
        // Sauvegarder le WebP
        await fs.writeFile(tempWebP, buffer);
        
        // Convertir en WebM avec ffmpeg
        const ffmpegCommand = `ffmpeg -i "${tempWebP}" -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 1M -crf 30 -speed 4 -row-mt 1 -t 5 -y "${tempWebM}"`;
        await execAsync(ffmpegCommand, { timeout: 10000 });
        
        // Lire le résultat
        const videoBuffer = await fs.readFile(tempWebM);
        
        // Vérifier la taille
        if (videoBuffer.length < 1000) {
            throw new Error('Vidéo trop petite');
        }
        
        return videoBuffer;
        
    } catch (error) {
        console.log('❌ Conversion WebM échouée:', error.message);
        
        // Fallback: utiliser sharp pour créer un MP4 simple
        return await createSimpleVideo(buffer);
        
    } finally {
        // Nettoyer
        await fs.unlink(tempWebP).catch(() => {});
        await fs.unlink(tempWebM).catch(() => {});
    }
}

// Créer une vidéo simple et fiable
async function createSimpleVideo(buffer) {
    const sharp = await import('sharp');
    
    try {
        // Convertir d'abord en PNG avec des dimensions standard
        const pngBuffer = await sharp.default(buffer)
            .resize(512, 512, { 
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toBuffer();
        
        // Utiliser ffmpeg pour créer une vidéo très simple
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        const tempDir = await ensureTempDir();
        const tempImage = path.join(tempDir, 'video_frame.png');
        const tempVideo = path.join(tempDir, 'simple_video.mp4');
        
        await fs.writeFile(tempImage, pngBuffer);
        
        // Commande ffmpeg simple et robuste
        const ffmpegCommand = `ffmpeg -loop 1 -i "${tempImage}" -c:v libx264 -t 3 -pix_fmt yuv420p -vf "scale=512:512" -r 10 -y "${tempVideo}"`;
        await execAsync(ffmpegCommand, { timeout: 10000 });
        
        const videoBuffer = await fs.readFile(tempVideo);
        
        // Nettoyer
        await fs.unlink(tempImage).catch(() => {});
        await fs.unlink(tempVideo).catch(() => {});
        
        return videoBuffer;
        
    } catch (error) {
        console.log('❌ Création vidéo simple échouée:', error.message);
        
        // Dernier recours: renvoyer l'image comme "vidéo"
        // WhatsApp peut parfois gérer ça
        return buffer;
    }
}

// Fonction utilitaire pour créer un dossier temporaire
async function ensureTempDir() {
    const tempDir = path.join(process.cwd(), 'tmp');
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
}