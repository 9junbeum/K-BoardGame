"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
} from "react";

// 모든 클라이언트가 같은 논리 해상도로 그려야 채우기(flood fill)까지 픽셀 단위로 일치한다
export const CANVAS_W = 640;
export const CANVAS_H = 480;
const BG_COLOR = "#ffffff";

/** 실시간으로 주고받는 그리기 연산 — 재생하면 같은 그림이 나온다 */
export type DrawOp =
  | { t: "seg"; id: string; color: string; size: number; pts: number[] } // pts = [x0,y0,x1,y1,...]
  | { t: "fill"; x: number; y: number; color: string }
  | { t: "clear" };

export interface CatchmindCanvasHandle {
  /** 원격에서 수신한 연산들을 캔버스에 반영 */
  apply: (ops: DrawOp[]) => void;
  /** 라운드 전환 등으로 캔버스를 백지로 되돌림 (연산 브로드캐스트 없음) */
  reset: () => void;
}

interface CatchmindCanvasProps {
  /** 내가 지금 그릴 수 있는지 (출제자인지) */
  canDraw: boolean;
  /** 로컬에서 발생한 연산을 부모에 전달 (브로드캐스트용) */
  onOps: (ops: DrawOp[]) => void;
}

const COLORS = [
  "#1a1614", "#e03131", "#f7871e", "#f5c518", "#37a13c",
  "#2b6fdd", "#7048c8", "#8a5a2b", "#e64980", "#ffffff",
];
const BRUSH_SIZES = [4, 10, 20];
const SEG_FLUSH_MS = 80;

type Tool = "brush" | "eraser" | "fill";

