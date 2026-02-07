# Codex skills for this repo

These skills are used by **OpenAI Codex** when you run Codex inside Cursor (or VS Code).

## Use Codex in Cursor

1. **Install the Codex extension**  
   In Cursor: Extensions → search for "Codex" or "ChatGPT" by OpenAI, or install from: [Codex for Cursor](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt).

2. **Sign in with OpenAI**  
   After installing, sign in with your **ChatGPT account** or **OpenAI API key**. Your plan’s usage applies to Codex.

3. **Use skills**  
   - In Codex chat, type `$` to see available skills (e.g. `$draft-commit-message`).  
   - Or describe a task; Codex may pick a matching skill automatically.

## Skills in this repo

| Skill | When it’s used |
|-------|-----------------|
| `draft-commit-message` | User asks for help writing a commit message. |

## Adding more skills

- **From Codex:** In Codex chat, run `$skill-creator` and describe the skill you want.  
- **Manually:** Add a folder under `.codex/skills/<skill-name>/` with a `SKILL.md` that has `name`, `description`, and instructions. Restart Codex to load it.

Docs: [Create skills](https://developers.openai.com/codex/skills/create-skill) | [Codex IDE extension](https://developers.openai.com/codex/ide)
