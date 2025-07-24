#!/usr/bin/env node

/**
 * Chart Documentation Generator
 * Generates markdown documentation from specifications
 */

const fs = require('fs');
const path = require('path');

// Load specifications
const specsPath = path.join(__dirname, '../dashboard-specs');
const chartSpecs = JSON.parse(fs.readFileSync(path.join(specsPath, 'chart-specifications.json'), 'utf8'));
const dataContracts = JSON.parse(fs.readFileSync(path.join(specsPath, 'data-contracts.json'), 'utf8'));

function generateChartDocumentation() {
  let markdown = `# TORUS Dashboard Chart Specifications

Generated: ${new Date().toISOString()}
Version: ${chartSpecs.version}

## Overview

This document provides comprehensive specifications for all charts and components in the TORUS Dashboard.

## Table of Contents

`;

  // Generate TOC
  Object.values(chartSpecs.charts).forEach(chart => {
    markdown += `- [${chart.title}](#${chart.id})\n`;
  });
  
  Object.values(chartSpecs.components).forEach(component => {
    markdown += `- [${component.title}](#${component.id})\n`;
  });

  markdown += `\n## Charts\n\n`;

  // Generate chart documentation
  Object.values(chartSpecs.charts).forEach(chart => {
    markdown += `### ${chart.title} {#${chart.id}}

**ID**: \`${chart.id}\`  
**Type**: ${chart.type}  
**Component**: \`${chart.component}\`

#### Features
${chart.features.dragPan ? '- ✅ **Drag/Pan**: Enabled' : '- ❌ **Drag/Pan**: Disabled'}
${chart.features.zoom ? '- ✅ **Zoom**: Enabled' : '- ❌ **Zoom**: Disabled'}
${chart.features.dataLabels ? '- ✅ **Data Labels**: Shown' : '- ❌ **Data Labels**: Hidden'}
- **Timeframes**: ${chart.features.timeframes.join(', ')}
- **Tooltip**: ${chart.features.tooltip}
${chart.features.exportable ? '- ✅ **Exportable**: Yes' : ''}

#### Data Configuration
- **Source Function**: \`${chart.data.source}\`
- **Max Days**: ${chart.data.maxDays}
${chart.data.refreshInterval ? `- **Refresh Interval**: ${chart.data.refreshInterval / 1000}s` : ''}

#### Display Settings
- **Height**: ${chart.display.height}px
${chart.display.yAxisFormat ? `- **Y-Axis Format**: ${chart.display.yAxisFormat}` : ''}
${chart.display.xAxisLabel ? `- **X-Axis Label**: "${chart.display.xAxisLabel}"` : ''}
${chart.display.yAxisLabel ? `- **Y-Axis Label**: "${chart.display.yAxisLabel}"` : ''}
${chart.display.barColor ? `- **Bar Color**: ${chart.display.barColor}` : ''}
${chart.display.lineColor ? `- **Line Color**: ${chart.display.lineColor}` : ''}

`;

    if (chart.validation) {
      markdown += `#### Validation Rules
- **Min Data Points**: ${chart.validation.minDataPoints}
- **Max Data Points**: ${chart.validation.maxDataPoints}
- **Required Fields**: ${chart.validation.requiredFields.join(', ')}

`;
    }

    markdown += `---

`;
  });

  // Generate component documentation
  markdown += `## Components\n\n`;

  Object.values(chartSpecs.components).forEach(component => {
    markdown += `### ${component.title} {#${component.id}}

**ID**: \`${component.id}\`  
**Type**: ${component.type}  
**Component**: \`${component.component}\`

#### Required Columns
| Field | Header | Format | Required |
|-------|--------|--------|----------|
`;

    component.requiredColumns.forEach(col => {
      markdown += `| \`${col.field}\` | ${col.header} | ${col.format || 'string'} | ${col.required ? '✅' : '❌'} |\n`;
    });

    markdown += `
#### Features
${component.features.sortable ? '- ✅ **Sortable**: Yes' : '- ❌ **Sortable**: No'}
${component.features.filterable ? '- ✅ **Filterable**: Yes' : '- ❌ **Filterable**: No'}
${component.features.exportable ? '- ✅ **Exportable**: Yes' : '- ❌ **Exportable**: No'}
${component.features.pagination ? `- ✅ **Pagination**: ${component.features.pageSize} items/page` : '- ❌ **Pagination**: No'}
${component.features.searchable ? '- ✅ **Searchable**: Yes' : '- ❌ **Searchable**: No'}

#### Field Mappings
`;

    Object.entries(component.validation.fieldMappings).forEach(([from, to]) => {
      markdown += `- \`${from}\` → \`${to}\`\n`;
    });

    markdown += `
#### Data Integrity Rules
`;

    Object.entries(component.validation.dataIntegrity).forEach(([rule, enabled]) => {
      markdown += `- ${rule}: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n`;
    });

    markdown += `
---

`;
  });

  // Add data contracts section
  markdown += `## Data Contracts

### Overview
Data contracts define the expected structure and validation rules for all data types used in the dashboard.

`;

  Object.entries(dataContracts.contracts).forEach(([name, contract]) => {
    markdown += `### ${name}

${contract.description}

| Field | Type | Required | Description |
|-------|------|----------|-------------|
`;

    Object.entries(contract.fields).forEach(([field, spec]) => {
      markdown += `| \`${field}\` | ${spec.type} | ${spec.required ? '✅' : '❌'} | ${spec.description || ''} |\n`;
    });

    markdown += `\n`;
  });

  // Add implementation notes
  markdown += `## Implementation Notes

### Adding a New Chart

1. Add specification to \`dashboard-specs/chart-specifications.json\`
2. Implement using the specification:
   \`\`\`typescript
   const spec = chartSpecs.charts['your-chart-id'];
   <PannableBarChart
     title={spec.title}
     showDataLabels={spec.features.dataLabels}
     windowSize={selectedDays}
     // ... other props from spec
   />
   \`\`\`
3. Run validation: \`npm run validate:specs\`
4. Generate updated docs: \`npm run docs:generate\`

### Modifying Existing Charts

1. Update specification in \`dashboard-specs/chart-specifications.json\`
2. Increment version number
3. Update implementation to match new specification
4. Run validation to ensure compliance
5. Commit both specification and implementation changes together

### Testing Charts

Each chart should have tests that verify:
- Component renders with correct type
- Features match specification
- Data validation rules are enforced
- Visual regression tests pass

`;

  return markdown;
}

// Generate and save documentation
const docs = generateChartDocumentation();
const docsPath = path.join(__dirname, '../docs');
if (!fs.existsSync(docsPath)) {
  fs.mkdirSync(docsPath);
}

fs.writeFileSync(path.join(docsPath, 'CHART_SPECIFICATIONS.md'), docs);
console.log('✅ Documentation generated: docs/CHART_SPECIFICATIONS.md');