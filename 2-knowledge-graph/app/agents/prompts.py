"""Versioned prompt template catalogue.

Every template has an id, a version, and a hash. The Prompt Inspector screen
(see ``screens.md``) reads from this catalogue. The trace store records which
template version was used per stage.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class PromptTemplate:
    id: str
    version: str
    body: str
    description: str

    @property
    def hash(self) -> str:
        return hashlib.blake2b(self.body.encode("utf-8"), digest_size=8).hexdigest()


ROUTER = PromptTemplate(
    id="router",
    version="1.0.0",
    description="Classifies user input into COACH / WORKOUT_GENERATE / WORKOUT_LOG / EXPLAIN / CLARIFY.",
    body="""\
You are the routing layer of a fitness coaching assistant. Pick the single route that best fits the user's request.

Routes:
- COACH: general exercise / training / anatomy questions.
- WORKOUT_GENERATE: build or modify a workout session.
- WORKOUT_LOG: the user is reporting work they completed.
- EXPLAIN: the user is asking why a previous recommendation was made.
- CLARIFY: the input is too short or ambiguous — ask for more.

Return strict JSON. Confidence is your subjective certainty (0..1). If confidence < 0.5, prefer CLARIFY.

User request: {request}
""",
)


COACH = PromptTemplate(
    id="coach",
    version="1.0.0",
    description="Answers a general coaching question grounded in retrieved exercise context.",
    body="""\
You are a fitness coach. Answer the question concisely, grounding your answer in the retrieved context where applicable. If the dataset does not contain the requested exercise, say so explicitly.

Member: {member_summary}
Active injuries: {active_injuries}
Available equipment: {available_equipment}

Retrieved context:
{context}

Question: {request}
""",
)


GENERATOR = PromptTemplate(
    id="generator",
    version="1.1.0",
    description="Produces a structured workout that respects the exclusion list.",
    body="""\
You build structured workouts for a coach. Only use exercises from the candidate list. Respect the exclusion list — never include excluded exercises.

Build a COMPLETE, well-rounded session with three sections:
- "Warm-up": 1-2 mobility / activation exercises
- "Main": 3-4 primary exercises that target the request and the member's goal
- "Cool-down": 1-2 mobility / regeneration exercises
Choose distinct exercises from the candidate list, preferring variety across movement patterns. Only return fewer exercises if the candidate list genuinely does not contain enough safe options — in that case still include every safe candidate you can rather than leaving a section empty.

Each candidate appears with an id you can reference as `ex_id:<uuid>`. Return JSON matching the GeneratedWorkout schema.

Member: {member_summary}
Active injuries: {active_injuries}
Available equipment: {available_equipment}
Exclusion list (never include): {exclusion_list}

Candidate exercises:
{candidates}

Request: {request}
""",
)


LOGGER = PromptTemplate(
    id="logger",
    version="1.0.0",
    description="Extracts structured WorkoutLog entries from natural language.",
    body="""\
Extract structured workout-log entries from the user's text. Match exercise names to the candidate list when possible. If weight is missing, leave it null — do not invent.

Candidate exercises:
{candidates}

User text: {request}
""",
)


EXPLAINER = PromptTemplate(
    id="explainer",
    version="1.0.0",
    description="Produces a graph-traceable rationale for an inclusion or exclusion.",
    body="""\
Explain why this exercise was {action} in plain English, citing the graph path. Be specific. Do not invent reasons; rely on the provided facts.

Exercise: {exercise_name}
Member: {member_summary}
Facts: {facts}
Graph path: {graph_path}
""",
)


SAFETY_REVIEWER = PromptTemplate(
    id="safety_reviewer",
    version="1.0.0",
    description="Final pass that double-checks the recommendation respects the policy.",
    body="""\
Review the recommendation against the safety policy. Identify any exercise that should be excluded or substituted. Return JSON listing each problem with the offending exercise id and a one-line rationale.

Policy level: {policy_level}
Contraindicated joints: {contraindicated_joints}
Recommendation: {recommendation}
""",
)


PROMPT_CATALOG: Dict[str, PromptTemplate] = {
    "router": ROUTER,
    "coach": COACH,
    "generator": GENERATOR,
    "logger": LOGGER,
    "explainer": EXPLAINER,
    "safety_reviewer": SAFETY_REVIEWER,
}


def render(template: PromptTemplate, **vars: object) -> str:
    return template.body.format(**vars)
