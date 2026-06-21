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
    ChannelType,
    StringSelectMenuBuilder
} = require('discord.js');
const Jsoning = require('jsoning').default ? require('jsoning').default : require('jsoning');

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

// ========================================================
// 🪐 REGISTRO AMPLIADO DE COMANDOS DE BARRA (SLASH)
// ========================================================
client.once('ready', async () => {
    console.log(`👑 [HUB SUPREMO EXTREMO] ${client.user.tag} está online!`);

    const commands = [
        {
            name: 'config',
            description: '⚙️ [Staff] Painel mestre de configurações e suporte.',
            default_member_permissions: PermissionFlagsBits.Administrator.toString()
        },
        {
            name: 'loja',
            description: '🛒 [Staff] Painel mestre de vendas estilo KamiVendas.',
            default_member_permissions: PermissionFlagsBits.Administrator.toString()
        },
        {
            name: 'mcstatus',
            description: '🎮 Consulta em tempo real o servidor de Minecraft configurado.'
        },
        {
            name: 'ping',
            description: '🏓 Mostra a latência atual do bot.'
        },
        {
            name: 'userinfo',
            description: '👤 Mostra informações detalhadas sobre um usuário.',
            options: [
                {
                    name: 'membro',
                    description: 'Selecione o membro para ver as informações.',
                    type: 6, // USER type
                    required: false
                }
            ]
        },
        {
            name: 'limpar',
            description: '🧹 [Staff] Apaga uma quantidade específica de mensagens do chat.',
            default_member_permissions: PermissionFlagsBits.ManageMessages.toString(),
            options: [
                {
                    name: 'quantidade',
                    description: 'Número de mensagens a apagar (1 a 100).',
                    type: 4, // INTEGER type
                    required: true
                }
            ]
        },
        {
            name: 'mute',
            description: '🤫 [Staff] Aplica um castigo temporário (timeout) em um membro.',
            default_member_permissions: PermissionFlagsBits.ModerateMembers.toString(),
            options: [
                { name: 'membro', description: 'Membro a ser silenciado.', type: 6, required: true },
                { name: 'minutos', description: 'Tempo em minutos.', type: 4, required: true },
                { name: 'motivo', description: 'Motivo do castigo.', type: 3, required: false }
            ]
        },
        {
            name: 'kick',
            description: '👢 [Staff] Expulsa um membro do servidor.',
            default_member_permissions: PermissionFlagsBits.KickMembers.toString(),
            options: [
                { name: 'membro', description: 'Membro a ser expulso.', type: 6, required: true },
                { name: 'motivo', description: 'Motivo da expulsão.', type: 3, required: false }
            ]
        },
        {
            name: 'ban',
            description: '🔨 [Staff] Bane permanentemente um membro do servidor.',
            default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
            options: [
                { name: 'membro', description: 'Membro a ser banido.', type: 6, required: true },
                { name: 'motivo', description: 'Motivo do banimento.', type: 3, required: false }
            ]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        // Registra os comandos diretamente na aplicação global do bot
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Todos os novos comandos Slash expandidos foram registrados!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

// ========================================================
// 📊 RENDERIZADORES DE INTERFACE (PAINÉIS DA STAFF)
// ========================================================

async function gerarPainelSupremo(guildId) {
    const statusAutoMod = await dbConfig.get(`automod_${guildId}`) ?? false;
    const canalTickets = await dbConfig.get(`ctickets_${guildId}`) || "Não configurado";
    const ipMc = await dbConfig.get(`ipmc_${guildId}`) || "Não configurado";
    const categorias = await dbConfig.get(`categorias_tk_${guildId}`) || [];

    return new EmbedBuilder()
        .setTitle("👑 PAINEL SUPREMO — GESTÃO DA COMUNIDADE")
        .setDescription("Controle as diretrizes do AutoMod, Minecraft e configure a árvore de canais de suporte.")
        .setColor(0x5865F2)
        .addFields(
            { name: "🛡️ AutoMod Inteligente", value: statusAutoMod ? "🟢 Ativado (Filtro Anti-Link)" : "🔴 Desativado", inline: true },
            { name: "🎮 IP de Minecraft", value: `\`${ipMc}\``, inline: true },
            { name: "🎫 Destino da Central", value: canalTickets === "Não configurado" ? "❌ Indefinido" : `<#${canalTickets}>`, inline: false },
            { name: "🗂️ Categorias de Atendimento", value: categorias.length > 0 ? categorias.map(c => `• **${c.label}** (${c.description})`).join('\n') : "*Nenhuma opção criada.*", inline: false }
        )
        .setTimestamp();
}

function obterBotoesPainel() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('v2_toggle_mod').setLabel('🛡️ Alternar AutoMod').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('v2_add_categoria_tk').setLabel('➕ Criar Tipo de Ticket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('v2_lancar_central').setLabel('🚀 Publicar Central de Tickets').setStyle(ButtonStyle.Success)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('v2_setup_mc').setLabel('🎮 Configurar IP Minecraft').setStyle(ButtonStyle.Secondary)
        )
    ];
}

async function gerarPainelLoja(guildId) {
    const totalProdutos = await dbVendas.all() || {};
    const quantidade = Object.keys(totalProdutos).filter(k => k.startsWith(`prod_${guildId}_`)).length;

    return new EmbedBuilder()
        .setTitle("🛒 GERENCIADOR DE VENDAS — ESTILO KAMIVENDAS")
        .setDescription("Cadastre seus infoprodutos, vips ou itens com entrega e geração de ordens automatizadas.")
        .setColor(0x2ECC71)
        .addFields(
            { name: "📦 Seu Estoque Atual", value: `\`${quantidade} produtos cadastrados\``, inline: true },
            { name: "💳 Integração de Checkout", value: "🟢 PIX Manual / Logs de Intenção", inline: true }
        )
        .setTimestamp();
}

function obterBotoesLoja() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('kv_add_produto').setLabel('➕ Cadastrar Produto').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('kv_lancar_loja').setLabel('🚀 Publicar Vitrine de Vendas').setStyle(ButtonStyle.Primary)
        )
    ];
}

