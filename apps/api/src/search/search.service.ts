import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';

export interface ProductSearchDocument {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  metal?: string | null;
  purity?: string | null;
  gemstone?: string | null;
  tags: string[];
  minPrice: number;
  imageUrl?: string | null;
}

const PRODUCTS_INDEX = 'products';

/**
 * Product search backed by Meilisearch. Failures are logged, never thrown, so the
 * catalogue keeps working (with DB fallback) when the search node is unavailable.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: MeiliSearch;

  constructor(config: ConfigService) {
    this.client = new MeiliSearch({
      host: config.get<string>('search.host')!,
      apiKey: config.get<string>('search.apiKey'),
    });
  }

  async onModuleInit() {
    try {
      await this.client.index(PRODUCTS_INDEX).updateSettings({
        searchableAttributes: ['name', 'tags', 'gemstone', 'category', 'metal', 'description'],
        filterableAttributes: ['category', 'metal', 'purity', 'gemstone', 'minPrice'],
        sortableAttributes: ['minPrice'],
      });
    } catch (err) {
      this.logger.warn(`Search unavailable: ${(err as Error).message}`);
    }
  }

  async indexProducts(docs: ProductSearchDocument[]) {
    if (!docs.length) return;
    try {
      await this.client.index(PRODUCTS_INDEX).addDocuments(docs, { primaryKey: 'id' });
    } catch (err) {
      this.logger.warn(`Failed to index products: ${(err as Error).message}`);
    }
  }

  async removeProduct(id: string) {
    try {
      await this.client.index(PRODUCTS_INDEX).deleteDocument(id);
    } catch (err) {
      this.logger.warn(`Failed to remove product ${id}: ${(err as Error).message}`);
    }
  }

  async searchProducts(query: string, opts: { filter?: string[]; limit?: number; offset?: number }) {
    return this.client.index<ProductSearchDocument>(PRODUCTS_INDEX).search(query, {
      filter: opts.filter,
      limit: opts.limit ?? 24,
      offset: opts.offset ?? 0,
    });
  }
}
