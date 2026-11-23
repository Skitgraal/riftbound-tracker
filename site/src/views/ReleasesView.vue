<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight } from 'lucide-vue-next';
import CountdownTiles from '../components/CountdownTiles.vue';
import EmptyState from '../components/EmptyState.vue';
import PageTitle from '../components/PageTitle.vue';
import ProductCard from '../components/ProductCard.vue';
import StatusChip from '../components/StatusChip.vue';
import { useData, type SiteMeta } from '../lib/data.ts';
import { ago } from '../lib/format.ts';
import {
  currentDraw,
  fuzzyLabel,
  fuzzySortKey,
  instantLabel,
  money,
  STATUS_LABELS,
  TYPE_LABELS,
  useProducts,
  type FuzzyDate,
  type ProductSummary,
  type ProductType,
  type Status,
} from '../lib/products.ts';

const { data: products, error } = useProducts();
const { data: meta } = useData<SiteMeta>('meta.json');
const now = Date.now();
const parisDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
const today = parisDay(new Date());

// --- À ne pas rater : tirages ouverts ou annoncés, précommandes ---
const urgentDraws = computed(() =>
  (products.value ?? [])
    .flatMap((p) => {
      const d = currentDraw(p, now);
      return d && (d.draw.opensAt || d.draw.closesAt) ? [{ p, d }] : [];
    })
    .sort(
      (a, b) =>
        (a.d.state === 'open' ? 0 : 1) - (b.d.state === 'open' ? 0 : 1) ||
        (a.d.draw.closesAt ?? a.d.draw.opensAt ?? '').localeCompare(b.d.draw.closesAt ?? b.d.draw.opensAt ?? ''),
    ),
);
const preorders = computed(() => (products.value ?? []).filter((p) => p.status === 'preorder'));

// --- Calendrier : prochaines dates (sorties, ouvertures et fermetures de tirage) ---
interface CalItem {
  key: string;
  sort: string;
  day: string;
  dow: string;
  month: string;
  name: string;
  what: string;
  chip: Status;
  chipLabel: string;
  slug: string;
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const calendar = computed(() => {
  const items: CalItem[] = [];
  for (const p of products.value ?? []) {
    // Sortie à venir, y compris imprécise (« T1 2027 » avec « date ? »)
    const r = p.releaseDate;
    if (r && p.status !== 'released' && p.status !== 'cancelled') {
      const sort = fuzzySortKey(r);
      if (sort >= today.slice(0, sort.length)) {
        const exact = r.precision === 'day' ? new Date(`${r.value}T12:00:00Z`) : null;
        items.push({
          key: `${p.slug}-release`,
          sort,
          day: exact ? exact.toLocaleDateString('fr-FR', { day: '2-digit', timeZone: 'UTC' }) : '—',
          dow: exact ? exact.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' }) : 'date ?',
          month: exact ? capitalize(exact.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })) : capitalize(fuzzyLabel(r, true)),
          name: p.name,
          what: 'Sortie',
          chip: p.status,
          chipLabel: STATUS_LABELS[p.status],
          slug: p.slug,
        });
      }
    }
    // Ouverture et fermeture des tirages
    for (const d of p.draws) {
      for (const [iso, what] of [[d.opensAt, 'Ouverture du tirage'], [d.closesAt, 'Fermeture du tirage']] as const) {
        if (!iso || Date.parse(iso) <= now) continue;
        const date = new Date(iso);
        items.push({
          key: `${p.slug}-${what}-${iso}`,
          sort: parisDay(date),
          day: date.toLocaleDateString('fr-FR', { day: '2-digit', timeZone: 'Europe/Paris' }),
          dow: date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'Europe/Paris' }),
          month: capitalize(date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })),
          name: p.name,
          what,
          chip: 'preorder',
          chipLabel: 'Tirage',
          slug: p.slug,
        });
      }
    }
  }
  items.sort((a, b) => a.sort.localeCompare(b.sort));
  const months: { label: string; items: CalItem[] }[] = [];
  for (const it of items) {
    const last = months.at(-1);
    if (last?.label === it.month) last.items.push(it);
    else months.push({ label: it.month, items: [it] });
  }
  return months.slice(0, 4);
});

