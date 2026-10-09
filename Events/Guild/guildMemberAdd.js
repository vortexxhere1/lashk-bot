const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const path = require("path");

function safeRequire(relativePath) {
  try { return require(relativePath); } catch { return null; }
}

const fs = safeRequire("../../Utils/Core/databaseFs") || require("fs");
const emojiler = safeRequire("../../Utils/Emojis/emojiler.js") || {};
const inviteTracker = safeRequire("../../Utils/Membership/inviteTracker") || {};
const accountData = safeRequire("../../Utils/Account/accountData") || {};
const accountBadges = safeRequire("../../Utils/Account/accountBadges") || {};
const accountCardRenderer = safeRequire("../../Utils/Account/accountCardRenderer") || {};
const dmCard = safeRequire("../../Utils/Media/dmWelcomeCard") || {};

const trackMemberInvite = inviteTracker.trackMemberInvite || (async () => {});
const girisDBPath = path.join(__dirname, "../../Database/Sunucu Yönetimi/girisCikis.json");
const pingDBPath = path.join(__dirname, "../../Database/Güvenlik ve Moderasyon/girisPing.json");

const DEFAULT_WELCOME_GIF = "https://media4.giphy.com/media/v1.Y2lkPTZjMDliPTZjMDliOTUyYmxpYnVoY2trYjI1b3I1aDRlNXVpYmVmODFvMG9xMnFxZjZicWtnZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/KUiRNSE9b3eKI/giphy.gif";

function safeLoadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch { return {}; }
}

