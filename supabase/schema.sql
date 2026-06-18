-- ============================================================================
--  Publisko iepirkumu risku analīzes platforma — datu shēma (Supabase / PostgreSQL)
--  Atbilst B1 specifikācijas 7. sadaļai. Paplašināms nākamajiem indikatoriem (A, C, D, E).
-- ============================================================================

-- 1) Jēldati tieši no IUB e-veidlapām (audita pēdas un atkārtotas parsēšanas dēļ)
create table if not exists raw_notices (
  id            text primary key,        -- paziņojuma ID (avota)
  source        text not null default 'IUB_EFORMS',
  fetched_at    timestamptz not null default now(),
  payload       jsonb not null           -- pilns eForms JSON
);

-- 2) Normalizētas iepirkuma daļas (LotResult līmenis)
create table if not exists lots (
  id            text primary key,        -- LotResult ID (BT-13713)
  notice_id     text references raw_notices(id),
  buyer_id      text not null,           -- pasūtītāja reģ. nr. (normalizēts; OPT-300)
  buyer_name    text,                    -- attēlošanai (nenormalizēts)
  cpv           text,                    -- BT-262 (vismaz 4 zīmes salīdzināšanai)
  received_bids int,                     -- BT-759 (Received Submissions Count)
  winner_chosen boolean not null default false, -- BT-142
  award_value   numeric,                 -- BT-720
  procedure_type text,                   -- BT-768
  notice_date   date,
  source_url    text,                    -- saite uz IUB oriģinālu
  created_at    timestamptz not null default now()
);
create index if not exists idx_lots_buyer on lots(buyer_id);
create index if not exists idx_lots_cpv on lots(cpv);

-- 3) Indikatoru rezultāti (vispārīgs, der visiem slāņiem A–E)
create table if not exists risk_results (
  id           bigint generated always as identity primary key,
  lot_id       text references lots(id),
  buyer_id     text not null,
  indicator    text not null,            -- piem. 'B1'
  scope        text not null,            -- 'lot' | 'buyer'
  level        text,                     -- 'yellow' | 'red' | null
  score        int,                      -- 0..100 vai null ('nepietiek datu')
  status       text not null,            -- 'RiskFound'|'RiskNotFound'|'NoData'|'NotApplicable'
  detail       jsonb,                    -- paskaidrojums / aprēķina starprezultāti
  computed_at  timestamptz not null default now()
);
create index if not exists idx_risk_buyer on risk_results(buyer_id);
create index if not exists idx_risk_indicator on risk_results(indicator);

-- 4) Konfigurējami sliekšņi un svari (DOZORRO princips: glabāt konfigurācijā, ne kodā)
create table if not exists config (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now()
);

-- Sākotnējās konfigurācijas vērtības (sākotnēji ieteiktās; pārkalibrējamas uz reāliem datiem)
insert into config (key, value) values
  ('weights', '{"A":0.25,"B":0.30,"C":0.20,"D":0.15,"E":0.10}'),
  ('B1', '{"min_sample":10,"buyer_yellow_ratio":1.3,"buyer_red_ratio":1.7,"score_slope":100}')
on conflict (key) do nothing;