const CatchmindCanvas = forwardRef<CatchmindCanvasHandle, CatchmindCanvasProps>(
  function CatchmindCanvas({ canDraw, onOps }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>("brush");
    const [color, setColor] = useState(COLORS[0]);
    const [size, setSize] = useState(BRUSH_SIZES[1]);

    // 진행 중인 스트로크 상태
    const strokeId = useRef<string | null>(null);
    const pending = useRef<number[]>([]); // 아직 전송 안 된 점들
    const lastPt = useRef<{ x: number; y: number } | null>(null);
    // 원격 스트로크 이어그리기용: 스트로크 id -> 마지막 점
    const remoteLast = useRef<Map<string, { x: number; y: number }>>(new Map());

    const ctx = () => canvasRef.current?.getContext("2d", { willReadFrequently: true }) ?? null;

    const clearCanvas = useCallback(() => {
      const c = ctx();
      if (!c) return;
      c.fillStyle = BG_COLOR;
      c.fillRect(0, 0, CANVAS_W, CANVAS_H);
      remoteLast.current.clear();
    }, []);

    useEffect(() => {
      clearCanvas();
    }, [clearCanvas]);

    const drawSeg = useCallback((op: Extract<DrawOp, { t: "seg" }>, isRemote: boolean) => {
      const c = ctx();
      if (!c || op.pts.length < 2) return;
      c.strokeStyle = op.color;
      c.lineWidth = op.size;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      const prev = isRemote ? remoteLast.current.get(op.id) : null;
      if (prev) c.moveTo(prev.x, prev.y);
      else c.moveTo(op.pts[0], op.pts[1]);
      for (let i = 0; i < op.pts.length; i += 2) {
        c.lineTo(op.pts[i], op.pts[i + 1]);
      }
      c.stroke();
      // 점 하나짜리(클릭 점 찍기)도 보이게
      if (op.pts.length === 2 && !prev) {
        c.fillStyle = op.color;
        c.beginPath();
        c.arc(op.pts[0], op.pts[1], op.size / 2, 0, Math.PI * 2);
        c.fill();
      }
      const n = op.pts.length;
      remoteLast.current.set(op.id, { x: op.pts[n - 2], y: op.pts[n - 1] });
    }, []);

    const floodFill = useCallback((x: number, y: number, fillColor: string) => {
      const c = ctx();
      if (!c) return;
      const img = c.getImageData(0, 0, CANVAS_W, CANVAS_H);
      const data = img.data;
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || px >= CANVAS_W || py < 0 || py >= CANVAS_H) return;

      const idx = (py * CANVAS_W + px) * 4;
      const target = [data[idx], data[idx + 1], data[idx + 2]];

      // hex -> rgb
      const m = /^#?([0-9a-f]{6})$/i.exec(fillColor);
      if (!m) return;
      const fr = parseInt(m[1].slice(0, 2), 16);
      const fg = parseInt(m[1].slice(2, 4), 16);
      const fb = parseInt(m[1].slice(4, 6), 16);
      if (Math.abs(target[0] - fr) + Math.abs(target[1] - fg) + Math.abs(target[2] - fb) === 0) return;

      // 안티앨리어싱 경계를 살짝 관용하는 BFS (채널당 오차 32 허용)
      const TOL = 32;
      const match = (i: number) =>
        Math.abs(data[i] - target[0]) <= TOL &&
        Math.abs(data[i + 1] - target[1]) <= TOL &&
        Math.abs(data[i + 2] - target[2]) <= TOL;

      const stack = [py * CANVAS_W + px];
      const visited = new Uint8Array(CANVAS_W * CANVAS_H);
      while (stack.length > 0) {
        const p = stack.pop() as number;
        if (visited[p]) continue;
        visited[p] = 1;
        const i4 = p * 4;
        if (!match(i4)) continue;
        data[i4] = fr;
        data[i4 + 1] = fg;
        data[i4 + 2] = fb;
        data[i4 + 3] = 255;
        const cx = p % CANVAS_W;
        if (cx > 0) stack.push(p - 1);
        if (cx < CANVAS_W - 1) stack.push(p + 1);
        if (p >= CANVAS_W) stack.push(p - CANVAS_W);
        if (p < CANVAS_W * (CANVAS_H - 1)) stack.push(p + CANVAS_W);
      }
      c.putImageData(img, 0, 0);
    }, []);

    const applyOp = useCallback(
      (op: DrawOp, isRemote: boolean) => {
        if (op.t === "seg") drawSeg(op, isRemote);
        else if (op.t === "fill") floodFill(op.x, op.y, op.color);
        else if (op.t === "clear") clearCanvas();
      },
      [drawSeg, floodFill, clearCanvas],
    );

    useImperativeHandle(
      ref,
      () => ({
        apply: (ops: DrawOp[]) => {
          for (const op of ops) applyOp(op, true);
        },
        reset: clearCanvas,
      }),
      [applyOp, clearCanvas],
    );

    // 스트로크 점 배치 전송 (그리는 동안 SEG_FLUSH_MS 간격으로 잘라 보냄)
    const flushPending = useCallback(() => {
      if (!strokeId.current || pending.current.length < 2) return;
      const op: DrawOp = {
        t: "seg",
        id: strokeId.current,
        color: tool === "eraser" ? BG_COLOR : color,
        size: tool === "eraser" ? Math.max(size * 2, 16) : size,
        pts: pending.current,
      };
      pending.current = [];
      onOps([op]);
    }, [tool, color, size, onOps]);

    useEffect(() => {
      const id = setInterval(flushPending, SEG_FLUSH_MS);
      return () => clearInterval(id);
    }, [flushPending]);

    const toLogical = (e: PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
        y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
      };
    };

    const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
      if (!canDraw) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = toLogical(e);

      if (tool === "fill") {
        const op: DrawOp = { t: "fill", x: p.x, y: p.y, color };
        applyOp(op, false);
        onOps([op]);
        return;
      }

      strokeId.current = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      lastPt.current = p;
      pending.current = [p.x, p.y];
      // 로컬 즉시 반영 (점 찍기)
      drawSeg(
        { t: "seg", id: strokeId.current, color: tool === "eraser" ? BG_COLOR : color, size: tool === "eraser" ? Math.max(size * 2, 16) : size, pts: [p.x, p.y] },
        false,
      );
      remoteLast.current.delete(strokeId.current);
    };

    const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
      if (!canDraw || !strokeId.current || !lastPt.current) return;
      const p = toLogical(e);
      const c = ctx();
      if (c) {
        c.strokeStyle = tool === "eraser" ? BG_COLOR : color;
        c.lineWidth = tool === "eraser" ? Math.max(size * 2, 16) : size;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(lastPt.current.x, lastPt.current.y);
        c.lineTo(p.x, p.y);
        c.stroke();
      }
      lastPt.current = p;
      pending.current.push(p.x, p.y);
    };

    const endStroke = () => {
      if (!strokeId.current) return;
      flushPending();
      strokeId.current = null;
      lastPt.current = null;
    };

    const clearAll = () => {
      clearCanvas();
      onOps([{ t: "clear" }]);
    };

    return (
      <div className="w-full max-w-[640px]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          className={`w-full rounded-lg border border-mud/30 bg-white shadow-[0_10px_30px_rgba(26,22,20,0.15)] ${
            canDraw ? (tool === "fill" ? "cursor-crosshair" : "cursor-crosshair") : "cursor-default"
          }`}
          style={{ touchAction: "none" }}
          aria-label="캐치마인드 그림판"
        />

        {canDraw && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* 색상 */}
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    if (tool === "eraser") setTool("brush");
                  }}
                  aria-label={`색상 ${c}`}
                  className={`h-6 w-6 rounded-full border transition ${
                    color === c && tool !== "eraser"
                      ? "scale-110 border-2 border-vermil"
                      : "border-mud/40"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* 붓 크기 */}
            <div className="flex items-center gap-1.5">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  aria-label={`붓 크기 ${s}`}
                  className={`flex h-8 w-8 items-center justify-center rounded border transition ${
                    size === s ? "border-vermil bg-paper-deep" : "border-mud/40"
                  }`}
                >
                  <span
                    className="rounded-full bg-ink"
                    style={{ width: Math.min(s, 18), height: Math.min(s, 18) }}
                  />
                </button>
              ))}
            </div>

            {/* 도구 */}
            <div className="flex items-center gap-1.5 font-plex text-xs">
              <button
                onClick={() => setTool("brush")}
                className={`rounded border px-3 py-1.5 transition ${
                  tool === "brush" ? "border-vermil bg-paper-deep text-ink" : "border-mud/40 text-ink-soft"
                }`}
              >
                붓
              </button>
              <button
                onClick={() => setTool("fill")}
                className={`rounded border px-3 py-1.5 transition ${
                  tool === "fill" ? "border-vermil bg-paper-deep text-ink" : "border-mud/40 text-ink-soft"
                }`}
              >
                채우기
              </button>
              <button
                onClick={() => setTool("eraser")}
                className={`rounded border px-3 py-1.5 transition ${
                  tool === "eraser" ? "border-vermil bg-paper-deep text-ink" : "border-mud/40 text-ink-soft"
                }`}
              >
                지우개
              </button>
              <button
                onClick={clearAll}
                className="rounded border border-mud/40 px-3 py-1.5 text-ink-soft transition hover:border-vermil hover:text-vermil"
              >
                전체 지우기
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default CatchmindCanvas;
