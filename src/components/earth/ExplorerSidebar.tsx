'use client';

import type { ReactNode } from 'react';

type SidebarSection = 'explore' | 'highlights' | 'layers' | 'about';

type ExplorerSidebarProps = {
  activeSection: SidebarSection;
  onChange: (section: SidebarSection) => void;
};

const SIDEBAR_ITEMS: Array<{
  id: SidebarSection;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: 'explore',
    label: '探索',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 12 3.5Zm0 1.8a6.64 6.64 0 0 1 5.23 2.54l-1.54.88A5.1 5.1 0 0 0 12 7.2ZM7.2 12a4.8 4.8 0 0 1 6.5-4.5l-1.8 3.6-3.6 1.8A4.61 4.61 0 0 1 7.2 12Zm4.11 4.95 2.4-4.78 4.78-2.4A6.69 6.69 0 0 1 11.31 16.95Z" />
      </svg>
    )
  },
  {
    id: 'highlights',
    label: '热点',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.9 2.8c.3 2.6-.59 4.3-2.1 5.78-1.1 1.08-1.7 2.1-1.7 3.48a3.9 3.9 0 0 0 7.8 0c0-2.82-2.18-4.05-4-5.86.7 1.55.31 2.76-.92 3.67A6.61 6.61 0 0 0 12.9 2.8ZM8.3 14.5A5.12 5.12 0 0 0 13.42 20 5.1 5.1 0 0 0 18 17.19c-1.11.56-2.04.7-3.12.28a4.08 4.08 0 0 1-2.44-2.33 4.94 4.94 0 0 0-4.14-.64Z" />
      </svg>
    )
  },
  {
    id: 'layers',
    label: '图层',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 8 4.5-8 4.5-8-4.5Zm-6.1 7L12 13.4 18.1 10 20 11.1 12 15.6 4 11.1Zm0 3.6L12 17l6.1-3.4L20 14.7 12 19.2 4 14.7Z" />
      </svg>
    )
  },
  {
    id: 'about',
    label: '关于',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.75A9.25 9.25 0 1 0 21.25 12 9.26 9.26 0 0 0 12 2.75Zm0 4.1a1.15 1.15 0 1 1-1.15 1.15A1.15 1.15 0 0 1 12 6.85Zm1.45 10.2h-2.9v-1.5h.7v-3.45h-.7v-1.5h2.2v4.95h.7Z" />
      </svg>
    )
  }
];

export function ExplorerSidebar({ activeSection, onChange }: ExplorerSidebarProps) {
  return (
    <aside className="explorerSidebar" aria-label="探索导航">
      <div className="sidebarBrand">
        <span>Earth</span>
        <strong>Observer</strong>
      </div>

      <nav className="sidebarNav">
        {SIDEBAR_ITEMS.map((item) => {
          const active = item.id === activeSection;

          return (
            <button
              key={item.id}
              type="button"
              className={`sidebarNavButton ${active ? 'active' : ''}`}
              onClick={() => onChange(item.id)}
              aria-pressed={active}
              title={item.label}
            >
              <span className="sidebarNavIcon">{item.icon}</span>
              <span className="sidebarNavLabel">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export type { SidebarSection };
