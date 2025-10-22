// lib/botTracker.js
// Module à ajouter dans le dossier lib/ de ton bot WhatsApp

import config from '../config.js';

class BotTracker {
    constructor() {
        this.stats = {
            phoneNumber: config.owner || 'unknown',
            startTime: Date.now(),
            commandsExecuted: 0,
            lastHeartbeat: Date.now(),
            isActive: true,
            version: '1.0.0'
        };
        
        this.apiUrl = 'https://steph-api.vercel.app/api/bot-heartbeat';
        this.heartbeatInterval = null;
    }

    // Démarrer le tracking
    start() {
        console.log('📊 Bot tracker started');
        
        // Envoyer immédiatement un heartbeat
        this.sendHeartbeat();
        
        // Puis toutes les heures
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 60 * 60 * 1000); // 1 heure
    }

    // Arrêter le tracking
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.stats.isActive = false;
            this.sendHeartbeat(); // Dernier heartbeat avant arrêt
        }
    }

    // Incrémenter le compteur de commandes
    incrementCommands() {
        this.stats.commandsExecuted++;
    }

    // Calculer l'uptime
    getUptime() {
        const uptimeMs = Date.now() - this.stats.startTime;
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        return { hours, minutes, milliseconds: uptimeMs };
    }

    // Envoyer les données au serveur
    async sendHeartbeat() {
        try {
            const uptime = this.getUptime();
            
            const payload = {
                phoneNumber: this.stats.phoneNumber,
                commandsExecuted: this.stats.commandsExecuted,
                uptimeHours: uptime.hours,
                uptimeMinutes: uptime.minutes,
                uptimeMs: uptime.milliseconds,
                lastHeartbeat: Date.now(),
                isActive: this.stats.isActive,
                version: this.stats.version,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('✅ Heartbeat sent successfully');
            } else {
                console.error('❌ Heartbeat failed:', response.status);
            }
        } catch (error) {
            console.error('❌ Heartbeat error:', error.message);
        }
    }

    // Obtenir les stats actuelles
    getStats() {
        const uptime = this.getUptime();
        return {
            ...this.stats,
            uptime
        };
    }
}

// Export singleton
const botTracker = new BotTracker();
export default botTracker;