// --- Tous les produits ---
const statusFilter = ref<Status | ''>('');
const typeFilter = ref<ProductType | ''>('');
const setFilter = ref('');
const confirmedOnly = ref(false);
const sets = computed(() => [...new Set((products.value ?? []).map((p) => p.set).filter((s): s is string => Boolean(s)))].sort());
const types = computed(() => [...new Set((products.value ?? []).map((p) => p.type))]);

const STATUS_ORDER: Status[] = ['preorder', 'announced', 'rumor', 'released', 'cancelled'];
const byDate = (a: FuzzyDate | null, b: FuzzyDate | null) => fuzzySortKey(a).localeCompare(fuzzySortKey(b));
const grid = computed(() =>
  (products.value ?? [])
    .filter(
      (p) =>
        (!statusFilter.value || p.status === statusFilter.value) &&
        (!typeFilter.value || p.type === typeFilter.value) &&
        (!setFilter.value || p.set === setFilter.value) &&
        (!confirmedOnly.value || p.reliability === 'confirmed'),
    )
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        // À venir : la plus proche d'abord ; déjà sortis : le plus récent d'abord
        (a.status === 'released' ? byDate(b.releaseDate, a.releaseDate) : byDate(a.releaseDate, b.releaseDate)) ||
        b.createdAt.localeCompare(a.createdAt),
    ),
);

const selectClass =
  'h-11 cursor-pointer rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-[#C3C9D6] hover:border-[#3A4256] focus:border-accent focus:outline-none';
const joinMeta = (parts: (string | null | undefined)[]) => parts.filter((x) => x && x !== '—').join(' · ');
</script>

