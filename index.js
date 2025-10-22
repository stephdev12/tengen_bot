
import { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason,
  makeCacheableSignalKeyStore
} from 'baileys';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import chalk from 'chalk';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';
import readline from 'readline';

// Import de vos modules existants
import config from './config.js';
import Database from './lib/database.js';
import { isAdmin, isOwner, checkPermissions } from './lib/isAdmin.js';
import { safeSend, safeReact, safePresence } from './lib/safeSend.js';
import { font, sendReply, sendMessage, buildAdReplyContext } from './lib/helpers.js';
import sudoManager from './lib/sudoManager.js';
import botTracker from './lib/botTracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache pour les groupes
const groupCache = new NodeCache({ stdTTL: 10 * 60, checkperiod: 120, useClones: false });

// Variables globales du bot
let sock = null;
let isConnected = false;
const commands = new Map();
const userWarnings = new Map();
const lastMessageTime = new Map();

function ask(questionText) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(questionText, answer => {
    rl.close();
    resolve(answer.trim());
  }));
}

// Chargement des commandes
async function loadCommands() {
  console.log('📚 Loading commands...');
  commands.clear();
  
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
        commands.set(cmd.name.toLowerCase(), cmd);
        
        if (cmd.aliases && Array.isArray(cmd.aliases)) {
          cmd.aliases.forEach(alias => {
            commands.set(alias.toLowerCase(), cmd);
          });
        }
        
        console.log(`✅ Command loaded: ${cmd.name}`);
      }
    } catch (error) {
      console.error(`❌ Error loading command ${file}:`, error.message);
    }
  }
  
  console.log(`📚 ${commands.size} commands loaded`);
}

// Gestion des avertissements utilisateur
function getUserWarnings(jid, userId) {
  const key = `${jid}_${userId}`;
  if (!userWarnings.has(key)) {
    userWarnings.set(key, {
      antilink: 0,
      antispam: 0,
      messages: [],
      lastReset: Date.now()
    });
  }
  return userWarnings.get(key);
}

function resetUserWarnings(jid, userId = null) {
  if (userId) {
    const key = `${jid}_${userId}`;
    userWarnings.delete(key);
  } else {
    for (const [key] of userWarnings) {
      if (key.startsWith(`${jid}_`)) {
        userWarnings.delete(key);
      }
    }
  }
}

