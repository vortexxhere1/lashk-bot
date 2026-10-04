const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

async function createSupportPanelPayload(guild, client) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Destek Sistemi')
    .setDescription('Sunucumuzda yardıma mı ihtiyacınız var? Aşağıdaki butona tıklayarak bir destek talebi (ticket) oluşturabilirsiniz.')
    .setColor('#5865F2')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('destek_olustur')
      .setLabel('Destek Talebi Oluştur')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫')
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

module.exports = {
  createSupportPanelPayload
};