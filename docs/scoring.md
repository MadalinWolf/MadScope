# Responsive Health scoring

Deterministic. No randomness. Starts at 100, subtracts fixed penalties per issue type:

| Issue type           | Per finding | Max penalty |
| -------------------- | ----------- | ----------- |
| horizontal-overflow  | 15          | 15          |
| element-overflow     | 4           | 20          |
| image-overflow       | 3           | 12          |
| text-clipping        | 2           | 10          |
| small-touch-target   | 1           | 10          |
| overlapping-elements | 3           | 15          |
| offscreen-element    | 2           | 10          |

Score = max(0, 100 − Σ penalties). Same input always yields the same score. Counts are capped so one noisy page cannot dominate. Findings are "potential issues", not certainties.
