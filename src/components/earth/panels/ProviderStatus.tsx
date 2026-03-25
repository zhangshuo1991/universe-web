'use client';

import type { ProviderDescriptor } from '@/types/observation';

function statusColor(status: ProviderDescriptor['status']): string {
  if (status === 'available') return 'var(--aqua)';
  if (status === 'degraded') return 'var(--warm)';
  return 'var(--danger)';
}

function statusLabel(status: ProviderDescriptor['status']): string {
  if (status === 'available') return '可用';
  if (status === 'degraded') return '降级';
  return '禁用';
}

export function ProviderStatus({ providers }: { providers: ProviderDescriptor[] }) {
  if (providers.length === 0) {
    return (
      <section className="infoPanel">
        <div className="panelHeader">
          <h2>数据源</h2>
        </div>
        <p className="emptyState">加载数据源状态...</p>
      </section>
    );
  }

  return (
    <section className="infoPanel">
      <div className="panelHeader">
        <h2>数据源</h2>
        <strong>{providers.length} 个</strong>
      </div>
      <div className="providerList">
        {providers.map((provider) => (
          <div key={provider.id} className="providerRow">
            <div>
              <strong>{provider.name}</strong>
              <span style={{ color: statusColor(provider.status) }}>
                {statusLabel(provider.status)}
                {provider.optional ? ' · 可选' : ''}
              </span>
            </div>
            {provider.reason && <small>{provider.reason}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}
