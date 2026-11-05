import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "@stemfig/display";
import {
  LABEL_ANGLE_DEFAULT,
  LABEL_GAP_MM,
  labelHitBox,
  labelOffsetMm,
  labelOrbitAxes,
  labelPoseFromOffset,
  pointLabelPage,
} from "./label-pos.ts";

function centerOf(angle: number, text: string): [number, number] {
  const box = labelHitBox(text, DEFAULT_STYLE.textSize);
  const [dx, dy] = labelOffsetMm(angle, text);
  return [dx + box.x + box.w / 2, dy + box.y + box.h / 2];
}

function distToBox(
  angle: number,
  text: string,
  size = DEFAULT_STYLE.textSize,
  gap?: number,
): number {
  const [dx, dy] = labelOffsetMm(angle, text, size, gap);
  const box = labelHitBox(text, size);
  const x = dx + box.x;
  const y = dy + box.y;
  const ox = Math.max(x - 0, 0, 0 - (x + box.w));
  const oy = Math.max(y - 0, 0, 0 - (y + box.h));
  return Math.hypot(ox, oy);
}

function jump(a: number, b: number, text: string): number {
  const p = labelOffsetMm(a, text);
  const q = labelOffsetMm(b, text);
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}

describe("labelOffsetMm", () => {
  it("places the default A in the top-right quadrant", () => {
    const [dx, dy] = labelOffsetMm();
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeLessThan(0);
    expect(LABEL_ANGLE_DEFAULT).toBe(45);
  });

  it("keeps the box center on the grown rectangle", () => {
    const box = labelHitBox("ABCD", DEFAULT_STYLE.textSize);
    const { a, b } = labelOrbitAxes(box);
    for (const angle of [0, 30, 45, 90, 180, 270, 315]) {
      const [cx, cy] = centerOf(angle, "ABCD");
      const onV = Math.abs(Math.abs(cx) - a) < 1e-9;
      const onH = Math.abs(Math.abs(cy) - b) < 1e-9;
      expect(onV || onH).toBe(true);
      expect(Math.abs(cx)).toBeLessThanOrEqual(a + 1e-9);
      expect(Math.abs(cy)).toBeLessThanOrEqual(b + 1e-9);
    }
  });

  it("uses only the height when a wide label sits above the point", () => {
    const box = labelHitBox("ABCD", DEFAULT_STYLE.textSize);
    const [, cy] = centerOf(90, "ABCD");
    expect(Math.abs(cy)).toBeCloseTo(LABEL_GAP_MM + box.h / 2);
    expect(Math.abs(cy)).toBeLessThan(
      LABEL_GAP_MM + Math.hypot(box.w / 2, box.h / 2) - 0.2,
    );
    expect(distToBox(90, "ABCD")).toBeCloseTo(LABEL_GAP_MM);
  });

  it("does not jump when the angle crosses an axis", () => {
    for (const text of ["A", "ABCD"]) {
      expect(jump(0, 1, text)).toBeLessThan(0.2);
      expect(jump(0, 359, text)).toBeLessThan(0.2);
      expect(jump(90, 89, text)).toBeLessThan(0.2);
      expect(jump(90, 91, text)).toBeLessThan(0.2);
    }
  });

  it("keeps a gap of LABEL_GAP_MM on the axes", () => {
    for (const angle of [0, 90, 180, 270]) {
      expect(distToBox(angle, "A")).toBeCloseTo(LABEL_GAP_MM);
      expect(distToBox(angle, "ABC")).toBeCloseTo(LABEL_GAP_MM);
    }
  });

  it("honors a custom labelDistance", () => {
    expect(distToBox(90, "A", DEFAULT_STYLE.textSize, 4)).toBeCloseTo(4);
    expect(distToBox(0, "A", DEFAULT_STYLE.textSize, 0.5)).toBeCloseTo(0.5);
  });

  it("adds the offset on the page", () => {
    const [dx, dy] = labelOffsetMm(0, "A");
    expect(pointLabelPage(10, 20, 0, "A")).toEqual([10 + dx, 20 + dy]);
  });

  it("recovers angle and gap from the box center", () => {
    const box = labelHitBox("A", DEFAULT_STYLE.textSize);
    for (const angle of [0, 45, 90, 180, 270]) {
      const [cx, cy] = centerOf(angle, "A");
      const pose = labelPoseFromOffset(cx, cy, box);
      expect(pose.angle).toBeCloseTo(angle);
      expect(pose.distance).toBeCloseTo(LABEL_GAP_MM);
    }
  });
});
