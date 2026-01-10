# Coding Simplification & Design Discipline

## Purpose

This document defines the design philosophy and refactoring rules for all code generated or modified by the AI.

The goal is not flexibility or theoretical purity, but:
- Simplicity
- Clarity
- Maintainability
- Reduced cognitive load

Code is read far more often than it is written.

---

## Core Principles

### 1. DRY — Don’t Repeat Yourself

**Definition**  
There should be a single, authoritative representation of any piece of knowledge or logic.

**Rules**
- Eliminate duplicated logic, conditionals, and transformations.
- Do NOT introduce abstractions unless they reduce *actual* duplication.
- Duplication is preferable to premature abstraction.

**Smells**
- Copy-pasted blocks with minor differences
- Multiple functions doing the same thing with slightly different names
- Repeated conditionals across files

**Acceptable Duplication**
- Small, obvious logic that would become harder to understand if abstracted
- Code that is duplicated but unlikely to change together

---

### 2. YAGNI — You Aren’t Gonna Need It

**Definition**  
Do not build features, abstractions, or extension points until they are actually needed.

**Rules**
- Remove interfaces with only one implementation.
- Remove strategy patterns, factories, or plugins unless there is a current use case.
- Remove configuration flags that are always set to the same value.
- Prefer direct calls over indirection.

**Smells**
- Interfaces named `XService` with only `XServiceImpl`
- Abstract base classes without multiple concrete subclasses
- “Future-proofing” comments

**Guiding Question**
> “What concrete problem does this abstraction solve *today*?”

If the answer is “none yet” — remove it.

---

### 3. Single Responsibility Principle (SRP)

**Definition**  
Each unit of code should have one reason to change.

#### Functions
- A function should:
    - Do one thing
    - Operate at a single level of abstraction
- If a function:
    - Validates input
    - Transforms data
    - Persists data

  …it must be split.

#### Classes / Modules
- A class should represent a single concept or responsibility.
- If a class can be described using “and”, it likely violates SRP.

**Smells**
- Large functions with comments separating sections
- Classes that:
    - Fetch data AND format it
    - Handle business logic AND infrastructure
- Methods that are difficult to name precisely

---

### 4. Comments: Explain WHY, Not WHAT

**Philosophy**
The code should explain *what* is happening.
Comments should explain *why* it was done that way.

**Good Comments Explain:**
- Non-obvious constraints
- Business rules
- Trade-offs
- Performance considerations
- Historical or external reasons

**Bad Comments:**
```js
// Loop through users
for (const user of users) { ... }
```

**Good Comments:**
```
// We process users sequentially to avoid rate-limiting the external API
for (const user of users) { ... }
```

**Rules**
- Delete comments that restate the code. 
- Prefer renaming variables or extracting functions over adding comments. 
- If a comment explains WHAT, refactor the code instead.

**Refactoring Checklist**

Before finalizing any code, verify:
- No duplicated logic without justification 
- No unnecessary interfaces or abstractions 
- Each function does exactly one thing 
- Each class/module has one clear responsibility 
- Comments explain WHY, not WHAT 
- The code is understandable by a new developer in 6 months 
- The simplest solution that works today was chosen

**Final Guiding Principle**

Simple code is not code with fewer lines.
Simple code is code with fewer ideas.

If forced to choose between:
- Clever vs Clear → Choose Clear
- Flexible vs Simple → Choose Simple
- Abstract vs Concrete → Choose Concrete