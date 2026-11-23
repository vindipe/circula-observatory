import type { Entity } from '../shared/model'

const evm = (id: string | number) => 'eip155:' + id
const nativeNetworks: Record<string, [string, string]> = {
  btc: ['network:btc', 'Bitcoin'],
  ada: ['network:ada', 'Cardano'],
  algo: ['network:algo', 'Algorand'],
  avaxc: [evm(43114), 'Avalanche C-Chain'],
  avaxp: ['network:avaxp', 'Avalanche P-Chain'],
  avaxx: ['network:avaxx', 'Avalanche X-Chain'],
  bch: ['network:bch', 'Bitcoin Cash'],
  bsv: ['network:bsv', 'Bitcoin SV'],
  btg: ['network:btg', 'Bitcoin Gold'],
  dash: ['network:dash', 'Dash'],
  dcr: ['network:dcr', 'Decred'],
  dgb: ['network:dgb', 'DigiByte'],
  doge: ['network:doge', 'Dogecoin'],
  eos: ['network:eos', 'EOS'],
  eth: [evm(1), 'Ethereum'],
  etc: [evm(61), 'Ethereum Classic'],
  flow_evm: [evm(747), 'Flow EVM'],
  flow_native: ['network:flow', 'Flow native'],
  grin: ['network:grin', 'Grin'],
  icp: ['network:icp', 'Internet Computer'],
  ltc: ['network:ltc', 'Litecoin'],
  neo: ['network:neo', 'NEO'],
  trx: ['network:trx', 'TRON'],
  vtc: ['network:vtc', 'Vertcoin'],
  xem: ['network:xem', 'NEM'],
  xlm: ['network:xlm', 'Stellar'],
  xmr: ['network:xmr', 'Monero'],
  xrp: ['network:xrp', 'XRP Ledger'],
  xtz: ['network:xtz', 'Tezos'],
  xvg: ['network:xvg', 'Verge'],
  zec: ['network:zec', 'Zcash'],
  sol: ['network:sol', 'Solana'],
  sui: ['network:sui', 'Sui'],
  near: ['network:near', 'NEAR'],
  dot: ['network:dot', 'Polkadot'],
  atom: ['network:atom', 'Cosmos Hub'],
  apt: ['network:apt', 'Aptos'],
  stx: ['network:stx', 'Stacks'],
  ton: ['network:ton', 'TON'],
}

const deploymentNetworks: Record<string, string> = {
  ethereum: evm(1), 'ethereum mainnet': evm(1), base: evm(8453), optimism: evm(10),
  arbitrum: evm(42161), 'arbitrum one': evm(42161), polygon: evm(137),
  'bnb smart chain': evm(56), 'binance smart chain': evm(56), avalanche: evm(43114),
  solana: 'network:sol', stellar: 'network:xlm', tron: 'network:trx',
}

export function coinAsset(coin: string, name: string): Entity {
  const deployment = /\s+on\s+(.+)$/i.exec(name)
  const onNetwork = deployment ? deploymentNetworks[deployment[1].toLowerCase()] : undefined
  const native = nativeNetworks[coin]
  return {
    id: 'asset:' + coin,
    name,
    symbol: (onNetwork ? coin.split('_')[0] : coin).toUpperCase(),
    kind: 'asset',
    category: onNetwork ? 'Token deployment' : native ? 'Native asset' : 'Cryptoasset',
    source: 'coin',
    testnet: 0,
    network_id: onNetwork ?? native?.[0] ?? null,
    website: null,
    description: onNetwork ? 'Ledger-specific deployment as scoped by Coin Metrics.' : null,
  }
}

export function coinNetwork(coin: string, name?: string): Entity {
  const native = nativeNetworks[coin]
  return {
    id: native?.[0] ?? 'network:' + coin,
    name: native?.[1] ?? name ?? coin.toUpperCase(),
    kind: 'network',
    category: coin === 'flow' ? 'Provider aggregate' : 'Ledger network',
    source: 'coin',
    symbol: coin.toUpperCase(),
    testnet: 0,
    network_id: null,
    website: null,
    description: coin === 'flow' ? 'Coin Metrics FLOW reporting scope overlaps the network-specific Flow series.' : null,
  }
}

export const additionalNetworks = Object.keys(nativeNetworks).map(coin => coinNetwork(coin))

export const wikiProjects = [
  { id: 'system:enwiki', name: 'English Wikipedia', project: 'en.wikipedia.org', website: 'https://en.wikipedia.org/' },
  { id: 'system:wikidata', name: 'Wikidata', project: 'www.wikidata.org', website: 'https://www.wikidata.org/' },
  { id: 'system:commons', name: 'Wikimedia Commons', project: 'commons.wikimedia.org', website: 'https://commons.wikimedia.org/' },
]

export const stellarKeys = [
  {
    id: 'protocol:soroswap', name: 'Soroswap',
    subject: 'Soroswap Router contract instance',
    address: 'CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH',
    key: 'AAAABgAAAAEN1ccQ6mpKI7MiB/0TDq35yc6Jn0MI6T5P/lP7rxCKBAAAABQAAAAB',
    website: 'https://github.com/soroswap/core',
  },
  {
    id: 'protocol:blend', name: 'Blend',
    subject: 'Blend V2 Backstop contract instance',
    address: 'CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7',
    key: 'AAAABgAAAAEhCPZWDdSDZU8ORn2pnTQ6ak3qD9ICiQ1eQi7a70qibQAAABQAAAAB',
    website: 'https://docs.blend.capital/mainnet-deployments',
  },
]

