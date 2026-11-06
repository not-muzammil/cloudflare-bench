// Example A: A fast, edge-optimized endpoint
export function fastHandler() {
  const items = [1, 2, 3, 4, 5];
  return items.map((x) => x * 2);
}

// Example B: A slow endpoint that does heavy math
export function heavyComputeHandler() {
  let val = 0;
  for (let i = 0; i < 200000; i++) {
    val += Math.sin(i) * Math.cos(i);
  }
  return val;
}

export default fastHandler;
