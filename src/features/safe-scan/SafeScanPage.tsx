import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, Shield } from 'lucide-react';
import {
  type BubblemapsChain,
  type BubblemapsScanReport,
  type EndpointResult,
  type TokenDetails,
  getBubblemapsChainLabel,
  isLikelyBubblemapsAddress,
  normalizeBubblemapsChain
} from '../../shared/bubblemaps';
import { AtlasPanel } from './AtlasPanel';
import { formatCompact, shortenAddress } from './format';
import { endpointData, inferredTotalSupply, labelMap, largestCluster } from './safe-scan-data';
import { type DetectedTokenNetwork, SafeScanService } from './safe-scan-service';
import { SafeScanEmptyState } from './SafeScanEmptyState';
import {
  ClusterRiskPanel,
  HolderConcentrationPanel,
  ScorePanel,
  SupplyExposurePanel
} from './SafeScanPanels';
import { Card, MetricCard, StatusPill } from './ui';

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function endpointMessage(name: string, result: EndpointResult) {
  if (result.status === 'available') return result.data ? `${name} returned data.` : `${name} returned an empty response.`;
  if (result.status === 'missing') return `${name} is not indexed by Bubblemaps for this token.`;
  if (result.status === 'unsupported') return `${name} is not supported for this chain or address.`;
  if (result.status === 'rate_limited') return `${name} was rate limited by Bubblemaps. Try again shortly.`;
  if (result.status === 'not_configured') return 'Bubblemaps API key is not configured.';
  return result.error || `${name} could not be loaded.`;
}

