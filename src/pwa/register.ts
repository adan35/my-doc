import { toast } from '@/app/toast-store';
import { editorActions } from '@/app/editor-store';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;

/** True when the browser offers installing My Doc as an app. */
export const canInstall = () => !!installPrompt;

export async function installApp() {
  const p = installPrompt;
  if (!p) return;
  installPrompt = null;
  await p.prompt();
}

/**
 * Registers the service worker (production only) so My Doc opens without a network
 * connection, and offers a reload when a new version has been downloaded.
 */
export function registerServiceWorker() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPromptEvent;
  });
  addEventListener('appinstalled', () => (installPrompt = null));

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  const offerUpdate = (worker: ServiceWorker) =>
    toast({
      message: 'A new version of My Doc is ready.',
      duration: 60_000,
      action: {
        label: 'Reload',
        run: () =>
          void editorActions.flushAll().finally(() => worker.postMessage({ type: 'skip-waiting' })),
      },
    });

  addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            // Only an update (not the first install) needs a reload.
            if (worker.state === 'installed' && navigator.serviceWorker.controller)
              offerUpdate(worker);
          });
        });
      })
      .catch((err) => console.warn('Offline support is unavailable.', err));
  });
}
