# Dashboard Specifications

This directory contains the single source of truth for all TORUS Dashboard features, configurations, and requirements.

## Why Specifications?

We follow world-class development standards similar to Bloomberg Terminal, Stripe Dashboard, and DataDog:

1. **Never Lose Features**: Every feature is explicitly specified
2. **Prevent Regression**: Tests validate against specifications
3. **Enable Evolution**: Version control tracks all changes
4. **Team Scalability**: New developers understand requirements instantly

## Structure

```
dashboard-specs/
├── chart-specifications.json    # All chart configurations
├── component-registry.json      # UI component specifications  
├── data-contracts.json         # Data shape definitions
├── feature-flags.json          # Feature toggles
├── test-scenarios.json         # Test specifications
└── version-history/            # Historical versions
```

## Key Files

### chart-specifications.json
Defines every chart in the dashboard:
- Chart type (line, bar, table)
- Features (drag/pan, zoom, data labels, timeframes)
- Data sources and validation rules
- Display configuration

### data-contracts.json
Defines expected data structures:
- Field types and requirements
- Validation rules
- Field mappings (e.g., amount0 → torusAmount)

### feature-flags.json
Controls feature rollout:
- Enable/disable features
- Gradual rollout percentages
- Required fields for features

## Usage

### Validate Implementation
```bash
npm run validate:specs
```

### Generate Documentation
```bash
npm run docs:generate
```

### Add New Chart
1. Add specification to `chart-specifications.json`
2. Implement chart using specification
3. Run validation
4. Commit both together

### Modify Existing Chart
1. Update specification
2. Increment version
3. Update implementation
4. Run validation
5. Document changes in changelog

## Example: LP Positions Table

The specification ensures torusAmount/titanxAmount are never lost:

```json
{
  "lp-positions-table": {
    "requiredColumns": [
      {
        "field": "torusAmount",
        "header": "TORUS Amount",
        "required": true
      },
      {
        "field": "titanxAmount", 
        "header": "TitanX Amount",
        "required": true
      }
    ],
    "validation": {
      "requiredFields": ["tokenId", "torusAmount", "titanxAmount"],
      "fieldMappings": {
        "amount0": "torusAmount",
        "amount1": "titanxAmount"
      }
    }
  }
}
```

Any implementation missing these fields will fail validation.

## Best Practices

1. **Always update specs first** before changing code
2. **Run validation** before committing
3. **Version changes** for tracking evolution
4. **Document reasons** for specification changes
5. **Test against specs** in CI/CD pipeline

## Benefits

- ✅ Single source of truth for requirements
- ✅ Automated validation prevents regression
- ✅ Self-documenting system
- ✅ Version control for feature evolution
- ✅ Enterprise-grade quality assurance