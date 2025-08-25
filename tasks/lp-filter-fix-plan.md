# LP Position Filter Fix Plan

## Current Issue
Frontend is showing BOTH positions (1029195 and 1030759) when it should only show the protocol position 1029195.

## Root Cause
I incorrectly removed the filter from App.tsx line 3541 while debugging earlier. The filter was correct and should be restored.

## Current State
```typescript
// WRONG - Shows all positions
positions={lpPositions}
```

## Should Be
```typescript  
// CORRECT - Shows only protocol position
positions={lpPositions.filter(position => position.tokenId === "1029195")}
```

## Solution

### Option 1: Restore Frontend Filter (Recommended)
**Change App.tsx line 3541 back to:**
```typescript
positions={lpPositions.filter(position => position.tokenId === "1029195")}
```

**Pros:**
- Simple one-line fix
- Restores original intended behavior
- Only shows the official protocol position

**Cons:**
- None

### Option 2: Filter in Data Layer
**Alternative: Only include position 1029195 in cached-data.json**

**Pros:**
- Smaller data file
- No frontend filtering needed

**Cons:**
- Loses visibility of other positions
- May want to track other positions in future

## Recommendation
Go with **Option 1** - Restore the frontend filter. This was the original design and it's working as intended. The filter ensures only the protocol's official LP position is displayed.

## Implementation
1. Restore filter in App.tsx
2. Rebuild application
3. Verify only position 1029195 shows

## Impact
- No data changes needed
- Frontend will correctly show only the protocol position
- Other position remains in data for potential future use