import type { Point } from '../shared/model'
import { statement, type Sql } from './catalog'

export function pointStatements(points: Point[]) {
  const payload = JSON.stringify(points.map(p => [
    p.entity_id, p.metric_id, p.day, p.value, p.unit, p.observed_at, p.collected_at, p.context,
  ]))
  return [
    statement(`
      INSERT INTO observations (entity_id,metric_id,day,value,unit,observed_at,collected_at,context)
      SELECT value->>0,value->>1,value->>2,value->>3,value->>4,value->>5,value->>6,value->>7
      FROM json_each(?) WHERE 1
      ON CONFLICT(entity_id,metric_id,day) DO UPDATE SET
        value=excluded.value, unit=excluded.unit, observed_at=excluded.observed_at,
        collected_at=excluded.collected_at, context=excluded.context,
        revision=observations.revision + 1
      WHERE excluded.observed_at>=observations.observed_at
        AND excluded.collected_at>observations.collected_at
        AND (observations.value,observations.unit,observations.observed_at,observations.context)
          IS NOT (excluded.value,excluded.unit,excluded.observed_at,excluded.context)
    `, payload),
    statement(`
      WITH affected AS (
        SELECT DISTINCT value->>0 AS entity_id, value->>1 AS metric_id FROM json_each(?)
      )
      INSERT INTO coverage (entity_id,metric_id,unit,first_day,last_day,last_value,observed_at,collected_at)
      SELECT o.entity_id,o.metric_id,o.unit,
        (SELECT min(day) FROM observations WHERE entity_id=o.entity_id AND metric_id=o.metric_id),
        o.day,o.value,o.observed_at,o.collected_at
      FROM affected a JOIN observations o USING (entity_id,metric_id)
      WHERE o.day=(SELECT max(day) FROM observations WHERE entity_id=a.entity_id AND metric_id=a.metric_id)
      ON CONFLICT(entity_id,metric_id) DO UPDATE SET
        unit=excluded.unit, first_day=excluded.first_day, last_day=excluded.last_day,
        last_value=excluded.last_value, observed_at=excluded.observed_at, collected_at=excluded.collected_at
      WHERE (coverage.unit,coverage.first_day,coverage.last_day,coverage.last_value,coverage.observed_at,coverage.collected_at)
        IS NOT (excluded.unit,excluded.first_day,excluded.last_day,excluded.last_value,excluded.observed_at,excluded.collected_at)
    `, payload),
  ]
}

export const applySql = (db: D1Database, queries: Sql[]) =>
  db.batch(queries.map(query => db.prepare(query.sql).bind(...query.args)))
