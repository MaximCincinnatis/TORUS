import React from 'react';
import './App.css';

const MaintenancePage: React.FC = () => {
  return (
    <div className="maintenance-container">
      <div className="maintenance-content">
        <img 
          src="https://www.torus.win/torus.svg" 
          alt="TORUS Logo" 
          className="maintenance-logo"
        />
        <h1 className="maintenance-title">Dashboard Under Maintenance</h1>
        <p className="maintenance-message">
          We're currently updating our data infrastructure to serve you better.
        </p>
        <p className="maintenance-submessage">
          Please check back in a few hours. Thank you for your patience.
        </p>
        <div className="maintenance-progress">
          <div className="maintenance-progress-bar"></div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;