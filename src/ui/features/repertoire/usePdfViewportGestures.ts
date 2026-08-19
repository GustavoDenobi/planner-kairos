import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { PdfNavigationMode } from '@/ui/features/repertoire/pdf-reader-preference-storage';
import {
  adjustPanForPinch,
  adjustScrollForPinch,
  clampPan,
  clampScale,
  computePinchScale,
  isScaleZoomed,
  touchCenter,
  touchDistance,
  type Pan,
  type Point,
  type ViewportBounds,
} from '@/ui/features/repertoire/pdf-viewport-gestures';

type GestureSession =
  | {
      kind: 'pinch';
      initialDistance: number;
      initialScale: number;
      initialPan: Pan;
      initialCenter: Point;
      initialScroll: Pan;
    }
  | {
      kind: 'pan';
      pointerId?: number;
      start: Point;
      initialPan: Pan;
      initialScroll: Pan;
    };

type UsePdfViewportGesturesOptions = {
  viewportRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  scale: number;
  setScale: Dispatch<SetStateAction<number>>;
  fitScale: number;
  navigation: PdfNavigationMode;
  isAnnotating: boolean;
  enabled: boolean;
  onDoubleTap?: () => void;
  onSingleTap?: (point: Point) => void;
};

const TAP_MOVE_PX = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE_PX = 32;
const SINGLE_TAP_DELAY_MS = 300;

function pointFromTouch(touch: Touch): Point {
  return { x: touch.clientX, y: touch.clientY };
}

