import { SHORTCUT_GROUPS } from '@/app/shortcuts';
import { Dialog } from '../components/Dialog';
import { formatShortcut } from '../hooks';

export function ShortcutsDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} size="lg">
      <div className="grid gap-x-8 gap-y-6 pb-4 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="section-label mb-2">{g.title}</h3>
            <dl className="divide-y divide-hairline-soft">
              {g.items.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-1.5 text-[14px]">
                  <dt className="text-charcoal">{label}</dt>
                  <dd>
                    <kbd className="kbd">{formatShortcut(keys)}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
