import { useRef, useEffect, useMemo } from 'react';

interface StickerPeelProps {
  imageSrc: string;
  rotate?: number;
  peelBackHoverPct?: number;
  peelBackActivePct?: number;
  width?: number;
  shadowIntensity?: number;
  lightingIntensity?: number;
  initialPosition?: { x: number; y: number } | 'center';
  peelDirection?: number;
  className?: string;
}

const StickerPeel: React.FC<StickerPeelProps> = ({
  imageSrc,
  rotate = 30,
  peelBackHoverPct = 30,
  peelBackActivePct = 40,
  width = 200,
  shadowIntensity = 0.6,
  lightingIntensity = 0.1,
  initialPosition = 'center',
  peelDirection = 0,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTargetRef = useRef<HTMLDivElement>(null);
  const pointLightRef = useRef<SVGFEPointLightElement>(null);
  const pointLightFlippedRef = useRef<SVGFEPointLightElement>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });

  const defaultPadding = 10;

  useEffect(() => {
    const target = dragTargetRef.current;
    if (!target) return;

    if (initialPosition !== 'center' && typeof initialPosition === 'object') {
      currentPosRef.current = { x: initialPosition.x, y: initialPosition.y };
      target.style.transform = `translate(${initialPosition.x}px, ${initialPosition.y}px)`;
    }
  }, [initialPosition]);

  useEffect(() => {
    const target = dragTargetRef.current;
    if (!target) return;

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      startPosRef.current = {
        x: e.clientX - currentPosRef.current.x,
        y: e.clientY - currentPosRef.current.y
      };
      target.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const newX = e.clientX - startPosRef.current.x;
      const newY = e.clientY - startPosRef.current.y;

      currentPosRef.current = { x: newX, y: newY };
      target.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      target.style.cursor = 'grab';
    };

    target.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      target.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const updateLight = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (pointLightRef.current) {
        pointLightRef.current.setAttribute('x', x.toString());
        pointLightRef.current.setAttribute('y', y.toString());
      }

      if (pointLightFlippedRef.current) {
        pointLightFlippedRef.current.setAttribute('x', x.toString());
        pointLightFlippedRef.current.setAttribute('y', (rect.height - y).toString());
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', updateLight);
      return () => container.removeEventListener('mousemove', updateLight);
    }
  }, [peelDirection]);

  const cssVars = useMemo(() => ({
    '--sticker-rotate': `${rotate}deg`,
    '--sticker-p': `${defaultPadding}px`,
    '--sticker-peelback-hover': `${peelBackHoverPct}%`,
    '--sticker-peelback-active': `${peelBackActivePct}%`,
    '--sticker-width': `${width}px`,
    '--sticker-shadow-opacity': shadowIntensity,
    '--sticker-lighting-constant': lightingIntensity,
    '--peel-direction': `${peelDirection}deg`,
    '--sticker-start': `calc(-1 * ${defaultPadding}px)`,
    '--sticker-end': `calc(100% + ${defaultPadding}px)`
  } as React.CSSProperties), [rotate, peelBackHoverPct, peelBackActivePct, width, shadowIntensity, lightingIntensity, peelDirection, defaultPadding]);

  return (
    <div
      className={`absolute cursor-grab active:cursor-grabbing ${className}`}
      ref={dragTargetRef}
      style={cssVars}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          .sticker-container:hover .sticker-main {
            clip-path: polygon(
              var(--sticker-start) var(--sticker-peelback-hover),
              var(--sticker-end) var(--sticker-peelback-hover),
              var(--sticker-end) var(--sticker-end),
              var(--sticker-start) var(--sticker-end)
            ) !important;
          }
          .sticker-container:hover .sticker-flap {
            clip-path: polygon(
              var(--sticker-start) var(--sticker-start),
              var(--sticker-end) var(--sticker-start),
              var(--sticker-end) var(--sticker-peelback-hover),
              var(--sticker-start) var(--sticker-peelback-hover)
            ) !important;
            top: calc(-100% + 2 * var(--sticker-peelback-hover) - 1px) !important;
          }
        `
      }} />

      <svg width="0" height="0">
        <defs>
          <filter id="pointLight">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feSpecularLighting
              result="spec"
              in="blur"
              specularExponent="100"
              specularConstant={lightingIntensity}
              lightingColor="white"
            >
              <fePointLight ref={pointLightRef} x="100" y="100" z="300" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceGraphic" result="lit" />
            <feComposite in="lit" in2="SourceAlpha" operator="in" />
          </filter>
          <filter id="pointLightFlipped">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feSpecularLighting
              result="spec"
              in="blur"
              specularExponent="100"
              specularConstant={lightingIntensity * 7}
              lightingColor="white"
            >
              <fePointLight ref={pointLightFlippedRef} x="100" y="100" z="300" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceGraphic" result="lit" />
            <feComposite in="lit" in2="SourceAlpha" operator="in" />
          </filter>
          <filter id="dropShadow">
            <feDropShadow
              dx="2"
              dy="4"
              stdDeviation={3 * shadowIntensity}
              floodColor="black"
              floodOpacity={shadowIntensity}
            />
          </filter>
        </defs>
      </svg>

      <div
        className="sticker-container relative select-none"
        ref={containerRef}
        style={{
          transform: `rotate(${peelDirection}deg)`,
          transformOrigin: 'center'
        }}
      >
        <div
          className="sticker-main"
          style={{
            clipPath: `polygon(
              var(--sticker-start) var(--sticker-start),
              var(--sticker-end) var(--sticker-start),
              var(--sticker-end) var(--sticker-end),
              var(--sticker-start) var(--sticker-end)
            )`,
            transition: 'clip-path 0.6s ease-out',
            filter: 'url(#dropShadow)'
          }}
        >
          <div style={{ filter: 'url(#pointLight)' }}>
            <img
              src={imageSrc}
              alt=""
              className="block"
              style={{
                transform: `rotate(calc(${rotate}deg - ${peelDirection}deg))`,
                width: `${width}px`
              }}
              draggable="false"
            />
          </div>
        </div>

        <div
          className="sticker-flap absolute w-full h-full left-0"
          style={{
            clipPath: `polygon(
              var(--sticker-start) var(--sticker-start),
              var(--sticker-end) var(--sticker-start),
              var(--sticker-end) var(--sticker-start),
              var(--sticker-start) var(--sticker-start)
            )`,
            top: `calc(-100% - var(--sticker-p) - var(--sticker-p))`,
            transform: 'scaleY(-1)',
            transition: 'all 0.6s ease-out'
          }}
        >
          <div style={{ filter: 'url(#pointLightFlipped)' }}>
            <img
              src={imageSrc}
              alt=""
              className="block"
              style={{
                transform: `rotate(calc(${rotate}deg - ${peelDirection}deg))`,
                width: `${width}px`
              }}
              draggable="false"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StickerPeel;
