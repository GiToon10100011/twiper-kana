import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { Denial, SyncStore } from './store.js';

type Sql = NeonQueryFunction<false, false>;

/** 처음 요청 때 한 번 만든다 (없을 때만). 열은 지우지 않고 덧붙이기만 한다 */
const SCHEMA = [
  `create table if not exists sync_space (
    id           text primary key,
    auth_hash    text not null,
    next_seq     bigint not null default 0,
    bytes        bigint not null default 0,
    window_start timestamptz not null default now(),
    window_count integer not null default 0,
    created_at   timestamptz not null default now(),
    used_at      timestamptz not null default now(),
    deleted_at   timestamptz
  )`,
  `create table if not exists sync_batch (
    space_id  text not null references sync_space(id) on delete cascade,
    seq       bigint not null,
    device_id text not null,
    iv        text not null,
    data      text not null,
    at        timestamptz not null default now(),
    primary key (space_id, seq)
  )`,
  `create table if not exists sync_client (
    id           text primary key,
    window_start timestamptz not null default now(),
    window_count integer not null default 0
  )`,
  // 압축 임대 (S3b)
  'alter table sync_space add column if not exists compaction_id text',
  'alter table sync_space add column if not exists compaction_up_to bigint',
  'alter table sync_space add column if not exists compaction_at timestamptz',
  'alter table sync_batch add column if not exists compaction_id text',
  'alter table sync_space add column if not exists compacted_bytes bigint not null default 0',
];

/** 요청자(IP의 해시)의 1분 카운터를 하나 올리고 그 수를 돌려준다 */
const ADMIT = `
  insert into sync_client (id, window_start, window_count) values ($1, now(), 1)
  on conflict (id) do update set
    window_count = case when sync_client.window_start > now() - interval '1 minute'
      then sync_client.window_count + 1 else 1 end,
    window_start = case when sync_client.window_start > now() - interval '1 minute'
      then sync_client.window_start else now() end
  returning window_count`;

/** 1시간 넘게 쓰지 않은 요청자 카운터 (가끔 치운다) */
const SWEEP_CLIENTS = `delete from sync_client where window_start < now() - interval '1 hour'`;

/** 살아 있는 압축 임대: 15분 안에 활동이 있었다 (store.LEASE_IDLE_MS와 같다) */
const LEASE_LIVE = `compaction_at > now() - interval '15 minutes'`;

/**
 * 묶음 쌓기. 공간 행을 바꾸는 update가 커밋까지 그 행을 잠그므로, 같은 공간의 쓰기는 한 줄로 서고
 * 번호(next_seq) 순서가 커밋 순서와 같다 (동기화 설계 §4.6). 키가 다르거나, 지운 공간이거나, 가득 찼거나,
 * 1분 한도를 넘으면 아무것도 쓰지 않는다. $9(압축 임대 ID)가 있으면 살아 있는 그 임대의 스냅샷 조각으로
 * 쌓고(받기에 보이지 않음), 한도의 2배까지 받는다
 */
const PUSH = `
  with s as (
    update sync_space set
      next_seq = next_seq + 1,
      bytes = bytes + $3,
      used_at = now(),
      compaction_at = case when $9::text is null then compaction_at else now() end,
      window_count = case when window_start > now() - interval '1 minute' then window_count + 1 else 1 end,
      window_start = case when window_start > now() - interval '1 minute' then window_start else now() end
    where id = $1 and auth_hash = $2 and deleted_at is null
      and (window_start <= now() - interval '1 minute' or window_count < $8)
      and case when $9::text is null
        then bytes + $3 <= $7
        else compaction_id = $9 and ${LEASE_LIVE} and bytes + $3 <= 2 * $7
      end
    returning next_seq
  )
  insert into sync_batch (space_id, seq, device_id, iv, data, compaction_id)
  select $1, next_seq, $4, $5, $6, $9 from s
  returning seq`;

/** 공간의 크기를 묶음에서 다시 센다 (압축으로 묶음을 지운 뒤) */
const RECOUNT = '(select coalesce(sum(length(data)), 0) from sync_batch where space_id = $1)';

