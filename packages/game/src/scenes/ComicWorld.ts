import type * as Phaser from "phaser";
import { TRACK } from "../config";
import type { CourseRow, RunnerModel } from "../model";

export const INK = 0x101631;
const COLORS = [0xff677e, 0x7461db, 0x27c5d2, 0xf5b94d, 0xee7b48];
type Graphics = Phaser.GameObjects.Graphics;

export function polygon(
  g: Graphics,
  points: number[],
  color: number,
  stroke = true,
  alpha = 1,
): void {
  g.fillStyle(color, alpha).beginPath().moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2)
    g.lineTo(points[i]!, points[i + 1]!);
  g.closePath().fillPath();
  if (stroke) g.lineStyle(2, INK, alpha).strokePath();
}

export function project(
  lane: number,
  ahead: number,
): { x: number; y: number; s: number } {
  const d = Math.max(0, Math.min(1.12, 1 - ahead / TRACK.LOOKAHEAD));
  return {
    x: 195 + (lane - 1) * 126 * (0.07 + d ** 1.6 * 0.93),
    y: TRACK.HORIZON + (TRACK.FEET - TRACK.HORIZON) * d ** 1.7,
    s: 0.07 + d ** 1.6 * 0.93,
  };
}

function building(
  g: Graphics,
  side: number,
  ahead: number,
  index: number,
): void {
  const p = project(1 + side * 2.12, ahead),
    s = p.s;
  const width = (70 + (index % 3) * 24) * s,
    height = (175 + (index % 4) * 47) * s;
  const x = p.x - (side < 0 ? width : 0),
    y = p.y - height;
  const color = COLORS[index % COLORS.length]!;
  polygon(g, [x, y, x + width, y - 13 * s, x + width, p.y, x, p.y], color);
  polygon(
    g,
    [
      x + width,
      y - 13 * s,
      x + width + 18 * s,
      y + 2 * s,
      x + width + 18 * s,
      p.y,
      x + width,
      p.y,
    ],
    0x3b3e77,
  );
  g.lineStyle(Math.max(1, 3 * s), INK).lineBetween(
    x - 5 * s,
    y,
    x + width,
    y - 13 * s,
  );
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = x + (9 + col * 23) * s,
        wy = y + (20 + row * 35) * s;
      g.fillStyle(row % 2 ? 0xffe498 : 0x224b71).fillRect(
        wx,
        wy,
        13 * s,
        22 * s,
      );
      g.lineStyle(Math.max(0.5, s), 0xffffff, 0.5).lineBetween(
        wx,
        wy + 11 * s,
        wx + 13 * s,
        wy + 11 * s,
      );
    }
  }
  g.fillStyle(0x172945).fillRect(
    x + 9 * s,
    p.y - 39 * s,
    width - 18 * s,
    35 * s,
  );
  g.fillStyle(0xffe177).fillRect(
    x + 4 * s,
    p.y - 47 * s,
    width - 8 * s,
    11 * s,
  );
  // Graffiti paint dashes and poster layers on the lower facade.
  g.lineStyle(6 * s, 0xffe177).lineBetween(
    x + 17 * s,
    p.y - 23 * s,
    x + 38 * s,
    p.y - 33 * s,
  );
  g.lineStyle(4 * s, 0xff5f9f).lineBetween(
    x + 22 * s,
    p.y - 12 * s,
    x + 45 * s,
    p.y - 29 * s,
  );
}

