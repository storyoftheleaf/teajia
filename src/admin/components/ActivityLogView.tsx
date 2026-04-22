import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useActivityLogs } from '../hooks/useAdminData';

const ENTITY_ROUTES: Record<string, string> = {
  product: '/admin/inventory?panel=',
  invoice: '/admin/orders?search=',
  customer: '/admin/people?search=',
};

export const ActivityLogView = () => {
  const navigate = useNavigate();
  const { data: logs, isLoading } = useActivityLogs();

  if (isLoading) {
    return <div className="p-12 text-center text-tea-text-sec flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Loading logs...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="border-b border-tea-border pb-6">
        <h2 className="text-2xl font-serif text-tea-text">Logs</h2>
        <p className="text-tea-text-sec text-sm mt-1">Audit trail of inventory changes and sales.</p>
      </div>

      <div className="overflow-hidden border border-tea-border rounded-xl bg-tea-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-tea-bg text-tea-text-sec font-medium uppercase text-xs tracking-[0.2em] border-b border-tea-border">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tea-border">
            {!logs || logs.length === 0 ? (
                <tr>
                    <td colSpan={4} className="p-8 text-center text-tea-text-sec">
                        <div className="flex flex-col items-center gap-2">
                           <AlertCircle size={24} />
                           <span>No activity recorded yet.</span>
                        </div>
                    </td>
                </tr>
            ) : (
                logs.map((log: any) => {
                  const route = log.entity_type && log.entity_id && ENTITY_ROUTES[log.entity_type];
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-tea-bg/50 transition-colors ${route ? 'cursor-pointer' : ''}`}
                      onClick={route ? () => navigate(`${route}${encodeURIComponent(log.entity_id)}`) : undefined}
                    >
                      <td className="py-3 px-4 text-tea-text-sec font-mono text-xs">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-3 px-4 text-tea-text">{log.user_email || 'System'}</td>
                      <td className="py-3 px-4 text-tea-gold">{log.action}</td>
                      <td className="py-3 px-4 text-tea-text-sec">
                        {log.details}
                        {route && <span className="ml-2 text-tea-gold/40 text-[10px]">→</span>}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};