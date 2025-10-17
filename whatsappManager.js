import makeWASocket, { 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    jidNormalizedUser
} from 'baileys';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import NodeCache from 'node-cache';
import Database from './lib/database.js';
import config from './config.js';
import { isAdmin, isOwner, checkPermissions } from './lib/isAdmin.js';
import { safeSend, safeReact } from './lib/safeSend.js';
import sudoManager from './lib/sudoManager.js';

class WhatsAppManager {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.sessionData = null;
        
        // Cache pour les groupes
        this.groupCache = new NodeCache({
            stdTTL: 10 * 60,
            checkperiod: 120,
            useClones: false
        });
        
        // Rate limiting simple
        this.rateLimiters = new Map();
        this.userWarnings = new Map();
        this.lastMessageTime = new Map();
        
        // Commandes
        this.commands = new Map();
        
        this.setupSessionsDirectory();
        this.loadCommands();
        this.setupTempDirectories();
    }

    setupSessionsDirectory() {
        if (!fs.existsSync(config.sessionDir)) {
            fs.mkdirSync(config.sessionDir, { recursive: true });
        }
    }

    setupTempDirectories() {
        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    }

    async loadCommands() {
        console.log('📚 Loading commands...');
        this.commands.clear();
        
        const commandsDir = path.join(process.cwd(), 'commands');
        if (!fs.existsSync(commandsDir)) {
            console.log('📁 Creating commands directory');
            fs.mkdirSync(commandsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'));
        
        for (const file of files) {
            try {
                const commandPath = path.join(commandsDir, file);
                const commandUrl = `file://${commandPath}?update=${Date.now()}`;
                
                const command = await import(commandUrl);
                const cmd = command.default || command;
                
                if (cmd.name) {
                    this.commands.set(cmd.name.toLowerCase(), cmd);
                    
                    if (cmd.aliases && Array.isArray(cmd.aliases)) {
                        cmd.aliases.forEach(alias => {
                            this.commands.set(alias.toLowerCase(), cmd);
                        });
                    }
                    
                    console.log(`✅ Command loaded: ${cmd.name}`);
                }
            } catch (error) {
                console.error(`❌ Error loading command ${file}:`, error.message);
            }
        }
        
        console.log(`📚 ${this.commands.size} commands loaded`);
    }

    getRateLimiter(key) {
        if (!this.rateLimiters.has(key)) {
            this.rateLimiters.set(key, {
                lastRequest: Date.now(),
                requestCount: 0,
                isBlocked: false,
                blockUntil: 0
            });
        }
        return this.rateLimiters.get(key);
    }

    checkRateLimit(key) {
        const limiter = this.getRateLimiter(key);
        const now = Date.now();
        
        if (now - limiter.lastRequest > 60000) {
            limiter.requestCount = 0;
            limiter.isBlocked = false;
            limiter.blockUntil = 0;
        }
        
        if (limiter.isBlocked) {
            if (now < limiter.blockUntil) {
                return false;
            } else {
                limiter.isBlocked = false;
                limiter.requestCount = 0;
            }
        }
        
        limiter.requestCount++;
        limiter.lastRequest = now;
        
        if (limiter.requestCount > 100) {
            limiter.isBlocked = true;
            limiter.blockUntil = now + 5000;
            return false;
        }
        
        return true;
    }

    getUserWarnings(jid, userId) {
        const key = `${jid}_${userId}`;
        if (!this.userWarnings.has(key)) {
            this.userWarnings.set(key, {
                antilink: 0,
                antispam: 0,
                messages: [],
                lastReset: Date.now()
            });
        }
        return this.userWarnings.get(key);
    }

    resetUserWarnings(jid, userId = null) {
        if (userId) {
            const key = `${jid}_${userId}`;
            this.userWarnings.delete(key);
        } else {
            for (const [key] of this.userWarnings) {
                if (key.startsWith(`${jid}_`)) {
                    this.userWarnings.delete(key);
                }
            }
        }
    }

    async sendMessageSafe(jid, message) {
        const now = Date.now();
        const lastTime = this.lastMessageTime.get(jid) || 0;
        const timeSinceLastMessage = now - lastTime;
        
        if (timeSinceLastMessage < 2000) {
            const waitTime = 2000 - timeSinceLastMessage;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        try {
            await this.sock.sendMessage(jid, message);
            this.lastMessageTime.set(jid, Date.now());
            return true;
        } catch (error) {
            if (error.message?.includes('rate-overlimit')) {
                console.log(`⚠️ WhatsApp rate limit hit, waiting 10s...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                return false;
            }
            throw error;
        }
    }

    async createSession(callbacks = {}) {
        try {
            console.log('🔄 Creating WhatsApp session...');
            
            const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
            const { version } = await fetchLatestBaileysVersion();

            // Cache pour les retries
            const msgRetryCounterCache = new NodeCache();

            this.sock = makeWASocket({
                version,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: ["Ubuntu", "Chrome", "20.0.04"],
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: true,
                getMessage: async (key) => {
                    return { message: { conversation: '' } };
                },
                msgRetryCounterCache,
                defaultQueryTimeoutMs: undefined,
            });

            this.sessionData = {
                sock: this.sock,
                createdAt: new Date(),
                lastActivity: new Date(),
                isHealthy: true
            };

            // Gestion des crédits
            this.sock.ev.on('creds.update', saveCreds);

            // Gestion des groupes
            this.sock.ev.on('groups.update', async (updates) => {
                for (const update of updates) {
                    try {
                        const metadata = await this.sock.groupMetadata(update.id);
                        this.groupCache.set(update.id, metadata);
                    } catch (e) {
                        console.error('❌ Group cache error:', e.message);
                    }
                }
            });

            // Gestion de la connexion
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                console.log(`📡 Connection update:`, connection);

                if (connection === 'open') {
                    console.log('✅ WhatsApp connected successfully');
                    this.isConnected = true;
                    
                    // Envoyer message de bienvenue
                    await this.sendWelcomeMessage();
                    
                    callbacks.onConnected?.();
                    
                } else if (connection === 'close') {
                    this.isConnected = false;
                    
                    const error = lastDisconnect?.error;
                    const statusCode = error?.output?.statusCode;
                    
                    console.log(`❌ Connection closed:`, error?.message);
                    
                    // Logout définitif
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        console.log('❌ Session logged out');
                        callbacks.onDisconnected?.('Logged out');
                        return;
                    }
                    
                    // Reconnexion
                    console.log('🔄 Reconnecting...');
                    setTimeout(() => {
                        this.createSession(callbacks);
                    }, 3000);
                    
                } else if (qr) {
                    console.log('📱 QR code generated');
                    callbacks.onQr?.(qr);
                }
            });

            // Gestion des messages
            this.sock.ev.on('messages.upsert', async ({ messages }) => {
                try {
                    for (const message of messages) {
                        if (message.key.remoteJid === 'status@broadcast') {
                            await this.handleStatusMessage(message);
                            continue;
                        }
                        
                        await this.handleMessage(message);
                    }
                } catch (error) {
                    console.error('❌ Message handling error:', error);
                }
            });

            // Gestion des participants groupe
            this.sock.ev.on('group-participants.update', async (event) => {
                await this.handleGroupParticipantsUpdate(event);
            });

            // Génération du pairing code si nécessaire
           setTimeout(async () => {
    const sessionPath = config.sessionDir;
    const credsPath = path.join(sessionPath, 'creds.json');
    
    if (fs.existsSync(credsPath) && state.creds.registered) {
        console.log('✅ Session déjà enregistrée, reconnexion...');
        return;
    }
    
    if (!state.creds.registered) {
        try {
            console.log('📱 Demande du code de pairing...');
            
            const customBrand = "STEPHDEV";
            let code;
            
            try {
                code = await this.sock.requestPairingCode(config.owner, customBrand);
                console.log(`✅ Marque personnalisée appliquée: ${customBrand}`);
            } catch (brandError) {
                console.log(`⚠️ Marque personnalisée non supportée, utilisation par défaut`);
                code = await this.sock.requestPairingCode(config.owner);
            }
            
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`🔑 Code de Pairing: ${formattedCode}`);
            
            callbacks.onPairingCode?.(formattedCode, customBrand);
            
            // ⭐ Délai d'expiration du code (60 secondes)
            setTimeout(() => {
                if (!state.creds.registered) {
                    console.log(`⏰ Code de pairing expiré`);
                    callbacks.onError?.(new Error('Code de pairing expiré'));
                }
            }, 60000);
            
        } catch (error) {
            console.error('❌ Erreur pairing:', error.message);
            callbacks.onError?.(error);
        }
    }
}, 3000);

            return this.sock;

        } catch (error) {
            console.error('❌ Session creation error:', error);
            callbacks.onError?.(error);
            throw error;
        }
    }

    async sendWelcomeMessage() {
        try {
            const userSettings = await Database.getUserSettings();
            const welcomeMessage = `*_CONNECTED SUCCESSFULLY_*\n\n` +
                `> *BOT NAME:* ${userSettings.bot_name}\n` +
                `> *PREFIX:* ${userSettings.prefix}\n` +
                `> *MODE:* ${userSettings.bot_mode}\n\n` +
                `> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴`;
            
            // Envoyer au owner si configuré
            if (config.owner) {
                const ownerJid = `${config.owner}@s.whatsapp.net`;
                await this.sock.sendMessage(ownerJid, { 
                    image: { 
                        url: userSettings.menu_image 
                    }, 
                    caption: welcomeMessage 
                });
            }
            
            console.log('📨 Welcome message sent');
            
        } catch (error) {
            console.error('❌ Welcome message error:', error.message);
        }
    }

    async handleStatusMessage(message) {
        try {
            if (config.autostatus) {
                const { handleAutoStatus } = await import('./commands/autostatus.js');
                await handleAutoStatus(this.sock, { messages: [message] });
            }
        } catch (error) {
            console.error('❌ Status handling error:', error.message);
        }
    }

    async handleMessage(msg) {
    if (!msg.message) return;

    if (this.sessionData) {
        this.sessionData.lastActivity = new Date();
    }

    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const isGroup = jid.endsWith('@g.us');
    
    const body = msg.message.conversation || 
                msg.message.extendedTextMessage?.text || 
                msg.message.imageMessage?.caption || '';

    // ⭐ DÉCLARATION UNIQUE de isCommand
    const userSettings = await Database.getUserSettings();
    const isCommand = body.startsWith(userSettings.prefix);

    // Ignorer les messages du bot SAUF si c'est une commande
    if (msg.key.fromMe && !isCommand) {
        return;
    }

    // ⭐ AJOUT: Log pour debug
    console.log(`📨 Message de ${msg.key.fromMe ? 'BOT' : sender}: ${body.substring(0, 50)}...`);
    if (isCommand) {
        console.log(`🔍 Commande détectée: ${body}`);
    }

    // Gestion antidelete
    if (msg.message.protocolMessage?.type === 0) {
        try {
            const { handleMessageRevocation } = await import('./commands/antidelete.js');
            await handleMessageRevocation(msg, this.sock);
        } catch (error) {
            console.error('❌ Antidelete error:', error.message);
        }
        return;
    }

    // Stocker le message pour antidelete
    try {
        const { storeMessage } = await import('./commands/antidelete.js');
        await storeMessage(msg, this.sock);
    } catch (error) {
        console.error('❌ Store message error:', error.message);
    }

    // Autowrite et Autoreact pour messages non-commande
    if (!isCommand && !msg.key.fromMe) {
        await this.handleAutoFeatures(msg);
    }

    // Gestion des commandes
    if (isCommand) {
        await this.handleCommand(msg, body, userSettings);
    }

    // Protection des groupes
    if (isGroup && !msg.key.fromMe) {
        await this.applyGroupProtections(msg, userSettings);
    }
}

    async handleAutoFeatures(msg) {
        // Autowrite
        try {
            const { handleAutowriteMessage } = await import('./commands/autowrite.js');
            if (handleAutowriteMessage) {
                await handleAutowriteMessage(this.sock, msg);
            }
        } catch (error) {
            // Silent fail
        }

        // Autoreact
        try {
            const { handleAutoReact } = await import('./commands/autoreact.js');
            if (handleAutoReact) {
                await handleAutoReact(this.sock, msg);
            }
        } catch (error) {
            // Silent fail
        }
    }

    async applyGroupProtections(msg, userSettings) {
        const jid = msg.key.remoteJid;
        const sender = msg.key.participant || jid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        const groupSettings = await Database.getGroupSettings(jid);

        if (groupSettings.antispam_enabled) {
            await this.checkSpam(msg, jid, sender, body, groupSettings);
        }

        if (groupSettings.antilink_enabled) {
            await this.checkLinks(msg, jid, sender, body, groupSettings);
        }

        if (groupSettings.antimention_enabled) {
            await this.checkMentions(msg, jid, sender, body, groupSettings);
        }

        if (groupSettings.antitag_enabled) {
            await this.checkMassTags(msg, jid, sender, body, groupSettings);
        }
    }

   async  checkSpam(msg, jid, sender, body, groupSettings) {
    try {
        // ⭐ Vérifier si c'est le owner
        if (isOwner(msg)) return;

        // ⭐ Vérifier si c'est un admin
        const senderIsAdmin = await isAdmin(this.sock, jid, sender);
        if (senderIsAdmin) return;

        const userWarnings = this.getUserWarnings(jid, sender);
        const now = Date.now();
        
        userWarnings.messages = userWarnings.messages.filter(m => now - m.timestamp < 5000);
        userWarnings.messages.push({ timestamp: now, body: body });

        if (userWarnings.messages.length > 5) {
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { delete: msg.key });
            userWarnings.antispam++;
            
            const warningMsg = `🚫 @${sender.split('@')[0]} - Spam detected!\n` +
                             `Warnings: ${userWarnings.antispam}/${groupSettings.antispam_threshold || 3}`;
            
            await safeSend(this.sock, jid, { 
                text: warningMsg,
                mentions: [sender]
            });

            if (userWarnings.antispam >= (groupSettings.antispam_threshold || 3)) {
                try {
                    await this.sock.groupParticipantsUpdate(jid, [sender], "remove");
                    await safeSend(this.sock, jid, { 
                        text: `👋 @${sender.split('@')[0]} removed for spam`,
                        mentions: [sender]
                    });
                } catch (kickError) {
                    console.error('❌ Cannot remove user:', kickError.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ Spam protection error:', error.message);
    }
}

async  checkLinks(msg, jid, sender, body, groupSettings) {
    try {
        // ⭐ Vérifier si c'est le owner
        if (isOwner(msg)) return;

        // ⭐ Vérifier si c'est un admin
        const senderIsAdmin = await isAdmin(this.sock, jid, sender);
        if (senderIsAdmin) return;

        const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
        if (linkRegex.test(body)) {
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { delete: msg.key });
            const userWarnings = this.getUserWarnings(jid, sender);
            userWarnings.antilink++;
            
            const warningMsg = `🚫 @${sender.split('@')[0]} - Links not allowed!\n` +
                             `Warnings: ${userWarnings.antilink}/${groupSettings.antilink_threshold || 3}`;
            
            await safeSend(this.sock, jid, { 
                text: warningMsg,
                mentions: [sender]
            });

            if (userWarnings.antilink >= (groupSettings.antilink_threshold || 3)) {
                try {
                    await this.sock.groupParticipantsUpdate(jid, [sender], "remove");
                    await safeSend(this.sock, jid, { 
                        text: `👋 @${sender.split('@')[0]} removed for sending links`,
                        mentions: [sender]
                    });
                } catch (kickError) {
                    console.error('❌ Cannot remove user:', kickError.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ Link protection error:', error.message);
    }
}

async  checkMentions(msg, jid, sender, body, groupSettings) {
    try {
        // ⭐ Vérifier si c'est le owner
        if (isOwner(msg)) return;

        // ⭐ Vérifier si c'est un admin
        const senderIsAdmin = await isAdmin(this.sock, jid, sender);
        if (senderIsAdmin) return;

        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const hasMassMention = mentions.length >= 3;
        const hasGroupMention = body.includes('@everyone') || body.includes('@all');
        
        if (hasMassMention || hasGroupMention) {
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { delete: msg.key });
            const warningMsg = `🚫 @${sender.split('@')[0]} - Mass mentions not allowed!`;
            await safeSend(this.sock, jid, { text: warningMsg, mentions: [sender] });
        }
    } catch (error) {
        console.error('❌ Mention protection error:', error.message);
    }
}

async  checkMassTags(msg, jid, sender, body, groupSettings) {
    try {
        // ⭐ Vérifier si c'est le owner
        if (isOwner(msg)) return;

        // ⭐ Vérifier si c'est un admin (avec votre logique intacte)
        const senderIsAdmin = await isAdmin(this.sock, jid, sender);
        if (senderIsAdmin) return;

        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentions.length >= 5) {
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { delete: msg.key });
            const warningMsg = `🚫 @${sender.split('@')[0]} - Too many tags!`;
            await safeSend(this.sock, jid, { text: warningMsg, mentions: [sender] });
        }
    } catch (error) {
        console.error('❌ Tag protection error:', error.message);
    }
}


    async handleGroupParticipantsUpdate(event) {
        const { id, participants, action } = event;
        
        try {
            const groupSettings = await Database.getGroupSettings(id);
            
            // Antidemote/Antipromote
            if (action === 'demote' && groupSettings.antidemote_enabled) {
                await this.handleAntidemote(event);
            }
            
            if (action === 'promote' && groupSettings.antipromote_enabled) {
                await this.handleAntipromote(event);
            }
            
            // Welcome/Goodbye
            if (action === 'add' && groupSettings.welcome_enabled) {
                await this.sendWelcomeMessageToGroup(event, groupSettings);
            }
            
            if (action === 'remove' && groupSettings.goodbye_enabled) {
                await this.sendGoodbyeMessageToGroup(event, groupSettings);
            }
        } catch (error) {
            console.error('❌ Group update error:', error);
        }
    }

    async handleAntidemote(event) {
        const { id, participants } = event;
        
        console.log(`🛡️ Anti-Demote activated for ${id}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (const participant of participants) {
            try {
                await this.sock.groupParticipantsUpdate(id, [participant], 'promote');
                console.log(`✅ Admin restored: ${participant.split('@')[0]}`);
            } catch (error) {
                console.error('❌ Anti-demote error:', error.message);
            }
        }
    }

    async handleAntipromote(event) {
        const { id, participants } = event;
        
        console.log(`🛡️ Anti-Promote activated for ${id}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        for (const participant of participants) {
            try {
                await this.sock.groupParticipantsUpdate(id, [participant], 'demote');
                console.log(`✅ Promotion cancelled: ${participant.split('@')[0]}`);
            } catch (error) {
                console.error('❌ Anti-promote error:', error.message);
            }
        }
    }

    async sendWelcomeMessageToGroup(event, groupSettings) {
        const { id, participants } = event;
        
        try {
            const metadata = await this.sock.groupMetadata(id);
            
            for (const participant of participants) {
                const welcomeText = groupSettings.welcome_message || 
                    `👋 Welcome @${participant.split('@')[0]} to ${metadata.subject}!\n` +
                    `We are now ${metadata.participants.length} members.`;
                
                await this.sock.sendMessage(id, {
                    text: welcomeText,
                    mentions: [participant]
                });
            }
        } catch (error) {
            console.error('❌ Welcome message error:', error);
        }
    }

    async sendGoodbyeMessageToGroup(event, groupSettings) {
        const { id, participants } = event;
        
        try {
            const metadata = await this.sock.groupMetadata(id);
            
            for (const participant of participants) {
                const goodbyeText = groupSettings.goodbye_message || 
                    `👋 @${participant.split('@')[0]} has left ${metadata.subject}.\n` +
                    `We are now ${metadata.participants.length} members.`;
                
                await this.sock.sendMessage(id, {
                    text: goodbyeText,
                    mentions: [participant]
                });
            }
        } catch (error) {
            console.error('❌ Goodbye message error:', error);
        }
    }

   async  handleCommand(msg, body, userSettings) {
    const jid = msg.key.remoteJid;
    const args = body.slice(userSettings.prefix.length).trim().split(/\s+/);
    const commandName = args[0].toLowerCase();
    
    try {
        const command = this.commands.get(commandName);
        if (!command) {
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { 
                text: `❌ Unknown command: ${commandName}\nUse ${userSettings.prefix}help` 
            });
            return;
        }

        // Vérification des permissions
        const permission = await checkPermissions({
            sock: this.sock, 
            msg, 
            userSettings, 
            commandName
        });

        if (!permission.allowed) {
            let errorMsg = '';
            switch (permission.reason) {
                case 'ACCESS_DENIED':
                    console.log(`🔒 Command ignored in private mode`);
                    return;
                case 'OWNER_ONLY':
                    errorMsg = '❌ This command can only be used by the bot owner.';
                    break;
                case 'PREMIUM_ONLY':
                    errorMsg = '👑 This is a premium command. Contact owner to upgrade.';
                    break;
                case 'ADMIN_ONLY':
                    errorMsg = '🔧 This command can only be used by group admins.';
                    break;
                default:
                    errorMsg = '❌ You do not have permission to use this command.';
            }
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { text: errorMsg });
            return;
        }

        const groupSettings = jid.endsWith('@g.us') ? await Database.getGroupSettings(jid) : {};

        await command.execute({
            sock: this.sock,
            msg,
            args: args.slice(1),
            phoneNumber: config.owner,
            userSettings,
            groupSettings,
            jid,
            isGroup: jid.endsWith('@g.us'),
            getUserWarnings: (userId) => this.getUserWarnings(jid, userId),
            resetUserWarnings: (userId) => this.resetUserWarnings(jid, userId),
            whatsappManager: this
        });
        
    } catch (error) {
        console.error('❌ Command error:', error.message);
        
        try {
            // ⭐ Utiliser safeSend
            await safeSend(this.sock, jid, { 
                text: `❌ Error: ${error.message}` 
            });
        } catch (sendError) {
            console.error('❌ Cannot send error message:', sendError.message);
        }
    }
}

    // Méthodes utilitaires
    getSock() {
        return this.sock;
    }

    isConnected() {
        return this.isConnected;
    }

    reloadCommands() {
        this.loadCommands();
        return this.commands.size;
    }

    async cleanup() {
        if (this.sock) {
            try {
                if (this.sock.ws) {
                    this.sock.ws.close();
                }
                if (this.sock.ev) {
                    this.sock.ev.removeAllListeners();
                }
            } catch (error) {
                console.error('❌ Cleanup error:', error.message);
            }
        }
        this.sock = null;
        this.isConnected = false;
        this.sessionData = null;
    }
}

const whatsappManager = new WhatsAppManager();
export default whatsappManager;