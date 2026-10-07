// Match the original app's 100 ms command cadence, independently of BLE acknowledgement latency.
export function startSweep(write: (hz: number) => Promise<unknown>) {
  // Count in tenths of a Hz to avoid floating-point drift over the sweep.
  let nextTenths = 550;
  let current: number | null = null;
  const pending = new Set<Promise<unknown>>();
  let finished = false;
  let resolve!: (hz: number | null) => void;
  let reject!: (error: unknown) => void;
  const done = new Promise<number | null>((yes, no) => { resolve = yes; reject = no; });

  async function finish(record: boolean, failure?: unknown) {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    const results = await Promise.allSettled(pending);
    for (const result of results) {
      if (result.status === 'rejected') failure ??= result.reason;
    }
    try { await write(0); } catch (error) { failure ??= error; }
    if (failure) reject(failure);
    else resolve(record ? current : null);
  }

  function step() {
    if (finished) return;
    // Zero is the firmware's stop command, not a measurable flicker frequency.
    if (nextTenths <= 0) { void finish(false); return; }
    const hz = nextTenths / 10;
    nextTenths -= 1;
    current = hz;
    const request = (async () => write(hz))();
    pending.add(request);
    void request.then(
      () => { pending.delete(request); },
      (error) => { pending.delete(request); void finish(false, error); },
    );
  }

  // ponytail: phone timers/BLE are not real-time; move the sweep into firmware if precise timing is required.
  const timer = setInterval(step, 100);
  step();
  return { done, stop: () => { void finish(true); }, cancel: () => { void finish(false); } };
}