export function drawWorld(
  g: Graphics,
  model: RunnerModel,
  clock: number,
  lean: number,
): void {
  g.clear();
  g.fillGradientStyle(0x19b6e7, 0x5084df, 0xffb5aa, 0xffde9f).fillRect(
    0,
    0,
    390,
    760,
  );
  // The sun, clouds, and skyline are layered independently from the course.
  g.fillStyle(0xffe18b).fillCircle(297, 211, 56);
  g.lineStyle(2, 0xfff4c6, 0.8).strokeCircle(297, 211, 65);
  for (let i = 0; i < 4; i++) {
    const x = ((i * 132 + clock / 110 + 50) % 540) - 70;
    const y = 122 + (i % 2) * 42;
    g.fillStyle(0xfff3dd, 0.85)
      .fillEllipse(x, y, 82, 17)
      .fillEllipse(x - 12, y - 6, 39, 21);
  }
  for (let i = 0; i < 15; i++) {
    const x = i * 30 - 20,
      h = 36 + ((i * 19) % 70);
    g.fillStyle(i % 2 ? 0x6769b9 : 0x444f98).fillRect(x, 293 - h, 25, h);
    g.fillStyle(0xffd285, 0.7);
    for (let j = 0; j < 3; j++)
      g.fillRect(x + 5 + (j % 2) * 10, 303 - h + j * 13, 4, 7);
  }
  // A dome and a clock-tower silhouette give the skyline a Boston character.
  g.fillStyle(0xf9cb64)
    .fillEllipse(137, 251, 42, 27)
    .fillRect(116, 252, 43, 38);
  g.lineStyle(2, INK).lineBetween(137, 230, 137, 243);
  g.fillStyle(0xe98391).fillRect(221, 208, 23, 85);
  polygon(g, [217, 208, 232, 186, 248, 208], 0x684da0);
  g.fillStyle(0xffe7af).fillCircle(232, 222, 7);
  g.lineStyle(1, INK)
    .lineBetween(232, 222, 232, 217)
    .lineBetween(232, 222, 236, 224);

  polygon(g, [160, 283, 230, 283, 525, 758, -135, 758], 0x726cb4);
  polygon(g, [160, 283, -135, 758, -220, 758, 142, 283], 0xef7a87);
  polygon(g, [230, 283, 525, 758, 610, 758, 248, 283], 0x37c3d5);
  for (let lane = 0; lane < 3; lane++) {
    const far = project(lane, TRACK.LOOKAHEAD),
      near = project(lane, -8);
    polygon(
      g,
      [far.x - 4, far.y, far.x + 4, far.y, near.x + 42, 758, near.x - 42, 758],
      lane % 2 ? 0x565a96 : 0x62629f,
      false,
    );
    for (let tie = 0; tie < 13; tie++) {
      const p = project(lane, (tie * 8 + 104 - (model.distance % 8)) % 104);
      g.lineStyle(5 * p.s + 0.5, 0x353858).lineBetween(
        p.x - 40 * p.s,
        p.y,
        p.x + 40 * p.s,
        p.y,
      );
      g.lineStyle(p.s, 0xa39bc7).lineBetween(
        p.x - 40 * p.s,
        p.y - 3 * p.s,
        p.x + 40 * p.s,
        p.y - 3 * p.s,
      );
    }
    g.lineStyle(5, INK)
      .lineBetween(far.x - 2, far.y, near.x - 29, 758)
      .lineBetween(far.x + 2, far.y, near.x + 29, 758);
    g.lineStyle(2.5, 0xd4e7eb)
      .lineBetween(far.x - 2, far.y, near.x - 27, 758)
      .lineBetween(far.x + 2, far.y, near.x + 27, 758);
  }
  for (let index = 8; index >= 0; index--) {
    const ahead = (index * 15 + 135 - (model.distance % 15)) % 135;
    if (ahead < TRACK.LOOKAHEAD + 15) {
      building(g, -1, ahead, index);
      building(g, 1, ahead + 5, index + 2);
    }
  }
  // Overhead wires, station arches and pennants.
  g.lineStyle(1.5, INK, 0.6)
    .lineBetween(0, 152, 195, 280)
    .lineBetween(390, 143, 195, 280);
  for (let i = 0; i < 5; i++) {
    const p = project(1, (i * 23 + 115 - (model.distance % 23)) % 115);
    if (p.s < 0.15) continue;
    g.lineStyle(5 * p.s, 0x172d58)
      .lineBetween(195 - 207 * p.s, p.y, 195 - 207 * p.s, p.y - 190 * p.s)
      .lineBetween(195 + 207 * p.s, p.y, 195 + 207 * p.s, p.y - 190 * p.s)
      .lineBetween(
        195 - 207 * p.s,
        p.y - 190 * p.s,
        195 + 207 * p.s,
        p.y - 190 * p.s,
      );
    for (let n = 0; n < 7; n++) {
      const x = 195 + (n - 3) * 49 * p.s,
        y = p.y - 190 * p.s;
      polygon(
        g,
        [x, y, x + 23 * p.s, y, x + 10 * p.s, y + 20 * p.s],
        COLORS[n % COLORS.length]!,
        false,
      );
    }
  }
  const rows = model.rows.filter(
    (row) =>
      row.distance - model.distance > -4 &&
      row.distance - model.distance < TRACK.LOOKAHEAD + 6,
  );
  for (let i = rows.length - 1; i >= 0; i--)
    drawRow(g, rows[i]!, model.distance, clock);
  if (model.running) {
    for (let i = 0; i < 10; i++) {
      const phase = (clock / 650 + i * 0.137) % 1;
      const side = i % 2 ? 1 : -1;
      const x = 195 + side * (80 + phase * 190) + lean * 3;
      const y = 350 + phase * 340;
      g.lineStyle(1.5 + phase * 2, 0xfff0af, phase * 0.5).lineBetween(
        x,
        y,
        x + side * phase * 25,
        y + phase * 65,
      );
    }
  }
}

