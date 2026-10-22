import React, { useState } from 'react';
import { Plus, Calendar, Tag, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Priority } from '../types/todo';

interface AddTaskFormProps {
  onAddTask: (data: {
    title: string;
    description?: string;
    priority: Priority;
    category?: string;
    dueDate?: string;
  }) => Promise<void>;
  disabled?: boolean;
}

const CATEGORY_PRESETS = ['Work', 'Personal', 'Urgent', 'Projects', 'Health', 'Shopping'];

export const AddTaskForm: React.FC<AddTaskFormProps> = ({ onAddTask, disabled }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || submitting || disabled) return;

    try {
      setSubmitting(true);
      await onAddTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: category.trim() || undefined,
        dueDate: dueDate || undefined,
      });

      // Reset
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('');
      setDueDate('');
      setExpanded(false);
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg mb-6 backdrop-blur-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={200}
              placeholder={disabled ? 'Sign in to add personal tasks...' : 'Add a new task... (Press Enter to add)'}
              disabled={disabled || submitting}
              className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all shadow-inner disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            disabled={disabled}
            className="p-3 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title={expanded ? 'Fewer options' : 'More options (Priority, due date, category)'}
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          <button
            type="submit"
            disabled={!title.trim() || submitting || disabled}
            className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm px-4 py-3 rounded-xl shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>

        {/* Expandable Options */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-200">
            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Description / Notes <span className="text-slate-600">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Add additional details, links, or instructions..."
                className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none resize-none transition-all"
              />
            </div>

            {/* Grid options */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['low', 'medium', 'high'] as Priority[]).map((p) => {
                    const active = priority === p;
                    const colors = {
                      low: active ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-300',
                      medium: active ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-300',
                      high: active ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-300',
                    };
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`text-xs py-1.5 rounded-lg capitalize font-medium transition-all cursor-pointer ${colors[p]}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  Category / Tag
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={50}
                  placeholder="e.g. Work, Personal"
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-950/70 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white outline-none transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Quick Preset Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> Suggestions:
              </span>
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer ${
                    category.toLowerCase() === cat.toLowerCase()
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
