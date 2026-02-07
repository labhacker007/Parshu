import React, { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Neural Network Animated Background
 * Subtle connected particles that respond to mouse movement
 * Used across all themes for consistent visual appeal
 */
export function AnimatedBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: null, y: null });
  const { currentTheme, isDark } = useTheme();

  // Get theme-appropriate colors
  const getParticleColor = useCallback(() => {
    const themeId = currentTheme?.id;
    
    // Light themes - subtle blue/gray dots
    if (!isDark || themeId === 'daylight') {
      return '150, 160, 180'; // Light gray-blue
    }
    
    // Matrix/Terminal - green dots
    if (themeId === 'matrix' || themeId?.includes('terminal')) {
      return '0, 255, 65';
    }
    
    // Graphite/Charcoal - neutral gray dots
    if (themeId === 'charcoal' || themeId === 'midnight') {
      return '100, 110, 130';
    }
    
    // Aurora - purple tint
    if (themeId === 'aurora') {
      return '168, 85, 247';
    }
    
    // Twilight - warm orange/purple
    if (themeId === 'twilight') {
      return '249, 115, 22';
    }
    
    // Red Alert - red tint
    if (themeId === 'red-alert') {
      return '220, 38, 38';
    }
    
    // Default (Command Center) - cyan/blue
    return '14, 165, 233';
  }, [currentTheme, isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    const particleColor = getParticleColor();

    // Create particles - fewer for subtlety
    const particleCount = Math.floor((width * height) / 45000); // Reduced density
    particlesRef.current = [];

    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.2, // Very slow movement
        vy: (Math.random() - 0.5) * 0.2,
        radius: Math.random() * 1.5 + 0.5, // Small dots
      });
    }

    // Mouse tracking
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: null, y: null };
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let frameCount = 0;
    const animate = () => {
      frameCount++;
      // Render every 2nd frame for performance (30fps)
      if (frameCount % 2 !== 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = width;
        if (particle.x > width) particle.x = 0;
        if (particle.y < 0) particle.y = height;
        if (particle.y > height) particle.y = 0;

        // Draw particle - very subtle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleColor}, ${isDark ? 0.15 : 0.08})`;
        ctx.fill();

        // Connect to nearby particles
        particles.slice(i + 1).forEach((other) => {
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            const opacity = (1 - distance / 100) * (isDark ? 0.08 : 0.05);
            ctx.strokeStyle = `rgba(${particleColor}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });

        // Connect to mouse (subtle attraction)
        if (mouse.x && mouse.y) {
          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(mouse.x, mouse.y);
            const opacity = (1 - distance / 150) * (isDark ? 0.12 : 0.06);
            ctx.strokeStyle = `rgba(${particleColor}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [getParticleColor, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-auto"
      style={{
        zIndex: 0,
        opacity: 0.6,
      }}
    />
  );
}

export default AnimatedBackground;
