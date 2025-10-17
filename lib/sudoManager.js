import fs from 'fs';
import path from 'path';

const SUDO_DIR = path.join(process.cwd(), 'data', 'sudo');
const SUDO_FILE = path.join(SUDO_DIR, 'sudo_users.json');

class SudoManager {
    constructor() {
        this.setupSudoDirectory();
        this.sudoUsers = this.loadSudoUsers();
    }
    
    setupSudoDirectory() {
        if (!fs.existsSync(SUDO_DIR)) {
            fs.mkdirSync(SUDO_DIR, { recursive: true });
        }
    }
    
    loadSudoUsers() {
        try {
            if (!fs.existsSync(SUDO_FILE)) {
                const defaultData = { users: [] };
                fs.writeFileSync(SUDO_FILE, JSON.stringify(defaultData, null, 2));
                return defaultData;
            }
            
            const data = fs.readFileSync(SUDO_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error loading sudo users:', error);
            return { users: [] };
        }
    }
    
    saveSudoUsers() {
        try {
            fs.writeFileSync(SUDO_FILE, JSON.stringify(this.sudoUsers, null, 2));
        } catch (error) {
            console.error('Error saving sudo users:', error);
        }
    }
    
    addSudoUser(targetUserJid) {
        if (!this.sudoUsers.users.includes(targetUserJid)) {
            this.sudoUsers.users.push(targetUserJid);
            this.saveSudoUsers();
            return true;
        }
        return false;
    }
    
    removeSudoUser(targetUserJid) {
        const index = this.sudoUsers.users.indexOf(targetUserJid);
        if (index !== -1) {
            this.sudoUsers.users.splice(index, 1);
            this.saveSudoUsers();
            return true;
        }
        return false;
    }
    
    isSudoUser(userJid) {
        return this.sudoUsers.users.includes(userJid);
    }
    
    getSudoUsers() {
        return this.sudoUsers.users || [];
    }
    
    clearAllSudoUsers() {
        this.sudoUsers.users = [];
        this.saveSudoUsers();
        return true;
    }
}

const sudoManager = new SudoManager();
export default sudoManager;