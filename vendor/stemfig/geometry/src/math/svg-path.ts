/**
 * SVG path d → 절대 M L C Q A Z.
 * H/V 는 L, S/T 는 반사로 C/Q. 상대는 현재점에 더한다.
 * GeoDef 를 모른다. 문법 오류는 BAD_FN.
 */
import { stemfigError } from "@stemfig/host";
import { type BezierSeg } from "./bezier.ts";

const SIG = 6;

/**
 * @param d SVG 1.1 path data
 * @param path StemfigValidationError.path
 * @throws BAD_FN 빈 문자열·미지 명령·인자 부족
 */
export function parseD(d: string, path: string): BezierSeg[] {
  const toks = lex(d, path);
  if (toks.length === 0) {
    throw stemfigError("BAD_FN", path, "empty path");
  }
  return readSegs(toks, path);
}

/**
 * 패널 쓰기 전. throw 하지 않는다.
 */
export function dOk(d: string): boolean {
  try {
    parseD(d, "d");
    return true;
  } catch {
    return false;
  }
}

/**
 * 절대 M L C Q A Z. 유효숫자 6자리. 상대·H/V/S/T 는 사라진다.
 */
export function serializeD(segs: readonly BezierSeg[]): string {
  return segs
    .map((seg) => {
      if (seg.op === "Z") {
        return "Z";
      }
      if (seg.op === "M" || seg.op === "L") {
        return `${seg.op} ${n(seg.x)} ${n(seg.y)}`;
      }
      if (seg.op === "C") {
        return `C ${n(seg.x1)} ${n(seg.y1)} ${n(seg.x2)} ${n(seg.y2)} ${n(seg.x)} ${n(seg.y)}`;
      }
      if (seg.op === "Q") {
        return `Q ${n(seg.x1)} ${n(seg.y1)} ${n(seg.x)} ${n(seg.y)}`;
      }
      return `A ${n(seg.rx)} ${n(seg.ry)} ${n(seg.rot)} ${seg.large ? 1 : 0} ${seg.sweep ? 1 : 0} ${n(seg.x)} ${n(seg.y)}`;
    })
    .join(" ");
}

function n(v: number): string {
  if (!Number.isFinite(v)) {
    return "0";
  }
  return String(Number(v.toPrecision(SIG)));
}

type Tok = { k: "cmd"; v: string } | { k: "num"; v: number };

function lex(d: string, path: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const fail = (msg: string): never => {
    throw stemfigError("BAD_FN", path, msg);
  };
  while (i < d.length) {
    const ch = d[i]!;
    if (ch === " " || ch === "," || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(ch)) {
      out.push({ k: "cmd", v: ch });
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "." || (ch >= "0" && ch <= "9")) {
      const start = i;
      if (ch === "+" || ch === "-") {
        i += 1;
      }
      while (i < d.length && d[i]! >= "0" && d[i]! <= "9") {
        i += 1;
      }
      if (d[i] === ".") {
        i += 1;
        while (i < d.length && d[i]! >= "0" && d[i]! <= "9") {
          i += 1;
        }
      }
      if (d[i] === "e" || d[i] === "E") {
        i += 1;
        if (d[i] === "+" || d[i] === "-") {
          i += 1;
        }
        while (i < d.length && d[i]! >= "0" && d[i]! <= "9") {
          i += 1;
        }
      }
      const v = Number(d.slice(start, i));
      if (!Number.isFinite(v) || i === start) {
        fail("bad number");
      }
      out.push({ k: "num", v });
      continue;
    }
    fail(`bad char ${ch}`);
  }
  return out;
}

function readSegs(toks: Tok[], path: string): BezierSeg[] {
  const fail = (msg: string): never => {
    throw stemfigError("BAD_FN", path, msg);
  };
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let px = 0;
  let py = 0;
  let prev = "";
  const segs: BezierSeg[] = [];
  const num = (): number => {
    const tok = toks[i];
    if (!tok || tok.k !== "num") {
      return fail("missing number");
    }
    i += 1;
    return tok.v;
  };
  const flag = (): boolean => {
    const v = num();
    if (v !== 0 && v !== 1) {
      fail("arc flag");
    }
    return v === 1;
  };

  if (toks[0]?.k !== "cmd") {
    fail("path must start with a command");
  }

  while (i < toks.length) {
    const tok = toks[i]!;
    if (tok.k === "cmd") {
      cmd = tok.v;
      i += 1;
    } else if (!cmd) {
      fail("missing command");
    }
    if (cmd === "Z" || cmd === "z") {
      segs.push({ op: "Z" });
      x = sx;
      y = sy;
      prev = "Z";
      /* 닫기 뒤 숫자는 새 명령이 없다. cmd 를 비우지 않으면 같은 토큰에서 무한 반복한다. */
      cmd = "";
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const up = cmd.toUpperCase();
    if (up === "M") {
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "M", x: nx, y: ny });
      x = nx;
      y = ny;
      sx = nx;
      sy = ny;
      prev = "M";
      cmd = rel ? "l" : "L";
      continue;
    }
    if (up === "L") {
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "L", x: nx, y: ny });
      x = nx;
      y = ny;
      prev = "L";
      continue;
    }
    if (up === "H") {
      const nx = rel ? x + num() : num();
      segs.push({ op: "L", x: nx, y });
      x = nx;
      prev = "L";
      continue;
    }
    if (up === "V") {
      const ny = rel ? y + num() : num();
      segs.push({ op: "L", x, y: ny });
      y = ny;
      prev = "L";
      continue;
    }
    if (up === "C") {
      const x1 = rel ? x + num() : num();
      const y1 = rel ? y + num() : num();
      const x2 = rel ? x + num() : num();
      const y2 = rel ? y + num() : num();
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "C", x1, y1, x2, y2, x: nx, y: ny });
      px = x2;
      py = y2;
      x = nx;
      y = ny;
      prev = "C";
      continue;
    }
    if (up === "S") {
      const x1 = prev === "C" ? 2 * x - px : x;
      const y1 = prev === "C" ? 2 * y - py : y;
      const x2 = rel ? x + num() : num();
      const y2 = rel ? y + num() : num();
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "C", x1, y1, x2, y2, x: nx, y: ny });
      px = x2;
      py = y2;
      x = nx;
      y = ny;
      prev = "C";
      continue;
    }
    if (up === "Q") {
      const x1 = rel ? x + num() : num();
      const y1 = rel ? y + num() : num();
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "Q", x1, y1, x: nx, y: ny });
      px = x1;
      py = y1;
      x = nx;
      y = ny;
      prev = "Q";
      continue;
    }
    if (up === "T") {
      const x1 = prev === "Q" ? 2 * x - px : x;
      const y1 = prev === "Q" ? 2 * y - py : y;
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "Q", x1, y1, x: nx, y: ny });
      px = x1;
      py = y1;
      x = nx;
      y = ny;
      prev = "Q";
      continue;
    }
    if (up === "A") {
      const rx = num();
      const ry = num();
      const rot = num();
      const large = flag();
      const sweep = flag();
      const nx = rel ? x + num() : num();
      const ny = rel ? y + num() : num();
      segs.push({ op: "A", rx, ry, rot, large, sweep, x: nx, y: ny });
      x = nx;
      y = ny;
      prev = "A";
      continue;
    }
    fail(`unknown command ${cmd}`);
  }
  return segs;
}
