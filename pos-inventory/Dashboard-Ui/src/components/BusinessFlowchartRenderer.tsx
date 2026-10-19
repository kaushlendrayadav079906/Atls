import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Workflow,
  ArrowDown,
  GitFork,
  Play,
  CheckCircle2,
  Cpu,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Database
} from 'lucide-react';
import type { FlowchartData, FlowchartNodeType } from '../types/ai';

interface BusinessFlowchartRendererProps {
  data: FlowchartData | { flowchart?: FlowchartData; [key: string]: any };
  className?: string;
}

export const BusinessFlowchartRenderer: React.FC<BusinessFlowchartRendererProps> = ({
  data,
  className = '',
}) => {
  const navigate = useNavigate();
  const flowchart: FlowchartData | undefined = (data as any)?.flowchart || (data as FlowchartData);

  if (!flowchart || !Array.isArray(flowchart.nodes) || flowchart.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-[10px] text-slate-500">
        No flowchart process definition available.
      </div>
    );
  }

  const { title, module, description, nodes = [], edges = [] } = flowchart;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const getNodeIcon = (type: FlowchartNodeType) => {
    switch (type) {
      case 'start':
        return <Play size={12} className="text-emerald-600 fill-emerald-600" />;
      case 'decision':
        return <GitFork size={13} className="text-amber-600" />;
      case 'end':
        return <CheckCircle2 size={13} className="text-purple-600" />;
      case 'process':
      default:
        return <Cpu size={13} className="text-indigo-600" />;
    }
  };

  const getNodeTheme = (type: FlowchartNodeType, isSelected: boolean) => {
    if (isSelected) {
      return {
        card: 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/40 shadow-sm',
        badge: 'bg-indigo-600 text-white',
        border: 'border-indigo-600',
      };
    }

    switch (type) {
      case 'start':
        return {
          card: 'border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white hover:border-emerald-300',
          badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
          border: 'border-emerald-500',
        };
      case 'decision':
        return {
          card: 'border-amber-200 bg-gradient-to-b from-amber-50/60 to-white hover:border-amber-300',
          badge: 'bg-amber-100 text-amber-800 border border-amber-200',
          border: 'border-amber-500',
        };
      case 'end':
        return {
          card: 'border-purple-200 bg-gradient-to-b from-purple-50/60 to-white hover:border-purple-300',
          badge: 'bg-purple-100 text-purple-800 border border-purple-200',
          border: 'border-purple-500',
        };
      case 'process':
      default:
        return {
          card: 'border-indigo-100 bg-gradient-to-b from-slate-50/60 to-white hover:border-indigo-200',
          badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80',
          border: 'border-indigo-500',
        };
    }
  };

  // Find outbound edges for a node to display transition conditions
  const getOutboundEdge = (nodeId: string) => {
    return edges.find((e) => e.from === nodeId);
  };

  return (
    <div className={`rounded-xl border border-indigo-100/90 bg-white overflow-hidden shadow-2xs ${className}`}>
      {/* ── 1. Header ───────────────────────────────────────────────────────── */}
      <div className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-slate-50/80 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
              <Workflow size={13} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/90 px-1.5 py-0.2 rounded border border-indigo-200/70">
                  {module || 'Atlas Process'}
                </span>
                <span className="text-[9.5px] font-semibold text-slate-400">
                  {nodes.length} Steps
                </span>
              </div>
              <h4 className="text-[11.5px] font-bold text-slate-900 tracking-tight truncate mt-0.5">
                {title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-[9px] text-slate-500">
            <span className="hidden sm:inline-flex items-center gap-1 bg-white/80 border border-slate-200/80 rounded-md px-1.5 py-0.5 font-medium">
              <Database size={10} className="text-slate-400" />
              Verified SAP Workflow
            </span>
          </div>
        </div>

        {description && (
          <p className="mt-1.5 text-[10px] text-slate-600 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* ── 2. Process Flow Diagram ─────────────────────────────────────────── */}
      <div className="p-3 bg-slate-50/40">
        <div className="flex flex-col gap-2.5">
          {nodes.map((node, idx) => {
            const isSelected = selectedNodeId === node.id;
            const theme = getNodeTheme(node.type, isSelected);
            const outbound = getOutboundEdge(node.id);
            const isLast = idx === nodes.length - 1;

            return (
              <div key={node.id} className="relative flex flex-col items-stretch">
                {/* Node Box */}
                <div
                  onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                  className={`group relative rounded-xl border p-2.5 transition-all cursor-pointer shadow-3xs ${theme.card}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {/* Step Indicator */}
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 shadow-3xs mt-0.5">
                        {node.stepNumber}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1 font-bold text-[11px] text-slate-900">
                            {getNodeIcon(node.type)}
                            <span>{node.title}</span>
                          </div>

                          {node.badge && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-mono font-semibold bg-white border border-slate-200/90 text-slate-600 shadow-3xs">
                              {node.badge}
                            </span>
                          )}

                          <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${theme.badge}`}>
                            {node.type}
                          </span>
                        </div>

                        <p className="mt-1 text-[10px] text-slate-600 leading-relaxed">
                          {node.description}
                        </p>
                      </div>
                    </div>

                    {/* Deep-link Action button */}
                    {node.route && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(node.route!);
                        }}
                        className="inline-flex items-center gap-1 shrink-0 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 px-2 py-1 text-[9px] font-bold text-indigo-700 shadow-3xs transition cursor-pointer"
                        title={`Open ${node.routeLabel || node.title}`}
                      >
                        <span>{node.routeLabel || 'Open'}</span>
                        <ChevronRight size={10} className="text-indigo-500" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Connecting Arrow between Nodes */}
                {!isLast && (
                  <div className="flex items-center justify-center py-1 relative">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[8.5px] font-medium text-slate-500 shadow-3xs z-10">
                      <ArrowDown size={10} className="text-indigo-500 shrink-0" />
                      {outbound?.label && (
                        <span className="font-semibold text-slate-700">{outbound.label}</span>
                      )}
                      {outbound?.condition && (
                        <span className="text-indigo-600 font-mono">[{outbound.condition}]</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 2.5 Expanded Step Details (if selected) ────────────────────────── */}
      {selectedNode && (
        <div className="mx-3 mb-2 p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 text-[10px] text-indigo-950 flex flex-col gap-1 shadow-3xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[10.5px]">Step #{selectedNode.stepNumber}: {selectedNode.title}</span>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="text-slate-600">{selectedNode.description}</p>
          {selectedNode.route && (
            <div className="mt-1 flex items-center justify-end">
              <button
                type="button"
                onClick={() => navigate(selectedNode.route!)}
                className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg shadow-3xs cursor-pointer"
              >
                <span>Navigate to {selectedNode.routeLabel || selectedNode.title}</span>
                <ChevronRight size={10} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Detail Callout Footer ────────────────────────────────────────── */}
      <div className="border-t border-slate-100 bg-white p-2.5 text-[9.5px] text-slate-500 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
            <Sparkles size={11} className="text-indigo-500" />
            Atlas Intelligence
          </span>
          <span>Click any step to inspect details and jump directly to the relevant system page.</span>
        </div>

        {flowchart.nodes.length > 0 && flowchart.nodes[flowchart.nodes.length - 1].route && (
          <button
            type="button"
            onClick={() => navigate(flowchart.nodes[flowchart.nodes.length - 1].route!)}
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
          >
            <span>{flowchart.nodes[flowchart.nodes.length - 1].routeLabel || 'Open Target Page'}</span>
            <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
};
