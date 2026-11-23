import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import { CalendarDays, Activity, Star, Timer, TrendingUp } from 'lucide-vue-next';
import type { Component } from 'vue';

export interface NavItem {
  path: string;
  label: string;
  icon: Component;
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Sorties', icon: CalendarDays },
  { path: '/tirages', label: 'Tirages', icon: Timer },
  { path: '/prix', label: 'Prix', icon: TrendingUp },
  { path: '/watchlist', label: 'Watchlist', icon: Star },
  { path: '/etat', label: 'État', icon: Activity },
];

const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('./views/ReleasesView.vue'), meta: { title: 'Sorties' } },
  { path: '/tirages', component: () => import('./views/DrawsView.vue'), meta: { title: 'Tirages' } },
  { path: '/prix', component: () => import('./views/PricesView.vue'), meta: { title: 'Prix' } },
  { path: '/watchlist', component: () => import('./views/WatchlistView.vue'), meta: { title: 'Watchlist' } },
  { path: '/etat', component: () => import('./views/StatusView.vue'), meta: { title: 'État' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

// Historique par « # » : GitHub Pages ne sait pas renvoyer index.html pour une URL inconnue.
export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : undefined;
  document.title = title ? `${title} · Riftbound Tracker` : 'Riftbound Tracker';
});
