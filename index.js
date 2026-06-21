const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    PermissionFlagsBits,
    REST,
    Routes,
    ChannelType
} = require('discord.js');
const Jsoning = require('jsoning').default ? require('jsoning').default : require('jsoning');

// Bancos de dados locais para persistência
const dbConfig = new Jsoning('config.json');
const dbVendas = new Jsoning('vendas.json');
const dbTickets = new Jsoning('tickets.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Registro dos Comandos Slash
client.once('ready', async () => {
    console.log(`🚀 ${client.user.tag} está online e pronto!`);

    const commands = [
        {
            name: 'config',
            description: '⚙️ [Staff] Abre o painel supremo de configuração do bot.',
            default_member_permissions: PermissionFlagsBits.Administrator.toString()
        },
        {
            name: 'mcstatus',
            description: '🎮 Mostra o status do servidor de Minecraft configurado.'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comandos /config e /mcstatus registrados globalmente.');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

// ========================================================
// 📊 RENDERIZADORES DO PAINEL SUPREMO (/config)
// ========================================================

async function gerarPainelSupremo(guildId) {
    const statusAutoMod = await dbConfig.get(`automod_${guildId}`) ?? false;
    const canalTickets = await dbConfig.get(`ctickets_${guildId}`) || "Não definido";
    const canalVendas = await dbConfig.get(`cvendas_${guildId}`) || "Não definido";
    const ipMc = await dbConfig.get(`ipmc_${guildId}`) || "Não configurado";

    return new EmbedBuilder()
        .setTitle("⚙️ PAINEL SUPREMO — GESTÃO INTEGRAL")
        .setDescription("Gerencie todos os módulos ativos do seu bot através dos botões abaixo.")
        .setColor(0x2B2D31)
        .addFields(
            { name: "🛡️ Moderação Avançada", value: statusAutoMod ? "🟢 `ATIVADO`" : "🔴 `DESATIVADO`", inline: true },
            { name: "🎫 Canal de Tickets", value: canalTickets === "Não definido" ? "❌ Não configurado" : `<#${canalTickets}>`, inline: true },
            { name: "🛒 Canal de Vendas", value: canalVendas === "Não definido" ? "❌ Não configurado" : `<#${canalVendas}>`, inline: true },
            { name: "🎮 IP de Minecraft", value: `\`${ipMc}\``, inline: false }
        )
        .setTimestamp();
}

function obterBotoesPainel() {
    const r1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_toggle_mod').setLabel('🛡️ Alternar Moderação').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg_setup_tickets').setLabel('🎫 Configurar Tickets').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg_setup_vendas').setLabel('🛒 Adicionar Produto').setStyle(ButtonStyle.Success)
    );
    const r2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_setup_mc').setLabel('🎮 Configurar Minecraft').setStyle(ButtonStyle.Secondary)
    );
    return [r1, r2];
}

// ========================================================
// 🛰️ INTERAÇÕES, BOTÕES E MODAIS
// ========================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'config') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: "❌ Apenas administradores podem acessar o painel.", ephemeral: true });
            }
            return interaction.reply({ embeds: [await gerarPainelSupremo(guildId)], components: obterBotoesPainel(), ephemeral: true });
        }

        if (interaction.commandName === 'mcstatus') {
            const ip = await dbConfig.get(`ipmc_${guildId}`);
            if (!ip) return interaction.reply({ content: "❌ Nenhum servidor de Minecraft foi configurado ainda.", ephemeral: true });
            
            await interaction.deferReply();
            try {
                // Consulta nativa HTTP à API de Status pública do Minecraft
                const response = await fetch(`https://api.mcsrvstat.us/3/${ip}`).then(res => res.json());
                if (response.online) {
                    const embedMc = new EmbedBuilder()
                        .setTitle(`🎮 Servidor: ${ip}`)
                        .setColor(0x2ECC71)
                        .addFields(
                            { name: "🟢 Status", value: "Online", inline: true },
                            { name: "👥 Jogadores", value: `${response.players.online}/${response.players.max}`, inline: true },
                            { name: "ℹ️ Versão", value: response.version || "Desconhecida", inline: false }
                        );
                    return interaction.editReply({ embeds: [embedMc] });
                } else {
                    return interaction.editReply({ content: `🔴 O servidor \`${ip}\` está offline no momento.` });
                }
            } catch (err) {
                return interaction.editReply({ content: "❌ Ocorreu um erro ao tentar consultar o status do servidor de Minecraft." });
            }
        }
    }

    // 2. Cliques em Botões Administráveis e Públicos
    if (interaction.isButton()) {
        const id = interaction.customId;

        // Toggles e Configurações do Painel Supremo
        if (id === 'cfg_toggle_mod') {
            await interaction.deferUpdate();
            const atual = await dbConfig.get(`automod_${guildId}`) ?? false;
            await dbConfig.set(`automod_${guildId}`, !atual);
            return interaction.editReply({ embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (id === 'cfg_setup_tickets') {
            const modal = new ModalBuilder().setCustomId('md_setup_tk').setTitle('🎫 Configurar Central de Suporte');
            const input = new TextInputBuilder().setCustomId('inp_tk_canal').setLabel('ID do Canal para a Central').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        if (id === 'cfg_setup_vendas') {
            const modal = new ModalBuilder().setCustomId('md_setup_vd').setTitle('🛒 Cadastro de Produto');
            const n = new TextInputBuilder().setCustomId('vd_nome').setLabel('Nome do Produto').setStyle(TextInputStyle.Short).setRequired(true);
            const p = new TextInputBuilder().setCustomId('vd_preco').setLabel('Preço (Ex: 15.00)').setStyle(TextInputStyle.Short).setRequired(true);
            const c = new TextInputBuilder().setCustomId('vd_canal').setLabel('ID do Canal de Anúncio').setStyle(TextInputStyle.Short).setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(n),
                new ActionRowBuilder().addComponents(p),
                new ActionRowBuilder().addComponents(c)
            );
            return interaction.showModal(modal);
        }

        if (id === 'cfg_setup_mc') {
            const modal = new ModalBuilder().setCustomId('md_setup_mc').setTitle('🎮 Vincular Servidor Minecraft');
            const input = new TextInputBuilder().setCustomId('inp_mc_ip').setLabel('IP/Endereço do Servidor').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // --- SISTEMA DE TICKETS (AÇÃO DO USUÁRIO) ---
        if (id === 'usuario_abrir_ticket') {
            await interaction.deferReply({ ephemeral: true });
            
            // Verifica se o usuário já tem um ticket em andamento
            const ticketAberto = await dbTickets.get(`aberto_${guildId}_${interaction.user.id}`);
            if (ticketAberto) return interaction.editReply(`❌ Você já possui um ticket aberto em <#${ticketAberto}>.`);

            const canalSuporte = await interaction.guild.channels.create({
                name: `🎫-${interaction.user.username}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]
            });

            await dbTickets.set(`aberto_${guildId}_${interaction.user.id}`, canalSuporte.id);

            const embedBoasVindas = new EmbedBuilder()
                .setTitle("🎫 SUPORTE INICIADO")
                .setDescription(`Olá ${interaction.user}, explique sua dúvida ou problema. Aguarde a resposta da Staff.\nPara encerrar este atendimento, clique no botão abaixo.`)
                .setColor(0x3498DB);
            
            const btnFechar = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('usuario_fechar_ticket').setLabel('🔒 Fechar Atendimento').setStyle(ButtonStyle.Danger)
            );

            await canalSuporte.send({ embeds: [embedBoasVindas], components: [btnFechar] });
            return interaction.editReply(`✅ Seu ticket privado foi gerado com sucesso: ${canalSuporte}`);
        }

        if (id === 'usuario_fechar_ticket') {
            await interaction.deferReply();
            // Localiza o dono do canal para resetar a chave do banco de dados
            const canais = await dbTickets.all();
            for (const [chave, valor] of Object.entries(canais)) {
                if (valor === interaction.channel.id) {
                    await dbTickets.delete(chave);
                }
            }
            await interaction.editReply("🔒 Este atendimento será deletado em 5 segundos...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
        }

        // --- SISTEMA DE VENDAS (AÇÃO DE COMPRA) ---
        if (id.startsWith('comprar_prod_')) {
            const prodId = id.replace('comprar_prod_', '');
            const produto = await dbVendas.get(prodId);
            if (!produto) return interaction.reply({ content: "❌ Produto não encontrado ou esgotado.", ephemeral: true });

            return interaction.reply({
                content: `🛒 **Intenção de Compra Registrada!**\n📦 **Produto:** ${produto.nome}\n🪙 **Valor:** R$ ${produto.preco}\n\n*Para concluir a transação, entre em contato com a administração do servidor.*`,
                ephemeral: true
            });
        }
    }

    // 3. Processamento de Modais
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'md_setup_tk') {
            await interaction.deferReply({ ephemeral: true });
            const canalId = interaction.fields.getTextInputValue('inp_tk_canal').trim();
            const canal = await client.channels.fetch(canalId).catch(() => null);
            
            if (!canal) return interaction.editReply("❌ Canal inválido ou não encontrado.");
            await dbConfig.set(`ctickets_${guildId}`, canalId);

            const embedTicket = new EmbedBuilder()
                .setTitle("🎫 CENTRAL DE SUPORTE")
                .setDescription("Precisa de ajuda externa ou auxílio da staff?\nClique no botão abaixo para abrir uma sala de suporte privada.")
                .setColor(0x3498DB);
            const rowTicket = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('usuario_abrir_ticket').setLabel('📩 Abrir Ticket').setStyle(ButtonStyle.Primary)
            );

            await canal.send({ embeds: [embedTicket], components: [rowTicket] });
            return interaction.editReply("✅ Painel de Atendimento enviado com sucesso!");
        }

        if (interaction.customId === 'md_setup_vd') {
            await interaction.deferReply({ ephemeral: true });
            const nome = interaction.fields.getTextInputValue('vd_nome').trim();
            const preco = interaction.fields.getTextInputValue('vd_preco').trim();
            const canalId = interaction.fields.getTextInputValue('vd_canal').trim();

            const canal = await client.channels.fetch(canalId).catch(() => null);
            if (!canal) return interaction.editReply("❌ Canal de anúncios inválido.");

            const prodId = `prod_${Date.now()}`;
            await dbVendas.set(prodId, { nome, preco });

            const embedVenda = new EmbedBuilder()
                .setTitle(`🛒 NOVA OFERTA DISPONÍVEL!`)
                .addFields(
                    { name: "📦 Item", value: nome, inline: true },
                    { name: "💵 Valor", value: `R$ ${preco}`, inline: true }
                )
                .setColor(0x2ECC71);
            
            const rowVenda = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`comprar_prod_${prodId}`).setLabel('🛒 Adquirir Produto').setStyle(ButtonStyle.Success)
            );

            await canal.send({ embeds: [embedVenda], components: [rowVenda] });
            return interaction.editReply("✅ Produto cadastrado e anunciado!");
        }

        if (interaction.customId === 'md_setup_mc') {
            await interaction.deferReply({ ephemeral: true });
            const ip = interaction.fields.getTextInputValue('inp_mc_ip').trim();
            await dbConfig.set(`ipmc_${guildId}`, ip);
            return interaction.editReply(`✅ IP de Minecraft definido com sucesso para: \`${ip}\`.`);
        }
    }
});

// ========================================================
// 🛡️ FILTRO AUTOMOD DE SEGURANÇA INTEGRADO
// ========================================================

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const guildId = message.guild.id;

    const modAtivo = await dbConfig.get(`automod_${guildId}`) ?? false;
    if (!modAtivo) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        // Bloqueia links abusivos/externos enviados por membros comuns
        if (/(https?:\/\/[^\s]+)/g.test(message.content)) {
            try { await message.delete(); } catch {}
            const aviso = await message.channel.send(`⚠️ <@${message.author.id}>, o envio de links externos está bloqueado neste chat.`);
            setTimeout(() => aviso.delete().catch(() => {}), 4000);
        }
    }
});

client.login(process.env.TOKEN);