// ==================== FONCTIONS DE PROTECTION ====================
async function checkSpam(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;

    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const userWarnings = getUserWarnings(jid, sender);
    const now = Date.now();
    
    userWarnings.messages = userWarnings.messages.filter(m => now - m.timestamp < 5000);
    userWarnings.messages.push({ timestamp: now, body: body });

    if (userWarnings.messages.length > 5) {
      await safeSend(sock, jid, { delete: msg.key });
      userWarnings.antispam++;
      
      const warningMsg = `🚫 @${sender.split('@')[0]} - Spam detected!\nWarnings: ${userWarnings.antispam}/${groupSettings.antispam_threshold || 3}`;
      
      await safeSend(sock, jid, { 
        text: warningMsg,
        mentions: [sender]
      });

      if (userWarnings.antispam >= (groupSettings.antispam_threshold || 3)) {
        try {
          await sock.groupParticipantsUpdate(jid, [sender], "remove");
          await safeSend(sock, jid, { 
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

async function checkLinks(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;

    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
    if (linkRegex.test(body)) {
      await safeSend(sock, jid, { delete: msg.key });
      const userWarnings = getUserWarnings(jid, sender);
      userWarnings.antilink++;
      
      const warningMsg = `🚫 @${sender.split('@')[0]} - Links not allowed!\nWarnings: ${userWarnings.antilink}/${groupSettings.antilink_threshold || 3}`;
      
      await safeSend(sock, jid, { 
        text: warningMsg,
        mentions: [sender]
      });

      if (userWarnings.antilink >= (groupSettings.antilink_threshold || 3)) {
        try {
          await sock.groupParticipantsUpdate(jid, [sender], "remove");
          await safeSend(sock, jid, { 
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

async function checkMentions(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;

    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const hasMassMention = mentions.length >= 3;
    const hasGroupMention = body.includes('@everyone') || body.includes('@all');
    
    if (hasMassMention || hasGroupMention) {
      await safeSend(sock, jid, { delete: msg.key });
      const warningMsg = `🚫 @${sender.split('@')[0]} - Mass mentions not allowed!`;
      await safeSend(sock, jid, { text: warningMsg, mentions: [sender] });
    }
  } catch (error) {
    console.error('❌ Mention protection error:', error.message);
  }
}

async function checkMassTags(msg, jid, sender, body, groupSettings) {
  try {
    if (isOwner(msg)) return;

    const senderIsAdmin = await isAdmin(sock, jid, sender);
    if (senderIsAdmin) return;

    const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length >= 5) {
      await safeSend(sock, jid, { delete: msg.key });
      const warningMsg = `🚫 @${sender.split('@')[0]} - Too many tags!`;
      await safeSend(sock, jid, { text: warningMsg, mentions: [sender] });
    }
  } catch (error) {
    console.error('❌ Tag protection error:', error.message);
  }
}

// ==================== GESTION DES GROUPES ====================
async function handleGroupParticipantsUpdate(event) {
  const { id, participants, action } = event;
  
  try {
    const groupSettings = await Database.getGroupSettings(id);
    
    // Antidemote/Antipromote
    if (action === 'demote' && groupSettings.antidemote_enabled) {
      await handleAntidemote(event);
    }
    
    if (action === 'promote' && groupSettings.antipromote_enabled) {
      await handleAntipromote(event);
    }
    
    // Welcome/Goodbye
    if (action === 'add' && groupSettings.welcome_enabled) {
      await sendWelcomeMessageToGroup(event, groupSettings);
    }
    
    if (action === 'remove' && groupSettings.goodbye_enabled) {
      await sendGoodbyeMessageToGroup(event, groupSettings);
    }
  } catch (error) {
    console.error('❌ Group update error:', error);
  }
}

async function handleAntidemote(event) {
  const { id, participants } = event;
  
  console.log(`🛡️ Anti-Demote activated for ${id}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  for (const participant of participants) {
    try {
      await sock.groupParticipantsUpdate(id, [participant], 'promote');
      console.log(`✅ Admin restored: ${participant.split('@')[0]}`);
    } catch (error) {
      console.error('❌ Anti-demote error:', error.message);
    }
  }
}

async function handleAntipromote(event) {
  const { id, participants } = event;
  
  console.log(`🛡️ Anti-Promote activated for ${id}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  for (const participant of participants) {
    try {
      await sock.groupParticipantsUpdate(id, [participant], 'demote');
      console.log(`✅ Promotion cancelled: ${participant.split('@')[0]}`);
    } catch (error) {
      console.error('❌ Anti-promote error:', error.message);
    }
  }
}

async function sendWelcomeMessageToGroup(event, groupSettings) {
  const { id, participants } = event;
  
  try {
    const metadata = await sock.groupMetadata(id);
    
    for (const participant of participants) {
      const welcomeText = groupSettings.welcome_message || 
        `👋 Welcome @${participant.split('@')[0]} to ${metadata.subject}!\n` +
        `We are now ${metadata.participants.length} members.`;
      
      await sock.sendMessage(id, {
        text: welcomeText,
        mentions: [participant]
      });
    }
  } catch (error) {
    console.error('❌ Welcome message error:', error);
  }
}

async function sendGoodbyeMessageToGroup(event, groupSettings) {
  const { id, participants } = event;
  
  try {
    const metadata = await sock.groupMetadata(id);
    
    for (const participant of participants) {
      const goodbyeText = groupSettings.goodbye_message || 
        `👋 @${participant.split('@')[0]} has left ${metadata.subject}.\n` +
        `We are now ${metadata.participants.length} members.`;
      
      await sock.sendMessage(id, {
        text: goodbyeText,
        mentions: [participant]
      });
    }
  } catch (error) {
    console.error('❌ Goodbye message error:', error);
  }
}

// ==================== FONCTIONS AUTOMATIQUES ====================
async function sendWelcomeMessage() {
  try {
    const userSettings = await Database.getUserSettings();
    const welcomeMessage = `*_CONNECTED SUCCESSFULLY_*\n\n` +
      `> *BOT NAME:* ${userSettings.bot_name}\n` +
      `> *PREFIX:* ${userSettings.prefix}\n` +
      `> *MODE:* ${userSettings.bot_mode}\n\n` +
      `> 𝚃𝙴𝙲𝙷 & 𝚅𝙴𝚁𝚂𝙴`;
    
    if (config.owner) {
      const ownerJid = `${config.owner}@s.whatsapp.net`;
      await sock.sendMessage(ownerJid, { 
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

async function handleStatusMessage(message) {
  try {
    if (config.autostatus) {
      const { handleAutoStatus } = await import('./commands/autostatus.js');
      await handleAutoStatus(sock, { messages: [message] });
    }
  } catch (error) {
    console.error('❌ Status handling error:', error.message);
  }
}

async function handleAutoFeatures(msg) {
  // Autowrite
  try {
    const { handleAutowriteMessage } = await import('./commands/autowrite.js');
    if (handleAutowriteMessage) {
      await handleAutowriteMessage(sock, msg);
    }
  } catch (error) {
    // Silent fail
  }

  // Autoreact
  try {
    const { handleAutoReact } = await import('./commands/autoreact.js');
    if (handleAutoReact) {
      await handleAutoReact(sock, msg);
    }
  } catch (error) {
    // Silent fail
  }
}

// ==================== GESTION DES MESSAGES ====================
async function handleMessage(msg) {
  if (!msg.message) return;

  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || jid;
  const isGroup = jid.endsWith('@g.us');
  
  const body = msg.message.conversation || 
              msg.message.extendedTextMessage?.text || 
              msg.message.imageMessage?.caption || '';

  const userSettings = await Database.getUserSettings();
  const isCommand = body.startsWith(userSettings.prefix);

  // Ignorer les messages du bot SAUF si c'est une commande
  if (msg.key.fromMe && !isCommand) {
    return;
  }

  console.log(`📨 Message de ${msg.key.fromMe ? 'BOT' : sender}: ${body.substring(0, 50)}...`);
  if (isCommand) {
    console.log(`🔍 Commande détectée: ${body}`);
  }

  // Gestion antidelete
  if (msg.message.protocolMessage?.type === 0) {
    try {
      const { handleMessageRevocation } = await import('./commands/antidelete.js');
      await handleMessageRevocation(msg, sock);
    } catch (error) {
      console.error('❌ Antidelete error:', error.message);
    }
    return;
  }

  // Stocker le message pour antidelete
  try {
    const { storeMessage } = await import('./commands/antidelete.js');
    await storeMessage(msg, sock);
  } catch (error) {
    console.error('❌ Store message error:', error.message);
  }

  // Autowrite et Autoreact pour messages non-commande
  if (!isCommand && !msg.key.fromMe) {
    await handleAutoFeatures(msg);
  }

  // Gestion des commandes
  if (isCommand) {
    await handleCommand(msg, body, userSettings);
  }

  // Protection des groupes
  if (isGroup && !msg.key.fromMe) {
    await applyGroupProtections(msg, userSettings);
  }
}

async function applyGroupProtections(msg, userSettings) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || jid;
  const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

  const groupSettings = await Database.getGroupSettings(jid);

  if (groupSettings.antispam_enabled) {
    await checkSpam(msg, jid, sender, body, groupSettings);
  }

  if (groupSettings.antilink_enabled) {
    await checkLinks(msg, jid, sender, body, groupSettings);
  }

  if (groupSettings.antimention_enabled) {
    await checkMentions(msg, jid, sender, body, groupSettings);
  }

  if (groupSettings.antitag_enabled) {
    await checkMassTags(msg, jid, sender, body, groupSettings);
  }
}

// ==================== GESTION DES COMMANDES ====================
async function handleCommand(msg, body, userSettings) {
  const jid = msg.key.remoteJid;
  const args = body.slice(userSettings.prefix.length).trim().split(/\s+/);
  const commandName = args[0].toLowerCase();
  
  try {
    const command = commands.get(commandName);
    if (!command) {
     
      return;
    }

  
    // Vérification des permissions
    const permission = await checkPermissions({
      sock: sock, 
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
      await safeSend(sock, jid, { text: errorMsg });
      return;
    }

    const groupSettings = jid.endsWith('@g.us') ? await Database.getGroupSettings(jid) : {};

    await command.execute({
      sock: sock,
      msg,
      args: args.slice(1),
      phoneNumber: config.owner,
      userSettings,
      groupSettings,
      jid,
      isGroup: jid.endsWith('@g.us'),
      getUserWarnings: (userId) => getUserWarnings(jid, userId),
      resetUserWarnings: (userId) => resetUserWarnings(jid, userId)
    });

    botTracker.incrementCommands();
    
  } catch (error) {
    console.error('❌ Command error:', error.message);
    
    try {
      await safeSend(sock, jid, { 
        text: `❌ Error: ${error.message}` 
      });
    } catch (sendError) {
      console.error('❌ Cannot send error message:', sendError.message);
    }
  }

  
}

// ==================== CONNEXION WHATSAPP ====================
async function startBot(usePairing = true) {
  try {
    console.log('🔄 Starting WhatsApp connection...');
    
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
      },
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      logger: pino({ level: 'silent' }),
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true
    });

    sock.ev.on('creds.update', saveCreds);

    // Gestion des groupes avec cache
    sock.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        try {
          const metadata = await sock.groupMetadata(update.id);
          groupCache.set(update.id, metadata);
        } catch (e) {
          console.error('❌ Group cache error:', e.message);
        }
      }
    });

    // Système de pairing code
    if (usePairing && !state.creds.registered) {
      setTimeout(async () => {
        try {
          console.log('📱 Demande du code de pairing...');
          
          const customBrand = "STEPHDEV";
          let code;
          
          try {
            code = await sock.requestPairingCode(config.owner, customBrand);
            console.log(`✅ Marque personnalisée appliquée: ${customBrand}`);
          } catch (brandError) {
            console.log(`⚠️ Marque personnalisée non supportée, utilisation par défaut`);
            code = await sock.requestPairingCode(config.owner);
          }
          
          const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
          console.log(`\n🔑 CODE DE PAIREMENT: ${formattedCode}\n`);
          console.log("➡️ Entrez ce code dans WhatsApp → Appareils liés");
          
        } catch (error) {
          console.error('❌ Erreur pairing:', error.message);
        }
      }, 3000);
    }

    // Gestion de la connexion
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      console.log(`📡 Connection update:`, connection);

      if (connection === 'open') {
        console.log('✅ WhatsApp connected successfully');
        isConnected = true;
        botTracker.start();
        // Envoyer message de bienvenue
        await sendWelcomeMessage();
        
      } else if (connection === 'close') {
        isConnected = false;
        
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode;
        
        console.log(`❌ Connection closed:`, error?.message);
        
        // Logout définitif
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('❌ Session logged out');
          return;
        }
        
        // Reconnexion
        console.log('🔄 Reconnecting...');
        setTimeout(() => {
          startBot(usePairing);
        }, 3000);
      }
    });

    // Charger les commandes
    await loadCommands();

    // Gestion des messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const message of messages) {
        if (message.key.remoteJid === 'status@broadcast') {
          await handleStatusMessage(message);
          continue;
        }
        
        await handleMessage(message);
      }
    });

    // Gestion des participants groupe
    sock.ev.on('group-participants.update', async (event) => {
      await handleGroupParticipantsUpdate(event);
    });

  } catch (error) {
    console.error('❌ Bot startup error:', error);
    setTimeout(() => startBot(usePairing), 5000);
  }
}

async function checkDashboardCommands() {
    // Cette fonction vérifiera Firebase toutes les 5 minutes
    setInterval(async () => {
        try {
            // À implémenter avec Firebase SDK côté bot
            console.log('🔍 Checking dashboard commands...');
        } catch (error) {
            // Silent fail
        }
    }, 5 * 60 * 1000);
}

async function listenForDashboardCommands() {
    // Cette fonction sera implémentée plus tard pour recevoir
    // les commandes de broadcast et de blocage depuis le dashboard
    setInterval(async () => {
        try {
            const response = await fetch('https://steph-api.vercel.app/api/check-commands', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: config.owner })
            });
            
            if (response.ok) {
                const { commands } = await response.json();
                // Traiter les commandes reçues
                for (const cmd of commands || []) {
                    if (cmd.type === 'BROADCAST') {
                        // Envoyer le message au owner
                        await sock.sendMessage(`${config.owner}@s.whatsapp.net`, {
                            text: cmd.message
                        });
                    }
                }
            }
        } catch (error) {
            // Silent fail
        }
    }, 5 * 60 * 1000); // Vérifier toutes les 5 minutes
}

// ==================== DÉMARRAGE ====================

// Serveur HTTP pour keep-alive
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 Bot WhatsApp en fonctionnement!');
}).listen(config.port, () => {
  console.log(chalk.blue(`🌐 Serveur démarré sur le port ${config.port}`));
});

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Arrêt du bot...'));
  botTracker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n🛑 Arrêt du bot...'));
  botTracker.stop();
  process.exit(0);
});



// Démarrer le bot
startBot(true);
listenForDashboardCommands();
checkDashboardCommands();