const fs = require("../../Utils/Core/databaseFs");
const path = require("path");
const emojiler = require("../../Utils/Emojis/emojiler.js");
const { markMemberLeft } = require("../../Utils/Membership/inviteTracker");

// Veritabanını güvenli okumak için fonksiyon (Dosya bozuksa botun çökmesini önler)
function safeLoadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`🔴 [ÇIKIŞ EVENT - DB HATASI] ${filePath} okunamadı:`, err.message);
    return {};
  }
}

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    // 1. DAVET TAKİP SİSTEMİ (Arka planda çalışır)
    try {
      markMemberLeft(member);
    } catch (err) {
      console.warn(`⚠️ [DAVET] ${member.user.tag} için çıkış kaydı işlenemedi:`, err.message);
    }

    // 2. ÇIKIŞ MESAJI SİSTEMİ
    const sendLeaveMessage = async () => {
      try {
        const dbPath = path.join(__dirname, "../../Database/Sunucu Yönetimi/girisCikis.json");
        const data = safeLoadJSON(dbPath);
        const guildData = data[member.guild.id];

        if (!guildData || !guildData.cikis) return;

        // Sistem aktif mi kontrolü
        const girisCikisAktif = guildData.aktif ?? Boolean(guildData.giris?.kanal || guildData.cikis?.kanal);
        if (!girisCikisAktif) return;

        const kanalId = guildData.cikis.kanal;
        const kanal = member.guild.channels.cache.get(kanalId);
        
        if (kanal) {
          let hedefBilgi = "";
          const hedefUye = guildData.cikis.hedefUye || guildData.giris?.hedefUye;
          
          if (hedefUye && !isNaN(hedefUye)) {
            const hedef = parseInt(hedefUye, 10);
            const toplam = member.guild.memberCount;
            const kalan = hedef - toplam;
            // Markdown formatını sadece hedef varsa ekliyoruz
            hedefBilgi = `\n-# Hedef: ${hedef} • Kalan: ${kalan > 0 ? kalan : 0}`;
          }

          // Mesajı kanala gönderiyoruz (Yetki yoksulluğu gibi hatalara karşı catch ekledik)
          await kanal.send({
            content: `${emojiler.cikisOk} ${member} **(** ${member.user.username} **)** sunucudan **ayrıldı.**${hedefBilgi}`
          }).catch(err => {
            console.warn(`⚠️ [ÇIKIŞ MESAJI] ${kanal.id} kanalına mesaj atılamadı (Yetki eksik olabilir):`, err.message);
          });
        }
      } catch (err) {
        console.error(`🔴 [ÇIKIŞ SİSTEMİ HATASI] ${member.user.tag}:`, err);
      }
    };

    // Fonksiyonu çalıştırıyoruz (await olmadan, böylece botu meşgul etmez)
    sendLeaveMessage();
  }
};