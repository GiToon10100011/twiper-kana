import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { Denial, SyncStore } from './store.js';

type Sql = NeonQueryFunction<false, false>;

/** 처음 요청 때 한 번 만든다 (없을 때만) */
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
];

/**
 * 묶음 쌓기. 공간 행을 바꾸는 update가 커밋까지 그 행을 잠그므로, 같은 공간의 쓰기는 한 줄로 서고
 * 번호(next_seq) 순서가 커밋 순서와 같다 (동기화 설계 §4.6). 키가 다르거나, 지운 공간이거나, 가득 찼거나,
 * 1분 한도를 넘으면 아무것도 쓰지 않는다
 */
const PUSH = `
  with s as (
    update sync_space set
      next_seq = next_seq + 1,
      bytes = bytes + $3,
      used_at = now(),
      window_count = case when window_start > now() - interval '1 minute' then window_count + 1 else 1 end,
      window_start = case when window_start > now() - interval '1 minute' then window_start else now() end
    where id = $1 and auth_hash = $2 and deleted_at is null
      and bytes + $3 <= $7
      and (window_start <= now() - interval '1 minute' or window_count < $8)
    returning next_seq
  )
  insert into sync_batch (space_id, seq, device_id, iv, data)
  select $1, next_seq, $4, $5, $6 from s
  returning seq`;

interface SpaceRow {
  readonly auth_hash: string;
  readonly deleted_at: string | null;
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
      (await sql.query('select auth_hash, deleted_at from sync_space where id = $1', [
        space,
      ])) as SpaceRow[]
    )[0];
  const denialOf = (row: SpaceRow | undefined, authHash: string): Denial | null =>
    !row || row.auth_hash !== authHash ? 'forbidden' : row.deleted_at ? 'gone' : null;

  return {
    async push({ space, authHash, deviceId, iv, data, limits }) {
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
      ])) as { seq: string | number }[];
      const seq = rows[0]?.seq;
      if (seq !== undefined) return { seq: Number(seq) };
      // 왜 쓰지 않았는지
      const [row] = (await sql.query(
        'select auth_hash, deleted_at, bytes + $2 > $3 as full from sync_space where id = $1',
        [space, data.length, limits.maxBytes],
      )) as (SpaceRow & { full: boolean })[];
      return { denied: denialOf(row, authHash) ?? (row?.full ? 'full' : 'rate') };
    },
    async pull({ space, authHash, after, limit }) {
      await ensure();
      const row = await spaceOf(space);
      if (!row) return { batches: [] };
      const denied = denialOf(row, authHash);
      if (denied) return { denied };
      const rows = (await sql.query(
        'select seq, device_id, iv, data from sync_batch where space_id = $1 and seq > $2 order by seq limit $3',
        [space, after, limit],
      )) as { seq: string | number; device_id: string; iv: string; data: string }[];
      return {
        batches: rows.map((r) => ({
          seq: Number(r.seq),
          deviceId: r.device_id,
          iv: r.iv,
          data: r.data,
        })),
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
          'update sync_space set deleted_at = coalesce(deleted_at, now()), bytes = 0 where id = $1',
          [space],
        ),
        sql.query('delete from sync_batch where space_id = $1', [space]),
      ]);
      return { removed: true };
    },
  };
}
