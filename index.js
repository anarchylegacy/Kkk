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

// Inicialização dos bancos de dados locais (.json)
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
// 🪐 REGISTRO GLOBAL DE COMANDOS DE BARRA (SLASH)
// ========================================================
client.once('ready', async () => {
    console.log(`👑 [HUB SUPREMO] ${client.user.tag} está online e pronto!`);

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
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Todos os comandos Slash foram registrados globalmente!');
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
            { name: "🗂️ Categorias de Atendimento", value: categories.length > 0 ? categorias.map(c => `• **${c.label}** (${c.description})`).join('\n') : "*Nenhuma opção criada.*", inline: false }
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
// 🛰️ NÚCLEO DE TRATAMENTO DE INTERAÇÕES E FLUXO DO BOT
// ========================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    // --- 1. COMANDOS SLASH ---
    if (interaction.isChatInputCommand()) {
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
                            { name: "ℹ️ Versão do Servidor", value: res.version || "1.20+", inline: false }
                        );
                    return interaction.editReply({ embeds: [embed] });
                }
                return interaction.editReply(`🔴 O servidor \`${ip}\` está offline no momento.`);
            } catch {
                return interaction.editReply("❌ Não foi possível obter resposta da API de verificação do Minecraft.");
            }
        }
    }

    // --- 2. LOGICA DOS BOTÕES ---
    if (interaction.isButton()) {
        const id = interaction.customId;

        // Gerenciamento Interno (Config / Módulos)
        if (id === 'v2_toggle_mod') {
            await interaction.deferUpdate();
            const at = await dbConfig.get(`automod_${guildId}`) ?? false;
            await dbConfig.set(`automod_${guildId}`, !at);
            return interaction.editReply({ embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (id === 'v2_add_categoria_tk') {
            const modal = new ModalBuilder().setCustomId('md_v2_add_tk').setTitle('Criar Categoria de Suporte');
            const nome = new TextInputBuilder().setCustomId('tk_label').setLabel('Nome da Categoria (Ex: Denúncias)').setStyle(TextInputStyle.Short).setRequired(true);
            const desc = new TextInputBuilder().setCustomId('tk_desc').setLabel('Subtítulo informativo').setStyle(TextInputStyle.Short).setRequired(true);
            const emoji = new TextInputBuilder().setCustomId('tk_emoji').setLabel('Emoji identificador (Ex: 🛠️)').setStyle(TextInputStyle.Short).setRequired(true);
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

        // --- MÓDULO KAMIVENDAS (AÇÕES INTERNAS) ---
        if (id === 'kv_add_produto') {
            const modal = new ModalBuilder().setCustomId('md_kv_criar').setTitle('KamiVendas — Novo Item');
            const idItem = new TextInputBuilder().setCustomId('kv_id').setLabel('ID Interno do Item (Ex: vip_iron)').setStyle(TextInputStyle.Short).setRequired(true);
            const nome = new TextInputBuilder().setCustomId('kv_nome').setLabel('Nome de Exibição do Produto').setStyle(TextInputStyle.Short).setRequired(true);
            const preco = new TextInputBuilder().setCustomId('kv_preco').setLabel('Preço Comercial (Ex: 10.00)').setStyle(TextInputStyle.Short).setRequired(true);
            const entrega = new TextInputBuilder().setCustomId('kv_entrega').setLabel('Conteúdo entregue após o pagamento').setStyle(TextInputStyle.Paragraph).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(idItem), new ActionRowBuilder().addComponents(nome), new ActionRowBuilder().addComponents(preco), new ActionRowBuilder().addComponents(entrega));
            return interaction.showModal(modal);
        }

        if (id === 'kv_lancar_loja') {
            const modal = new ModalBuilder().setCustomId('md_kv_lancar_painel').setTitle('Enviar Vitrine Comercial');
            const canal = new TextInputBuilder().setCustomId('kv_canal_vitrine').setLabel('ID do Canal onde a Loja será postada').setStyle(TextInputStyle.Short).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(canal));
            return interaction.showModal(modal);
        }

        // --- SISTEMAS OPERACIONAIS PÚBLICOS (CLIENTES / MEMBROS) ---
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
            if (!produto) return interaction.editReply("❌ Produto esgotado ou indisponível no momento.");

            const embedPix = new EmbedBuilder()
                .setTitle(`🛒 ORDEM DE COMPRA — ${produto.nome}`)
                .setDescription(`Sua intenção de compra foi registrada.\n\n**Valor do Item:** R$ ${produto.preco}\n\n*Para realizar o pagamento e receber o seu produto automaticamente na DM, realize o pagamento via chave cadastrada junto à gerência.*`)
                .setColor(0x00D2FF);
            return interaction.editReply({ embeds: [embedPix] });
        }
    }

    // --- 3. MENUS DE SELEÇÃO DINÂMICOS (TICKETS USUÁRIOS) ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'usuario_select_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const valorSelecionado = interaction.values[0];
        
        const aberto = await dbTickets.get(`ab_${guildId}_${interaction.user.id}`);
        if (aberto) return interaction.editReply(`❌ Você já possui um atendimento em andamento em <#${aberto}>.`);

        const categorias = await dbConfig.get(`categorias_tk_${guildId}`) || [];
        const escolhida = categorias.find(c => c.value === valorSelecionado);
        if (!escolhida) return interaction.editReply("❌ Tipo de atendimento não identificado.");

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

        const embed = new EmbedBuilder()
            .setTitle(`🎫 ATENDIMENTO: ${escolhida.label.toUpperCase()}`)
            .setDescription(`Seja bem-vindo ao suporte privado.\nExplique seus motivos e anexe provas caso necessário.\n\n**Setor encarregado:** <@&${escolhida.cargo}>`)
            .setColor(0x5865F2);

        const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_fechar_v2').setLabel('🔒 Encerrar Ticket').setStyle(ButtonStyle.Danger));
        await sala.send({ embeds: [embed], components: [btn] });
        
        return interaction.editReply(`✅ Canal criado com sucesso: ${sala}`);
    }

    // --- 4. RECEBIMENTO DE FORMULÁRIOS (MODAIS SUBMITS) ---
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

            return interaction.editReply({ content: `✅ Opção de suporte \`${label}\` adicionada com sucesso ao menu!`, embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (interaction.customId === 'md_v2_lancar') {
            await interaction.deferReply({ ephemeral: true });
            const cId = interaction.fields.getTextInputValue('tk_canal_alvo').trim();
            const canal = await client.channels.fetch(cId).catch(() => null);
            if (!canal) return interaction.editReply("❌ Canal inválido.");

            await dbConfig.set(`ctickets_${guildId}`, cId);
            const opcoesMenu = await dbConfig.get(`categorias_tk_${guildId}`) || [];
            if (opcoesMenu.length === 0) return interaction.editReply("❌ Cadastre categorias de ticket antes de enviar o menu.");

            const embed = new EmbedBuilder()
                .setTitle("🎫 CENTRAL DE ATENDIMENTO INTEGRAL")
                .setDescription("Para evitar filas e otimizar seu suporte, selecione na caixa de opções abaixo a categoria correspondente à sua solicitação.")
                .setColor(0x5865F2);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('usuario_select_ticket')
                .setPlaceholder('Escolha o motivo do seu contato...')
                .addOptions(opcoesMenu.map(o => ({ label: o.label, description: o.description, emoji: o.emoji, value: o.value })));

            await canal.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
            return interaction.editReply("🚀 Painel central publicado com sucesso!");
        }

        if (interaction.customId === 'md_v2_mc') {
            await interaction.deferReply({ ephemeral: true });
            const ip = interaction.fields.getTextInputValue('mc_ip_alvo').trim();
            await dbConfig.set(`ipmc_${guildId}`, ip);
            return interaction.editReply({ content: `✅ Endereço de Minecraft atualizado para: \`${ip}\`.`, embeds: [await gerarPainelSupremo(guildId)] });
        }

        if (interaction.customId === 'md_kv_criar') {
            await interaction.deferReply({ ephemeral: true });
            const itemKey = interaction.fields.getTextInputValue('kv_id').trim().toLowerCase();
            const nome = interaction.fields.getTextInputValue('kv_nome').trim();
            const preco = interaction.fields.getTextInputValue('kv_preco').trim();
            const entrega = interaction.fields.getTextInputValue('kv_entrega').trim();

            await dbVendas.set(`prod_${guildId}_${itemKey}`, { nome, preco, entrega, id: itemKey });
            return interaction.editReply({ content: `✅ Item \`${nome}\` adicionado à base KamiVendas!`, embeds: [await gerarPainelLoja(guildId)] });
        }

        if (interaction.customId === 'md_kv_lancar_painel') {
            await interaction.deferReply({ ephemeral: true });
            const canalId = interaction.fields.getTextInputValue('kv_canal_vitrine').trim();
            const canal = await client.channels.fetch(canalId).catch(() => null);
            if (!canal) return interaction.editReply("❌ Canal da vitrine inválido.");

            const todosProdutos = await dbVendas.all() || {};
            const listaProdutosServidor = Object.entries(todosProdutos).filter(([k]) => k.startsWith(`prod_${guildId}_`));

            if (listaProdutosServidor.length === 0) return interaction.editReply("❌ Não há produtos no estoque para anunciar.");

            const embedVitrine = new EmbedBuilder()
                .setTitle("🛒 VITRINE VIRTUAL DE PRODUTOS")
                .setDescription("Selecione um dos produtos disponíveis nos botões abaixo para obter informações e ordens de pagamento.")
                .setColor(0x2ECC71);

            const linhasBotoes = [];
            let rowAtual = new ActionRowBuilder();

            listaProdutosServidor.forEach(([chave, prod], index) => {
                if (index > 0 && index % 5 === 0) {
                    linhasBotoes.push(rowAtual);
                    rowAtual = new ActionRowBuilder();
                }
                rowAtual.addComponents(new ButtonBuilder().setCustomId(`kv_comprar_${chave}`).setLabel(`${prod.nome} — R$ ${prod.preco}`).setStyle(ButtonStyle.Success));
            });
            linhasBotoes.push(rowAtual);

            await canal.send({ embeds: [embedVitrine], components: linhasBotoes });
            return interaction.editReply("✅ Loja publicada com sucesso!");
        }
    }
});

// ========================================================
// 🛡️ FILTRO AUTOMOD (MODERAÇÃO DE CONTEÚDO ATIVA)
// ========================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (await dbConfig.get(`automod_${message.guild.id}`) !== true) return;

    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        if (/(https?:\/\/[^\s]+)/g.test(message.content)) {
            try { await message.delete(); } catch {}
            const av = await message.channel.send(`⚠️ <@${message.author.id}>, o envio de links externos não é permitido neste chat.`);
            setTimeout(() => av.delete().catch(() => {}), 4000);
        }
    }
});

client.login(process.env.TOKEN);
