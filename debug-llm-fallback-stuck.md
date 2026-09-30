# Debug Session: llm-fallback-stuck

Status: [OPEN]

## Symptom
Sandrone's current Gen 9 Random Battle appears to repeatedly use fallback actions after enabling Mify DeepSeek Flash thinking mode with low effort.

## Hypotheses
1. Mify rejects or mishandles the thinking/reasoning parameters.
2. Decision service 8092 is unavailable or requests exceed the turn deadline.
3. The model returns an action that cannot be mapped to a legal PS action.
4. The same request is processed repeatedly by the PS client.

## Evidence plan
- Inspect current PS JSONL decision/error records.
- Inspect decision server health and process state.
- Compare request, response, fallback, and sent-action records by battle/turn.
- Do not modify business logic until runtime evidence identifies the cause.