export const operationalEntities: Entity[] = [
  ...additionalNetworks,
  ...wikiProjects.map(project => ({
    id: project.id, name: project.name, kind: 'system' as const, category: 'Web publishing',
    symbol: null, source: 'wikimedia' as const, network_id: null, website: project.website,
    description: 'A bounded web publishing system measured by Wikimedia Analytics.', testnet: 0,
  })),
  ...stellarKeys.map(item => ({
    id: item.id, name: item.name, kind: 'protocol' as const, category: 'Smart contract protocol',
    symbol: null, source: 'stellar' as const, network_id: 'network:xlm', website: item.website,
    description: item.subject + ' on Stellar mainnet. Tracked address ' + item.address + '.', testnet: 0,
  })),
]

export interface Sql {
  sql: string
  args: (string | number | null)[]
}

export const statement = (sql: string, ...args: Sql['args']): Sql => ({ sql, args })

export function putEntities(entities: Entity[]) {
  return statement(`
    INSERT INTO entities (id, name, kind, category, symbol, source, network_id, website, description, testnet)
    SELECT value->>0, value->>1, value->>2, value->>3, value->>4, value->>5, value->>6, value->>7, value->>8, value->>9
    FROM json_each(?) WHERE 1
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category, symbol = excluded.symbol,
      network_id = excluded.network_id, website = excluded.website, description = excluded.description, testnet = excluded.testnet
    WHERE entities.source = excluded.source
      AND (entities.name, entities.category, entities.symbol, entities.network_id, entities.website, entities.description, entities.testnet)
        IS NOT (excluded.name, excluded.category, excluded.symbol, excluded.network_id, excluded.website, excluded.description, excluded.testnet)
  `, JSON.stringify(entities.map(e => [
    e.id, e.name, e.kind, e.category, e.symbol, e.source, e.network_id, e.website, e.description, e.testnet,
  ])))
}

export function tokenRelations(assets: Entity[]) {
  const pairs = assets.filter(asset => asset.network_id && asset.category === 'Token deployment' && asset.id.includes('_'))
    .map(asset => [asset.id, asset.id.split('_')[0], 'Deployment of'])
  return statement(`
    INSERT OR IGNORE INTO relations (entity_id, target_id, label)
    SELECT value->>0, value->>1, value->>2 FROM json_each(?)
  `, JSON.stringify(pairs))
}

export function registryStatements(raw: string, now: number) {
  return [
    statement(`
      INSERT INTO entities (id,name,kind,category,symbol,source,network_id,website,description,testnet)
      SELECT 'eip155:' || (value -> '$.chainId'), value->>'$.name', 'network',
        CASE WHEN value->>'$.parent.type' = 'L2' THEN 'EVM layer 2' ELSE 'EVM network' END,
        value->>'$.nativeCurrency.symbol','evm-registry',
        replace(value->>'$.parent.chain','eip155-','eip155:'),value->>'$.infoURL',
        'EIP-155 chain ID ' || (value -> '$.chainId') || '. Registry status ' ||
          coalesce(value->>'$.status','active') || '.',
        CASE WHEN lower(value->>'$.name') GLOB '*testnet*'
          OR lower(value->>'$.name') GLOB '*sepolia*'
          OR lower(value->>'$.name') GLOB '*goerli*'
          OR lower(value->>'$.name') GLOB '*holesky*'
          OR value->>'$.status' = 'deprecated' THEN 1 ELSE 0 END
      FROM json_each(?) WHERE json_type(value,'$.chainId') IN ('integer','real')
        AND json_type(value,'$.name')='text'
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, category=excluded.category, symbol=excluded.symbol, source=excluded.source,
        network_id=excluded.network_id, website=excluded.website, description=excluded.description, testnet=excluded.testnet
      WHERE (entities.name, entities.category, entities.symbol, entities.source, entities.network_id,
        entities.website, entities.description, entities.testnet) IS NOT
        (excluded.name, excluded.category, excluded.symbol, excluded.source, excluded.network_id,
        excluded.website, excluded.description, excluded.testnet)
    `, raw),
    statement(`
      INSERT INTO jobs (id,source,payload,cadence_minutes,next_at)
      SELECT 'evm:' || (chain.value -> '$.chainId'), 'evm-rpc',
        json_object('entity','eip155:' || (chain.value -> '$.chainId'),'endpoint',min(rpc.value)),
        1440, ?
      FROM json_each(?) AS chain JOIN json_each(chain.value,'$.rpc') AS rpc
      JOIN entities e ON e.id='eip155:' || (chain.value -> '$.chainId')
      WHERE rpc.type='text' AND rpc.value GLOB 'https://*.publicnode.com'
        AND e.testnet=0 AND e.name NOT IN ('Mumbai','Amoy')
      GROUP BY e.id
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, enabled=1
      WHERE jobs.payload<>excluded.payload OR jobs.enabled=0
    `, now, raw),
  ]
}
