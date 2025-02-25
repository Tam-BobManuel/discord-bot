import dotenv from 'dotenv';
import { Client, GatewayIntentBits,ChannelType,ActivityType  } from 'discord.js';
import Parser from 'rss-parser';
import ijawNames from 'ijaw-names';


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
const parser = new Parser();
// Create a cache to store messages
const messageCache = new Map();

// VARIABLES
// command prefix
const PREFIX = '!';
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID;
const NEWS_DATA_API = process.env.NEWS_DATA_API; // Set this in your environment variables
const AFRICAN_COUNTRIES = [
    'dz', 'ao', 'bj', 'bw', 'bf', 'bi', 'cv', 'cm', 'cf', 'td', 'km', 'cd',
    'cg', 'ci', 'dj', 'eg', 'gq', 'er', 'sz', 'et', 'ga', 'gm', 'gh', 'gn',
    'gw', 'ke', 'ls', 'lr', 'ly', 'mg', 'mw', 'ml', 'mr', 'mu', 'ma', 'mz',
    'na', 'ne', 'ng', 'rw', 'st', 'sn', 'sc', 'sl', 'so', 'za', 'ss', 'sd',
    'tz', 'tg', 'tn', 'ug', 'zm', 'zw'
];
const RSS_FEED_URL = process.env.RSS_FEED_URL;
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
const watcherRoleId = process.env.WATCHER_ROLE_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const WATCHER_ROLE_ID = watcherRoleId;
const agreedToRule = process.env.AGREED_ROLE_NAME; 
const rulesChannelId = process.env.RULES_CHANNEL_ID;
const rulesMessageId = process.env.RULES_MESSAGE_ID;
const generalChannelId = process.env.GENERAL_CHANNEL_ID;
const ROLES = {
    ASIAN: process.env.ROLE_ASIAN,
    EUROPE: process.env.ROLE_EUROPE,
    NORTH_AMERICA: process.env.ROLE_NORTH_AMERICA,
    SOUTH_AMERICA: process.env.ROLE_SOUTH_AMERICA,
    AFRICA: process.env.ROLE_AFRICA,
    OCEANIA: process.env.ROLE_OCEANIA,
    CARIBBEAN: process.env.ROLE_CARIBBEAN,
    WHITE: process.env.ROLE_WHITE,
    BLACK: process.env.ROLE_BLACK,
    MIXED: process.env.ROLE_MIXED,
    EAST_ASIAN: process.env.ROLE_EAST_ASIAN,
    VERIFIED_BLACK: '',
    VERIFIED: '',
    LURKER: process.env.ROLE_LURKER
};
const MESSAGES = {
    CONTINENTAL: process.env.MESSAGE_CONTINENTAL,
    SKIN_COLOR: process.env.MESSAGE_SKIN_COLOR,
    VERIFIED: process.env.MESSAGE_VERIFIED,
    BASE: process.env.MESSAGE_BASE
};
// Emoji to role mappings
const EMOJI_ROLES = {
    '🌏': ROLES.ASIAN,
    '💶': ROLES.EUROPE,
    '🍁': ROLES.NORTH_AMERICA,
    '🌎': ROLES.SOUTH_AMERICA,
    '🌍': ROLES.AFRICA,
    '🦘': ROLES.OCEANIA,
    '🔥': ROLES.CARIBBEAN,
    '🤍': ROLES.WHITE,
    '🖤': ROLES.BLACK,
    '🍥': ROLES.MIXED,
    '🍜': ROLES.EAST_ASIAN,
    '🎫': ROLES.VERIFIED_BLACK,
    '✅': ROLES.VERIFIED,
    '🆕': ROLES.LURKER
};

const CONTINENTAL_ROLES = new Set([
    ROLES.ASIAN, ROLES.EUROPE, ROLES.NORTH_AMERICA,
    ROLES.SOUTH_AMERICA, ROLES.AFRICA, ROLES.OCEANIA, ROLES.CARIBBEAN
]);

const SKIN_COLOR_ROLES = new Set([
    ROLES.WHITE, ROLES.BLACK, ROLES.MIXED, ROLES.EAST_ASIAN
]);

