# Claude Development Rules for TORUS Dashboard

## Project Overview
This project involves creating a comprehensive dashboard for the TORUS smart contract ecosystem on Ethereum. The dashboard will track staking metrics, token creation data, and provide future projections.

### Smart Contract References
- Main Token Contract: [0xb47f575807fc5466285e1277ef8acfbb5c6686e8](https://etherscan.io/address/0xb47f575807fc5466285e1277ef8acfbb5c6686e8#code)
- Create & Stake Contract: [0xc7cc775b21f9df85e043c7fdd9dac60af0b69507](https://etherscan.io/address/0xc7cc775b21f9df85e043c7fdd9dac60af0b69507#code)
- Buy & Process Contract: [0xaa390a37006e22b5775a34f2147f81ebd6a63641](https://etherscan.io/address/0xaa390a37006e22b5775a34f2147f81ebd6a63641#code)

## Development Workflow Rules

### 1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
Before starting any implementation, thoroughly analyze the requirements and existing code structure. Create a detailed plan that breaks down the work into manageable tasks.

### 2. The plan should have a list of todo items that you can check off as you complete them
Use a structured todo list format with clear, actionable items. Each item should be specific and measurable.

### 3. Before you begin working, check in with me and I will verify the plan.
Always present the plan for approval before making any code changes. This ensures alignment with project goals and expectations.

### 4. Then, begin working on the todo items, marking them as complete as you go.
Track progress in real-time by updating the todo list status as each task is completed. This provides visibility into the development progress.

### 5. Please every step of the way just give me a high level explanation of what changes you made
Provide concise summaries of each change without going into excessive technical detail. Focus on the "what" and "why" rather than the "how".

### 6. Make every task and code change you do as simple as possible.
- Avoid making massive or complex changes
- Every change should impact as little code as possible
- Everything is about simplicity
- Break down complex features into smaller, manageable pieces
- Prefer straightforward solutions over clever optimizations

### 7. Finally, add a review section to the todo.md file with a summary of the changes you made and any other relevant information.
Document the completed work with:
- Summary of all changes made
- Any important decisions or trade-offs
- Next steps or recommendations
- Potential improvements for future iterations

## Key Development Principles

- **Simplicity First**: Always choose the simplest solution that meets the requirements
- **Incremental Progress**: Make small, testable changes rather than large refactors
- **Clear Communication**: Provide regular updates without overwhelming technical details
- **Structured Planning**: Use todo.md as the single source of truth for task management
- **Minimal Impact**: Each change should affect the smallest possible code surface area

## File Structure
- `tasks/todo.md` - Primary task tracking and review documentation
- `CLAUDE.md` - This file, containing project rules and guidelines

## Memory

- Always follow claud.md when working on the TORUS Dashboard project