# ZLE - Zany Language for Enthusiasts

This small esoteric programming language tries to avoid using constructs like `if-else` and `for`, `loop`, `switch` etc.

Instead it relies on `goto` with experssions as parameter e.g. label name or number is calculated in runtime.

It is derived as simplification of BASIC, leaving only few types of statements:

- assignments (all typical expressions and operators are supported, variables and arrays indexed with numbers or strings)
- `goto` with argument which could be an expression
- `exec` to invoke surrounding system functions (in JS impelmentations they are various `window` functions)
- `push` and `pop` to manipulate stack and allow subroutine calls and returns.

**[Online Sandbox](https://rodiongork.github.io/zle)**

_Some manual is yet to come..._