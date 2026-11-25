<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { ArrowUpRight, Bell, CalendarPlus } from 'lucide-vue-next';
import CountdownTiles from '../components/CountdownTiles.vue';
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
import ProductArt from '../components/ProductArt.vue';
import StatusChip from '../components/StatusChip.vue';
import { useData, type SiteMeta } from '../lib/data.ts';
import { ago } from '../lib/format.ts';
import { drawIcsUrl, drawState, instantLabel, money, TYPE_LABELS, useProducts, type Draw, type ProductSummary } from '../lib/products.ts';

const { data: products, error } = useProducts();
const { data: meta } = useData<SiteMeta>('meta.json');

// L'état d'un tirage (ouvert, à venir, terminé) bascule pendant que la page reste ouverte.
const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 60_000);
onBeforeUnmount(() => clearInterval(timer));

interface Row {
  key: string;
  p: ProductSummary;
  d: Draw;
}

const rows = computed<Row[]>(() =>
  (products.value ?? []).flatMap((p) => p.draws.map((d) => ({ key: `${p.slug}|${d.opensAt ?? d.closesAt ?? d.url}`, p, d }))),
);

const by = (iso: (r: Row) => string | null) => (a: Row, b: Row) => (iso(a) ?? '9999').localeCompare(iso(b) ?? '9999');
const open = computed(() => rows.value.filter((r) => drawState(r.d, now.value) === 'open').sort(by((r) => r.d.closesAt)));
const upcoming = computed(() => rows.value.filter((r) => drawState(r.d, now.value) === 'upcoming').sort(by((r) => r.d.opensAt)));
/** Terminés depuis moins de 6 mois, le plus récent d'abord. */
const past = computed(() =>
  rows.value
    .filter((r) => drawState(r.d, now.value) === 'closed' && now.value - Date.parse(r.d.closesAt!) < 183 * 86_400_000)
    .sort((a, b) => b.d.closesAt!.localeCompare(a.d.closesAt!)),
);

const signup = (r: Row) => r.d.url ?? r.p.officialUrl ?? undefined;
const facts = (r: Row) => [TYPE_LABELS[r.p.type], money(r.p.msrp), r.d.region].filter((x) => x && x !== '—').join(' · ');
const drawWindow = (d: Draw) => `${d.opensAt ? instantLabel(d.opensAt) : '?'} → ${d.closesAt ? instantLabel(d.closesAt) : '?'}`;
</script>

