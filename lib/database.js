import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'db.json');

class JSONDatabase {
    constructor() {
        this.db = this.loadDB();
    }

    loadDB() {
        try {
            if (existsSync(DB_PATH)) {
                const content = readFileSync(DB_PATH, 'utf-8');
                return JSON.parse(content);
            }
            return {
                settings: this.getDefaultUserSettings(),
                groups: {},
                sudoUsers: [],
                premiumUsers: [],
                userMedia: {},
                userWarnings: {}
            };
        } catch (error) {
            console.error('❌ Database load error:', error);
            return this.getDefaultStructure();
        }
    }

    saveDB() {
        try {
            writeFileSync(DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
        } catch (error) {
            console.error('❌ Database save error:', error);
        }
    }

    getDefaultStructure() {
        return {
            settings: this.getDefaultUserSettings(),
            groups: {},
            sudoUsers: [],
            premiumUsers: [],
            userMedia: {},
            userWarnings: {}
        };
    }

    getDefaultUserSettings() {
        return {
            prefix: '!',
            bot_name: 'TechVerse Bot',
            bot_mode: 'public',
            language: 'en',
            antidelete_enabled: true,
            autoreact_enabled: true,
            menu_image: 'https://i.postimg.cc/gjZbjhfx/default-menu.jpg',
            welcome_image: 'https://i.postimg.cc/6Qq7gWb9/default-welcome.jpg'
        };
    }

    getDefaultGroupSettings() {
        return {
            welcome_enabled: false,
            goodbye_enabled: false,
            muted: false,
            antilink_enabled: true,
            antispam_enabled: true,
            antitag_enabled: true,
            antimention_enabled: true,
            antidemote_enabled: true,
            antipromote_enabled: true,
            antilink_threshold: 3,
            antispam_threshold: 5,
            welcome_message: null,
            goodbye_message: null
        };
    }

    // === MÉTHODES POUR COMPATIBILITÉ ===
    async getUserSettingsByPhone(phoneNumber) {
        return this.db.settings || this.getDefaultUserSettings();
    }

    async updateUserSettingsByPhone(phoneNumber, updates) {
        return this.updateUserSettings(updates);
    }

    async getUserByPhone(phoneNumber) {
        return { phone_number: phoneNumber };
    }

    async updateConnectionStatus(phoneNumber, isConnected) {
        console.log(`Connection status: ${phoneNumber} - ${isConnected}`);
    }

    async cleanupUserMedia(phoneNumber) {
        this.db.userMedia = {};
        this.saveDB();
        console.log(`Media cleaned up for: ${phoneNumber}`);
        return true;
    }

    // === SETTINGS UTILISATEUR ===
    async getUserSettings() {
        return this.db.settings || this.getDefaultUserSettings();
    }

    async updateUserSettings(updates) {
        this.db.settings = { ...this.db.settings, ...updates };
        this.saveDB();
        console.log('✅ User settings updated');
    }

    // === GROUPES ===
    async getGroupSettings(jid) {
        return this.db.groups[jid] || this.getDefaultGroupSettings();
    }

    async updateGroupSettings(jid, updates) {
        if (!this.db.groups[jid]) {
            this.db.groups[jid] = this.getDefaultGroupSettings();
        }
        this.db.groups[jid] = { ...this.db.groups[jid], ...updates };
        this.saveDB();
        console.log(`✅ Group settings updated for ${jid}`);
    }

    async getAllGroupSettings() {
        return this.db.groups;
    }

    // === SUDO USERS ===
    async getSudoUsers() {
        return this.db.sudoUsers || [];
    }

    async addSudoUser(userJid) {
        if (!this.db.sudoUsers.includes(userJid)) {
            this.db.sudoUsers.push(userJid);
            this.saveDB();
            return true;
        }
        return false;
    }

    async removeSudoUser(userJid) {
        const index = this.db.sudoUsers.indexOf(userJid);
        if (index !== -1) {
            this.db.sudoUsers.splice(index, 1);
            this.saveDB();
            return true;
        }
        return false;
    }

    async isSudoUser(userJid) {
        return this.db.sudoUsers.includes(userJid);
    }

    // === PREMIUM USERS ===
    async getPremiumUsers() {
        return this.db.premiumUsers || [];
    }

    async addPremiumUser(userJid) {
        if (!this.db.premiumUsers.includes(userJid)) {
            this.db.premiumUsers.push(userJid);
            this.saveDB();
            return true;
        }
        return false;
    }

    async removePremiumUser(userJid) {
        const index = this.db.premiumUsers.indexOf(userJid);
        if (index !== -1) {
            this.db.premiumUsers.splice(index, 1);
            this.saveDB();
            return true;
        }
        return false;
    }

    async isPremiumUser(userJid) {
        return this.db.premiumUsers.includes(userJid);
    }

    // === MEDIA ===
    async getUserMedia(mediaType = null) {
        if (mediaType) {
            return Object.values(this.db.userMedia).filter(media => media.media_type === mediaType);
        }
        return Object.values(this.db.userMedia);
    }

    async saveUserMedia(mediaName, mediaType, filePath) {
        const key = `${mediaType}_${mediaName}`;
        this.db.userMedia[key] = {
            media_name: mediaName,
            media_type: mediaType,
            file_path: filePath,
            created_at: new Date().toISOString()
        };
        this.saveDB();
    }

    async deleteUserMedia(mediaName, mediaType) {
        const key = `${mediaType}_${mediaName}`;
        if (this.db.userMedia[key]) {
            delete this.db.userMedia[key];
            this.saveDB();
            return true;
        }
        return false;
    }

    // === WARNINGS ===
    getUserWarnings(jid, userId) {
        const key = `${jid}_${userId}`;
        return this.db.userWarnings[key] || {
            antilink: 0,
            antispam: 0,
            messages: [],
            lastReset: Date.now()
        };
    }

    updateUserWarnings(jid, userId, warnings) {
        const key = `${jid}_${userId}`;
        this.db.userWarnings[key] = warnings;
        this.saveDB();
    }

    resetUserWarnings(jid, userId = null) {
        if (userId) {
            const key = `${jid}_${userId}`;
            delete this.db.userWarnings[key];
        } else {
            Object.keys(this.db.userWarnings).forEach(key => {
                if (key.startsWith(`${jid}_`)) {
                    delete this.db.userWarnings[key];
                }
            });
        }
        this.saveDB();
    }
}

const database = new JSONDatabase();
export default database;