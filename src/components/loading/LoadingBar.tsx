import React from 'react';
import './LoadingBar.css';

interface LoadingBarProps {
  progress: number;
  message: string;
  details?: string[];
}

const LoadingBar: React.FC<LoadingBarProps> = ({ progress, message, details }) => {
  const getProgressDetails = () => {
    const steps = [
      { threshold: 10, text: 'Establishing blockchain connection...' },
      { threshold: 20, text: 'Verifying smart contract addresses...' },
      { threshold: 50, text: 'Querying blockchain events...' },
      { threshold: 60, text: 'Fetching protocol data...' },
      { threshold: 70, text: 'Processing reward pool information...' },
      { threshold: 85, text: 'Calculating projections and analytics...' },
      { threshold: 95, text: 'Finalizing data visualization...' },
      { threshold: 100, text: 'Loading complete!' }
    ];

    return steps.filter(step => progress >= step.threshold).slice(-3);
  };

  const activeSteps = getProgressDetails();

  return (
    <div className="loading-bar-container">
      <div className="loading-content">
        <div className="loading-header">
          <div className="loading-logo-container">
            <img 
              src="https://www.torus.win/torus.svg" 
              alt="TORUS Logo" 
              className="loading-torus-logo"
            />
            <div className="loading-title-wrapper">
              <h1 className="loading-title"><span className="torus-text">TORUS</span> Dashboard</h1>
              <div className="loading-subtitle">Analytics & Insights</div>
            </div>
          </div>
        </div>
        
        <div className="loading-bar-wrapper">
          <div className="loading-bar-background">
            <div 
              className="loading-bar-fill" 
              style={{ width: `${progress}%` }}
            >
              <div className="loading-bar-glow" />
            </div>
          </div>
        </div>
        
        <div className="loading-message">
          <div className="loading-spinner" />
          <span className="loading-main-message">{message}</span>
        </div>
        
        <div className="loading-details">
          {activeSteps.map((step, index) => (
            <div 
              key={index} 
              className={`loading-detail-item ${index === activeSteps.length - 1 ? 'active' : 'completed'}`}
            >
              <div className="detail-icon">
                {index === activeSteps.length - 1 ? '◉' : '✓'}
              </div>
              <span>{step.text}</span>
            </div>
          ))}
        </div>
        
        {details && details.length > 0 && (
          <div className="loading-extra-details">
            {details.map((detail, index) => (
              <div key={index} className="extra-detail-item">
                {detail}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingBar;