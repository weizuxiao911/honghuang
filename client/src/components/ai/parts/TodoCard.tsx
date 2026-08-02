import React, { useMemo } from 'react';

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: string;
}

export function extractAssistantTodos(value: any): TodoItem[] {
  if (!value) return [];
  let arr: any = null;
  if (Array.isArray(value)) arr = value;
  else if (Array.isArray(value?.todos)) arr = value.todos;
  else if (Array.isArray(value?.data)) arr = value.data;
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const items: TodoItem[] = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const content = (e as any).content;
    const status = (e as any).status;
    const priority = (e as any).priority;
    if (typeof content !== 'string' || content.trim().length === 0) continue;
    const normalizedStatus: TodoItem['status'] =
      status === 'completed' || status === 'in_progress' || status === 'pending'
        ? status
        : 'pending';
    items.push({
      content: content.trim(),
      status: normalizedStatus,
      priority: typeof priority === 'string' ? priority.trim().toLowerCase() : undefined,
    });
  }
  return items;
}

export function findTodosInPart(part: any): TodoItem[] {
  const candidates = [
    part?.state?.output,
    part?.state?.input,
    part?.state?.metadata?.todos,
    part?.state?.metadata,
    part?.state?.raw,
  ];
  for (const c of candidates) {
    const list = extractAssistantTodos(c);
    if (list.length > 0) return list;
  }
  if (typeof part?.state?.output === 'string') {
    try {
      const parsed = JSON.parse(part.state.output);
      const list = extractAssistantTodos(parsed);
      if (list.length > 0) return list;
    } catch { /* noop */ }
  }
  return [];
}

export const TodoCard: React.FC<{ part: any }> = ({ part }) => {
  const todos = useMemo(() => findTodosInPart(part), [part]);
  const toolStatus: string = part?.state?.status || 'pending';
  const stats = useMemo(() => {
    let total = todos.length, completed = 0, inProgress = 0;
    for (const t of todos) {
      if (t.status === 'completed') completed += 1;
      else if (t.status === 'in_progress') inProgress += 1;
    }
    return { total, completed, inProgress };
  }, [todos]);

  if (todos.length === 0) {
    return (
      <div className="tc-todo tc-todo--empty">
        <span className="tc-todo__icon tc-todo__icon--spin">◐</span>
        <span>正在规划任务...</span>
      </div>
    );
  }

  return (
    <div className="tc-todo">
      <div className="tc-todo__head">
        <span className={`tc-todo__status tc-todo__status--${toolStatus}`}>
          {toolStatus === 'completed' ? '✓' : toolStatus === 'running' ? '◐' : '○'}
        </span>
        <span className="tc-todo__title">
          {`任务规划 ${stats.completed}/${stats.total}`}
          {stats.inProgress > 0 ? ` · ${stats.inProgress} 进行中` : ''}
        </span>
      </div>
      <ol className="tc-todo__list">
        {todos.map((t, i) => (
          <li key={i} className={`tc-todo__item is-${t.status}`}>
            <span className="tc-todo__check">
              {t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '◐' : (i + 1)}
            </span>
            <span className="tc-todo__content">{t.content}</span>
            {t.priority && t.priority !== 'medium' && (
              <span className={`tc-todo__pri is-${t.priority}`}>{t.priority}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
