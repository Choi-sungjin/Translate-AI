// Batch nearby page requests, while a separate bounded lane keeps typing responsive.
export function createTranslationQueue({ translate, translateBatch, cwd, batchDelay = 40 }) {
  const pages = [], inputs = [];
  let pageActive = false, inputActive = false, timer;
  const stats = () => ({ active: Number(pageActive) + Number(inputActive), queued: pages.length + inputs.length });
  function take(queue) {
    while (queue.length) {
      const job = queue.shift();
      if (!job.cancelled()) return job;
      job.reject(new Error('취소된 요청입니다.'));
    }
  }
  function pumpInput() {
    if (inputActive) return;
    const job = take(inputs); if (!job) return;
    inputActive = true;
    Promise.resolve().then(() => translate(job.data, cwd)).then(job.resolve, job.reject)
      .finally(() => { inputActive = false; pumpInput(); });
  }
  function pumpPage() {
    timer = undefined;
    if (pageActive) return;
    const first = take(pages); if (!first) return;
    const batch = [first]; let chars = first.data.text.length;
    // Keep language boundaries and bound both output size and time to first result.
    for (let i = 0; i < pages.length && batch.length < 12;) {
      const job = pages[i];
      if (job.cancelled()) { pages.splice(i, 1); job.reject(new Error('취소된 요청입니다.')); continue; }
      if (job.data.target === first.data.target && chars + job.data.text.length <= 12000) {
        pages.splice(i, 1); batch.push(job); chars += job.data.text.length;
      } else i++;
    }
    pageActive = true;
    Promise.resolve().then(async () => {
      const results = batch.length === 1 ? [await translate(first.data, cwd)]
        : await translateBatch({ texts: batch.map(j => j.data.text), target: first.data.target }, cwd);
      if (!Array.isArray(results) || results.length !== batch.length || results.some(t => typeof t !== 'string' || !t.trim() || t.length > 60000)) {
        throw new Error('묶음 번역 결과가 올바르지 않습니다. 원문은 유지됩니다.');
      }
      batch.forEach((job, i) => job.resolve(results[i]));
    }).catch(error => batch.forEach(job => job.reject(error)))
      .finally(() => { pageActive = false; if (pages.length) timer = setTimeout(pumpPage, batchDelay); });
  }
  function schedule(data, mode, cancelled = () => false) {
    return new Promise((resolve, reject) => {
      const input = mode !== 'page', queue = input ? inputs : pages;
      if (queue.length >= (input ? 8 : 96)) { reject(new Error('번역 대기열이 가득 찼습니다. 잠시 후 다시 시도하세요.')); return; }
      queue.push({ data, resolve, reject, cancelled });
      if (input) pumpInput();
      else if (!pageActive && !timer) timer = setTimeout(pumpPage, batchDelay);
    });
  }
  return { schedule, stats };
}
