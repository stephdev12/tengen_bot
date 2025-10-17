// commands/test.js
export default {
    name: 'test',
    aliases: ['test'],
    description: 'Simple test command',
    usage: 'test',

    async execute({ sock, msg, phoneNumber }) {
        try {
            const jid = msg.key.remoteJid;
            
            // Test 1 : Message texte simple
            await sock.sendMessage(jid, { text: '✅ Test 1: Simple text' });
            
            // Test 2 : Message avec mention
            await sock.sendMessage(jid, { 
                text: '✅ Test 2: With context',
                contextInfo: {
                    mentionedJid: [msg.key.participant || jid]
                }
            });
            
            console.log(`✅ [${phoneNumber}] Test command successful`);
            
        } catch (error) {
            console.error(`❌ Test command error:`, error);
        }
    }
};