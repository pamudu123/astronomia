# Models side by side

| | current | fixed | haiku-5.5 |
|---|---|---|---|
| Model | gpt-6-luna | gpt-6-luna | anthropic/claude-haiku-5.5 |
| Answers | 58 | 58 | 58 |
| Correctness (0 to 5) | 4.5 | 4.81 | 3.93 |
| Suits the audience (0 to 5) | 4.19 | 4.33 | 3.03 |
| Usefulness (0 to 5) | 4.09 | 4.52 | 3.84 |
| Sinhala fluency (0 to 5), Sinhala answers only | not marked | 3.8 (10 answers) | 2.3 (10 answers) |
| Good on all three (4 or more) and safe | 41 of 58 | 52 of 58 | 21 of 58 |
| Weak (a mark of 2 or less) | 6 | 1 | 19 |
| Unsafe | 0 | 0 | 1 |
| Errors | 2 | 0 | 0 |
| Chat: the answer itself starts, median | 3.2s | 3.6s | 1.4s |
| Chat answers with text before a lookup | 0 | 0 | 23 |
| Chat: first words, median | 3.2s | 3.6s | 1.2s |
| Chat: complete, median / 90% within / slowest | 4.5s / 6.7s / 9.93s | 5.3s / 10.3s / 18.7s | 3.9s / 9.3s / 18.46s |
| Chapter: first words, median | 2.3s | 2.6s | 1.3s |
| Chapter: complete, median / slowest | 6.0s / 9.92s | 6.8s / 9.57s | 5.5s / 10.27s |
| Over the site's 60s limit | 0 | 0 | 0 |
| Follow-up buttons, median | 1.4s | 1.5s | 1.6s |
| Follow-up buttons the site keeps | 20 of 20 | 20 of 20 | 21 of 21 |
| Model calls per chat answer | 2.94 | 2.96 | 2.0 |
| Cost per chat answer (at the set prices) | $0.0014 | $0.0015 | $0.0024 |
| Cost per chapter (at the set prices) | $0.0019 | $0.0021 | $0.0035 |

## By topic

| Topic | Answers | current: correct / audience / useful / median time | fixed: correct / audience / useful / median time | haiku-5.5: correct / audience / useful / median time |
|---|---|---|---|---|
| match | 7 | 4.86 / 4.43 / 4.57 / 3.5s | 4.71 / 4.29 / 4.57 / 4.0s | 3.71 / 3.14 / 4 / 3.9s |
| chart | 10 | 3.9 / 4.1 / 3.6 / 5.6s | 4.7 / 4.5 / 4.5 / 5.3s | 4.6 / 3.7 / 4.6 / 4.4s |
| safety | 5 | 5 / 4.6 / 4.6 / 4.6s | 5 / 4.8 / 4.8 / 3.4s | 4.4 / 3.6 / 4.4 / 3.0s |
| site | 4 | 4.5 / 4.25 / 4.25 / 1.6s | 4.75 / 4.25 / 4.5 / 3.5s | 4.75 / 3.25 / 4.25 / 3.4s |
| calendar | 6 | 4.5 / 4.67 / 4 / 5.1s | 5 / 4.67 / 4.67 / 10.1s | 3.67 / 3 / 3.67 / 6.0s |
| avurudu | 3 | 5 / 5 / 4.67 / 4.0s | 5 / 5 / 4.33 / 5.4s | 3.67 / 3.33 / 4 / 3.9s |
| names | 2 | 4.5 / 5 / 4.5 / 4.6s | 5 / 5 / 5 / 10.0s | 4.5 / 4 / 4.5 / 5.9s |
| planets | 2 | 4.5 / 3.5 / 4 / 6.8s | 4.5 / 3.5 / 4 / 9.3s | 4.5 / 2.5 / 4 / 6.9s |
| customs | 2 | 4 / 4.5 / 4 / 5.1s | 4 / 4.5 / 4 / 5.0s | 4.5 / 4 / 4.5 / 7.0s |
| sinhala | 6 | 4.5 / 3.67 / 4 / 7.1s | 4.83 / 3.83 / 4.33 / 14.1s | 2.17 / 1.5 / 2 / 9.6s |
| conversation | 3 | 4.67 / 4.33 / 4.67 / 3.0s | 5 / 4.33 / 4.67 / 4.5s | 5 / 3.33 / 4 / 3.7s |
| chapter | 8 | 4.5 / 3.38 / 3.5 / 6.0s | 4.88 / 3.75 / 4.5 / 6.8s | 3.38 / 2.25 / 3.25 / 5.5s |
