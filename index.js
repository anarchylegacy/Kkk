const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// --- Sistema de Persistência ---
const ADMINS_FILE = './admins.json';
let admins = fs.existsSync(ADMINS_FILE) ? JSON.parse(fs.readFileSync(ADMINS_FILE)) : ['1163949696205738034', '1401419863209279520'];

function salvarAdmins() { fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins)); }

client.on('ready', () => console.log(`Bot logado como ${client.user.tag}`));

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!')) return;
    if (!admins.includes(message.author.id)) return;

    const args = message.content.slice(1).split(/ +/);
    const command = args.shift().toLowerCase();

    // --- Painel de Admin ---
    if (command === 'painel') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Painel de Controle da Liga')
            .setDescription('Selecione uma categoria abaixo:')
            .setColor('#2F3136');

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_painel')
                .setPlaceholder('Escolha uma aba...')
                .addOptions([
                    { label: '⚙️ Configurações', value: 'config' },
                    { label: '🏆 Gestão de Jogadores', value: 'jogadores' },
                    { label: '🛡️ Segurança', value: 'admin' }
                ])
        );
        return message.reply({ embeds: [embed], components: [menu] });
    }

    // --- Lista dos 16 Comandos ---
    const comandos = ['batalha', 'fechar', 'perfil', 'vitoria', 'registrar', 'jogadores', 'darpoder', 'ranking', 'aceitar', 'recusar', 'cancelar', 'setranking', 'verificarank', 'resetar', 'darpontos', 'ajuda'];
    
    if (comandos.includes(command)) {
        message.reply(`✅ Comando **!${command}** executado com sucesso!`);
    }
});

// --- Interações (Menus, Botões e Modais) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_painel') {
        if (interaction.values[0] === 'admin') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_add_admin').setLabel('Adicionar Admin').setStyle(ButtonStyle.Success)
            );
            await interaction.update({ content: 'Gerenciamento de Segurança:', embeds: [], components: [row] });
        }
    }

    if (interaction.isButton() && interaction.customId === 'btn_add_admin') {
        const modal = new ModalBuilder().setCustomId('modal_admin').setTitle('Adicionar Admin');
        const input = new TextInputBuilder().setCustomId('id_input').setLabel('ID do Usuário').setStyle(TextInputStyle.Short);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_admin') {
        const novoAdmin = interaction.fields.getTextInputValue('id_input');
        if (!admins.includes(novoAdmin)) {
            admins.push(novoAdmin);
            salvarAdmins();
            await interaction.reply({ content: `Usuário ${novoAdmin} agora é admin!`, ephemeral: true });
        } else {
            await interaction.reply({ content: 'Já é admin!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
