import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {PGlite}=await import(process.argv[2] || '@electric-sql/pglite');
const root=fileURLToPath(new URL('../../',import.meta.url));
const db=new PGlite();
const website='638df471-e15b-4dfb-914b-447083317254';
await db.exec(`
CREATE TABLE session(session_id uuid PRIMARY KEY, website_id uuid, distinct_id text);
CREATE TABLE website_event(event_id uuid PRIMARY KEY, website_id uuid, session_id uuid, created_at timestamptz, event_name text);
CREATE TABLE event_data(website_event_id uuid, data_key text, string_value text, number_value numeric(19,4));
`);
let index=0;
const id=()=>`00000000-0000-4000-8000-${String(++index).padStart(12,'0')}`;
const sessionA=id(),sessionB=id(),sessionC=id();
for(const [session,player] of [[sessionA,'player-a'],[sessionB,'player-a'],[sessionC,'player-b']])
  await db.query('INSERT INTO session VALUES ($1,$2,$3)',[session,website,player]);
async function event(session,name,props={},created='2026-11-19T10:00:00Z'){
  const event=id();
  await db.query('INSERT INTO website_event VALUES ($1,$2,$3,$4,$5)',[event,website,session,created,name]);
  for(const [key,value] of Object.entries(props))
    await db.query('INSERT INTO event_data VALUES ($1,$2,$3,$4)',[event,key,typeof value==='number'?null:String(value),typeof value==='number'?value:null]);
}
const a={expedition_id:'expedition-a',expedition_number:1};
await event(sessionA,'game_opened',a);
await event(sessionA,'expedition_started',a);
await event(sessionA,'flight_started',a);
await event(sessionA,'flight_finished',{...a,outcome:'arrived'});
await event(sessionA,'object_card_opened',{...a,object_id:'proxima'});
await event(sessionA,'theme_changed',{...a,from_theme:'dark',to_theme:'radar'});
await event(sessionA,'active_time',{...a,seconds:30});
// Same player, new Umami session (e.g. changed IP): not a third player.
await event(sessionB,'game_opened',a);
await event(sessionB,'flight_started',a);
await event(sessionB,'flight_finished',{...a,outcome:'stopped_short'});
await event(sessionB,'quest_started',{...a,quest_id:'nearby'});
await event(sessionB,'quest_completed',{...a,quest_id:'nearby'});
// Summary counters are deliberately large: the report must not sum snapshots.
await event(sessionB,'session_summary',{...a,active_seconds:999,flights_started:999});
const b={expedition_id:'expedition-b',expedition_number:1};
await event(sessionC,'game_opened',b);
await event(sessionC,'expedition_started',b);
await event(sessionC,'object_card_opened',{...b,object_id:'sirius'});
await event(sessionC,'flight_started',b);
await event(sessionC,'flight_cancelled',b);
await event(sessionC,'active_time',{...b,seconds:15});
await event(sessionC,'game_opened',b,'2020-01-01T00:00:00Z');

const source=await fs.readFile(root+'/deployment/analytics/report.sql','utf8');
function sql(since,until){
  return source.slice(source.indexOf('WITH events'))
    .replaceAll(":'since'",`'${since}'`).replaceAll(":'until'",`'${until}'`);
}
const report=(await db.query(sql('2026-11-01T00:00:00Z','2026-12-01T00:00:00Z'))).rows[0].jsonb_build_object;
assert.deepEqual(report.totals,{
  players_observed:2,players_flew:2,game_opens:3,expeditions_started:2,
  flights_started:3,flights_completed:1,flights_cancelled:1,cards_opened:2,
  theme_changes:1,players_changed_theme:1,quests_completed:1,active_seconds:45,
});
assert.equal(report.players.length,2);
assert.equal(report.expeditions.length,2);
assert.equal(report.expeditions[0].flights_started,2);
assert.equal(report.expeditions[0].flights_completed,1);
assert.equal(report.themes[0].to_theme,'radar');
assert.equal(report.quests[0].completions,1);
const empty=(await db.query(sql('2030-01-01T00:00:00Z','2030-02-01T00:00:00Z'))).rows[0].jsonb_build_object;
assert.equal(empty.totals.players_observed,0);
assert.equal(empty.totals.active_seconds,0);
assert.deepEqual(empty.expeditions,[]);
await db.close();
console.log('PASS report.sql in PostgreSQL (PGlite): distinct players across IP sessions, per-expedition counts, outcomes, themes, quests, time, date filters, snapshot exclusion and empty history');
