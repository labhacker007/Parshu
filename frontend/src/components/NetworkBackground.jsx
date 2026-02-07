import React, { useMemo } from 'react';

/**
 * NetworkBackground Component
 * Animated network nodes and connections for login page background
 * Creates a dynamic, live feel without being distracting
 */

// Individual network node
function NetworkNode({ x, y, size = 4, delay = 0, pulsing = false }) {
  return (
    <div
      className={`
        absolute rounded-full bg-[hsl(var(--primary))]/40
        ${pulsing ? 'animate-pulse-glow' : ''}
      `}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

// Connection line between nodes
function ConnectionLine({ x1, y1, x2, y2, delay = 0 }) {
  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  return (
    <div
      className="absolute bg-[hsl(var(--primary))]/10"
      style={{
        left: `${x1}%`,
        top: `${y1}%`,
        width: `${length}%`,
        height: 1,
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%',
        animationDelay: `${delay}s`,
      }}
    />
  );
}

/**
 * NetworkBackground
 * Generates random network nodes and connections
 */
export function NetworkBackground({ 
  nodeCount = 20, 
  connectionDistance = 25,
  className = '' 
}) {
  // Generate nodes with memoization for consistent rendering
  const { nodes, connections } = useMemo(() => {
    const nodes = Array.from({ length: nodeCount }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 3 + Math.random() * 5,
      delay: Math.random() * 2,
      pulsing: Math.random() > 0.7,
    }));

    // Generate connections between nearby nodes
    const connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].x - nodes[j].x, 2) +
          Math.pow(nodes[i].y - nodes[j].y, 2)
        );
        if (dist < connectionDistance) {
          connections.push({
            from: nodes[i],
            to: nodes[j],
            delay: Math.random() * 2,
          });
        }
      }
    }

    return { nodes, connections };
  }, [nodeCount, connectionDistance]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Connection lines */}
      {connections.map((conn, i) => (
        <ConnectionLine
          key={`conn-${i}`}
          x1={conn.from.x}
          y1={conn.from.y}
          x2={conn.to.x}
          y2={conn.to.y}
          delay={conn.delay}
        />
      ))}
      
      {/* Network nodes */}
      {nodes.map((node) => (
        <NetworkNode
          key={node.id}
          x={node.x}
          y={node.y}
          size={node.size}
          delay={node.delay}
          pulsing={node.pulsing}
        />
      ))}
    </div>
  );
}

/**
 * GridPattern
 * Subtle grid pattern background
 */
export function GridPattern({ className = '' }) {
  return (
    <div 
      className={`absolute inset-0 grid-pattern opacity-50 pointer-events-none ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }}
    />
  );
}

/**
 * GradientOrbs
 * Floating gradient orbs for background depth
 */
export function GradientOrbs({ className = '' }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div 
        className="absolute w-96 h-96 rounded-full opacity-20 animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
          top: '10%',
          left: '10%',
          filter: 'blur(60px)',
        }}
      />
      <div 
        className="absolute w-80 h-80 rounded-full opacity-15 animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(var(--secondary)) 0%, transparent 70%)',
          bottom: '20%',
          right: '15%',
          filter: 'blur(50px)',
          animationDelay: '2s',
        }}
      />
      <div 
        className="absolute w-64 h-64 rounded-full opacity-10 animate-float"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
          top: '50%',
          right: '30%',
          filter: 'blur(40px)',
          animationDelay: '4s',
        }}
      />
    </div>
  );
}

export default NetworkBackground;
