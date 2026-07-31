import type { Offer, Supplier } from '../types';
import { SUPPLIERS, generateOffersForQuery } from '../data/seed';

/**
 * Integration seam for the future backend / scraper layer.
 *
 * The UI depends only on this interface. Replacing the mock with a real
 * implementation (REST client, scraper service, price API) requires no UI
 * changes — just swap the provider returned by `getSupplierDataProvider`.
 */
export interface SupplierDataProvider {
  /** Free-text (natural language) product search across all suppliers. */
  searchOffers(query: string): Promise<Offer[]>;
  /** The full supplier directory including verification and risk data. */
  listSuppliers(): Promise<Supplier[]>;
  /** Latest price for a tracked product at a specific supplier. */
  fetchCurrentPrice(query: string, supplierId: string): Promise<number | null>;
}

/** Simulated network latency so loading states behave like production. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MockSupplierDataProvider implements SupplierDataProvider {
  async searchOffers(query: string): Promise<Offer[]> {
    await delay(600 + Math.random() * 500);
    return generateOffersForQuery(query);
  }

  async listSuppliers(): Promise<Supplier[]> {
    await delay(150);
    return SUPPLIERS;
  }

  async fetchCurrentPrice(query: string, supplierId: string): Promise<number | null> {
    await delay(300);
    const offers = generateOffersForQuery(query);
    const offer = offers.find((o) => o.supplierId === supplierId) ?? offers[0];
    return offer ? offer.basePrice + offer.shippingCost + offer.taxEstimate : null;
  }
}

// Placeholder for the real client. VITE_API_BASE_URL is empty today, so the
// mock provider is always used; once a backend exists, implement
// `HttpSupplierDataProvider` and return it here when the URL is configured.
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

let provider: SupplierDataProvider | null = null;

export function getSupplierDataProvider(): SupplierDataProvider {
  if (!provider) {
    provider = new MockSupplierDataProvider();
    if (API_BASE_URL) {
      console.info(`[api] VITE_API_BASE_URL is set (${API_BASE_URL}) — real client not implemented yet, using mock.`);
    }
  }
  return provider;
}
