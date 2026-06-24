# Design-Spec Contract

Codegen input should follow:

- `pages` list and page intent
- `components` list and reusability constraints
- `acceptance` and `state_matrix` for user-visible behaviors
- theme tokens (`primary`, spacing, typography)

Only generate UI + logic that map to this contract, then adapt platform behavior through adapter layer.
