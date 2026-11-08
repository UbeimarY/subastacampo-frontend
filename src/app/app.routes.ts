import { Routes } from '@angular/router';

import { roleGuard, signedInGuard, signedOutGuard } from './core/auth/guards';
import { UserRole } from './gen/subastacampo/v1/common_pb';

// Every page is lazy loaded: the first visit only downloads what it shows.
export const routes: Routes = [
  {
    path: '',
    title: 'Subastas en vivo · SubastaCampo',
    loadComponent: () => import('./pages/auctions/auctions-page').then((m) => m.AuctionsPage),
  },
  {
    path: 'subastas/:auctionId',
    title: 'Sala de subasta · SubastaCampo',
    loadComponent: () =>
      import('./pages/auction-room/auction-room-page').then((m) => m.AuctionRoomPage),
  },
  {
    path: 'publicar',
    title: 'Publicar cosecha · SubastaCampo',
    canActivate: [roleGuard(UserRole.PRODUCER)],
    loadComponent: () => import('./pages/publish/publish-page').then((m) => m.PublishPage),
  },
  {
    path: 'mis-productos',
    title: 'Mis productos · SubastaCampo',
    canActivate: [roleGuard(UserRole.PRODUCER)],
    loadComponent: () =>
      import('./pages/my-products/my-products-page').then((m) => m.MyProductsPage),
  },
  {
    path: 'mis-pujas',
    title: 'Mis pujas · SubastaCampo',
    canActivate: [signedInGuard, roleGuard(UserRole.BUYER)],
    loadComponent: () => import('./pages/auctions/auctions-page').then((m) => m.AuctionsPage),
    data: { scope: 'my-bids' },
  },
  {
    path: 'ingresar',
    title: 'Ingresar · SubastaCampo',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./pages/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'registro',
    title: 'Crear cuenta · SubastaCampo',
    canActivate: [signedOutGuard],
    loadComponent: () => import('./pages/register/register-page').then((m) => m.RegisterPage),
  },
  {
    path: '**',
    title: 'Página no encontrada · SubastaCampo',
    loadComponent: () => import('./pages/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