export function usePdfViewportGestures({
  viewportRef,
  contentRef,
  scale,
  setScale,
  fitScale,
  navigation,
  isAnnotating,
  enabled,
  onDoubleTap,
  onSingleTap,
}: UsePdfViewportGesturesOptions) {
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);

  const panRef = useRef(pan);
  panRef.current = pan;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const fitScaleRef = useRef(fitScale);
  fitScaleRef.current = fitScale;
  const isAnnotatingRef = useRef(isAnnotating);
  isAnnotatingRef.current = isAnnotating;
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;
  const onSingleTapRef = useRef(onSingleTap);
  onSingleTapRef.current = onSingleTap;

  const sessionRef = useRef<GestureSession | null>(null);
  const scaleFrameRef = useRef<number>(0);
  const tapStartRef = useRef<Point | null>(null);
  const tapMovedRef = useRef(false);
  const pinchOccurredRef = useRef(false);
  const lastTapRef = useRef<{ point: Point; time: number } | null>(null);
  const singleTapTimeoutRef = useRef<number>(0);

  const isZoomed = isScaleZoomed(scale, fitScale);

  const measureBounds = useCallback((): ViewportBounds | null => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      return null;
    }
    return {
      pageWidth: content.offsetWidth,
      pageHeight: content.offsetHeight,
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
    };
  }, [contentRef, viewportRef]);

  const applyClampedPan = useCallback(
    (next: Pan) => {
      const bounds = measureBounds();
      const origin = navigationRef.current === 'horizontal' ? 'center' : 'topLeft';
      const clamped = bounds ? clampPan(next, bounds, origin) : next;
      panRef.current = clamped;
      setPan(clamped);
    },
    [measureBounds],
  );

  const resetPan = useCallback(() => {
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
  }, [viewportRef]);

  const commitScale = useCallback(
    (next: number) => {
      const clamped = clampScale(next);
      scaleRef.current = clamped;
      if (scaleFrameRef.current) {
        cancelAnimationFrame(scaleFrameRef.current);
      }
      scaleFrameRef.current = requestAnimationFrame(() => {
        scaleFrameRef.current = 0;
        setScale(clamped);
      });
    },
    [setScale],
  );

  useLayoutEffect(() => {
    if (!isScaleZoomed(scale, fitScale)) {
      if (panRef.current.x !== 0 || panRef.current.y !== 0) {
        resetPan();
      }
      return;
    }
    applyClampedPan(panRef.current);
  }, [applyClampedPan, fitScale, resetPan, scale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!enabled || !viewport) {
      return;
    }

    const viewportCenter = (): Point => {
      const rect = viewport.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    };

    const cancelScheduledSingleTap = () => {
      if (singleTapTimeoutRef.current) {
        window.clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = 0;
      }
    };

    const rememberTapStart = (point: Point) => {
      tapStartRef.current = point;
      tapMovedRef.current = false;
    };

    const markTapMovedIfNeeded = (point: Point) => {
      const start = tapStartRef.current;
      if (!start || tapMovedRef.current) {
        return;
      }
      if (Math.hypot(point.x - start.x, point.y - start.y) > TAP_MOVE_PX) {
        tapMovedRef.current = true;
        lastTapRef.current = null;
        cancelScheduledSingleTap();
      }
    };

    const finishTap = (point: Point) => {
      if (isAnnotatingRef.current || pinchOccurredRef.current || tapMovedRef.current) {
        lastTapRef.current = null;
        pinchOccurredRef.current = false;
        tapStartRef.current = null;
        return;
      }

      const now = performance.now();
      const lastTap = lastTapRef.current;
      if (
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_MS &&
        Math.hypot(point.x - lastTap.point.x, point.y - lastTap.point.y) <= DOUBLE_TAP_DISTANCE_PX
      ) {
        cancelScheduledSingleTap();
        lastTapRef.current = null;
        tapStartRef.current = null;
        onDoubleTapRef.current?.();
        return;
      }

      lastTapRef.current = { point, time: now };
      tapStartRef.current = null;
      cancelScheduledSingleTap();
      singleTapTimeoutRef.current = window.setTimeout(() => {
        singleTapTimeoutRef.current = 0;
        onSingleTapRef.current?.(point);
      }, SINGLE_TAP_DELAY_MS);
    };

    const beginPinch = (touches: TouchList) => {
      const first = touches[0];
      const second = touches[1];
      if (!first || !second) {
        return;
      }
      const a = pointFromTouch(first);
      const b = pointFromTouch(second);
      sessionRef.current = {
        kind: 'pinch',
        initialDistance: touchDistance(a, b),
        initialScale: scaleRef.current,
        initialPan: panRef.current,
        initialCenter: touchCenter(a, b),
        initialScroll: { x: viewport.scrollLeft, y: viewport.scrollTop },
      };
      setIsGesturing(true);
      pinchOccurredRef.current = true;
      tapMovedRef.current = true;
      lastTapRef.current = null;
      cancelScheduledSingleTap();
    };

    const applyPinch = (touches: TouchList) => {
      const session = sessionRef.current;
      if (!session || session.kind !== 'pinch') {
        return;
      }
      const first = touches[0];
      const second = touches[1];
      if (!first || !second) {
        return;
      }

      const a = pointFromTouch(first);
      const b = pointFromTouch(second);
      const newScale = computePinchScale(
        session.initialScale,
        touchDistance(a, b),
        session.initialDistance,
      );
      const ratio = session.initialScale > 0 ? newScale / session.initialScale : 1;
      const focal = touchCenter(a, b);
      const centerDelta = {
        x: focal.x - session.initialCenter.x,
        y: focal.y - session.initialCenter.y,
      };

      commitScale(newScale);

      if (navigationRef.current === 'horizontal') {
        const scaledPan = adjustPanForPinch({
          pan: session.initialPan,
          viewportCenter: viewportCenter(),
          focal: session.initialCenter,
          scaleRatio: ratio,
        });
        applyClampedPan({
          x: scaledPan.x + centerDelta.x,
          y: scaledPan.y + centerDelta.y,
        });
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const nextScroll = adjustScrollForPinch(
        session.initialScroll,
        {
          x: session.initialCenter.x - rect.left,
          y: session.initialCenter.y - rect.top,
        },
        ratio,
      );
      viewport.scrollLeft = nextScroll.x + centerDelta.x;
      viewport.scrollTop = nextScroll.y + centerDelta.y;
    };

    const beginTouchPan = (touch: Touch) => {
      sessionRef.current = {
        kind: 'pan',
        start: pointFromTouch(touch),
        initialPan: panRef.current,
        initialScroll: { x: viewport.scrollLeft, y: viewport.scrollTop },
      };
      setIsGesturing(true);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        event.preventDefault();
        event.stopPropagation();
        beginPinch(event.touches);
        return;
      }

      if (event.touches[0]) {
        rememberTapStart(pointFromTouch(event.touches[0]));
      }

      const zoomed = isScaleZoomed(scaleRef.current, fitScaleRef.current);
      if (
        event.touches.length === 1 &&
        zoomed &&
        !isAnnotatingRef.current &&
        navigationRef.current === 'horizontal' &&
        event.touches[0]
      ) {
        beginTouchPan(event.touches[0]);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches[0]) {
        markTapMovedIfNeeded(pointFromTouch(event.touches[0]));
      }

      const session = sessionRef.current;
      if (!session) {
        return;
      }

      if (session.kind === 'pinch' && event.touches.length >= 2) {
        event.preventDefault();
        event.stopPropagation();
        applyPinch(event.touches);
        return;
      }

      if (session.kind === 'pan' && event.touches.length === 1 && event.touches[0]) {
        event.preventDefault();
        event.stopPropagation();
        const current = pointFromTouch(event.touches[0]);
        applyClampedPan({
          x: session.initialPan.x + (current.x - session.start.x),
          y: session.initialPan.y + (current.y - session.start.y),
        });
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        event.preventDefault();
        event.stopPropagation();
        beginPinch(event.touches);
        return;
      }

      if (sessionRef.current) {
        event.stopPropagation();
      }

      if (
        event.touches.length === 1 &&
        event.touches[0] &&
        isScaleZoomed(scaleRef.current, fitScaleRef.current) &&
        !isAnnotatingRef.current &&
        navigationRef.current === 'horizontal'
      ) {
        beginTouchPan(event.touches[0]);
        return;
      }

      const ended = event.changedTouches[0];
      sessionRef.current = null;
      setIsGesturing(false);

      if (event.touches.length === 0 && ended) {
        finishTap(pointFromTouch(ended));
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest('button, select, input, textarea, a')
      ) {
        return;
      }

      rememberTapStart({ x: event.clientX, y: event.clientY });

      if (isAnnotatingRef.current) {
        return;
      }
      if (!isScaleZoomed(scaleRef.current, fitScaleRef.current)) {
        return;
      }

      sessionRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        initialPan: panRef.current,
        initialScroll: { x: viewport.scrollLeft, y: viewport.scrollTop },
      };
      viewport.setPointerCapture(event.pointerId);
      setIsGesturing(true);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') {
        markTapMovedIfNeeded({ x: event.clientX, y: event.clientY });
      }

      const session = sessionRef.current;
      if (!session || session.kind !== 'pan' || session.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - session.start.x;
      const deltaY = event.clientY - session.start.y;

      if (navigationRef.current === 'horizontal') {
        applyClampedPan({
          x: session.initialPan.x + deltaX,
          y: session.initialPan.y + deltaY,
        });
        return;
      }

      viewport.scrollLeft = session.initialScroll.x - deltaX;
      viewport.scrollTop = session.initialScroll.y - deltaY;
    };

    const onPointerUp = (event: PointerEvent) => {
      const session = sessionRef.current;
      if (session?.kind === 'pan' && session.pointerId === event.pointerId) {
        sessionRef.current = null;
        setIsGesturing(false);
        if (viewport.hasPointerCapture(event.pointerId)) {
          viewport.releasePointerCapture(event.pointerId);
        }
      }

      if (event.pointerType !== 'touch' && event.button === 0) {
        finishTap({ x: event.clientX, y: event.clientY });
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();

      const currentScale = scaleRef.current;
      const newScale = clampScale(currentScale * Math.exp(-event.deltaY * 0.01));
      if (newScale === currentScale) {
        return;
      }

      const ratio = currentScale > 0 ? newScale / currentScale : 1;
      const focal = { x: event.clientX, y: event.clientY };
      commitScale(newScale);

      if (navigationRef.current === 'horizontal') {
        applyClampedPan(
          adjustPanForPinch({
            pan: panRef.current,
            viewportCenter: viewportCenter(),
            focal,
            scaleRatio: ratio,
          }),
        );
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const nextScroll = adjustScrollForPinch(
        { x: viewport.scrollLeft, y: viewport.scrollTop },
        { x: focal.x - rect.left, y: focal.y - rect.top },
        ratio,
      );
      viewport.scrollLeft = nextScroll.x;
      viewport.scrollTop = nextScroll.y;
    };

    viewport.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { capture: true });
    viewport.addEventListener('touchcancel', onTouchEnd, { capture: true });
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelScheduledSingleTap();
      if (scaleFrameRef.current) {
        cancelAnimationFrame(scaleFrameRef.current);
      }
      viewport.removeEventListener('touchstart', onTouchStart, true);
      viewport.removeEventListener('touchmove', onTouchMove, true);
      viewport.removeEventListener('touchend', onTouchEnd, true);
      viewport.removeEventListener('touchcancel', onTouchEnd, true);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', onPointerUp);
      viewport.removeEventListener('pointercancel', onPointerUp);
      viewport.removeEventListener('wheel', onWheel);
    };
  }, [applyClampedPan, commitScale, enabled, navigation, viewportRef]);

  return {
    pan,
    isGesturing,
    isZoomed,
    resetPan,
  };
}
