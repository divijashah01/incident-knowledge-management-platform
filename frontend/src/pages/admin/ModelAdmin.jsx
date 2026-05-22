import { useState, useEffect, useRef } from 'react';
import { runModelCommand, getJobStatus } from '../../services/api';

const COMMANDS = [
  {
    key:   'train_classifier',
    label: 'Train Classifier',
    icon:  '🤖',
    desc:  'Retrain the ticket classification model (Logistic Regression + TF-IDF + Metadata). Run this after adding new tickets to the database.',
    time:  '~10 seconds',
  },
  // {
  //   key:   'train_mttr',
  //   label: 'Train MTTR Model',
  //   icon:  '⏱',
  //   desc:  'Retrain the resolution time prediction model (GradientBoosting). Run after classifier retraining.',
  //   time:  '~15 seconds',
  // },
  {
    key:   'generate_embeddings',
    label: 'Generate Embeddings',
    icon:  '🔢',
    desc:  'Regenerate all ticket embeddings and rebuild the FAISS index. Required for semantic search and clustering.',
    time:  '~2 minutes',
  },
  {
    key:   'run_clustering',
    label: 'Run Clustering',
    icon:  '🧩',
    desc:  'Run K-Means clustering on ticket embeddings to detect recurring incident patterns. Requires embeddings to be generated first.',
    time:  '~30 seconds',
  },
  {
    key:   'generate_runbooks',
    label: 'Generate Runbooks',
    icon:  '📖',
    desc:  'Generate LLM runbooks for clusters that have none. Skips approved runbooks. Requires clustering to be run first.',
    time:  '~5 minutes (rate limited)',
  },
  {
    key:   'generate_postmortems',
    label: 'Generate Postmortems',
    icon:  '📋',
    desc:  'Generate LLM postmortems for Critical severity resolved tickets. Skips tickets that already have one.',
    time:  '~5 minutes (rate limited)',
  },
];

function CommandCard({ cmd, onRun }) {
  const [status, setStatus] = useState(null);  // null | running | done | failed
  const [output, setOutput] = useState('');
  const [jobId,  setJobId]  = useState(null);
  const pollRef = useRef(null);

  const run = async () => {
    setStatus('running'); setOutput(''); setJobId(null);
    try {
      const r = await onRun(cmd.key);
      const id = r.data.job_id;
      setJobId(id);

      // Poll every 3 seconds for status
      pollRef.current = setInterval(async () => {
        try {
          const s = await getJobStatus(id);
          if (s.data.status !== 'running') {
            clearInterval(pollRef.current);
            setStatus(s.data.status);
            setOutput(s.data.output || s.data.error || '');
          }
        } catch { clearInterval(pollRef.current); setStatus('failed'); }
      }, 3000);
    } catch (e) {
      setStatus('failed');
      setOutput(e.response?.data?.error || 'Failed to start command.');
    }
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const statusColors = { running:'text-blue-600', done:'text-green-600', failed:'text-red-600' };
  const statusLabels = { running:'Running...', done:'Completed', failed:'Failed' };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cmd.icon}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{cmd.label}</p>
            <p className="text-xs text-gray-400">Est. time: {cmd.time}</p>
          </div>
        </div>
        <button onClick={run} disabled={status==='running'}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0">
          {status==='running' ? 'Running...' : 'Run'}
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-3">{cmd.desc}</p>

      {status && (
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 mb-2">
            {status==='running' && <div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />}
            <span className={`text-xs font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>
          </div>
          {output && (
            <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function ModelAdmin() {
  const run = (command) => runModelCommand(command);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Model Admin</h1>
      <p className="text-sm text-gray-500 mb-2">Trigger retraining and pipeline commands from the UI.</p>
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-700 font-medium">Recommended execution order when retraining from scratch:</p>
        <p className="text-xs text-blue-600 mt-0.5">Train Classifier → Generate Embeddings → Run Clustering → Generate Runbooks → Generate Postmortems</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {COMMANDS.map(cmd => <CommandCard key={cmd.key} cmd={cmd} onRun={run} />)}
      </div>
    </div>
  );
}