const ROLES_CHANNEL_ID = process.env.ROLES_CHANNEL_ID;
let lastNewsItem = null;
// Event listener for when the bot is ready
client.on('ready', async () => {
    console.log(`Our bot is ready to go!!!`);
    client.user.setPresence({
        activities: [{
            name: 'Life',
            type: ActivityType.Playing
        }],
        status: 'online'
    });
  //news functionality
    postNews();
    setInterval(postNews, 1800000); // 30 minutes
    // Find the rules channel
    const rulesChannel = client.channels.cache.get(rulesChannelId);
    if (!rulesChannel) {
        console.error(`Could not find the rules channel with ID "${rulesChannelId}".`);
        return;
    }

    try {
        const rulesMessage = await rulesChannel.messages.fetch(rulesMessageId);
        console.log(`Found existing rules message with ID "${rulesMessageId}".`);

        // Fetch reactions for users who reacted while the bot was offline
        const reactions = rulesMessage.reactions.cache.get('✅');

        if (reactions) {
            const users = await reactions.users.fetch();
            for (const user of users.values()) {
                if (user.bot) continue; // Skip bots

                // Find the guild member who reacted
                const guild = rulesMessage.guild;
                const member = await guild.members.fetch(user.id).catch(() => null);

                if (!member) {
                    console.error(`Member not found for user ${user.tag}.`);
                    continue;
                }

                // Find the role to assign
                const role = guild.roles.cache.find((r) => r.name === agreedToRule);

                if (!role) {
                    console.error(`Role "${agreedToRule}" not found.`);
                    continue;
                }

                // Check if the member already has the role
                if (!member.roles.cache.has(role.id)) {
                    try {
                        // Send a message tagging the user
                        await rulesChannel.send(`Welcome ${member}! The role "${agreedToRule}" has been added to you. Enjoy your stay!`);
                        
                        // Assign the role to the member
                        await member.roles.add(role);
                        console.log(`Assigned the "${agreedToRule}" role to ${member.user.tag}.`);
                    } catch (error) {
                        console.error(`Failed to assign the "${agreedToRule}" role to ${member.user.tag}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error fetching rules message or reactions:', error);
    }

    // Schedule the message-clearing task every 1 minute
    setInterval(clearGeneralChannel, 60 * 60 * 1000); // 60 minutes in milliseconds
});
client.on('guildMemberAdd', async (member) => {
    try {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        const rulesChannel = member.guild.channels.cache.get(rulesChannelId);
        
        if (welcomeChannel && rulesChannel) {
            await welcomeChannel.send(
                `Welcome ${member}! Please head over to ${rulesChannel} and react with ✅ to gain access to the rest of the server!`
            );
        }
    } catch (error) {
        console.error('Error sending welcome message:', error);
    }
});
client.on('guildMemberRemove', async (member) => {
    try {
        // Get the rules channel
        const rulesChannel = member.guild.channels.cache.get(rulesChannelId);
        if (!rulesChannel) {
            console.error(`Could not find the rules channel with ID "${rulesChannelId}".`);
            return;
        }

        // Fetch the rules message
        const rulesMessage = await rulesChannel.messages.fetch(rulesMessageId);
        if (!rulesMessage) {
            console.error('Could not find the rules message.');
            return;
        }

        // Get the checkmark reaction
        const reaction = rulesMessage.reactions.cache.get('✅');
        if (reaction) {
            // Remove the user's reaction
            await reaction.users.remove(member.id);
            console.log(`Removed reaction from ${member.user.tag} as they left the server.`);
        }
    } catch (error) {
        console.error('Error removing reaction from leaving member:', error);
    }
});

// Event listener for incoming messages
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Ijaw name commands
    if (command === 'ijaw') {
        try {
            const subCommand = args[0]?.toLowerCase();
            
            // !ijaw - Random name
            if (!subCommand) {
                const name = ijawNames().name;
                return message.channel.send(`🔮 Random Ijaw name: **${name}**`);
            }

            // !ijaw meaning [name] - Get name meaning
            if (subCommand === 'meaning') {
                const query = args[1];
                const result = query ? ijawNames(query) : ijawNames();
                
                if (!result.meaning) {
                    return message.channel.send(query 
                        ? `❌ No meaning found for **${query}**`
                        : `❌ Failed to get random name meaning`);
                }
                
                return message.channel.send(
                    `📚 ${query ? `**${result.name}** means:` : 'Random name meaning:'} \n"${result.meaning}"`
                );
            }

            // !ijaw check [name] - Check name existence
            if (subCommand === 'check') {
                const nameToCheck = args.slice(1).join(' ').trim();
                if (!nameToCheck) return message.channel.send('❌ Please provide a name to check');
            
                // Get name information (case-insensitive check)
                const result = ijawNames(nameToCheck);
                
                // Verify exact match with case-insensitive comparison
                const isValid = result.name ==true;
            
                if (isValid) {
                    const response = [
                        `✅ **${result.name}** is a valid Ijaw name!`,
                        result.meaning ? `📖 Meaning: ${result.meaning}` : ''
                    ].join('\n');
                    
                    return message.channel.send(response);
                }
                
                return message.channel.send(`❌ **${nameToCheck}** not found, it just may not be in my database yet!`);
            }
        } catch (error) {
            console.error('Ijaw command error:', error);
            message.channel.send('❌ Error processing Ijaw name request');
        }
    }
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

    // Handle prune command
    if (message.content.startsWith('prune.')) {
        // Check if the user has permission to manage messages
        if (!message.member?.permissions.has('MANAGE_MESSAGES')) {
            await message.reply('You do not have permission to use this command.');
            return;
        }
    
        // Extract the number of messages to delete
        const numberToDelete = parseInt(message.content.split('.')[1], 10);
    
        // Validate the number
        if (isNaN(numberToDelete)) {
            await message.reply('Please provide a valid number of messages to delete.');
            return;
        }
    
        // Ensure the number is within Discord's limit (1-100)
        if (numberToDelete < 1 || numberToDelete > 100) {
            await message.reply('You can only delete between 1 and 100 messages at a time.');
            return;
        }
    
        try {
            // Fetch messages
            const fetchedMessages = await message.channel.messages.fetch({ limit: numberToDelete });
    
            // Filter out pinned messages from users with the "watchers" role
            const messagesToDelete = fetchedMessages.filter(msg => {
                const member = msg.guild.members.cache.get(msg.author.id);
                const hasWatcherRole = member?.roles.cache.some(role => role.name.toLowerCase() === 'watchers');
                return !msg.pinned || !hasWatcherRole; // Delete only if not pinned or not from "watchers"
            });
    
            // Check if there are messages to delete
            if (messagesToDelete.size === 0) {
                await message.reply('No messages were deleted because they were either pinned by watchers or no valid messages were found.');
                return;
            }
    
            // Send a confirmation message before deleting
            // await message.reply(`Deleting ${messagesToDelete.size} messages...`);
    
            // Bulk delete messages
            await message.channel.bulkDelete(messagesToDelete);
        } catch (error) {
            console.error('Error deleting messages:', error);
            await message.reply('Failed to delete messages. Please try again.');
        }
    }
    
});
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content.toLowerCase() !== '!close') return;

    const channel = message.channel;
    if (channel.parentId !== TICKET_CATEGORY_ID) return;

    try {
        const member = await message.guild.members.fetch(message.author.id);
        const isWatcher = member.roles.cache.has(WATCHER_ROLE_ID);
        const isOwner = channel.topic === message.author.id;

        if (isWatcher || isOwner) {
            await channel.delete();
            console.log(`Ticket ${channel.name} closed by ${message.author.tag}`);
        } else {
            await message.reply('You do not have permission to close this ticket.');
        }
    } catch (error) {
        console.error('Error handling !close command:', error);
    }
});

// Event listener for deleted messages
client.on('messageDelete', async (deletedMessage) => {
    // Retrieve the cached message
    const cachedMessage = messageCache.get(deletedMessage.id);

    if (cachedMessage) {
        // Fetch the member who deleted the message
        const member = deletedMessage.guild?.members.cache.get(cachedMessage.author.id);

        // Check if the member has the watcher role ID
        if (member && member.roles.cache.has(watcherRoleId)) {
            // Skip notifying if the user has the watcher role
            console.log(`Message deleted by ${cachedMessage.author.tag}, but they have the watcher role. No notification sent.`);
        } else {
            // Tag the user who deleted the message
            deletedMessage.channel.send(`${cachedMessage.author}, Stop deleting messages, you coward!`);
        }
    } else {
        // If the message is not in the cache, send a generic response
        // deletedMessage.channel.send('Someone deleted a message, but I don\'t know who!');
    }

    // Remove the message from the cache
    messageCache.delete(deletedMessage.id);
});

// Event listener for message reactions
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        // Fetch the partial reaction if necessary
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        // Check if the reaction is on the rules message and is ✅
        if (reaction.message.id === rulesMessageId && reaction.emoji.name === '✅') {
            // Log the reaction event
            console.log(`${user.tag} reacted to the rules message with ✅.`);

            // Find the guild member who reacted
            const guild = reaction.message.guild;
            const member = await guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                console.error(`Member not found for user ${user.tag}.`);
                return;
            }

            // Find the role to assign
            const role = guild.roles.cache.find((r) => r.name === agreedToRule);

            if (!role) {
                console.error(`Role "${agreedToRule}" not found.`);
                return;
            }

            // Check if the member already has the role
            if (!member.roles.cache.has(role.id)) {
                try {
                    // Send a message tagging the user
                    await reaction.message.channel.send(`Welcome ${member}! The role "${agreedToRule}" has been added to you. Enjoy your stay!`);
                    
                    // Assign the role to the member
                    await member.roles.add(role);
                    console.log(`Assigned the "${agreedToRule}" role to ${member.user.tag}.`);
                } catch (error) {
                    console.error(`Failed to assign the "${agreedToRule}" role to ${member.user.tag}:`, error);
                }
            }
        }
        
    } catch (error) {
        console.error('Error handling reaction:', error);
    }
});
// Reaction Add Event
client.on('messageReactionAdd', async (reaction, user) => {
    await handleRoleChange(reaction, user, true);
});

// Reaction Remove Event
client.on('messageReactionRemove', async (reaction, user) => {
    await handleRoleChange(reaction, user, false);
});

// Handles uncached reactions
client.on('raw', async event => {
    if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(event.t)) return;
    
    const { d: data } = event;
    const channel = await client.channels.fetch(data.channel_id);
    const message = await channel.messages.fetch(data.message_id);
    const emoji = data.emoji.name;
    const user = await client.users.fetch(data.user_id);
    
    const fakeReaction = {
        message,
        emoji: { name: emoji },
        partial: false,
        users: { remove: async () => {} } // Prevent crashes if remove fails
    };
    
    if (event.t === 'MESSAGE_REACTION_ADD') {
        handleRoleChange(fakeReaction, user, true);
    } else if (event.t === 'MESSAGE_REACTION_REMOVE') {
        handleRoleChange(fakeReaction, user, false);
    }
});


// Function to handle role assignment



async function createVerificationTicket(user, guild) {
    const category = guild.channels.cache.get(TICKET_CATEGORY_ID);
    if (!category) {
        console.error('Ticket category not found');
        return;
    }

    // Check for existing tickets using cache
    const existingTicket = category.children.cache.find(ch => ch.topic === user.id);
    if (existingTicket) {
        try {
            await user.send(`You already have an open ticket: ${existingTicket}`);
        } catch (error) {
            console.error('Failed to send DM:', error);
        }
        return;
    }

    try {
        const newChannel = await guild.channels.create({
            name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9_]/g, '-').slice(0, 20)}`,
            type: ChannelType.GuildText, // Updated channel type
            parent: TICKET_CATEGORY_ID,
            topic: user.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel'],
                },
                {
                    id: user.id,
                    allow: ['ViewChannel', 'SendMessages'],
                },
                {
                    id: WATCHER_ROLE_ID,
                    allow: ['ViewChannel', 'SendMessages'],
                },
            ],
        });

        await newChannel.send({
            content: `${user}, welcome to your ticket!\n` +
                `Support team will be with you shortly.\n` +
                `Type \`!close\` to close this ticket at any time.`
        });

        console.log(`Created ticket channel ${newChannel.name} for ${user.tag}`);
    } catch (error) {
        console.error('Error creating ticket channel:', error);
        try {
            await user.send('Failed to create ticket. Please try again later.');
        } catch (dmError) {
            console.error('Failed to send error DM:', dmError);
        }
    }
}

async function handleRoleChange(reaction, user, addRole) {
    if (user.bot) return;
    
    try {
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();
    } catch (error) {
        console.error('Error fetching reaction or message:', error);
        return;
    }
    
    if (reaction.message.channel.id !== ROLES_CHANNEL_ID) return;
    
    const emoji = reaction.emoji.name;
    const roleId = EMOJI_ROLES[emoji];
    if (!roleId) return;
    
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    
    // Handle verification roles separately
    if (emoji === '🎫' || emoji === '✅') {
        await createVerificationTicket(user, guild);
        return;
    }

    if (addRole) {
        const userContinentRoles = member.roles.cache.filter(role => CONTINENTAL_ROLES.has(role.id));
        if (CONTINENTAL_ROLES.has(roleId) && userContinentRoles.size >= 2) {
            try {
                await reaction.users.remove(user.id);
            } catch (error) {
                console.error('Error removing reaction:', error);
            }
            
            await reaction.message.channel.send(`${user}, you can only select up to 2 continental roles. Your selection has been reset.`);
            await member.roles.remove(userContinentRoles);
            return;
        }

        const userSkinRoles = member.roles.cache.filter(role => SKIN_COLOR_ROLES.has(role.id));
        if (SKIN_COLOR_ROLES.has(roleId) && userSkinRoles.size >= 1) {
            try {
                await reaction.users.remove(user.id);
            } catch (error) {
                console.error('Error removing reaction:', error);
            }
            
            await reaction.message.channel.send(`${user}, you can only select one skin color role. Your selection has been reset.`);
            await member.roles.remove(userSkinRoles);
            return;
        }

        try {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId);
                console.log(`Added role ${roleId} to ${user.tag}`);
            }
        } catch (error) {
            console.error(`Error adding role: ${error}`);
        }
    } else {
        try {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                console.log(`Removed role ${roleId} from ${user.tag}`);
            }
        } catch (error) {
            console.error(`Error removing role: ${error}`);
        }
    }
}

