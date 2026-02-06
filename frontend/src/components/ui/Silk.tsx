import { useEffect, useRef } from 'react';

interface SilkProps {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
  className?: string;
}

const Silk: React.FC<SilkProps> = ({
  speed = 5,
  scale = 1,
  color = '#393E46',
  noiseIntensity = 0.2,
  rotation = 0,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    let time = 0;

    const drawSilk = () => {
      ctx.clearRect(0, 0, width, height);
      
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      const lines = 50;
      const amplitude = 100;

      for (let i = 0; i < lines; i++) {
        ctx.beginPath();
        
        const offset = (i / lines) * Math.PI * 2;
        const noise = Math.random() * noiseIntensity;

        for (let x = -width / 2; x < width / 2; x += 5) {
          const y = Math.sin((x * 0.01 + time * speed * 0.01 + offset)) * amplitude + 
                    Math.sin((x * 0.02 + time * speed * 0.02)) * (amplitude * 0.5) +
                    noise * 10;
          
          if (x === -width / 2) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.1 + (i / lines) * 0.3;
        ctx.lineWidth = 1 + (i / lines) * 2;
        ctx.stroke();
      }

      ctx.restore();
      time++;
      animationRef.current = requestAnimationFrame(drawSilk);
    };

    drawSilk();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [speed, scale, color, noiseIntensity, rotation]);

  return (
    <canvas
      ref={canvasRef}
      width={1080}
      height={1080}
      className={`absolute inset-0 ${className}`}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
};

export default Silk;
