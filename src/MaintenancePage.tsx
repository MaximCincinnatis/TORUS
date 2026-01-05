import React, { useEffect, useState } from 'react';
import './App.css';

const MaintenancePage: React.FC = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePosition({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="maintenance-container">
      {/* Atmospheric background layers */}
      <div className="maintenance-bg-layer maintenance-bg-1" />
      <div className="maintenance-bg-layer maintenance-bg-2" />
      <div className="maintenance-grid-overlay" />

      <div className="maintenance-content">
        {/* Animated Torus Logo with parallax */}
        <div
          className="maintenance-logo-wrapper"
          style={{
            transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`
          }}
        >
          <svg
            className="maintenance-logo-svg"
            width="180"
            height="180"
            viewBox="0 0 264 262"
            fill="none"
          >
            {/* Outer ring - draws itself */}
            <circle
              className="torus-ring-outer"
              cx="132"
              cy="131"
              r="128"
              fill="none"
              stroke="url(#outerGlow)"
              strokeWidth="2"
            />
            {/* Inner torus circles with staggered animation */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((rotation, i) => (
              <circle
                key={i}
                className="torus-ring-inner"
                cx="132"
                cy="131"
                r="58"
                fill="none"
                stroke="url(#torusGradient)"
                strokeWidth="2"
                style={{
                  animationDelay: `${i * 0.15}s`,
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: '132px 131px'
                }}
              />
            ))}
            <defs>
              <linearGradient id="torusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F2CE30" />
                <stop offset="50%" stopColor="#BD2BE2" />
                <stop offset="100%" stopColor="#79115C" />
              </linearGradient>
              <linearGradient id="outerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#22c55e" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Typography */}
        <h1 className="maintenance-headline">
          FORGING THE FUTURE
        </h1>
        <p className="maintenance-tagline">
          The TORUS Dashboard is being crafted.
        </p>
        <p className="maintenance-detail">
          Analytics, metrics, and insights — coming soon.
        </p>

        {/* Animated progress indicator */}
        <div className="maintenance-progress-track">
          <div className="maintenance-progress-glow" />
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