// Function to clear messages in the specified channel
async function clearGeneralChannel() {
    try {
        // Find the channel by ID
        const channel = client.channels.cache.get(generalChannelId);

        if (!channel) {
            console.error(`Could not find the channel with ID "${generalChannelId}".`);
            return;
        }

        // Fetch messages in the channel (no limit)
        const messages = await channel.messages.fetch({ limit: 100 }); // Adjust limit if needed

        // Fetch pinned messages
        const pinnedMessages = await channel.messages.fetchPinned();

        // Filter messages to delete
        const messagesToDelete = messages.filter((msg) => {
            // Skip pinned messages
            if (pinnedMessages.has(msg.id)) return false;

            // Skip messages from users with the watcher role ID
            const member = msg.guild?.members.cache.get(msg.author.id);
            if (member && member.roles.cache.has(watcherRoleId)) {
                return false;
            }

            // Delete all other messages
            return true;
        });

        // Bulk delete the messages
        if (messagesToDelete.size > 0) {
            await channel.bulkDelete(messagesToDelete);
            console.log(`Cleared ${messagesToDelete.size} messages in the channel with ID "${generalChannelId}".`);
        } else {
            console.log(`No messages to clear in the channel with ID "${generalChannelId}".`);
        }
    } catch (error) {
        console.error('Error clearing messages:', error);
    }
}
// News function
async function postNews() {
    try {
        const randomCountry = AFRICAN_COUNTRIES[Math.floor(Math.random() * AFRICAN_COUNTRIES.length)];
        const apiUrl = `https://newsdata.io/api/1/latest?apikey=${NEWS_DATA_API}&country=${randomCountry}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status !== 'success' || !data.results?.length) {
            console.log('No articles found in the API response');
            return;
        }

        const channel = await client.channels.fetch(NEWS_CHANNEL_ID);
        const articles = data.results.slice(0, 3);

        for (const article of articles) {
            if (article.link) {
                await channel.send(article.link);
                console.log(`Posted article from ${randomCountry}: ${article.link}`);
            }
        }

    } catch (error) {
        console.error('Error fetching or posting news:', error);
    }
}

// Log in to Discord using the token from the environment variables
client.login(process.env.DISCORD_TOKEN);