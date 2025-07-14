import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  children: React.ReactNode;
}

const Dashboard: React.FC<DashboardProps> = ({ children }) => {
  return (
    <div className="dashboard-container">
      <div className="dashboard">
        <div className="dashboard-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;