// ========================================================
// 🛰️ EXECUÇÃO DOS NOVOS COMANDOS SLASH E INTERAÇÕES
// ========================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    if (interaction.isChatInputCommand()) {
        // --- COMANDOS JÁ EXISTENTES ---
        if (interaction.commandName === 'config') {
            return interaction.reply({ embeds: [await gerarPainelSupremo(guildId)], components: obterBotoesPainel(), ephemeral: true });
        }

        if (interaction.commandName === 'loja') {
            return interaction.reply({ embeds: [await gerarPainelLoja(guildId)], components: obterBotoesLoja(), ephemeral: true });
        }

        if (interaction.commandName === 'mcstatus') {
            const ip = await dbConfig.get(`ipmc_${guildId}`);
            if (!ip) return interaction.reply({ content: "❌ O IP do servidor de Minecraft não foi configurado pela staff.", ephemeral: true });
            await interaction.deferReply();
            try {
                const res = await fetch(`https://api.mcsrvstat.us/3/${ip}`).then(r => r.json());
                if (res.online) {
                    const embed = new EmbedBuilder()
                        .setTitle(`🎮 STATUS DA REDE: ${ip}`)
                        .setColor(0x2ECC71)
                        .addFields(
                            { name: "🟢 Status", value: "Online", inline: true },
                            { name: "👥 Jogadores", value: `${res.players.online}/${res.players.max}`, inline: true },
                            { name: "ℹ️ Versão", value: res.version || "1.20+", inline: false }
                        );
                    return interaction.editReply({ embeds: [embed] });
                }
                return interaction.editReply(`🔴 O servidor \`${ip}\` está offline.`);
            } catch { return interaction.editReply("❌ Erro ao consultar API do Minecraft."); }
        }

        // --- NOVOS COMANDOS UTILITÁRIOS E MODERAÇÃO ---
        if (interaction.commandName === 'ping') {
            return interaction.reply(`🏓 **Pong!** Latência da API: \`${client.ws.ping}ms\``);
        }

        if (interaction.commandName === 'userinfo') {
            const usuario = interaction.options.getUser('membro') || interaction.user;
            const membro = await interaction.guild.members.fetch(usuario.id);
            const embedUser = new EmbedBuilder()
                .setTitle(`👤 Informações de: ${usuario.username}`)
                .setThumbnail(usuario.displayAvatarURL())
                .setColor(0x3498DB)
                .addFields(
                    { name: "🆔 ID do Usuário", value: `\`${usuario.id}\``, inline: true },
                    { name: "📅 Conta Criada", value: `<t:${Math.floor(usuario.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: "📥 Entrou no Servidor", value: `<t:${Math.floor(membro.joinedTimestamp / 1000)}:R>`, inline: false }
                );
            return interaction.reply({ embeds: [embedUser] });
        }

        if (interaction.commandName === 'limpar') {
            const qtd = interaction.options.getInteger('quantidade');
            if (qtd < 1 || qtd > 100) return interaction.reply({ content: "❌ Insira um valor entre 1 e 100.", ephemeral: true });
            
            await interaction.channel.bulkDelete(qtd, true);
            return interaction.reply({ content: `🧹 Apagadas **${qtd}** mensagens recentes do chat.`, ephemeral: true });
        }

        if (interaction.commandName === 'mute') {
            const alvo = interaction.options.getMember('membro');
            const minutos = interaction.options.getInteger('minutos');
            const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado.';

            if (!alvo.moderatable) return interaction.reply({ content: "❌ Eu não tenho permissões suficientes para silenciar este membro.", ephemeral: true });
            
            await alvo.timeout(minutos * 60 * 1000, motivo);
            return interaction.reply({ content: `🤫 ${alvo} foi silenciado por **${minutos} minutos**.\n**Motivo:** ${motivo}` });
        }

        if (interaction.commandName === 'kick') {
            const alvo = interaction.options.getMember('membro');
            const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado.';

            if (!alvo.kickable) return interaction.reply({ content: "❌ Eu não posso expulsar este membro.", ephemeral: true });
            
            await alvo.kick(motivo);
            return interaction.reply({ content: `👢 ${alvo.user.username} foi expulso do servidor.\n**Motivo:** ${motivo}` });
        }

        if (interaction.commandName === 'ban') {
            const alvo = interaction.options.getMember('membro');
            const motivo = interaction.options.getString('motivo') || 'Sem motivo especificado.';

            if (!alvo.bannable) return interaction.reply({ content: "❌ Eu não possuo permissão para banir este membro.", ephemeral: true });
            
            await alvo.ban({ reason: motivo });
            return interaction.reply({ content: `🔨 ${alvo.user.username} foi banido permanentemente.\n**Motivo:** ${motivo}` });
        }
    }

    // --- RECEPTOR DOS BOTÕES ANTIGOS, TICKETS E MODAIS (MANTIDOS E INTEGRADOS) ---
    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === 'v2_toggle_mod') {
            await interaction.deferUpdate();
            const at = await dbConfig.get(`automod_${guildId}`) ?? false;
            await dbConfig.set(`automod_${guildId}`, !at);
            return interaction.editReply({ embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (id === 'v2_add_categoria_tk') {
            const modal = new ModalBuilder().setCustomId('md_v2_add_tk').setTitle('Criar Categoria de Suporte');
            const nome = new TextInputBuilder().setCustomId('tk_label').setLabel('Nome da Categoria (Ex: Compras)').setStyle(TextInputStyle.Short).setRequired(true);
            const desc = new TextInputBuilder().setCustomId('tk_desc').setLabel('Subtítulo informativo').setStyle(TextInputStyle.Short).setRequired(true);
            const emoji = new TextInputBuilder().setCustomId('tk_emoji').setLabel('Emoji identificador (Ex: 🛒)').setStyle(TextInputStyle.Short).setRequired(true);
            const cargo = new TextInputBuilder().setCustomId('tk_cargo').setLabel('ID do Cargo que atende este Ticket').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(nome), new ActionRowBuilder().addComponents(desc), new ActionRowBuilder().addComponents(emoji), new ActionRowBuilder().addComponents(cargo));
            return interaction.showModal(modal);
        }

        if (id === 'v2_lancar_central') {
            const modal = new ModalBuilder().setCustomId('md_v2_lancar').setTitle('Lançar Árvore de Tickets');
            const canal = new TextInputBuilder().setCustomId('tk_canal_alvo').setLabel('ID do Canal da Central').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(canal));
            return interaction.showModal(modal);
        }

        if (id === 'v2_setup_mc') {
            const modal = new ModalBuilder().setCustomId('md_v2_mc').setTitle('IP da Rede Minecraft');
            const ip = new TextInputBuilder().setCustomId('mc_ip_alvo').setLabel('Endereço/IP numérico ou textual').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(ip));
            return interaction.showModal(modal);
        }

        if (id === 'kv_add_produto') {
            const modal = new ModalBuilder().setCustomId('md_kv_criar').setTitle('KamiVendas — Novo Item');
            const idItem = new TextInputBuilder().setCustomId('kv_id').setLabel('ID Interno do Item (Ex: vip_iron)').setStyle(TextInputStyle.Short).setRequired(true);
            const nome = new TextInputBuilder().setCustomId('kv_nome').setLabel('Nome de Exibição').setStyle(TextInputStyle.Short).setRequired(true);
            const preco = new TextInputBuilder().setCustomId('kv_preco').setLabel('Preço Comercial (Ex: 10.00)').setStyle(TextInputStyle.Short).setRequired(true);
            const entrega = new TextInputBuilder().setCustomId('kv_entrega').setLabel('Conteúdo entregue após pagamento').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(idItem), new ActionRowBuilder().addComponents(nome), new ActionRowBuilder().addComponents(preco), new ActionRowBuilder().addComponents(entrega));
            return interaction.showModal(modal);
        }

        if (id === 'kv_lancar_loja') {
            const modal = new ModalBuilder().setCustomId('md_kv_lancar_painel').setTitle('Enviar Vitrine Comercial');
            const canal = new TextInputBuilder().setCustomId('kv_canal_vitrine').setLabel('ID do Canal da Loja').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(canal));
            return interaction.showModal(modal);
        }

        if (id === 'ticket_fechar_v2') {
            await interaction.deferReply();
            const canais = await dbTickets.all();
            for (const [key, val] of Object.entries(canais)) {
                if (val === interaction.channel.id) await dbTickets.delete(key);
            }
            await interaction.editReply("🔒 Sala finalizada. Deletando canal de texto...");
            setTimeout(() => interaction.channel.delete().catch(() => {}), 4000);
        }

        if (id.startsWith('kv_comprar_')) {
            await interaction.deferReply({ ephemeral: true });
            const produtoIdCompleto = id.replace('kv_comprar_', '');
            const produto = await dbVendas.get(produtoIdCompleto);
            if (!produto) return interaction.editReply("❌ Produto esgotado.");
            return interaction.editReply({ content: `🛒 **Pedido Iniciado!**\n📦 Item: **${produto.nome}**\n💵 Valor: **R$ ${produto.preco}**\n\nAbra um atendimento ou contate a administração.` });
        }
    }

    // --- SELEÇÃO DE MENU DE TICKETS ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'usuario_select_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const valorSelecionado = interaction.values[0];
        const aberto = await dbTickets.get(`ab_${guildId}_${interaction.user.id}`);
        if (aberto) return interaction.editReply(`❌ Você já possui um atendimento aberto em <#${aberto}>.`);

        const categorias = await dbConfig.get(`categorias_tk_${guildId}`) || [];
        const escolhida = categorias.find(c => c.value === valorSelecionado);
        if (!escolhida) return interaction.editReply("❌ Tipo de atendimento inválido.");

        const sala = await interaction.guild.channels.create({
            name: `${escolhida.value}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: escolhida.cargo, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        await dbTickets.set(`ab_${guildId}_${interaction.user.id}`, sala.id);
        const embed = new EmbedBuilder().setTitle(`🎫 ATENDIMENTO: ${escolhida.label.toUpperCase()}`).setDescription(`Equipe notificada. Cargo encarregado: <@&${escolhida.cargo}>`).setColor(0x5865F2);
        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_fechar_v2').setLabel('🔒 Encerrar Ticket').setStyle(ButtonStyle.Danger));
        await sala.send({ embeds: [embed], components: [btn] });
        return interaction.editReply(`✅ Canal criado com sucesso: ${sala}`);
    }

    // --- FORMULÁRIOS SUBMITS ---
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'md_v2_add_tk') {
            await interaction.deferReply({ ephemeral: true });
            const label = interaction.fields.getTextInputValue('tk_label').trim();
            const description = interaction.fields.getTextInputValue('tk_desc').trim();
            const emoji = interaction.fields.getTextInputValue('tk_emoji').trim();
            const cargo = interaction.fields.getTextInputValue('tk_cargo').trim();
            const value = `tk_${label.toLowerCase().replace(/[^a-z]/g, '')}`;

            let cat = await dbConfig.get(`categorias_tk_${guildId}`) || [];
            cat.push({ label, description, emoji, cargo, value });
            await dbConfig.set(`categorias_tk_${guildId}`, cat);
            return interaction.editReply({ content: `✅ Opção \`${label}\` adicionada!`, embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (interaction.customId === 'md_v2_lancar') {
            await interaction.deferReply({ ephemeral: true });
            const cId = interaction.fields.getTextInputValue('tk_canal_alvo').trim();
            const canal = await client.channels.fetch(cId).catch(() => null);
            if (!canal) return interaction.editReply("❌ Canal inválido.");

            await dbConfig.set(`ctickets_${guildId}`, cId);
            const opcoesMenu = await dbConfig.get(`categorias_tk_${guildId}`) || [];
            if (opcoesMenu.length === 0) return interaction.editReply("❌ Adicione categorias primeiro.");

            const embed = new EmbedBuilder().setTitle("🎫 CENTRAL DE ATENDIMENTO").setDescription("Selecione o motivo na caixa abaixo.").setColor(0x5865F2);
            const selectMenu = new StringSelectMenuBuilder().setCustomId('usuario_select_ticket').setPlaceholder('Escolha a categoria...').addOptions(opcoesMenu.map(o => ({ label: o.label, description: o.description, emoji: o.emoji, value: o.value })));
            await canal.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
            return interaction.editReply("🚀 Central enviada!");
        }

        if (interaction.customId === 'md_v2_mc') {
            await interaction.deferReply({ ephemeral: true });
            const ip = interaction.fields.getTextInputValue('mc_ip_alvo').trim();
            await dbConfig.set(`ipmc_${guildId}`, ip);
            return interaction.editReply({ content: `✅ IP alterado para: \`${ip}\`.`, embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (interaction.customId === 'md_kv_criar') {
            await interaction.deferReply({ ephemeral: true });
            const itemKey = interaction.fields.getTextInputValue('kv_id').trim().toLowerCase();
            const nome = interaction.fields.getTextInputValue('kv_nome').trim();
            const preco = interaction.fields.getTextInputValue('kv_preco').trim();
            const entrega = interaction.fields.getTextInputValue('kv_entrega').trim();

            await dbVendas.set(`prod_${guildId}_${itemKey}`, { nome, preco, entrega, id: itemKey });
            return interaction.editReply({ content: `✅ Item cadastrado!`, embeds: [await gerarPainelLoja(guildId)] });
        }

        if (interaction.customId === 'md_kv_lancar_painel') {
            await interaction.deferReply({ ephemeral: true });
            const canalId = interaction.fields.getTextInputValue('kv_canal_vitrine').trim();
            const canal = await client.channels.fetch(canalId).catch(() => null);
            if (!canal) return interaction.editReply("❌ Canal inválido.");

            const todosProdutos = await dbVendas.all() || {};
            const listaProdutosServidor = Object.entries(todosProdutos).filter(([k]) => k.startsWith(`prod_${guildId}_`));

            const embedVitrine = new EmbedBuilder().setTitle("🛒 VITRINE DE PRODUTOS").setDescription("Clique em um botão para iniciar o pedido.").setColor(0x2ECC71);
            const linhasBotoes = [];
            let rowAtual = new ActionRowBuilder();

            listaProdutosServidor.forEach(([chave, prod], index) => {
                if (index > 0 && index % 5 === 0) { linhasBotoes.push(rowAtual); rowAtual = new ActionRowBuilder(); }
                rowAtual.addComponents(new ButtonBuilder().setCustomId(`kv_comprar_${chave}`).setLabel(`${prod.nome} — R$ ${prod.preco}`).setStyle(ButtonStyle.Success));
            });
            linhasBotoes.push(rowAtual);
            await canal.send({ embeds: [embedVitrine], components: linhasBotoes });
            return interaction.editReply("✅ Loja publicada!");
        }
    }
});

// ========================================================
// 🛡️ AUTOMOD (ANTI-LINK)
// ========================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (await dbConfig.get(`automod_${message.guild.id}`) !== true) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (/(https?:\/\/[^\s]+)/g.test(message.content)) {
            try { await message.delete(); } catch {}
            const av = await message.channel.send(`⚠️ <@${message.author.id}>, links não são permitidos neste chat.`);
            setTimeout(() => av.delete().catch(() => {}), 4000);
        }
    }
});

client.login(process.env.TOKEN);
