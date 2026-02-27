-- Harden product catalog writes: clients can read, only trusted server paths can write.

drop policy if exists "authenticated write products" on public.products;
drop policy if exists "authenticated update products" on public.products;
drop policy if exists "authenticated delete products" on public.products;

revoke insert, update, delete on table public.products from authenticated;
revoke insert, update, delete on table public.products from anon;

grant select on table public.products to authenticated;
