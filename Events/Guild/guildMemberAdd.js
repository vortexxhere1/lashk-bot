const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Canvas = require('canvas');
const path = require('path');
const fs = require('../../Utils/Core/databaseFs');
const emojiler = require('../../Utils/Emojis/emojiler.js');
const { trackMemberInvite } = require('../../Utils/Membership/inviteTracker');
const { createDmWelcomeCard } = require('../../Utils/Media/dmWelcomeCard');

const girisDBPath = path.join(__dirname, '../../Database/Sunucu Yönetimi/girisCikis.json');
const pingDBPath = path.join(__dirname, '../../Database/Güvenlik ve Moderasyon/girisPing.json');

function safeLoadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`🔴 [GİRİŞ EVENT - DB HATASI] ${filePath} okunamadı`, err.message);
    return {};
  }
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      await trackMemberInvite(member).catch(err => {
        console.warn(`⚠️ [DAVET] ${member.user.tag} için davet kaydı alınamadı`, err.message);
      });

      // GİRİŞ MESAJI SİSTEMİ
      const girisData = safeLoadJSON(girisDBPath);
      const guildData = girisData[member.guild.id] || {}; 
      const giris = guildData.giris || {};

      if (giris.kanal) {
        const kanal = member.guild.channels.cache.get(giris.kanal);
        if (kanal) {
          let mesaj = `Sunucuya hoş geldin!`;
          if (giris.mesaj) {
            mesaj = giris.mesaj.replace(/{user}/g, `<@${member.id}>`);
          }

          if (giris.otoRol) {
            const rol = member.guild.roles.cache.get(giris.otoRol);
            if (rol) {
              await member.roles.add(rol, 'Oto-rol sistemi aktif').catch(err =>
                console.warn(`⚠️ [OTO ROL] ${member.user.tag} ${err.message}`)
              );
            }
          }

          // EMOJI HATASINI ÖNLEYEN GÜVENLİ KONTROL
          const emojiVal = (typeof emojiler.elsallama === 'string' && emojiler.elsallama.trim() !== '') 
            ? emojiler.elsallama 
            : '👋';

          const buton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`selamver_${member.id}`)
              .setLabel('Selam Ver')
              .setStyle(ButtonStyle.Success)
              .setEmoji(emojiVal)
          );

          let hedefBilgi = '';
          if (giris.hedefUye && !isNaN(giris.hedefUye)) {
            const hedef = parseInt(giris.hedefUye, 10);
            const toplam = member.guild.memberCount;
            const kalan = hedef - toplam;
            hedefBilgi = `\n-# Hedef ${hedef} • Kalan ${kalan > 0 ? kalan : 0}`;
          }

          const payload = {
            content: `${mesaj} ${emojiler.girisok || '📥'} <@${member.id}> ( ${member.user.username} )${hedefBilgi}`,
            components: [buton]
          };

          // --- CANVAS HOŞ GELDİN KARTI ---
          try {
            const canvas = Canvas.createCanvas(1280, 720);
            const ctx = canvas.getContext('2d');

            // Projenin kök dizinindeki assets klasöründen resmi çağırır
            const bgPath = path.join(process.cwd(), 'assets/giris-background.png');
            const background = await Canvas.loadImage(bgPath);
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            const centerX = 350;

            // HOŞ GELDİN yazısı
            ctx.font = 'bold 70px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('HOŞ GELDİN!', centerX, 550);

            // Kullanıcı adı
            ctx.font = '45px sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText(`@${member.user.username}`, centerX, 620);

            // Profil Fotoğrafı (Avatar)
            ctx.beginPath();
            ctx.arc(centerX, 320, 125, 0, Math.PI * 2, true); 
            ctx.closePath();
            ctx.clip(); 

            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarURL);
            ctx.drawImage(avatar, centerX - 125, 320 - 125, 250, 250);

            payload.files = [new AttachmentBuilder(canvas.toBuffer(), { name: 'hosgeldin.png' })];
          } catch (err) {
            console.error('🔴 [GİRİŞ KARTI HATASI]', err);
          }

          await kanal.send(payload).catch(err => console.error('🔴 [GİRİŞ MESAJI GÖNDERİLEMEDİ]', err.message));
        }
      }

      // DM MESAJI SİSTEMİ
      try {
        const imageBuffer = await createDmWelcomeCard(member);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'hosgeldin.png' });
        await member.send({
            content: `${emojiler.pikachuselam || '👋'} Selam! <@${member.user.id}> Aramıza hoş geldin! \n🌺 __${member.guild.name}__ ailesine katıldığın için çok mutluyuz 🌟 \n${emojiler.redheart || '❤️'} __Güzel zaman geçirmen dileğiyle! İyi günler diliyorum!__ 🙃`,
            files: [attachment]
        });
      } catch (err) {
        console.warn(`⚠️ [DM MESAJ] DM gönderilemedi ${member.user.tag}`);
      }

      // GHOST PING SİSTEMİ
      const pingDB = safeLoadJSON(pingDBPath);
      const channels = pingDB[member.guild.id];
      let tagDuration = 1000;
      
      if (pingDB._ayarlar && pingDB._ayarlar[member.guild.id]) {
         const configuredTagDuration = Number(pingDB._ayarlar[member.guild.id].etiketSuresi);
         if (Number.isFinite(configuredTagDuration) && configuredTagDuration >= 500 && configuredTagDuration <= 60000) {
             tagDuration = Math.round(configuredTagDuration);
         }
      }

      if (channels && Array.isArray(channels) && channels.length > 0) {
        for (const channelId of channels) {
          const channel = member.guild.channels.cache.get(channelId);
          if (!channel) continue;
          try {
            const msg = await channel.send(`<@${member.id}>`);
            setTimeout(() => msg.delete().catch(() => {}), tagDuration);
          } catch (err) {
            console.warn(`⚠️ [GHOST PING] ${channelId} ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`🔴 [GUILD MEMBER ADD GENEL HATA] ${member?.user?.tag}`, err);
    }
  }
};