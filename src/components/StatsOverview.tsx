import React from 'react';
import { CheckCircle2, Clock, Flame, ListTodo } from 'lucide-react';
import { Task } from '../types/todo';

interface StatsOverviewProps {
  tasks: Task[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ tasks }) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const highPriority = tasks.filter((t) => !t.completed && t.priority === 'high').length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
      {/* Total */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Total Tasks</span>
          <div className="p-1.5 rounded-lg bg-slate-800 text-indigo-400">
            <ListTodo className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-white tracking-tight">{total}</span>
          <span className="text-xs text-slate-500">items</span>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
          <div className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-amber-400 tracking-tight">{pending}</span>
          <span className="text-xs text-slate-500">active</span>
        </div>
      </div>

      {/* Completed */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
          <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-emerald-400 tracking-tight">{completed}</span>
          <span className="text-xs text-emerald-500/80 font-medium">({completionPercentage}%)</span>
        </div>
        {/* Micro progress bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* High Priority */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Urgent Focus</span>
          <div className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-400">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-rose-400 tracking-tight">{highPriority}</span>
          <span className="text-xs text-slate-500">high priority</span>
        </div>
      </div>
    </div>
  );
};
