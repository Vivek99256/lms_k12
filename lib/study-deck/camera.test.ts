import test from 'node:test';
import assert from 'node:assert/strict';

import { cameraFor, cameraTransform, focusCamera, FOCUS_ZOOM } from './camera';

test('parts close together get the biggest zoom, centred on the one being looked at', () => {
  const parts = [{ x: 45, y: 40 }, { x: 55, y: 40 }, { x: 50, y: 60 }];
  const camera = cameraFor(parts[0], parts);

  assert.ok(camera);
  assert.equal(camera.zoom, 1.3);
  assert.ok(Math.abs(50 + camera.zoom * (parts[0].x - 50 + camera.tx) - 50) < 12, 'the focus ends up near the middle of the window');
});

test('every part stays in view: widely spread parts get a gentler zoom, or none', () => {
  const near = [{ x: 15, y: 50 }, { x: 85, y: 50 }];
  const wide = [{ x: 5, y: 50 }, { x: 95, y: 50 }];
  const gentle = cameraFor(near[0], near);

  assert.ok(gentle && gentle.zoom < 1.3 && gentle.zoom >= 1.1, 'a smaller zoom keeps both parts on screen');
  assert.equal(cameraFor(wide[0], wide), null, 'parts at both edges leave no room to zoom');
});

test('whatever the camera does, no part is pushed out of the window', () => {
  const sets = [
    [{ x: 10, y: 20 }, { x: 40, y: 25 }, { x: 70, y: 22 }],
    [{ x: 50, y: 12 }, { x: 22, y: 78 }, { x: 78, y: 78 }],
    [{ x: 8, y: 12 }, { x: 92, y: 88 }],
  ];
  for (const keep of sets) {
    for (const focus of keep) {
      const camera = cameraFor(focus, keep);
      if (!camera) continue;
      for (const p of keep) {
        const sx = 50 + camera.zoom * (p.x - 50 + camera.tx);
        const sy = 50 + camera.zoom * (p.y - 50 + camera.ty);
        assert.ok(sx >= 4 && sx <= 96 && sy >= 4 && sy <= 96, `part ${p.x},${p.y} at ${sx.toFixed(1)},${sy.toFixed(1)}`);
      }
    }
  }
});

test('the picture is never shifted so far that its edge shows', () => {
  const camera = cameraFor({ x: 15, y: 15 }, [{ x: 15, y: 15 }, { x: 25, y: 20 }]);

  assert.ok(camera);
  assert.ok(Math.abs(camera.tx) <= 50 - 50 / camera.zoom + 1e-9);
  assert.ok(Math.abs(camera.ty) <= 50 - 50 / camera.zoom + 1e-9);
});

test('the CSS transform is "none" with no camera', () => {
  assert.equal(cameraTransform(null), 'none');
  assert.match(cameraTransform({ zoom: 1.2, tx: 3, ty: -4 }), /^scale\(1\.2\) translate\(3%, -4%\)$/);
});

test('focusCamera: a small part is shown larger than a big one, within the zoom limits', () => {
  const small = focusCamera({ x: 50, y: 50 }, 6);
  const big = focusCamera({ x: 50, y: 50 }, 60);
  const middle = focusCamera({ x: 50, y: 50 }, 18);

  assert.equal(small.zoom, FOCUS_ZOOM.max);
  assert.equal(big.zoom, FOCUS_ZOOM.min);
  assert.ok(middle.zoom > FOCUS_ZOOM.min && middle.zoom < FOCUS_ZOOM.max);
  assert.equal(focusCamera({ x: 50, y: 50 }, 0).zoom, FOCUS_ZOOM.max, 'a part with no size still zooms');
});

test('focusCamera: centres on the part but never shows beyond the edge of the picture', () => {
  const centred = focusCamera({ x: 50, y: 50 }, 18);
  assert.equal(centred.tx, 0);
  assert.equal(centred.ty, 0);

  for (const [x, y] of [[0, 0], [100, 100], [3, 97], [97, 3]]) {
    const c = focusCamera({ x, y }, 10);
    const limit = 50 - 50 / c.zoom;
    // The picture's corners must still cover the window: |shift| <= 50 - 50/zoom.
    assert.ok(Math.abs(c.tx) <= limit + 1e-9 && Math.abs(c.ty) <= limit + 1e-9, `${x},${y}`);
    // And the part itself lands inside the window.
    const sx = 50 + c.zoom * (x - 50 + c.tx);
    const sy = 50 + c.zoom * (y - 50 + c.ty);
    assert.ok(sx >= 0 && sx <= 100 && sy >= 0 && sy <= 100, `part ${x},${y} is in view`);
  }
});

test('focusCamera with room: a part moves to the side away from the card, still inside the window', () => {
  const left = focusCamera({ x: 60, y: 50 }, 14, 'left');
  const right = focusCamera({ x: 40, y: 50 }, 14, 'right');
  const sx = (x: number, c: { zoom: number; tx: number }) => 50 + c.zoom * (x - 50 + c.tx);

  assert.ok(sx(60, left) > 60, 'with the card on the left the part sits right of centre');
  assert.ok(sx(40, right) < 40, 'with the card on the right the part sits left of centre');
  for (const c of [left, right]) assert.ok(Math.abs(c.tx) <= 50 - 50 / c.zoom + 1e-9);
  assert.equal(focusCamera({ x: 60, y: 50 }, 14).tx, focusCamera({ x: 60, y: 50 }, 14, undefined).tx, 'no room asked for: centred as before');
});