function CoverageNotice({ report, token }: { report: BubblemapsScanReport; token: TokenDetails | null }) {
  const watchedEndpoints = [
    ['Metrics', report.endpoints.metrics],
    ['Holders', report.endpoints.holders],
    ['Map', report.endpoints.map]
  ] as const;
  const missingData = watchedEndpoints.filter(([, result]) => result.status !== 'available' || !result.data);
  const tokenNotIndexed = token?.metadata.is_indexed === false;

  if (!tokenNotIndexed && !missingData.length) return null;

  return (
    <Card className="coverage-notice">
      <div className="coverage-copy">
        <span className="section-icon"><AlertTriangle size={20} /></span>
        <div>
          <div className="eyebrow">Bubblemaps coverage</div>
          <h2>{tokenNotIndexed ? 'This token is not indexed yet' : 'Some Bubblemaps data is unavailable'}</h2>
          <p>
            {token
              ? 'Token metadata loaded, but holder, cluster, or map data is missing.'
              : 'Bubblemaps has no metadata, holder, cluster, or map data for this scan.'}
          </p>
        </div>
      </div>
      <div className="coverage-status-grid">
        {watchedEndpoints.map(([name, result]) => (
          <div className="coverage-status-row" key={name}>
            <div>
              <strong>{name}</strong>
              <span>{endpointMessage(name, result)}</span>
            </div>
            <StatusPill result={result} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SafeScanPage() {
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState<BubblemapsChain>('eth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BubblemapsScanReport | null>(null);
  const [detectedNetwork, setDetectedNetwork] = useState<DetectedTokenNetwork | null>(null);
  const [detectingNetwork, setDetectingNetwork] = useState(false);

  const normalizedAddress = address.trim();
  const addressSupported = !normalizedAddress || isLikelyBubblemapsAddress(normalizedAddress, chain);
  const token = endpointData(report?.endpoints.token);
  const metrics = endpointData(report?.endpoints.metrics);
  const holders = endpointData(report?.endpoints.holders) || [];
  const map = endpointData(report?.endpoints.map);
  const clusters = map?.clusters || [];
  const totalSupply = useMemo(() => inferredTotalSupply(clusters, [...(map?.nodes?.top_holders || []), ...holders]), [clusters, holders, map]);
  const labels = useMemo(() => labelMap([...(map?.nodes?.top_holders || []), ...holders]), [holders, map]);
  const topHolder = holders[0];
  const largest = largestCluster(clusters);

  useEffect(() => {
    if (!normalizedAddress || loading) {
      setDetectedNetwork(null);
      setDetectingNetwork(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setDetectingNetwork(true);
      SafeScanService.detectTokenNetwork(normalizedAddress)
        .then((detection) => {
          setDetectedNetwork(detection);
          if (detection && detection.chain !== chain) setChain(detection.chain);
        })
        .catch(() => setDetectedNetwork(null))
        .finally(() => setDetectingNetwork(false));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [normalizedAddress, loading]);

  useEffect(() => {
    const queryAddress = searchParams.get('address')?.trim() || '';
    const queryChain = normalizeBubblemapsChain(searchParams.get('chain') || searchParams.get('network')) || 'eth';
    if (!queryAddress) return;

    setAddress(queryAddress);
    setChain(queryChain);
    if (searchParams.get('autoScan') === '1' && isLikelyBubblemapsAddress(queryAddress, queryChain)) {
      void runScan(queryChain, queryAddress);
    }
  }, []);

  async function runScan(scanChain = chain, scanAddress = normalizedAddress) {
    if (!scanAddress || !isLikelyBubblemapsAddress(scanAddress, scanChain)) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await SafeScanService.scanToken(scanChain, scanAddress));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Bubblemaps scan failed.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setReport(null);
    setError(null);
    setDetectedNetwork(null);
    setDetectingNetwork(false);
    setAddress('');
    setChain('eth');
  }

  if (!report) {
    return (
      <SafeScanEmptyState
        address={address}
        chain={chain}
        loading={loading}
        error={error}
        detectedNetwork={detectedNetwork}
        detectingNetwork={detectingNetwork}
        addressSupported={addressSupported}
        onAddressChange={setAddress}
        onChainChange={setChain}
        onSubmit={(event) => {
          event?.preventDefault();
          void runScan();
        }}
      />
    );
  }

  return (
    <div className="safe-scan-results">
      <Card className="result-hero">
        <div>
          <h1>Bubblemaps Safe Scan</h1>
          <p>Holder concentration, linked wallets, supply exposure, and transfer relationships.</p>
        </div>
        <button type="button" className="primary-button compact" onClick={reset}>
          <Shield size={18} /> New scan
        </button>
      </Card>

      <Card className="token-card">
        <div className="token-heading">
          <div className="token-logo">{token?.metadata.img_url ? <img src={token.metadata.img_url} alt="" /> : (token?.metadata.symbol || 'BM').slice(0, 2)}</div>
          <div>
            <h2>{token?.metadata.name || 'Token report'}</h2>
            <div className="token-meta">
              <span>{token?.metadata.symbol || 'N/A'}</span>
              <span>{getBubblemapsChainLabel(report.chain)}</span>
              <button type="button" onClick={() => navigator.clipboard?.writeText(report.address)} aria-label="Copy token address">
                {shortenAddress(report.address)} <Copy size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="metric-grid token-metric-strip">
          <MetricCard label="Indexed" value={token ? (token.metadata.is_indexed ? 'Yes' : 'No') : 'N/A'} detail="Bubblemaps coverage" />
          <MetricCard label="Transfers" value={formatCompact(token?.stats?.transfers_count)} detail="Indexed transfers" />
          <MetricCard label="First activity" value={formatDate(token?.stats?.min_date)} detail="Earliest indexed transfer" />
          <MetricCard label="Latest activity" value={formatDate(token?.stats?.max_date)} detail="Latest indexed transfer" />
        </div>
      </Card>

      <CoverageNotice report={report} token={token} />
      <ScorePanel metrics={metrics} />
      <SupplyExposurePanel metrics={metrics} topHolder={topHolder} largestCluster={largest} totalSupply={totalSupply} />
      <HolderConcentrationPanel holders={holders} labels={labels} totalSupply={totalSupply} />
      <ClusterRiskPanel map={map} holders={holders} labels={labels} totalSupply={totalSupply} />
      <AtlasPanel map={map} clusters={clusters} labels={labels} />
    </div>
  );
}