interface SpaceRow {
  readonly auth_hash: string;
  readonly deleted_at: string | null;
  readonly bytes: string | number;
  readonly compacted_bytes: string | number;
}

/** Postgres(Neon) 저장소. 접속은 Vercel에 연결한 Neon의 DATABASE_URL로 한다 */
export function createNeonStore(sql: Sql): SyncStore {
  let ready: Promise<void> | null = null;
  const ensure = () =>
    (ready ??= (async () => {
      for (const statement of SCHEMA) await sql.query(statement);
    })().catch((error: unknown) => {
      ready = null;
      throw error;
    }));
  const spaceOf = async (space: string) =>
    (
      (await sql.query(
        'select auth_hash, deleted_at, bytes, compacted_bytes from sync_space where id = $1',
        [space],
      )) as SpaceRow[]
    )[0];
  const denialOf = (row: SpaceRow | undefined, authHash: string): Denial | null =>
    !row || row.auth_hash !== authHash ? 'forbidden' : row.deleted_at ? 'gone' : null;
  /** 트랜잭션의 마지막 문장이 행을 돌려줬는지 */
  const lastReturned = (results: unknown) => {
    const all = results as unknown[][];
    return (all[all.length - 1]?.length ?? 0) > 0;
  };

  return {
    async push({ space, authHash, deviceId, iv, data, limits, compactionId }) {
      await ensure();
      await sql.query(
        'insert into sync_space (id, auth_hash) values ($1, $2) on conflict (id) do nothing',
        [space, authHash],
      );
      const rows = (await sql.query(PUSH, [
        space,
        authHash,
        data.length,
        deviceId,
        iv,
        data,
        limits.maxBytes,
        limits.pushesPerMinute,
        compactionId ?? null,
      ])) as { seq: string | number }[];
      const seq = rows[0]?.seq;
      if (seq !== undefined) return { seq: Number(seq) };
      // 왜 쓰지 않았는지
      const [row] = (await sql.query(
        `select auth_hash, deleted_at, bytes, compaction_id, ${LEASE_LIVE} as lease_live,
           bytes + $2 > (case when $4::text is null then $3 else 2 * $3 end) as full
         from sync_space where id = $1`,
        [space, data.length, limits.maxBytes, compactionId ?? null],
      )) as (SpaceRow & { compaction_id: string | null; lease_live: boolean; full: boolean })[];
      const denied = denialOf(row, authHash);
      if (denied) return { denied };
      if (compactionId !== undefined && (row?.compaction_id !== compactionId || !row.lease_live)) {
        return { denied: 'busy' };
      }
      return { denied: row?.full ? 'full' : 'rate' };
    },
    async pull({ space, authHash, after, limit }) {
      await ensure();
      const row = await spaceOf(space);
      if (!row) return { batches: [], bytes: 0, compactedBytes: 0 };
      const denied = denialOf(row, authHash);
      if (denied) return { denied };
      // 받기만 하는 기기도 공간을 쓰는 것으로 친다 (하루에 한 번만 고쳐 쓴다)
      await sql.query(
        `update sync_space set used_at = now() where id = $1 and used_at < now() - interval '1 day'`,
        [space],
      );
      const rows = (await sql.query(
        `select seq, device_id, iv, data from sync_batch
         where space_id = $1 and seq > $2 and compaction_id is null order by seq limit $3`,
        [space, after, limit],
      )) as { seq: string | number; device_id: string; iv: string; data: string }[];
      return {
        batches: rows.map((r) => ({
          seq: Number(r.seq),
          deviceId: r.device_id,
          iv: r.iv,
          data: r.data,
        })),
        bytes: Number(row.bytes),
        compactedBytes: Number(row.compacted_bytes),
      };
    },
    async remove({ space, authHash }) {
      await ensure();
      // 올린 적이 없어도 이 코드는 다시 쓸 수 없게 표시를 남긴다
      await sql.query(
        'insert into sync_space (id, auth_hash, deleted_at) values ($1, $2, now()) on conflict (id) do nothing',
        [space, authHash],
      );
      const row = await spaceOf(space);
      if (!row || row.auth_hash !== authHash) return { denied: 'forbidden' };
      await sql.transaction([
        sql.query(
          `update sync_space set deleted_at = coalesce(deleted_at, now()), bytes = 0,
             compaction_id = null, compaction_up_to = null, compaction_at = null
           where id = $1`,
          [space],
        ),
        sql.query('delete from sync_batch where space_id = $1', [space]),
      ]);
      return { removed: true };
    },
    async admit({ client, perMinute }) {
      await ensure();
      const [row] = (await sql.query(ADMIT, [client])) as { window_count: number }[];
      if (Math.random() < 0.01) await sql.query(SWEEP_CLIENTS);
      return (row?.window_count ?? 0) <= perMinute;
    },
    async startCompaction({ space, authHash, upTo }) {
      await ensure();
      const denied = denialOf(await spaceOf(space), authHash);
      if (denied) return { denied };
      const id = crypto.randomUUID();
      const results = await sql.transaction([
        // 버려진 임대의 조각을 지운다
        sql.query(
          `delete from sync_batch where space_id = $1 and compaction_id is not null
             and compaction_id = (select compaction_id from sync_space
               where id = $1 and not (${LEASE_LIVE}))`,
          [space],
        ),
        sql.query(
          `update sync_space set compaction_id = $3, compaction_up_to = $4, compaction_at = now(),
             bytes = ${RECOUNT}
           where id = $1 and auth_hash = $2 and deleted_at is null
             and (compaction_id is null or not (${LEASE_LIVE}))
           returning id`,
          [space, authHash, id, upTo],
        ),
      ]);
      return lastReturned(results) ? { compactionId: id } : { denied: 'busy' };
    },
    async finishCompaction({ space, authHash, compactionId }) {
      await ensure();
      const denied = denialOf(await spaceOf(space), authHash);
      if (denied) return { denied };
      const lease = `select 1 from sync_space where id = $1 and auth_hash = $2
        and compaction_id = $3 and ${LEASE_LIVE}`;
      const results = await sql.transaction([
        sql.query(
          `delete from sync_batch where space_id = $1 and compaction_id is null
             and seq <= (select compaction_up_to from sync_space where id = $1 and auth_hash = $2
               and compaction_id = $3 and ${LEASE_LIVE})`,
          [space, authHash, compactionId],
        ),
        sql.query(
          `update sync_batch set compaction_id = null
           where space_id = $1 and compaction_id = $3 and exists (${lease})`,
          [space, authHash, compactionId],
        ),
        sql.query(
          `update sync_space set compaction_id = null, compaction_up_to = null,
             compaction_at = null, bytes = ${RECOUNT}, compacted_bytes = ${RECOUNT}
           where id = $1 and auth_hash = $2 and compaction_id = $3 and ${LEASE_LIVE}
           returning id`,
          [space, authHash, compactionId],
        ),
      ]);
      return lastReturned(results) ? { done: true } : { denied: 'busy' };
    },
    async abortCompaction({ space, authHash, compactionId }) {
      await ensure();
      const denied = denialOf(await spaceOf(space), authHash);
      if (denied) return { denied };
      const results = await sql.transaction([
        sql.query(
          `delete from sync_batch where space_id = $1 and compaction_id = $3
             and exists (select 1 from sync_space where id = $1 and auth_hash = $2
               and compaction_id = $3)`,
          [space, authHash, compactionId],
        ),
        sql.query(
          `update sync_space set compaction_id = null, compaction_up_to = null,
             compaction_at = null, bytes = ${RECOUNT}
           where id = $1 and auth_hash = $2 and compaction_id = $3
           returning id`,
          [space, authHash, compactionId],
        ),
      ]);
      return lastReturned(results) ? { done: true } : { denied: 'busy' };
    },
    async sweep() {
      await ensure();
      // 묶음은 on delete cascade로 함께 지워진다
      const rows = (await sql.query(
        `delete from sync_space
         where coalesce(deleted_at, used_at) < now() - interval '1 year'
         returning id`,
      )) as unknown[];
      await sql.query(SWEEP_CLIENTS);
      return { spaces: rows.length };
    },
  };
}
