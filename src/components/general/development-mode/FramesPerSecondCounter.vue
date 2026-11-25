<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from "vue";

const barCount = 15;
const publishInterval = 125;
const limits = shallowRef({ "max": 60, "current": 0, "latency": "0", "peak": "16.7" });
const frames = shallowRef<Array<number>>([]);

onMounted(() => {
  let times = new Float64Array(64);
  let head = 0;
  let count = 0;
  let previous: number | undefined;
  let lastPublish = -Infinity;
  let max = 60;
  let peak = 16.7;
  const bars = new Uint32Array(barCount);
  let nextBar = 0;

  function countFrame(now: number): void {
    while (count && times[head] <= now - 1000) {
      head = (head + 1) % times.length;
      count--;
    }
    if (count === 0) {
      previous = undefined;
    }
    if (count === times.length) {
      const larger = new Float64Array(count * 2);

      larger.set(times.subarray(head));
      larger.set(times.subarray(0, head), count - head);
      times = larger;
      head = 0;
    }

    times[(head + count) % times.length] = now;
    count++;
    max = Math.max(max, count);
    const latency = now - (previous ?? now);

    previous = now;
    peak = Math.max(peak, latency);
    bars[nextBar] = count;
    nextBar = (nextBar + 1) % barCount;

    if (now - lastPublish >= publishInterval) {
      lastPublish = now;
      limits.value = {
        max, "current": count, "latency": latency.toFixed(1), "peak": peak.toFixed(1),
      };
      const length = Math.min(count, barCount);

      frames.value = Array.from({ length }, (_, index) => (
        bars[(nextBar - length + index + barCount) % barCount]
      ));
    }
    rafId = requestAnimationFrame(countFrame);
  }

  rafId = requestAnimationFrame(countFrame);
});

let rafId: number;

onUnmounted(() => cancelAnimationFrame(rafId));
</script>

<template>
  <div
    id="__dev-fps-counter__wrapper"
    class="flex flex-col items-end gap-2 bg-black p-2 opacity-50"
  >
    <div
      id="__dev-fps-counter__counter-container"
      class="w-full flex flex-nowrap justify-between gap-4 text-sm text-white font-mono"
    >
      <p id="__dev-fps-counter__counter-current">
        {{ limits.current }} FPS
      </p>
      <p id="__dev-fps-counter__counter-max">
        {{ limits.max }} peak
      </p>
    </div>
    <div
      id="__dev-fps-counter__lines-container"
      class="box-content h-fit w-60 flex flex-nowrap justify-start border"
    >
      <!-- Display only 15 last frames -->
      <div
        v-for="(frame, index) in frames"
        :key="index"
        :id="`__dev-fps-counter__line-${index}`"
        class="h-15 w-4"
        :style="{
          backgroundColor: `hsl(${frame / limits.max * 140} 100% 50%)`,
        }"
      ></div>
    </div>
    <div
      id="__dev-fps-counter__latency-container"
      class="w-full flex flex-nowrap justify-between gap-4 text-sm text-white font-mono"
    >
      <p id="__dev-fps-counter__latency-current">
        {{ limits.latency }} ms
      </p>
      <p id="__dev-fps-counter__latency-current">
        {{ limits.peak }} peak
      </p>
    </div>
  </div>
</template>