function drawRow(
  g: Graphics,
  row: CourseRow,
  distance: number,
  clock: number,
): void {
  const ahead = row.distance - distance,
    { x, y, s } = project(row.lane, ahead);
  g.fillStyle(INK, 0.18).fillEllipse(x, y + 4 * s, 96 * s, 18 * s);
  if (!row.passed) {
    if (row.hazard === "train") {
      const color = [0xff4e72, 0x27c7d8, 0xffac37][row.lane]!;
      polygon(
        g,
        [
          x - 42 * s,
          y - 133 * s,
          x + 32 * s,
          y - 133 * s,
          x + 49 * s,
          y - 116 * s,
          x - 29 * s,
          y - 116 * s,
        ],
        0xffedd5,
      );
      g.fillStyle(color).fillRoundedRect(
        x - 45 * s,
        y - 123 * s,
        90 * s,
        122 * s,
        11 * s,
      );
      g.lineStyle(3 * s, INK).strokeRoundedRect(
        x - 45 * s,
        y - 123 * s,
        90 * s,
        122 * s,
        11 * s,
      );
      g.fillStyle(0xfff2cb).fillRect(x - 42 * s, y - 117 * s, 84 * s, 12 * s);
      g.fillStyle(0x143b64).fillRoundedRect(
        x - 35 * s,
        y - 98 * s,
        70 * s,
        44 * s,
        5 * s,
      );
      polygon(
        g,
        [
          x - 32 * s,
          y - 95 * s,
          x - 12 * s,
          y - 95 * s,
          x + 13 * s,
          y - 58 * s,
          x - 7 * s,
          y - 58 * s,
        ],
        0x69dfed,
        false,
        0.7,
      );
      g.lineStyle(2 * s, INK).lineBetween(x, y - 99 * s, x, y - 54 * s);
      g.fillStyle(0xffedc6).fillRect(x - 42 * s, y - 43 * s, 84 * s, 15 * s);
      g.fillStyle(INK).fillCircle(x, y - 35 * s, 11 * s);
      g.lineStyle(3 * s, 0xffffff)
        .lineBetween(x - 6 * s, y - 39 * s, x + 6 * s, y - 39 * s)
        .lineBetween(x, y - 39 * s, x, y - 29 * s);
      g.fillStyle(0xffeb7c)
        .fillCircle(x - 29 * s, y - 16 * s, 6 * s)
        .fillCircle(x + 29 * s, y - 16 * s, 6 * s);
      g.fillStyle(INK).fillRect(x - 24 * s, y - 5 * s, 48 * s, 10 * s);
    } else if (row.hazard === "barrier") {
      g.fillStyle(INK)
        .fillRect(x - 39 * s, y - 15 * s, 9 * s, 15 * s)
        .fillRect(x + 30 * s, y - 15 * s, 9 * s, 15 * s);
      g.fillStyle(0xffce45).fillRoundedRect(
        x - 45 * s,
        y - 44 * s,
        90 * s,
        32 * s,
        4 * s,
      );
      g.lineStyle(3 * s, INK).strokeRoundedRect(
        x - 45 * s,
        y - 44 * s,
        90 * s,
        32 * s,
        4 * s,
      );
      for (let stripe = -32; stripe < 33; stripe += 22)
        polygon(
          g,
          [
            x + stripe * s,
            y - 42 * s,
            x + (stripe + 12) * s,
            y - 42 * s,
            x + (stripe - 2) * s,
            y - 14 * s,
            x + (stripe - 14) * s,
            y - 14 * s,
          ],
          INK,
          false,
        );
    } else {
      g.lineStyle(8 * s, INK)
        .lineBetween(x - 46 * s, y, x - 46 * s, y - 115 * s)
        .lineBetween(x + 46 * s, y, x + 46 * s, y - 115 * s);
      g.lineStyle(4 * s, 0x1edbd1)
        .lineBetween(x - 46 * s, y, x - 46 * s, y - 115 * s)
        .lineBetween(x + 46 * s, y, x + 46 * s, y - 115 * s);
      g.fillStyle(0xfb4e86).fillRoundedRect(
        x - 50 * s,
        y - 91 * s,
        100 * s,
        34 * s,
        4 * s,
      );
      g.lineStyle(3 * s, INK).strokeRoundedRect(
        x - 50 * s,
        y - 91 * s,
        100 * s,
        34 * s,
        4 * s,
      );
      g.fillStyle(0xffedba).fillRect(x - 43 * s, y - 85 * s, 86 * s, 7 * s);
    }
  }
  if (!row.collected && ahead > 6) {
    const p = project(row.coinLane, ahead - 6);
    const bob = Math.sin(clock / 160 + row.distance) * 3 * p.s;
    const width =
      Math.max(5, Math.abs(Math.cos(clock / 240 + row.distance)) * 20) * p.s;
    g.fillStyle(0xffee8b, 0.18).fillCircle(p.x, p.y - 30 * p.s + bob, 20 * p.s);
    g.fillStyle(0xe89921).fillEllipse(
      p.x + 3 * p.s,
      p.y - 29 * p.s + bob,
      width + 4 * p.s,
      28 * p.s,
    );
    g.fillStyle(0xffdf51).fillEllipse(
      p.x,
      p.y - 31 * p.s + bob,
      width,
      28 * p.s,
    );
    g.lineStyle(2 * p.s, 0xfff3bd).strokeEllipse(
      p.x,
      p.y - 31 * p.s + bob,
      width * 0.7,
      20 * p.s,
    );
    g.fillStyle(0xffffff).fillCircle(
      p.x - 4 * p.s,
      p.y - 39 * p.s + bob,
      2.5 * p.s,
    );
  }
}

