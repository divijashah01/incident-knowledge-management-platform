import { useState } from 'react';

export default function RunbookCard({ runbook }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="font-medium text-gray-900 text-sm">{runbook.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Cluster {runbook.cluster_id} · v{runbook.version} · by {runbook.created_by}
          </p>
        </div>
        <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <pre className="mt-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-4 rounded">
            {runbook.content}
          </pre>
        </div>
      )}
    </div>
  );
}