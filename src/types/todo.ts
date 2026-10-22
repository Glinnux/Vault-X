export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  category?: string;
  dueDate?: string; // YYYY-MM-DD
  createdAt: any;
  updatedAt: any;
}

export type TaskStatusFilter = 'all' | 'active' | 'completed';
export type TaskPriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type TaskSortOption = 'createdAt-desc' | 'createdAt-asc' | 'dueDate' | 'priority' | 'title';

export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: any;
  updatedAt: any;
}
