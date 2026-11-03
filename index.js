const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

let userMessages = new Map();
let userOffenses = new Map();

const badWords = [
    "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cunt", 
    "idiot", "stupid", "motherfucker", "piss", "slut", "whore"
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Timeout a member for a specified duration in minutes')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('The user to timeout')
                    .setRequired(true))
            .addIntegerOption(option =>
                option.setName('minutes')
                    .setDescription('Duration in minutes')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('reason')
                    .setDescription('Reason for timeout')
                    .setRequired(false)),
        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Delete a specified number of messages')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Number of messages to delete (1-100)')
                    .setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken('MTU2NzIzODU3OTU2MDkwNjc4Mg.Gzv94l.GAd3riAEHXEXxS3Sm1LpJ-HP8zGunS8PahU-OY');

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully registered administration slash commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, member } = interaction;

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return await interaction.reply({ content: '❌ You do not have Administrator permissions to use this command.', ephemeral: true });
    }

    if (commandName === 'timeout') {
        const targetUser = interaction.options.getMember('user');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!targetUser) {
            return await interaction.reply({ content: '❌ User not found in this server.', ephemeral: true });
        }

        try {
            const durationMs = minutes * 60 * 1000;
            await targetUser.timeout(durationMs, reason);
            await interaction.reply(`✅ Successfully timed out ${targetUser.user.tag} for **${minutes} minutes**. Reason: ${reason}`);
        } catch (error) {
            console.error('Failed to timeout member:', error);
            await interaction.reply({ content: '❌ Failed to timeout the user. Check my role hierarchy permissions.', ephemeral: true });
        }
    }
    else if (commandName === 'clear') {
        const amount = interaction.options.getInteger('amount');

        if (amount < 1 || amount > 100) {
            return await interaction.reply({ content: '❌ Please provide a number between 1 and 100.', ephemeral: true });
        }

        try {
            await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `✅ Successfully deleted **${amount}** messages.`, ephemeral: true });
        } catch (error) {
            console.error('Failed to clear messages:', error);
            await interaction.reply({ content: '❌ Failed to delete messages (messages older than 14 days cannot be bulk deleted).', ephemeral: true });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const content = message.content.toLowerCase();
    const member = message.member;

    if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

    if (message.mentions.has(client.user) || message.content.includes("1.0k9")) {
        try {
            await member.timeout(30 * 1000, 'Mentioning protected user 1.0k9');
            await message.channel.send(`⚠️ ${message.author}, do not mention 1.0k9! Timed out for 30 seconds.`);
        } catch (err) {
            console.error('Failed to timeout for mention:', err);
        }
        return;
    }

    let containsBadWord = badWords.some(word => content.includes(word));
    if (containsBadWord) {
        try {
            let offenses = userOffenses.get(userId) || 0;
            let timeoutDuration = offenses === 0 ? (60 * 60 * 1000) : (5 * 60 * 60 * 1000);
            let durationText = offenses === 0 ? '1 hour' : '5 hours';

            userOffenses.set(userId, offenses + 1);

            await member.timeout(timeoutDuration, 'Using prohibited profanity or insults');
            await message.delete();
            await message.channel.send(`🚫 ${message.author}, profanity or insults are strictly prohibited. Timed out for **${durationText}**.`);
        } catch (err) {
            console.error('Failed to timeout for swearing:', err);
        }
        return;
    }

    const now = Date.now();
    let userHistory = userMessages.get(userId) || [];
    userHistory = userHistory.filter(timestamp => now - timestamp < 5000);
    userHistory.push(now);
    userMessages.set(userId, userHistory);

    if (userHistory.length >= 3) {
        try {
            userMessages.set(userId, []);
            await member.timeout(60 * 1000, 'Spamming messages');
            await message.delete();
            await message.channel.send(`⚠️ ${message.author}, please stop spamming! Timed out for **1 minute**.`);
        } catch (err) {
            console.error('Failed to timeout for spam:', err);
        }
    }
});

client.login('MTU2NzIzODU3OTU2MDkwNjc4Mg.Gzv94l.GAd3riAEHXEXxS3Sm1LpJ-HP8zGunS8PahU-OY');
