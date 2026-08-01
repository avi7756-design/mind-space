import type {
  AlertChannel,
  AlertChannelSettings,
  AlertRecord,
  WatchlistItem,
} from '../types';
import { newId } from './format';

export function enabledChannels(settings: AlertChannelSettings): AlertChannel[] {
  const channels: AlertChannel[] = [];
  if (settings.email.enabled) channels.push('email');
  if (settings.telegram.enabled) channels.push('telegram');
  if (settings.webhook.enabled) channels.push('webhook');
  return channels;
}

/**
 * The alerts engine: evaluates a watchlist item after a price update and
 * returns the alerts that should be dispatched.
 *
 * Dispatch itself is mocked — in production each channel maps to a delivery
 * integration (email service, Telegram bot API, outgoing webhook) invoked by
 * the backend using the keys from the environment configuration.
 */
export function evaluatePriceChange(
  item: WatchlistItem,
  previousPrice: number,
  newPrice: number,
  channelSettings: AlertChannelSettings,
): AlertRecord[] {
  const channels = enabledChannels(channelSettings);
  const alerts: AlertRecord[] = [];

  // Crossing the target is reported only on the update that actually crosses it:
  // the item must have been strictly above the target beforehand.
  const crossedTarget = previousPrice > item.targetPrice && newPrice <= item.targetPrice;

  // A significant drop stays worth reporting even once the item is already below
  // its target — a further 20% fall is high-value information, not noise.
  // The single exclusion is the boundary case where the previous price sat
  // exactly on the target: that update is neither a crossing nor a drop the user
  // has not effectively already been told about.
  const bigDrop =
    previousPrice !== item.targetPrice &&
    newPrice < previousPrice &&
    (previousPrice - newPrice) / previousPrice >= 0.05;

  if (crossedTarget) {
    alerts.push({
      id: newId('alert'),
      type: 'price_drop',
      title: 'ירידת מחיר מתחת ליעד',
      message: `${item.productName} ירד ל‑${newPrice.toLocaleString('he-IL')} ₪ — מתחת למחיר היעד (${item.targetPrice.toLocaleString('he-IL')} ₪)`,
      channels,
      status: channels.length > 0 ? 'sent' : 'pending',
      createdAt: new Date().toISOString(),
      productName: item.productName,
    });
  } else if (bigDrop) {
    const pct = (((previousPrice - newPrice) / previousPrice) * 100).toFixed(1);
    alerts.push({
      id: newId('alert'),
      type: 'price_drop',
      title: 'ירידת מחיר משמעותית',
      message: `${item.productName} ירד ב‑${pct}% ל‑${newPrice.toLocaleString('he-IL')} ₪`,
      channels,
      status: channels.length > 0 ? 'sent' : 'pending',
      createdAt: new Date().toISOString(),
      productName: item.productName,
    });
  }

  return alerts;
}

export function trustChangeAlert(
  supplierName: string,
  previousScore: number,
  newScore: number,
  channelSettings: AlertChannelSettings,
): AlertRecord {
  const channels = enabledChannels(channelSettings);
  const message =
    newScore === previousScore
      ? `ציון האמינות של ${supplierName} נותר ללא שינוי (${newScore})`
      : `ציון האמינות של ${supplierName} ${newScore < previousScore ? 'ירד' : 'עלה'} מ‑${previousScore} ל‑${newScore}`;
  return {
    id: newId('alert'),
    type: 'trust_change',
    title: 'שינוי בציון אמינות ספק',
    message,
    channels,
    status: channels.length > 0 ? 'sent' : 'pending',
    createdAt: new Date().toISOString(),
    supplierName,
  };
}
