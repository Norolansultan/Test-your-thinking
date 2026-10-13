# My First AI Coding Agent 🤖



> AI-powered development workflow that converts specifications into production code through supervised agent execution.

## `tak-sim/` — wildfire incident-command research instrument (TAK-based)

[`tak-sim/`](tak-sim/) holds a separate project: the **TAK-based version of the Fire-rescue-simulation research
instrument**, a single-participant wildfire incident-command simulation for a doctoral study, built on Team Awareness
Kit conventions (Cursor on Target, MIL-STD-2525 symbols, GeoChat) as a clean-room web app (TypeScript, Preact,
MapLibre, Vite). See [`tak-sim/README.md`](tak-sim/README.md) to run it and
[`tak-sim/SPEC/28_TAK_Base.md`](tak-sim/SPEC/28_TAK_Base.md) for the design; CI is
[`.github/workflows/tak-sim-ci.yml`](.github/workflows/tak-sim-ci.yml).

**Note:** `tak-sim/` contains the full study content including answer keys; the repository should be made private
(or the build moved to the private repository) before any data collection (`tak-sim/SPEC/28_TAK_Base.md` §8).

The rest of this README is the Agentics 101 course project.



Built during **Agentics 101** to master specification-driven development.



## What This Demonstrates



- **Specification writing**: Converting requirements into precise instructions

- **AI supervision**: Directing Claude.ai to generate code from specs

- **Human-in-the-loop review**: Maintaining quality through verification

- **Safety protocols**: Operating AI within bounded parameters

- **Professional documentation**: Creating maintainable projects



## The Workflow



📝 Specification → 🤖 Agent Generation → 👤 Human Review → ✅ Production



1. Write detailed requirements in `specs/`

2. AI agent generates code matching specifications

3. Human verifies output quality and accuracy

4. Approved code committed and deployed



## Results



- **Development Time**: 15 minutes spec-to-code (vs ~2 hours manual)

- **First-Pass Accuracy**: 95%+ with detailed specifications

- **Iterations**: 2-3 cycles to production quality

- **Efficiency Gain**: ~8x faster than traditional coding



**Key Learning**: Specification detail directly correlates with output quality.



## Technical Stack



**Development Tools**

- AI Agent: Claude.ai (Sonnet 4)

- Version Control: GitHub

- Deployment: GitHub Pages



**Approach**

- Methodology: Specification-driven development

- Human Role: Supervisor, reviewer, quality control

- Agent Role: Code generation, implementation

- Safety Model: Human-in-the-loop (HITL)



## Project Structure



my-first-agent/ ├── specs/ # 📋 Specifications (read-only for agent) ├── docs/ # 📦 Generated code (deployed) ├── SAFETY.md # 🛡️ Safety protocols └── README.md # 📖 Documentation



## How to Use



1. **Write Specification** in `specs/` with colors, measurements, behaviors

2. **Generate Code** using Claude.ai with system prompt

3. **Review Output** for accuracy and quality

4. **Deploy** to `docs/` and commit changes



## Key Learnings



- Precise specifications eliminate AI ambiguity

- Directive feedback beats vague requests

- Manual review builds error-detection intuition

- Safety protocols prevent disasters



## Safety Features



✅ Human approval required for all changes  

✅ Agent scope bounded to specific folders  

✅ Full Git history for rollback capability  

✅ Documented procedures in SAFETY.md



## Live Demo



🌐 **[View Live Site]** - https://github.com/Norolansultan/Test-your-thinking/settings/pages



---



**Course**: Agentics 101  

**Creators**: Bradley Ross, Nicholas Ruest, The Agentics Foundation  

**Completed**: 16.02.2026



*Built with AI assistance, supervised by humans.*
