const { EmbedBuilder } = require("discord.js");
const path = require("path");

function safeRequire(relativePath) {
  try { return require(relativePath); } catch { return null; }
}

const fs = safeRequire("../../Utils/Core/databaseFs") || require("fs");
const emojiler = safeRequire("../../Utils/Emojis/emojiler.js") || {};
const inviteTracker = safeRequire("../../Utils/Membership/inviteTracker") || {};

const markMemberLeft = inviteTracker.markMemberLeft || (() => {});
const girisDBPath = path.join(__dirname, "../../Database/Sunucu Yönetimi/girisCikis.json");

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
    return "#EF4444";
  } catch { return "#EF4444"; }
}

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    if (!member || !member.guild) return;

    // 1. Davet Çıkış Kaydı
    try { markMemberLeft(member); } catch {}

    // 2. Çıkış Mesajı İşlemleri
    try {
      const dbData = safeLoadJSON(girisDBPath);
      const guildData = dbData[member.guild.id];
      const girisCikisAktif = guildData?.aktif ?? Boolean(guildData?.giris?.kanal || guildData?.cikis?.kanal);

      if (girisCikisAktif && guildData?.cikis?.kanal) {
        const cikis = guildData.cikis;
        const kanal = member.guild.channels.cache.get(cikis.kanal);

        if (kanal) {
          const currentMembers = member.guild.memberCount || 0;
          let targetMembers = Math.ceil((currentMembers || 1) / 100) * 100;
          const hedefUye = cikis.hedefUye || guildData?.giris?.hedefUye;
          if (hedefUye && !isNaN(hedefUye)) targetMembers = parseInt(hedefUye, 10);
          const kalan = Math.max(0, targetMembers - currentMembers);

          const username = member.user?.username || "Kullanıcı";
          const userColor = await getUserColor(member);
          const cikisEmoji = emojiler.cikisOk || "➖";

          const goodbyeEmbed = new EmbedBuilder()
            .setColor(userColor)
            .setTitle(`${username} | ${member.id}`)
            .setDescription("**Sunucudan ayrıldı!**")
            .setThumbnail(member.user?.displayAvatarURL({ dynamic: true, size: 512 }) || null)
            .addFields(
              { name: "• Kullanıcı:", value: `<@${member.id}>`, inline: true },
              { name: "• Sunucudaki Üye Sayısı:", value: `${currentMembers}`, inline: true },
              { name: "• Hedeflenen Üye Sayısı:", value: `${currentMembers}/${targetMembers}`, inline: true }
            )
            .setTimestamp();

          await kanal.send({
            content: `${cikisEmoji} <@${member.id}> **(** ${username} **)** sunucudan **ayrıldı.**\n-# Hedef: ${targetMembers} • Kalan: ${kalan}`,
            embeds: [goodbyeEmbed]
          }).catch(() => {});
        }
      }
    } catch (err) { console.error("🔴 [ÇIKIŞ EVENTİ HATASI]", err); }
  }
};