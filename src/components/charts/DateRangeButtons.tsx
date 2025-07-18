import React from 'react';
import './DateRangeButtons.css';

interface DateRangeButtonsProps {
  selectedDays: number;
  onDaysChange: (days: number) => void;
}

const DateRangeButtons: React.FC<DateRangeButtonsProps> = ({ selectedDays, onDaysChange }) => {
  const options = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '60d', value: 60 },
    { label: '88d', value: 88 },
  ];

  return (
    <div className="date-range-buttons">
      {options.map(option => (
        <button
          key={option.value}
          className={`date-range-btn ${selectedDays === option.value ? 'active' : ''}`}
          onClick={() => onDaysChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default DateRangeButtons;