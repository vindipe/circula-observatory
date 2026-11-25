import type { Key, Topic } from './copy'

export interface ResourcePath {
  id: string
  resource: Key
  measure: Key
  area: Key
  question: Key
  figure: Topic
  target: {view:string; asset:string; metric:string}
  unit?: Key | '%'
}
export const resourcePaths: ResourcePath[] = [
  {id:'history',resource:'blocks',measure:'history',area:'infrastructure',question:'hq',figure:'history',target:{view:'history',asset:'btc',metric:'history_gb'}},
  {id:'records',resource:'transactions',measure:'txHistory',area:'infrastructure',question:'txQuestion',figure:'circulation',unit:'txUnit',target:{view:'indicator',asset:'btc',metric:'transactions'}},
  {id:'inactive',resource:'outputs',measure:'inactive',area:'holdings',question:'iq',figure:'inactive',target:{view:'inactive',asset:'btc',metric:'inactive_365d'}},
  {id:'balances',resource:'balances',measure:'bound',area:'holdings',question:'floorQuestion',figure:'context',unit:'%',target:{view:'indicator',asset:'btc',metric:'inactiveFloor'}},
  {id:'circulation',resource:'transferEvents',measure:'transferMean',area:'circulation',question:'transfersQuestion',figure:'circulation',unit:'transferUnit',target:{view:'indicator',asset:'btc',metric:'transfers30d'}},
  {id:'expiration',resource:'state',measure:'expiration',area:'expiration',question:'eq',figure:'expiration',target:{view:'expiration',asset:'xlm',metric:'ttl_events'}},
]
