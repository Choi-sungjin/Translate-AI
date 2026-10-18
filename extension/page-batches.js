// One HTTP request per group avoids exhausting the browser's per-origin
// connection pool with page paragraphs, leaving room for input translation.
export function createPageBatcher(send, delay = 30) {
  const groups = new Map(); let pendingCount = 0, chain = Promise.resolve();
  async function flush(group) {
    while (group.jobs.length) {
      const batch = []; let chars = 0;
      while (group.jobs.length && batch.length < 12 && chars + group.jobs[0].text.length <= 12000) {
        const job = group.jobs.shift(); batch.push(job); chars += job.text.length;
      }
      try {
        const result = await send(group.settings, { texts: batch.map(j => j.text), target: group.target, mode: 'page' });
        if (!Array.isArray(result.texts) || result.texts.length !== batch.length || result.texts.some(t => typeof t !== 'string' || !t.trim() || t.length > 60000)) throw new Error('묶음 번역 결과가 올바르지 않습니다.');
        batch.forEach((job, i) => job.resolve(result.texts[i]));
      } catch (error) { batch.forEach(job => job.reject(error)); }
      finally { pendingCount -= batch.length; }
    }
  }
  return (text, target, settings) => new Promise((resolve, reject) => {
    if (typeof text !== 'string' || !text.trim() || text.length > 12000 || pendingCount >= 96) { reject(new Error('페이지 번역 요청이 너무 많거나 너무 깁니다.')); return; }
    const key = JSON.stringify([settings.bridgeToken, target]);
    let group = groups.get(key);
    if (!group) {
      group = { jobs: [], settings, target }; groups.set(key, group);
      setTimeout(() => { groups.delete(key); chain = chain.then(() => flush(group)); }, delay);
    }
    group.jobs.push({ text, resolve, reject }); pendingCount++;
  });
}