<template>
  <PageTitle title="Sorties" :subtitle="meta ? `Mis à jour ${ago(meta.generatedAt)} · heure de Paris` : 'Heure de Paris'" />

  <EmptyState v-if="error" title="Sorties indisponibles" :detail="`Les données n'ont pas pu être chargées (${error}).`" />
  <p v-else-if="!products" class="text-sm text-text-faint">Chargement…</p>
  <EmptyState
    v-else-if="products.length === 0"
    title="La veille démarre"
    detail="Les produits annoncés par Riot, les leaks et les précommandes apparaîtront ici automatiquement."
  />

  <template v-else>
    <!-- À ne pas rater : un seul bloc urgent en tête, le reste en cartes -->
    <section v-if="urgentDraws.length || preorders.length" aria-labelledby="urgent" class="mb-12">
      <h2 id="urgent" class="m-0 mb-4 font-display text-[22px] font-semibold tracking-tight">À ne pas rater</h2>
      <div class="grid gap-4">
        <article
          v-for="{ p, d } in urgentDraws.slice(0, 1)"
          :key="p.slug"
          class="grid gap-5 rounded-2xl border border-urgent-border bg-urgent-bg p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div class="min-w-0">
            <p class="m-0 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-urgent uppercase">
              <span class="size-1.5 rounded-full bg-urgent" aria-hidden="true" />
              {{ d.state === 'open' ? 'Tirage ouvert' : 'Tirage à venir' }}
            </p>
            <h3 class="m-0 mt-2 font-display text-[22px] font-semibold tracking-tight">
              <RouterLink :to="`/produit/${p.slug}`" class="text-text no-underline hover:text-urgent">{{ p.name }}</RouterLink>
            </h3>
            <p class="m-0 mt-1.5 text-sm text-text-muted">
              {{ joinMeta([TYPE_LABELS[p.type], 'Anglais', money(p.msrp), d.draw.region]) }} ·
              {{ d.state === 'open' ? `Fermeture le ${instantLabel(d.draw.closesAt)}` : `Ouverture le ${instantLabel(d.draw.opensAt)}` }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <CountdownTiles v-if="d.state === 'open' && d.draw.closesAt" :until="d.draw.closesAt" verb="Ferme" />
            <CountdownTiles v-else-if="d.state === 'upcoming' && d.draw.opensAt" :until="d.draw.opensAt" verb="Ouvre" />
            <a
              v-if="d.draw.url || p.officialUrl"
              :href="d.draw.url || p.officialUrl || undefined"
              target="_blank"
              rel="noopener"
              class="inline-flex h-11 items-center gap-2 rounded-[10px] bg-urgent px-4 text-sm font-semibold text-[#1A1306] no-underline hover:bg-[#FFD88A]"
            >
              {{ d.state === 'open' ? "S'inscrire au tirage" : 'Voir les détails' }}
              <ArrowUpRight :size="16" aria-hidden="true" />
            </a>
          </div>
        </article>

        <div v-if="urgentDraws.length > 1 || preorders.length" class="grid gap-4 md:grid-cols-2">
          <article v-for="{ p, d } in urgentDraws.slice(1)" :key="`d-${p.slug}`" class="rounded-2xl border border-border bg-surface p-5">
            <StatusChip status="preorder" :label="d.state === 'open' ? 'Tirage ouvert' : 'Tirage à venir'" />
            <h3 class="m-0 mt-3 font-display text-lg font-semibold">{{ p.name }}</h3>
            <p class="m-0 mt-1 text-sm text-text-muted">
              {{ d.state === 'open' ? `Ferme le ${instantLabel(d.draw.closesAt)}` : `Ouvre le ${instantLabel(d.draw.opensAt)}` }}
            </p>
            <RouterLink :to="`/produit/${p.slug}`" class="mt-3 inline-block text-sm font-medium">Voir la fiche →</RouterLink>
          </article>
          <article v-for="p in preorders" :key="`p-${p.slug}`" class="rounded-2xl border border-border bg-surface p-5">
            <StatusChip status="preorder" label="Précommande ouverte" />
            <h3 class="m-0 mt-3 font-display text-lg font-semibold">{{ p.name }}</h3>
            <p class="m-0 mt-1 text-sm text-text-muted">
              {{ joinMeta([money(p.msrp), p.releaseDate ? `sortie ${fuzzyLabel(p.releaseDate)}` : null]) || 'Précommande ouverte' }}
            </p>
            <RouterLink :to="`/produit/${p.slug}`" class="mt-3 inline-block text-sm font-medium">Voir la fiche →</RouterLink>
          </article>
        </div>
      </div>
    </section>

    <!-- Calendrier -->
    <section v-if="calendar.length" aria-labelledby="upcoming" class="mb-12">
      <div class="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="upcoming" class="m-0 font-display text-[22px] font-semibold tracking-tight">Calendrier</h2>
        <span class="text-sm text-text-faint">Heure de Paris</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="m in calendar" :key="m.label" class="rounded-2xl border border-border bg-surface p-4">
          <p class="m-0 mb-3 text-xs font-semibold tracking-[0.08em] text-text-faint uppercase">{{ m.label }}</p>
          <RouterLink
            v-for="it in m.items"
            :key="it.key"
            :to="`/produit/${it.slug}`"
            class="-mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2.5 text-text no-underline hover:bg-surface-2"
          >
            <div class="w-10 shrink-0 text-center">
              <div class="font-display text-xl leading-none font-bold tabular-nums">{{ it.day }}</div>
              <div class="mt-1 text-[11px] text-text-faint">{{ it.dow }}</div>
            </div>
            <div class="min-w-0 flex-1">
              <p class="m-0 truncate text-sm font-medium">{{ it.name }}</p>
              <p class="m-0 text-xs text-text-faint">{{ it.what }}</p>
            </div>
            <StatusChip :status="it.chip" :label="it.chipLabel" class="shrink-0" />
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- Tous les produits -->
    <section aria-labelledby="all">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="all" class="m-0 mr-auto font-display text-[22px] font-semibold tracking-tight">
          Tous les produits <span class="text-text-faint">· {{ grid.length }}</span>
        </h2>
        <select v-model="statusFilter" :class="selectClass" aria-label="Statut">
          <option value="">Statut</option>
          <option v-for="s in STATUS_ORDER" :key="s" :value="s">{{ STATUS_LABELS[s] }}</option>
        </select>
        <select v-model="typeFilter" :class="selectClass" aria-label="Type">
          <option value="">Type</option>
          <option v-for="t in types" :key="t" :value="t">{{ TYPE_LABELS[t] }}</option>
        </select>
        <select v-model="setFilter" :class="selectClass" aria-label="Set">
          <option value="">Set</option>
          <option v-for="s in sets" :key="s" :value="s">{{ s }}</option>
        </select>
        <label class="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-text-muted">
          <input v-model="confirmedOnly" type="checkbox" class="size-4 accent-[#4FD1C5]" />
          Confirmés uniquement
        </label>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ProductCard v-for="p in grid" :key="p.slug" :product="p" />
      </div>
      <p v-if="grid.length === 0" class="py-10 text-center text-sm text-text-muted">Aucun produit pour ces filtres.</p>
    </section>
  </template>
</template>
