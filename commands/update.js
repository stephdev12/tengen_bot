import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendReply, formatSuccess, formatError } from '../lib/helpers.js';
import { isOwner, isSudoUser } from '../lib/isAdmin.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

async function updateViaGit() {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) {
                return reject(new Error('Too many redirects'));
            }
            visited.add(url);

            const useHttps = url.startsWith('https://');
            const client = useHttps ? require('https') : require('http');
            const req = client.get(url, {
                headers: {
                    'User-Agent': 'TechVerse-Bot-Updater/1.0',
                    'Accept': '*/*'
                }
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    const nextUrl = new URL(location, url).toString();
                    res.resume();
                    return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });
            req.on('error', err => {
                fs.unlink(dest, () => reject(err));
            });
        } catch (e) {
            reject(e);
        }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd);
        return;
    }
    
    try {
        await run('command -v unzip');
        await run(`unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    try {
        await run('command -v 7z');
        await run(`7z x -y '${zipPath}' -o'${outDir}'`);
        return;
    } catch {}
    try {
        await run('busybox unzip -h');
        await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    throw new Error("No system unzip tool found (unzip/7z/busybox). Git mode is recommended on this panel.");
}

function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

async function updateViaZip(sock, jid, msg) {
    const zipUrl = process.env.UPDATE_ZIP_URL || config.updateZipUrl || '';
    if (!zipUrl) {
        throw new Error('No ZIP URL configured. Set UPDATE_ZIP_URL environment variable.');
    }
    
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);
    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    // Find the top-level extracted folder
    const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    // Copy over while preserving important directories
    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'db.json', 'saved_status', 'user_media'];
    const copied = [];
    
    // Preserve config settings
    let preservedOwner = config.owner;
    let preservedOwnerName = config.ownerName;
    let preservedPrefix = config.prefix;
    
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);
    
    // Restore preserved settings
    try {
        const configPath = path.join(process.cwd(), 'config.js');
        if (fs.existsSync(configPath)) {
            let text = fs.readFileSync(configPath, 'utf8');
            
            // Restore owner number
            if (preservedOwner) {
                text = text.replace(/owner:\s*process\.env\.BOT_OWNER\s*\|\|\s*'[^']*'/, `owner: process.env.BOT_OWNER || '${preservedOwner}'`);
            }
            
            // Restore owner name
            if (preservedOwnerName) {
                text = text.replace(/ownerName:\s*process\.env\.BOT_OWNER_NAME\s*\|\|\s*'[^']*'/, `ownerName: process.env.BOT_OWNER_NAME || '${preservedOwnerName}'`);
            }
            
            // Restore prefix
            if (preservedPrefix) {
                text = text.replace(/prefix:\s*process\.env\.BOT_PREFIX\s*\|\|\s*'[^']*'/, `prefix: process.env.BOT_PREFIX || '${preservedPrefix}'`);
            }
            
            fs.writeFileSync(configPath, text);
        }
    } catch (error) {
        console.error('Error restoring config:', error);
    }
    
    // Cleanup
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    
    return { copiedFiles: copied };
}

async function restartProcess(sock, jid, msg) {
    try {
        await sock.sendMessage(jid, { text: '✅ Update complete! Restarting…' }, { quoted: msg });
    } catch {}
    
    try {
        // Try PM2 first
        await run('pm2 restart all');
        return;
    } catch {}
    
    // Fallback: exit process (panel should restart it)
    setTimeout(() => {
        process.exit(0);
    }, 500);
}

export default {
    name: 'update',
    aliases: ['upgrade', 'gitpull'],
    description: 'Update the bot to latest version',
    usage: 'update',
    
    async execute({ sock, msg, jid }) {
        const sender = msg.key.participant || msg.key.remoteJid;
        
        // Vérifier les permissions
        if (!isOwner(msg) && !isSudoUser(sender)) {
            return await sendReply(sock, jid, 
                formatError('❌ Only bot owner or sudo users can use this command'), 
                { quoted: msg }
            );
        }

        try {
            await sendReply(sock, jid, formatSuccess('🔄 Updating the bot, please wait…'), { quoted: msg });

            if (await hasGitRepo()) {
                // Mode Git
                const { oldRev, newRev, alreadyUpToDate, commits, files } = await updateViaGit();
                
                if (alreadyUpToDate) {
                    await sendReply(sock, jid, 
                        formatSuccess(`✅ Already up to date\nCommit: ${newRev.substring(0, 7)}`), 
                        { quoted: msg }
                    );
                    return;
                }
                
                // Installer les dépendances
                await run('npm install --no-audit --no-fund');
                
                await sendReply(sock, jid, 
                    formatSuccess(`✅ Updated to ${newRev.substring(0, 7)}\n\n💡 Restarting...`), 
                    { quoted: msg }
                );
                
            } else {
                // Mode ZIP
                const { copiedFiles } = await updateViaZip(sock, jid, msg);
                
                await sendReply(sock, jid, 
                    formatSuccess(`✅ Update completed\nUpdated ${copiedFiles.length} files\n\n💡 Restarting...`), 
                    { quoted: msg }
                );
            }
            
            // Redémarrer le processus
            await restartProcess(sock, jid, msg);
            
        } catch (error) {
            console.error('Update failed:', error);
            await sendReply(sock, jid, 
                formatError(`❌ Update failed:\n${error.message}`), 
                { quoted: msg }
            );
        }
    }
};