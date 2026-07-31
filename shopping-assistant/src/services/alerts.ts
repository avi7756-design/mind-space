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

  const crossedTarget = previousPrice > item.targetPrice && newPrice <= item.targetPrice;
  const bigDrop = newPrice < previousPrice && (previousPrice - newPrice) / previousPrice >= 0.05;

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
  const direction = newScore < previousScore ? 'ירד' : 'עלה';
  const channels = enabledChannels(channelSettings);
  return {
    id: newId('alert'),
    type: 'trust_change',
    title: 'שינוי בציון אמינות ספק',
    message: `ציון האמינות של ${supplierName} ${direction} מ‑${previousScore} ל‑${newScore}`,
    channels,
    status: channels.length > 0 ? 'sent' : 'pending',
    createdAt: new Date().toISOString(),
    supplierName,
  };
}