<template>
  <PageTitle title="Tirages" :subtitle="meta ? `Mis à jour ${ago(meta.generatedAt)} · heure de Paris` : 'Heure de Paris'" />

  <EmptyState v-if="error" title="Tirages indisponibles" :detail="`Les données n'ont pas pu être chargées (${error}).`" />
  <p v-else-if="!products" class="text-sm text-text-faint">Chargement…</p>

  <template v-else>
    <p class="m-0 mb-8 flex items-start gap-2 text-sm text-text-muted">
      <Bell :size="16" class="mt-0.5 shrink-0 text-urgent" aria-hidden="true" />
      Rappels Discord dans #alertes-critiques à l'ouverture, 24 h et 2 h avant la fermeture.
    </p>

    <!-- Ouverts -->
    <section aria-labelledby="open" class="mb-12">
      <h2 id="open" class="m-0 mb-4 font-display text-[22px] font-semibold tracking-tight">
        Ouverts <span class="text-text-faint">· {{ open.length }}</span>
      </h2>
      <div v-if="open.length" class="grid gap-4">
        <article
          v-for="r in open"
          :key="r.key"
          class="grid gap-5 rounded-2xl border border-urgent-border bg-urgent-bg p-5 sm:grid-cols-[96px_minmax(0,1fr)] sm:p-6 lg:grid-cols-[96px_minmax(0,1fr)_auto] lg:items-center"
        >
          <ProductArt :product="r.p" class="hidden size-24 rounded-xl sm:flex" />
          <div class="min-w-0">
            <p class="m-0 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-urgent uppercase">
              <span class="size-1.5 rounded-full bg-urgent" aria-hidden="true" />
              Tirage ouvert
            </p>
            <h3 class="m-0 mt-2 font-display text-[22px] font-semibold tracking-tight">
              <RouterLink :to="`/produit/${r.p.slug}`" class="text-text no-underline hover:text-urgent">{{ r.p.name }}</RouterLink>
            </h3>
            <p class="m-0 mt-1.5 text-sm text-text-muted">
              {{ facts(r) }}{{ facts(r) ? ' · ' : '' }}{{ r.d.closesAt ? `Fermeture le ${instantLabel(r.d.closesAt)}` : 'Fermeture : date inconnue' }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1">
            <CountdownTiles v-if="r.d.closesAt" :until="r.d.closesAt" verb="Ferme" />
            <a
              v-if="signup(r)"
              :href="signup(r)"
              target="_blank"
              rel="noopener"
              class="inline-flex h-11 items-center gap-2 rounded-[10px] bg-urgent px-4 text-sm font-semibold text-[#1A1306] no-underline hover:bg-[#FFD88A]"
            >
              S'inscrire <ArrowUpRight :size="16" aria-hidden="true" />
            </a>
            <a
              v-if="drawIcsUrl(r.p, r.d)"
              :href="drawIcsUrl(r.p, r.d)!"
              :download="`tirage-${r.p.slug}.ics`"
              class="inline-flex h-11 items-center gap-2 rounded-[10px] border border-urgent-border px-3 text-sm font-medium text-urgent no-underline hover:bg-[#2A2010]"
              title="Ajouter la fermeture à l'agenda, avec une alarme 2 h avant"
            >
              <CalendarPlus :size="16" aria-hidden="true" /> Agenda
            </a>
          </div>
        </article>
      </div>
      <p v-else class="m-0 rounded-2xl border border-border bg-surface px-5 py-6 text-sm text-text-muted">
        Aucun tirage ouvert en ce moment. Dès qu'un tirage est annoncé, il apparaît ici et une alerte part sur Discord.
      </p>
    </section>

    <!-- À venir -->
    <section v-if="upcoming.length" aria-labelledby="upcoming" class="mb-12">
      <h2 id="upcoming" class="m-0 mb-4 font-display text-[22px] font-semibold tracking-tight">
        À venir <span class="text-text-faint">· {{ upcoming.length }}</span>
      </h2>
      <div class="grid gap-4 md:grid-cols-2">
        <article v-for="r in upcoming" :key="r.key" class="rounded-2xl border border-border bg-surface p-5">
          <StatusChip status="preorder" label="Tirage à venir" />
          <h3 class="m-0 mt-3 font-display text-lg font-semibold">
            <RouterLink :to="`/produit/${r.p.slug}`" class="text-text no-underline hover:text-accent-text">{{ r.p.name }}</RouterLink>
          </h3>
          <p class="m-0 mt-1 text-sm text-text-muted">{{ r.d.opensAt || r.d.closesAt ? drawWindow(r.d) : 'Dates à venir' }}</p>
          <div v-if="r.d.opensAt" class="mt-4">
            <CountdownTiles :until="r.d.opensAt" verb="Ouvre" />
          </div>
          <a v-if="signup(r)" :href="signup(r)" target="_blank" rel="noopener" class="mt-4 inline-flex items-center gap-1 text-sm font-medium">
            Page du tirage <ArrowUpRight :size="14" aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>

    <!-- Terminés -->
    <section v-if="past.length" aria-labelledby="past">
      <h2 id="past" class="m-0 mb-4 font-display text-[22px] font-semibold tracking-tight">
        Terminés <span class="text-text-faint">· 6 derniers mois</span>
      </h2>
      <ul class="m-0 list-none rounded-2xl border border-border bg-surface p-0">
        <li v-for="r in past" :key="r.key" class="border-b border-border-soft last:border-b-0">
          <RouterLink :to="`/produit/${r.p.slug}`" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 text-text no-underline hover:bg-surface-2">
            <span class="min-w-0 text-sm font-medium">{{ r.p.name }}</span>
            <span class="text-xs text-text-faint tabular-nums">{{ drawWindow(r.d) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>
