/** Envoie un message de test dans chaque salon, pour vérifier les webhooks. Lancé par le workflow `alert-test`. */
import { COLORS, sendDiscord, type Channel } from './discord.ts';

const channels: { channel: Channel; label: string; color: number }[] = [
  { channel: 'critical', label: 'alertes-critiques', color: COLORS.urgent },
  { channel: 'feed', label: 'fil', color: COLORS.accent },
];

let missing = 0;
for (const { channel, label, color } of channels) {
  const ok = await sendDiscord(channel, [{
    title: `Test du salon ${label}`,
    description: 'Si tu lis ceci, Riftbound Tracker peut poster ici.',
    color,
    timestamp: new Date().toISOString(),
  }]);
  console.log(`${label} : ${ok ? 'envoyé' : 'webhook absent'}`);
  if (!ok) missing++;
}
if (missing > 0) process.exitCode = 1;
