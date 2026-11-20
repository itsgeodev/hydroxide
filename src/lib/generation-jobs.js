import { useCallback, useEffect, useRef, useState } from 'react';

export function useGenerationJobs() {
  const current = useRef(new Map());
  const [jobs, setJobs] = useState(current.current);

  const change = (chatId, job) => {
    const next = new Map(current.current);
    if (job) next.set(chatId, job);
    else next.delete(chatId);
    current.current = next;
    setJobs(next);
  };

  const start = (chatId, messageId, status) => {
    if (current.current.has(chatId)) return null;
    const controller = new AbortController();
    change(chatId, { chatId, messageId, status, controller });
    return controller;
  };

  const status = (chatId, messageId, value) => {
    const job = current.current.get(chatId);
    if (job?.messageId === messageId && job.status !== value)
      change(chatId, { ...job, status: value });
  };

  const finish = (chatId, messageId) => {
    if (current.current.get(chatId)?.messageId === messageId) change(chatId, null);
  };

  const abortAll = useCallback(() => {
    for (const job of current.current.values()) job.controller.abort();
  }, []);
  useEffect(() => abortAll, [abortAll]);

  return { jobs, start, status, finish, abortAll, current };
}
