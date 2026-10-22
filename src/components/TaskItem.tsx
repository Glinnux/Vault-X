import React, { useState } from 'react';
import {
  Check,
  Calendar,
  Tag,
  AlertCircle,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Task } from '../types/todo';

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string, currentCompleted: boolean) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => Promise<void>;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Due date status evaluation
  const getDueDateStatus = () => {
    if (!task.dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate + 'T00:00:00');

    if (task.completed) {
      return { text: task.dueDate, color: 'text-slate-500' };
    }

    if (due < today) {
      return { text: `Overdue (${task.dueDate})`, color: 'text-rose-400 bg-rose-950/50 border-rose-800/50' };
    } else if (due.getTime() === today.getTime()) {
      return { text: 'Due Today', color: 'text-amber-400 bg-amber-950/50 border-amber-800/50' };
    } else {
      return { text: task.dueDate, color: 'text-slate-400 bg-slate-800/60 border-slate-700/60' };
    }
  };

  const dueDateInfo = getDueDateStatus();

  const priorityStyles = {
    high: 'bg-rose-950/50 text-rose-300 border-rose-800/50',
    medium: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
    low: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50',
  };

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setIsDeleting(true);
      await onDelete(task.id);
    } catch (err) {
      console.error('Delete error:', err);
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      className={`group relative bg-slate-900/60 hover:bg-slate-900/90 border transition-all rounded-xl p-3.5 sm:p-4 mb-2.5 ${
        task.completed
          ? 'border-slate-800/60 bg-slate-950/40 opacity-75'
          : 'border-slate-800 hover:border-slate-700 shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Interactive Checkbox */}
        <button
          onClick={() => onToggle(task.id, task.completed)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
            task.completed
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'border-slate-600 hover:border-indigo-400 bg-slate-950/60'
          }`}
          title={task.completed ? 'Mark as incomplete' : 'Mark as completed'}
        >
          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4
              onClick={() => onToggle(task.id, task.completed)}
              className={`text-sm font-medium leading-snug cursor-pointer select-none transition-all break-words ${
                task.completed
                  ? 'line-through text-slate-500'
                  : 'text-slate-100 hover:text-indigo-300'
              }`}
            >
              {task.title}
            </h4>

            {/* Actions for Task */}
            <div className="flex items-center space-x-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Edit Task"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {confirmDelete ? (
                <div className="flex items-center space-x-1 animate-in fade-in">
                  <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-md transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleDeleteClick}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                  title="Delete Task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Optional Description */}
          {task.description && (
            <div className="mt-1.5">
              <p
                className={`text-xs text-slate-400 whitespace-pre-wrap break-words ${
                  !expanded ? 'line-clamp-2' : ''
                }`}
              >
                {task.description}
              </p>
              {task.description.length > 100 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-1 text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                >
                  {expanded ? (
                    <>
                      <span>Show less</span>
                      <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span>Show more</span>
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Badges / Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {/* Priority Badge */}
            <span
              className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                priorityStyles[task.priority]
              }`}
            >
              {task.priority}
            </span>

            {/* Category */}
            {task.category && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded-md">
                <Tag className="w-3 h-3 text-slate-500" />
                <span>{task.category}</span>
              </span>
            )}

            {/* Due Date */}
            {dueDateInfo && (
              <span
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${dueDateInfo.color}`}
              >
                <Calendar className="w-3 h-3" />
                <span>{dueDateInfo.text}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
