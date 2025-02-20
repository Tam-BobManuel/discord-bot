import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

// Load environment variables from .env file
dotenv.config();

// Create a new Discord client with the necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent, // Required to read message content
    ],
});

// Create a cache to store messages
const messageCache = new Map();

// Event listener for when the bot is ready
client.on('ready', () => {
    console.log(`Our bot is ready to go!!!`);

    // Schedule the message-clearing task every 30 minutes
    setInterval(clearGeneralChannel, 30 * 60 * 1000); // 30 minutes in milliseconds
});

// Function to clear messages in the "general" channel
async function clearGeneralChannel() {
    try {
        // Replace 'general' with the exact name of your channel
        const channelName = 'general';

        // Find the "general" channel by name
        const channel = client.channels.cache.find(
            (ch) => ch.name === channelName && ch.isTextBased()
        );

        if (!channel) {
            console.error(`Could not find the "${channelName}" channel.`);
            return;
        }

        // Fetch the last 100 messages in the channel
        const messages = await channel.messages.fetch({ limit: 10 });

        // Bulk delete the messages
        if (messages.size > 0) {
            await channel.bulkDelete(messages);
            console.log(`Cleared ${messages.size} messages in the "${channelName}" channel.`);
        } else {
            console.log(`No messages to clear in the "${channelName}" channel.`);
        }
    } catch (error) {
        console.error('Error clearing messages:', error);
    }
}

// Event listener for incoming messages
client.on('messageCreate', (message) => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Cache the message with its ID
    messageCache.set(message.id, message);

    // Respond to specific messages
    if (message.content === 'hello') {
        message.channel.send('Hello, World!');
    } else if (message.content === 'ping') {
        message.reply('Pong!');
    } else if (message.content === 'I love black people') {
        message.react('💖');
    }
});

// Event listener for deleted messages
client.on('messageDelete', (deletedMessage) => {
    // Retrieve the cached message
    const cachedMessage = messageCache.get(deletedMessage.id);

    if (cachedMessage) {
        // Tag the user who deleted the message
        deletedMessage.channel.send(`${cachedMessage.author}, Stop deleting messages, you coward!`);
    } else {
        // If the message is not in the cache, send a generic response
        deletedMessage.channel.send('Someone deleted a message, but I don\'t know who!');
    }

    // Remove the message from the cache
    messageCache.delete(deletedMessage.id);
});

// Log in to Discord using the token from the environment variables
client.login(process.env.DISCORD_TOKEN);