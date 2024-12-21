# ZLE - Zany Language for Enthusiasts

This small esoteric programming language tries to avoid using constructs like `if-else` and `for`, `loop`, `switch` etc.

Instead it relies on `goto` with experssions as parameter e.g. label name or number is calculated in runtime.

It is derived as simplification of BASIC, leaving only few types of statements:

- assignments (all typical expressions and operators are supported, variables and arrays indexed with numbers or strings)
- `goto` with argument which could be an expression
- `exec` to invoke surrounding system functions (in JS impelmentations they are various `window` functions)
- `call` and `return` to allow subroutines

Actually, `goto`, `call` and `return` could be removed also if we operate on `pc` variable itself. This may happen in a future version.
