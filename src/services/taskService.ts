import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Priority, Task } from '../types/todo';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: Priority;
  category?: string;
  dueDate?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: Priority;
  category?: string;
  dueDate?: string;
  completed?: boolean;
}

/**
 * Subscribes to real-time updates for a user's isolated task list.
 */
export function subscribeToTasks(
  userId: string,
  onUpdate: (tasks: Task[]) => void,
  onError: (error: unknown) => void
): () => void {
  const collectionPath = `users/${userId}/tasks`;
  const tasksRef = collection(db, 'users', userId, 'tasks');
  const q = query(tasksRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Task[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || '',
          description: data.description,
          completed: Boolean(data.completed),
          priority: (data.priority as Priority) || 'medium',
          category: data.category,
          dueDate: data.dueDate,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      onUpdate(items);
    },
    (error) => {
      console.error('Error fetching tasks live subscription:', error);
      onError(error);
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

/**
 * Creates a new personal task strictly linked to the authenticated user.
 */
export async function createTask(userId: string, payload: CreateTaskPayload): Promise<string> {
  const cleanTitle = payload.title.trim().slice(0, 200);
  if (!cleanTitle) {
    throw new Error('Task title cannot be empty.');
  }

  const tasksRef = collection(db, 'users', userId, 'tasks');
  const newDocRef = doc(tasksRef);
  const docPath = `users/${userId}/tasks/${newDocRef.id}`;

  const taskDoc: Record<string, any> = {
    userId,
    title: cleanTitle,
    completed: false,
    priority: payload.priority || 'medium',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.description && payload.description.trim()) {
    taskDoc.description = payload.description.trim().slice(0, 2000);
  }

  if (payload.category && payload.category.trim()) {
    taskDoc.category = payload.category.trim().slice(0, 50);
  }

  if (payload.dueDate && payload.dueDate.trim()) {
    taskDoc.dueDate = payload.dueDate.trim().slice(0, 50);
  }

  try {
    await setDoc(newDocRef, taskDoc);
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

/**
 * Toggles the completed state of a personal task.
 */
export async function toggleTaskCompleted(
  userId: string,
  taskId: string,
  completed: boolean
): Promise<void> {
  const docPath = `users/${userId}/tasks/${taskId}`;
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);

  try {
    await updateDoc(taskRef, {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Updates task fields (title, description, priority, category, dueDate, etc.).
 */
export async function updateTask(
  userId: string,
  taskId: string,
  payload: UpdateTaskPayload
): Promise<void> {
  const docPath = `users/${userId}/tasks/${taskId}`;
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);

  const updates: Record<string, any> = {
    updatedAt: serverTimestamp(),
  };

  if (payload.title !== undefined) {
    const cleanTitle = payload.title.trim().slice(0, 200);
    if (!cleanTitle) throw new Error('Title cannot be empty');
    updates.title = cleanTitle;
  }

  if (payload.description !== undefined) {
    updates.description = payload.description.trim() ? payload.description.trim().slice(0, 2000) : '';
  }

  if (payload.priority !== undefined) {
    updates.priority = payload.priority;
  }

  if (payload.category !== undefined) {
    updates.category = payload.category.trim() ? payload.category.trim().slice(0, 50) : '';
  }

  if (payload.dueDate !== undefined) {
    updates.dueDate = payload.dueDate.trim() ? payload.dueDate.trim().slice(0, 50) : '';
  }

  if (payload.completed !== undefined) {
    updates.completed = Boolean(payload.completed);
  }

  try {
    await updateDoc(taskRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

/**
 * Deletes a personal task record permanently.
 */
export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const docPath = `users/${userId}/tasks/${taskId}`;
  const taskRef = doc(db, 'users', userId, 'tasks', taskId);

  try {
    await deleteDoc(taskRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Batch clears all completed tasks for the user.
 */
export async function clearCompletedTasks(userId: string, taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;

  const batch = writeBatch(db);
  taskIds.forEach((id) => {
    const taskRef = doc(db, 'users', userId, 'tasks', id);
    batch.delete(taskRef);
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/tasks`);
  }
}