async function getUserColor(member) {
  try {
    if (member?.user?.accentColor) return `#${member.user.accentColor.toString(16).padStart(6, "0")}`;
    const highestRole = member?.roles?.highest;
    if (highestRole && highestRole.color !== 0) return `#${highestRole.color.toString(16).padStart(6, "0")}`;
    return "#3B82F6";
  } catch { return "#3B82F6"; }
}

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    if (!member || !member.guild) return;

    // 1. Davet İstatistiği Kaydı
    try { await trackMemberInvite(member); } catch {}

    // 2. Giriş Mesajı İşlemleri
    try {
      const girisData = safeLoadJSON(girisDBPath);
      const guildData = girisData[member.guild.id];
      const girisCikisAktif = guildData?.aktif ?? Boolean(guildData?.giris?.kanal || guildData?.cikis?.kanal);

      if (girisCikisAktif && guildData?.giris?.kanal) {
        const giris = guildData.giris;
        const kanal = member.guild.channels.cache.get(giris.kanal);

        if (kanal) {
          // Otorol Tanımlama
          if (giris.otoRol) {
            const rol = member.guild.roles.cache.get(giris.otoRol);
            if (rol) await member.roles.add(rol, "Oto-rol aktif").catch(() => {});
          }

          // Üye ve Hedef Hesaplamaları
          const currentMembers = member.guild.memberCount || 0;
          let targetMembers = Math.ceil((currentMembers || 1) / 100) * 100;
          if (giris.hedefUye && !isNaN(giris.hedefUye)) targetMembers = parseInt(giris.hedefUye, 10);
          const kalan = Math.max(0, targetMembers - currentMembers);
          const hedefBilgi = `\n-# Hedef: ${targetMembers} • Üye Sayısı: ${currentMembers} • Kalan: ${kalan}`;

          const username = member.user?.username || "Kullanıcı";
          const userColor = await getUserColor(member);
          const createdAt = member.user?.createdAt ? new Date(member.user.createdAt) : new Date();
          const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          const yearsOld = Math.floor(daysOld / 365);
          const createdDateStr = createdAt.toLocaleDateString("tr-TR");

          let riskLevel = "Düşük";
          if (daysOld < 7) riskLevel = "Çok Yüksek";
          else if (daysOld < 30) riskLevel = "Yüksek";
          else if (daysOld < 90) riskLevel = "Orta";

          // "Selam Ver" Butonu
          const button = new ButtonBuilder()
            .setCustomId(`selamver_${member.id}`)
            .setLabel("Selam Ver")
            .setStyle(ButtonStyle.Success);

          if (emojiler?.elsallama) {
            try { button.setEmoji(emojiler.elsallama); } catch { button.setEmoji("👋"); }
          } else {
            button.setEmoji("👋");
          }
          const row = new ActionRowBuilder().addComponents(button);

          const payload = {
            content: `🟢 <@${member.id}> **Merheba,Sunucumuza** **hoşgeldin!**${hedefBilgi}`,
            components: [row],
            files: []
          };

          // Resimli Giriş Kartı (Seçeneğe Göre)
          if (giris.resimli === "evet" && accountCardRenderer.renderAccountCard) {
            try {
              const user = await member.user.fetch(true).catch(() => member.user);
              const images = accountData.getProfileImages ? accountData.getProfileImages(user) : {};
              const image = await accountCardRenderer.renderAccountCard({
                user,
                badges: accountBadges.getBadges ? accountBadges.getBadges(user) : [],
                primaryGuild: accountBadges.getPrimaryGuild ? accountBadges.getPrimaryGuild(user) : null,
                avatarURL: images.cardAvatarURL,
                bannerURL: images.cardBannerURL,
                avatarDecorationURL: images.avatarDecorationURL
              });
              payload.files.push(new AttachmentBuilder(image, { name: "hosgeldin.png" }));
            } catch (err) {
              console.warn("⚠️ [GİRİŞ KARTI] Resim oluşturulamadı, Varsayılan Embed kullanılıyor.");
            }
          }

          // Resim yoksa standart Embed
          if (payload.files.length === 0) {
            const gifUrl = (giris.gifUrl && typeof giris.gifUrl === "string" && giris.gifUrl.startsWith("http"))
              ? giris.gifUrl
              : DEFAULT_WELCOME_GIF;

            const welcomeEmbed = new EmbedBuilder()
              .setColor(userColor)
              .setTitle(`${username} | ${member.id}`)
              .setDescription("**Sunucuya katıldı!**")
              .setThumbnail(member.user?.displayAvatarURL({ dynamic: true, size: 512 }) || null)
              .addFields(
                { name: "• Kullanıcı:", value: `<@${member.id}>`, inline: true },
                { name: "• Risk Seviyesi:", value: riskLevel, inline: true },
                { name: "• Sunucudaki Üye Sayısı:", value: `${currentMembers}`, inline: true },
                { name: "• Hedeflenen Üye Sayısı:", value: `${currentMembers}/${targetMembers}`, inline: true },
                { name: "• Hesap Oluşturulma Tarihi:", value: `${createdDateStr} | ${yearsOld} yıl önce`, inline: false }
              )
              .setImage(gifUrl);

            payload.embeds = [welcomeEmbed];
          }

          await kanal.send(payload).catch(() => {});
        }
      }
    } catch (err) { console.error("🔴 [GİRİŞ EVENTİ HATASI]", err); }

    // 3. Karşılama DM Mesajı (Varsa)
    if (dmCard.createDmWelcomeCard) {
      try {
        const imageBuffer = await dmCard.createDmWelcomeCard(member);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'hosgeldin.png' });
        await member.send({
          content: `${emojiler.pikachuselam || "👋"} **Selam!** <@${member.user.id}> Aramıza hoş geldin!\n🌺 __${member.guild.name}__ ailesine katıldığın için çok mutluyuz 🌟`,
          files: [attachment]
        }).catch(() => {});
      } catch {}
    }

    // 4. Ghost Ping İşlemi
    try {
      const pingDB = safeLoadJSON(pingDBPath);
      const channels = pingDB[member.guild.id];
      if (Array.isArray(channels)) {
        for (const channelId of channels) {
          const channel = member.guild.channels.cache.get(channelId);
          if (channel) {
            const msg = await channel.send(`<@${member.id}>`);
            setTimeout(() => msg.delete().catch(() => {}), 1000);
          }
        }
      }
    } catch {}
  }
};