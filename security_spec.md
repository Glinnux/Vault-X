# Security Specification: TaskFlow To-Do Application

## 1. Data Invariants
1. **Strict User Isolation**: A task document under `/users/{userId}/tasks/{taskId}` can ONLY be read, listed, created, modified, or deleted by the authenticated user whose `request.auth.uid == userId`.
2. **Path Parameter Integrity**: Document IDs `{userId}` and `{taskId}` must conform to safe regex patterns `^[a-zA-Z0-9_-]+$` with length <= 128 characters to prevent path traversal or injection.
3. **Temporal Integrity**: `createdAt` and `updatedAt` timestamps on write must strictly equal `request.time`. On update, `createdAt` and `userId` are immutable and cannot be changed.
4. **Mandatory Field Integrity**: A Task must contain `userId`, `title` (length 1-200), `completed` (boolean), `priority` ('low' | 'medium' | 'high'), and valid timestamps. Optional fields like `description`, `category`, and `dueDate` must conform to strict type and size bounds.
5. **No Unauthorized Cross-User Reads**: An unauthenticated user or authenticated user `A` cannot query, fetch, or listen to the tasks of user `B`.
6. **No Phantom / Ghost Keys**: Creation payloads are restricted to defined keys only (`data.keys().hasOnly(...)`).
7. **Action-Based Updates**: Updates must only alter permitted task properties (completion state, task content) and bump `updatedAt` to `request.time`.

---

## 2. The "Dirty Dozen" Payloads (Malicious / Invalid Writes)

1. **Spoofed User ID (Cross-Account Injection)**:
   - Attempt by User A (`auth.uid: user_a`) to write a task under `/users/user_b/tasks/task_1`.
   - Expected Result: `PERMISSION_DENIED`
2. **Unauthenticated Read**:
   - Unauthenticated client attempting `get` or `list` on `/users/user_123/tasks`.
   - Expected Result: `PERMISSION_DENIED`
3. **Cross-User Snooping (List Query)**:
   - User A querying `/users/user_b/tasks`.
   - Expected Result: `PERMISSION_DENIED`
4. **Title Buffer Overflow (Denial of Wallet)**:
   - User submitting a task with a `title` containing 50,000 characters.
   - Expected Result: `PERMISSION_DENIED`
5. **Empty Title Attack**:
   - User submitting a task with an empty `title` (`""`).
   - Expected Result: `PERMISSION_DENIED`
6. **Ghost Field Poisoning (Shadow Keys)**:
   - User creating a task with extra unauthorized field `isAdmin: true` or `role: "superuser"`.
   - Expected Result: `PERMISSION_DENIED`
7. **Client-Manipulated Timestamps**:
   - User creating a task with `createdAt: 1999-01-01T00:00:00Z` instead of `request.time`.
   - Expected Result: `PERMISSION_DENIED`
8. **Immutable Field Tampering on Update**:
   - User attempting to change `userId` or `createdAt` on an existing task.
   - Expected Result: `PERMISSION_DENIED`
9. **Invalid Priority Value**:
   - User creating a task with `priority: "super-critical"` (not in `['low', 'medium', 'high']`).
   - Expected Result: `PERMISSION_DENIED`
10. **Invalid Path ID Characters (Path Traversal/Poisoning)**:
    - Target task ID `../../evil` or `task#%$!*`.
    - Expected Result: `PERMISSION_DENIED`
11. **Type Confusion Attack**:
    - Submitting `completed: "true"` (string instead of boolean).
    - Expected Result: `PERMISSION_DENIED`
12. **Foreign Profile Tampering**:
    - User A attempting to modify `/users/user_b` profile document.
    - Expected Result: `PERMISSION_DENIED`

---

## 3. Test Runner Specification (`firestore.rules.test.ts`)
The test cases simulate unauthorized and malformed operations against the ruleset, ensuring every rule gate strictly holds.
