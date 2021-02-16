<script>
  export let fromPoint;
  export let toPoint;
  export let type = 'any';
  export let color = undefined;

  $: actualColor = color || (type === 'exec' ? '#E7E7E7' : '#00A7EF');

  function connectionMakePath(fromPoint, toPoint) {
    const { x: x1, y: y1 } = toPoint;
    const { x: x4, y: y4 } = fromPoint;

    let dx = x1 - x4;
    const bezierWeight = dx > 0 ? 0.675 : 1.1;
    dx = Math.max(Math.abs(dx) * bezierWeight, 80);

    const p1x = x1;
    const p1y = y1;

    const p2x = x1 - dx;
    const p2y = y1;

    const p4x = x4;
    const p4y = y4;

    const p3x = x4 + dx;
    const p3y = y4;

    const d = `M${p1x} ${p1y} C ${p2x} ${p2y} ${p3x} ${p3y} ${p4x} ${p4y}`;

    return d;
  }

  $: d = (fromPoint && toPoint && connectionMakePath(fromPoint, toPoint)) || '';
</script>

<path
  {d}
  class="WirePath WirePathType-{type}"
  stroke={actualColor}
  stroke-width="3"
  stroke-linecap="round"
  stroke-linejoin="round"
  fill="none"
/>
