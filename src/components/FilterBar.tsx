import React from 'react';
import { Search, X, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  Priority,
  TaskPriorityFilter,
  TaskSortOption,
  TaskStatusFilter,
} from '../types/todo';

interface FilterBarProps {
  statusFilter: TaskStatusFilter;
  setStatusFilter: (status: TaskStatusFilter) => void;
  priorityFilter: TaskPriorityFilter;
  setPriorityFilter: (priority: TaskPriorityFilter) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  sortBy: TaskSortOption;
  setSortBy: (sort: TaskSortOption) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categories: string[];
  totalCounts: {
    all: number;
    active: number;
    completed: number;
  };
  onClearCompleted: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  categoryFilter,
  setCategoryFilter,
  sortBy,
  setSortBy,
  searchQuery,
  setSearchQuery,
  categories,
  totalCounts,
  onClearCompleted,
}) => {
  return (
    <div className="space-y-3.5 mb-5">
      {/* Top row: Status Tabs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === 'all' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {totalCounts.all}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Active</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === 'active' ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {totalCounts.active}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Completed</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === 'completed' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-800 text-slate-400'
              }`}
            >
              {totalCounts.completed}
            </span>
          </button>
        </div>

        {/* Clear Completed Action */}
        {totalCounts.completed > 0 && (
          <button
            onClick={onClearCompleted}
            className="flex items-center space-x-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/50 px-3 py-1.5 rounded-xl transition-all self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Completed ({totalCounts.completed})</span>
          </button>
        )}
      </div>

      {/* Second row: Search, Priority, Category & Sort Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        {/* Search */}
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title, note, or tag..."
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority Filter */}
        <div className="sm:col-span-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriorityFilter)}
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-slate-300 outline-none transition-all cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="sm:col-span-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-slate-300 outline-none transition-all cursor-pointer"
          >
            <option value="all">All Tags</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="sm:col-span-3">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TaskSortOption)}
              className="w-full bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none transition-all cursor-pointer"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority (High to Low)</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
