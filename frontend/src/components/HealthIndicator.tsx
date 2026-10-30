'use client';

import React, { useEffect, useState } from 'react';
import { checkHealth } from '@/lib/api';
import { HealthResponse } from '@/types';

export const HealthIndicator: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const data = await checkHealth();
        if (isMounted) setHealth(data);
      } catch (err) {
        if (isMounted) {
          setHealth({
            status: 'degraded',
            version: '0.1.0',
            timestamp: new Date().toISOString(),
            services: { api: 'down', database: 'down' },
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
        <span className="w-2 h-2 rounded-full bg-slate-400 animate-ping" />
        Checking system...
      </div>
    );
  }

  const isHealthy = health?.status === 'healthy';

  return (
    <div
      className={`flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border ${
        isHealthy
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
      title={`API: ${health?.services.api} | DB: ${health?.services.database}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
        }`}
      />
      <span>
        {isHealthy ? 'System Online' : 'Service Degraded'} (API: {health?.services.api})
      </span>
    </div>
  );
};
