import type {
  BubblemapsChain,
  BubblemapsScanReport,
  ChainDetails,
  TokenDetails,
  TokenHolder,
  TokenMap,
  TokenMetrics
} from '../../src/shared/bubblemaps';
import {
  ChainDetailsSchema,
  TokenDetailsSchema,
  TokenHolderSchema,
  TokenMapSchema,
  TokenMetricsSchema
} from '../../src/shared/bubblemaps-schema';
import { BubblemapsClient, BUBBLEMAPS_CHAIN_CACHE_TTL_MS, BUBBLEMAPS_DEFAULT_CACHE_TTL_MS } from './client';
import { TtlCache } from './cache';
import { validateBubblemapsRequest } from './validation';

export class BubblemapsReportService {
  private readonly reportCache = new TtlCache();
  private readonly reportInflight = new Map<string, Promise<BubblemapsScanReport>>();

  constructor(private readonly client: BubblemapsClient) {}

  async buildReport(chain: BubblemapsChain, address: string): Promise<BubblemapsScanReport> {
    validateBubblemapsRequest(chain, address);
    const reportCacheKey = `report:${chain}:${address.toLowerCase()}`;
    const cached = this.reportCache.get(reportCacheKey);
    if (cached) return cached.value as BubblemapsScanReport;

    const inflight = this.reportInflight.get(reportCacheKey);
    if (inflight) return inflight;

    const request = this.fetchReport(chain, address, reportCacheKey)
      .finally(() => {
        this.reportInflight.delete(reportCacheKey);
      });
    this.reportInflight.set(reportCacheKey, request);
    return request;
  }

  private async fetchReport(chain: BubblemapsChain, address: string, reportCacheKey: string): Promise<BubblemapsScanReport> {
    const encodedChain = encodeURIComponent(chain);
    const encodedAddress = encodeURIComponent(address);
    const cacheBase = `${chain}:${address.toLowerCase()}`;

    const [chains, token, metrics, holders, map] = await Promise.all([
      this.client.fetchEndpoint<ChainDetails[]>({
        path: '/v0/chains',
        cacheKey: 'chains:v0',
        endpointKey: 'chains',
        schema: ChainDetailsSchema.array(),
        ttlMs: BUBBLEMAPS_CHAIN_CACHE_TTL_MS
      }),
      this.client.fetchEndpoint<TokenDetails>({
        path: `/v0/tokens/metadata/${encodedChain}/${encodedAddress}`,
        cacheKey: `token:${cacheBase}`,
        endpointKey: 'token',
        params: { return_token_stats: true },
        schema: TokenDetailsSchema
      }),
      this.client.fetchEndpoint<TokenMetrics>({
        path: `/v0/tokens/metrics/${encodedChain}/${encodedAddress}`,
        cacheKey: `metrics:${cacheBase}`,
        endpointKey: 'metrics',
        schema: TokenMetricsSchema
      }),
      this.client.fetchEndpoint<TokenHolder[]>({
        path: `/v0/tokens/holders/${encodedChain}/${encodedAddress}`,
        cacheKey: `holders:${cacheBase}:250`,
        endpointKey: 'holders',
        params: { limit: 250, return_metadata: true },
        schema: TokenHolderSchema.array()
      }),
      this.client.fetchEndpoint<TokenMap>({
        path: `/v0/tokens/map/${encodedChain}/${encodedAddress}`,
        cacheKey: `map:${cacheBase}:250`,
        endpointKey: 'map',
        params: {
          limit: 250,
          return_nodes: true,
          return_relationships: true,
          return_clusters: true,
          use_magic_nodes: true,
          use_time_nodes: true
        },
        schema: TokenMapSchema
      })
    ]);

    const report: BubblemapsScanReport = {
      chain,
      address,
      generatedAt: new Date().toISOString(),
      source: 'bubblemaps',
      endpoints: { chains, token, metrics, holders, map }
    };

    this.reportCache.set(reportCacheKey, report, BUBBLEMAPS_DEFAULT_CACHE_TTL_MS, report.generatedAt);
    return report;
  }
}