export function drawHero(
  g: Graphics,
  x: number,
  feet: number,
  model: RunnerModel,
  clock: number,
  lean: number,
): void {
  const jump =
    model.jumpLeft > 0
      ? Math.sin((1 - model.jumpLeft / 900) * Math.PI) * 112
      : 0;
  const duck = model.duckLeft > 0,
    y = feet - jump,
    squash = duck ? 24 : 0;
  const stride = model.running
    ? Math.sin(clock / 65) * 12
    : Math.sin(clock / 500) * 2;
  const bob = model.running
    ? Math.abs(Math.sin(clock / 65)) * 3
    : Math.sin(clock / 400) * 2;
  g.clear();
  g.fillStyle(INK, 0.3).fillEllipse(x, feet + 5, 65 - jump / 8, 15);
  if (model.running) {
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x36ffe4, 0.17 - i * 0.04).fillEllipse(
        x - lean * (15 + i * 7),
        feet + i * 11,
        28 + i * 7,
        5,
      );
    }
  }
  // Legs and big high-top sneakers, posed separately for a readable run cycle.
  for (const side of [-1, 1]) {
    const hipX = x + side * 9,
      kneeX = x + side * (12 + stride * 0.25),
      footX = x + side * (14 + stride * 0.55);
    g.lineStyle(14, INK)
      .lineBetween(
        hipX,
        y - 31 + squash / 3,
        kneeX,
        y - 14 - (side * stride) / 3,
      )
      .lineBetween(
        kneeX,
        y - 14 - (side * stride) / 3,
        footX,
        y - 3 - (side * stride) / 4,
      );
    g.lineStyle(8, 0x284f96)
      .lineBetween(
        hipX,
        y - 31 + squash / 3,
        kneeX,
        y - 14 - (side * stride) / 3,
      )
      .lineBetween(
        kneeX,
        y - 14 - (side * stride) / 3,
        footX,
        y - 3 - (side * stride) / 4,
      );
    g.fillStyle(0xffd149).fillRoundedRect(
      footX - 10,
      y - 7 - (side * stride) / 4,
      24,
      12,
      4,
    );
    g.lineStyle(2, INK).strokeRoundedRect(
      footX - 10,
      y - 7 - (side * stride) / 4,
      24,
      12,
      4,
    );
    g.fillStyle(0xfff4d6).fillRect(
      footX - 8,
      y + 1 - (side * stride) / 4,
      21,
      3,
    );
  }
  const top = y - 88 + squash + bob;
  // A streaming red scarf, pink hoodie and teal lightning backpack.
  polygon(
    g,
    [
      x - 13,
      top + 12,
      x - 38 - Math.sin(clock / 110) * 9,
      top + 5,
      x - 58,
      top + 19,
      x - 37,
      top + 21,
      x - 18,
      top + 26,
    ],
    0xff4e78,
  );
  g.lineStyle(12, INK)
    .lineBetween(x - 21, top + 26, x - 31 - lean * 2, top + 45 + stride / 2)
    .lineBetween(x + 21, top + 26, x + 31 - lean * 2, top + 45 - stride / 2);
  g.lineStyle(7, 0xff7898)
    .lineBetween(x - 21, top + 26, x - 31 - lean * 2, top + 45 + stride / 2)
    .lineBetween(x + 21, top + 26, x + 31 - lean * 2, top + 45 - stride / 2);
  g.fillStyle(0xf3b98f)
    .fillCircle(x - 31 - lean * 2, top + 45 + stride / 2, 5)
    .fillCircle(x + 31 - lean * 2, top + 45 - stride / 2, 5);
  g.fillStyle(0xf44c83).fillRoundedRect(
    x - 23,
    top + 13,
    46,
    45 - squash / 2,
    12,
  );
  g.lineStyle(3, INK).strokeRoundedRect(
    x - 23,
    top + 13,
    46,
    45 - squash / 2,
    12,
  );
  g.fillStyle(0x2be1cf).fillRoundedRect(
    x - 17,
    top + 20,
    34,
    34 - squash / 3,
    9,
  );
  g.lineStyle(3, INK).strokeRoundedRect(
    x - 17,
    top + 20,
    34,
    34 - squash / 3,
    9,
  );
  g.fillStyle(0x9bfff0).fillRoundedRect(x - 12, top + 25, 24, 5, 2);
  polygon(
    g,
    [
      x + 2,
      top + 29,
      x - 7,
      top + 40,
      x,
      top + 40,
      x - 2,
      top + 48,
      x + 9,
      top + 36,
      x + 2,
      top + 36,
    ],
    0xffe16b,
    false,
  );
  g.fillStyle(0x5d327b).fillEllipse(x, top + 10, 42, 30);
  g.lineStyle(3, INK).strokeEllipse(x, top + 10, 42, 30);
  g.fillStyle(0xe8af89).fillCircle(x, top - 4, 15);
  g.lineStyle(3, INK).strokeCircle(x, top - 4, 15);
  g.fillStyle(0x1b2545).fillRoundedRect(x - 16, top - 15, 32, 18, 7);
  g.fillStyle(0x2fcbdc).fillRoundedRect(x - 18, top - 22, 35, 16, 7);
  g.lineStyle(3, INK).strokeRoundedRect(x - 18, top - 22, 35, 16, 7);
  polygon(
    g,
    [x + 4, top - 9, x + 27, top - 7, x + 30, top - 2, x + 7, top - 1],
    0xffd249,
  );
  g.fillStyle(0x8cfff0).fillRect(x - 12, top - 18, 9, 3);
}
