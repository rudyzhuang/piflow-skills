# Manual Provider

`manual` does not call cloud APIs. It validates that each service has a `url` or `domain`, then records planned or completed service outputs.

Use it when deployment is handled outside PiFlow but downstream `test` still needs deploy URLs.
