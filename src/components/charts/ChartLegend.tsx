import React from 'react';

interface LegendItem {
  label: string;
  color: string;
  logo?: string;
}

interface ChartLegendProps {
  items: LegendItem[];
}

const ChartLegend: React.FC<ChartLegendProps> = ({ items }) => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '20px',
      marginTop: '10px',
      marginBottom: '5px',
      flexWrap: 'wrap'
    }}>
      {items.map((item, index) => (
        <div key={index} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '24px',
            height: '14px',
            background: item.color,
            borderRadius: '3px',
            border: '1px solid rgba(255,255,255,0.2)'
          }} />
          {item.logo && (
            <img 
              src={item.logo} 
              alt="" 
              style={{ 
                width: '16px', 
                height: '16px',
                opacity: 0.9
              }} 
            />
          )}
          <span style={{
            fontSize: '13px',
            color: '#e5e7eb'
          }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ChartLegend;