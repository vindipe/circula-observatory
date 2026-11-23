INSERT OR IGNORE INTO jobs (id,source,payload,cadence_minutes,next_at) VALUES
  ('coin-plan','coin','{}',10080,0),
  ('coin-catalog','coin','{}',10080,1),
  ('evm-registry','evm-registry','{}',10080,2),
  ('stellar-contracts','stellar','{}',360,3),
  ('solana-supply','solana','{}',1440,4),
  ('wiki-enwiki','wikimedia','{"project":"en.wikipedia.org","entity":"system:enwiki"}',1440,5),
  ('wiki-commons','wikimedia','{"project":"commons.wikimedia.org","entity":"system:commons"}',1440,6),
  ('wiki-wikidata','wikimedia','{"project":"www.wikidata.org","entity":"system:wikidata"}',1440,7);
