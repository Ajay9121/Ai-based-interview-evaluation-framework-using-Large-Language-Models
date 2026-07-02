from groq import Groq

key = "REMOVED_API_KEY"
try:
    client = Groq(api_key=key)
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a technical interviewer. Return only valid JSON."},
            {"role": "user",   "content": 'Generate 1 interview question about Python. Return JSON: {"question":"...","ideal_answer":"..."}'}
        ],
        temperature=0.7,
        max_completion_tokens=150,
        stream=False
    )
    print("Groq OK:", resp.choices[0].message.content.strip()[:200])
except Exception as e:
    print("Groq FAIL:", e)
