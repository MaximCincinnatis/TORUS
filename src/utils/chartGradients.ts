export const createGradient = (ctx: CanvasRenderingContext2D, chartArea: any, color1: string, color2: string, opacity: number = 0.8) => {
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  
  // Convert hex to rgba with opacity
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Special handling for TORUS gradient - yellow to pink to purple
  if (color1 === '#fbbf24' && color2 === '#8b5cf6') {
    // TORUS gradient: yellow to pink to purple
    gradient.addColorStop(0, hexToRgba('#fbbf24', opacity * 0.5));   // Yellow at bottom
    gradient.addColorStop(0.5, hexToRgba('#ec4899', opacity * 0.7)); // Pink in middle
    gradient.addColorStop(1, hexToRgba('#8b5cf6', opacity));         // Purple at top
  } else if (color1 === '#ffffff' && color2 === '#16a34a') {
    // TitanX gradient: white to green with more green
    gradient.addColorStop(0, hexToRgba(color1, opacity * 0.4));  // White at bottom (less white)
    gradient.addColorStop(0.4, hexToRgba(color2, opacity * 0.6)); // Green starts earlier
    gradient.addColorStop(1, hexToRgba(color2, opacity));         // Full green at top
  } else {
    // Default gradient
    gradient.addColorStop(0, hexToRgba(color1, opacity * 0.3));
    gradient.addColorStop(0.5, hexToRgba(color1, opacity * 0.6));
    gradient.addColorStop(1, hexToRgba(color2, opacity));
  }
  
  return gradient;
};

// Color schemes for different chart types
export const chartColors = {
  // Purple to Pink gradient (replaces red)
  primary: {
    start: '#8b5cf6',
    end: '#ec4899',
    border: '#a855f7'
  },
  // Cyan to Blue gradient
  secondary: {
    start: '#06b6d4',
    end: '#3b82f6',
    border: '#0ea5e9'
  },
  // Emerald to Teal gradient
  tertiary: {
    start: '#10b981',
    end: '#14b8a6',
    border: '#059669'
  },
  // Amber to Orange gradient (for TitanX)
  quaternary: {
    start: '#f59e0b',
    end: '#fb923c',
    border: '#f97316'
  },
  // Violet to Indigo (for ETH)
  eth: {
    start: '#8b5cf6',
    end: '#6366f1', 
    border: '#7c3aed'
  },
  // Indigo to Purple gradient
  quinary: {
    start: '#6366f1',
    end: '#8b5cf6',
    border: '#7c3aed'
  },
  // TORUS: Yellow to Purple gradient (more purple)
  torus: {
    start: '#fbbf24',  // Yellow
    end: '#8b5cf6',    // Purple
    border: '#a855f7'
  },
  // TitanX: White to Green gradient
  titanx: {
    start: '#ffffff',  // White
    end: '#16a34a',    // Green
    border: '#15803d'
  },
  // ETH: Blue gradient
  ethBlue: {
    start: '#60a5fa',  // Light blue
    end: '#2563eb',    // Darker blue
    border: '#1d4ed8'
  },
  // Pink gradient for special bars
  pink: {
    start: '#fbbdd5',  // Light pink
    end: '#ec4899',    // Hot pink
    border: '#db2777'
  }
};

// Plugin to apply gradients to bar charts
export const gradientPlugin = {
  id: 'customGradient',
  beforeDatasetsUpdate: (chart: any) => {
    // Check if it's a bar chart
    if (chart.config?.type !== 'bar') return;
    
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    
    if (!chartArea) return;
    
    chart.data.datasets.forEach((dataset: any, i: number) => {
      // Skip if gradient already applied or custom backgroundColor is set
      if (dataset._gradient || typeof dataset.backgroundColor === 'object') return;
      
      let colorScheme;
      
      // Special handling based on dataset labels
      if (dataset.label && dataset.label.toLowerCase().includes('torus')) {
        colorScheme = chartColors.torus; // Yellow to Purple for TORUS
      } else if (dataset.label && dataset.label.toLowerCase().includes('titanx')) {
        colorScheme = chartColors.titanx; // White to Green for TitanX
      } else if (dataset.label === 'ETH Used' || dataset.label === 'ETH') {
        colorScheme = chartColors.ethBlue; // Blue for ETH
      } else if (dataset.label === 'Buy & Burn') {
        colorScheme = chartColors.torus; // TORUS colors for Buy & Burn
      } else if (dataset.label === 'Buy & Build') {
        colorScheme = chartColors.pink; // Pink for Buy & Build
      } else if (dataset.label === 'Principal TORUS') {
        colorScheme = chartColors.torus; // TORUS colors for Principal
      } else if (dataset.label === 'Accrued Rewards') {
        colorScheme = chartColors.pink; // Pink for Accrued Rewards
      } else if (dataset.label === 'TORUS Staked') {
        colorScheme = chartColors.torus; // TORUS colors for Staked
      } else if (dataset.label === 'TitanX Amount') {
        colorScheme = chartColors.titanx; // White to Green for TitanX
      } else if (dataset.label === 'Number of Creates') {
        colorScheme = chartColors.pink; // Pink for Creates ending
      } else if (dataset.label === 'Creates') {
        colorScheme = chartColors.primary; // Purple to pink for Creates
      } else if (dataset.label === 'Stakes') {
        colorScheme = {
          start: '#ec4899',  // Pink
          end: '#fbbf24',    // Yellow
          border: '#f97316'
        }; // Pink to yellow for Stakes
      } else {
        // Default color scheme
        switch (i) {
          case 0:
            colorScheme = chartColors.primary;
            break;
          case 1:
            colorScheme = chartColors.secondary;
            break;
          case 2:
            colorScheme = chartColors.tertiary;
            break;
          case 3:
            colorScheme = chartColors.quaternary;
            break;
          default:
            colorScheme = chartColors.quinary;
        }
      }
      
      dataset.backgroundColor = createGradient(ctx, chartArea, colorScheme.start, colorScheme.end, 0.85);
      dataset.borderColor = colorScheme.border;
      dataset.borderWidth = 1;
      dataset._gradient = true;
      
      // Preserve yAxisID if it exists
      if (dataset.yAxisID) {
        console.log(`Dataset ${i} has yAxisID: ${dataset.yAxisID}`);
      }
    });
  }
};