"""Knowledge graph ontology.

This module is the canonical reference for the Schema and Ontology screen
described in ``screens.md``. ``GET /graph/schema`` serialises ``node_catalogue()``
and ``edge_catalogue()`` directly.

Schema version is bumped any time a node/edge type is added, removed, or
renamed, or any time a property type changes. Recommendations record the
schema version they were generated against (see ``app/schemas/trace.py``).
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0.0"


class NodeType(str, Enum):
    MEMBER = "Member"
    GOAL = "Goal"
    PREFERENCE = "Preference"
    EQUIPMENT = "Equipment"
    INJURY = "Injury"
    JOINT = "Joint"
    EXERCISE = "Exercise"
    MUSCLE_GROUP = "MuscleGroup"
    MOVEMENT_PATTERN = "MovementPattern"
    WORKOUT = "Workout"
    WORKOUT_LOG = "WorkoutLog"
    CONTEXT_SIGNAL = "ContextSignal"


class EdgeType(str, Enum):
    HAS_GOAL = "HAS_GOAL"
    PREFERS = "PREFERS"
    HAS_EQUIPMENT = "HAS_EQUIPMENT"
    HAS_INJURY = "HAS_INJURY"
    AFFECTS_JOINT = "AFFECTS_JOINT"
    LOADS_JOINT = "LOADS_JOINT"
    TRAINS_MUSCLE = "TRAINS_MUSCLE"
    USES_EQUIPMENT = "USES_EQUIPMENT"
    HAS_MOVEMENT_PATTERN = "HAS_MOVEMENT_PATTERN"
    COMPLETED_WORKOUT = "COMPLETED_WORKOUT"
    MENTIONED_IN = "MENTIONED_IN"
    CONTRAINDICATES = "CONTRAINDICATES"
    HAS_BILATERAL_PAIR = "HAS_BILATERAL_PAIR"


class PropertySpec(BaseModel):
    name: str
    type: str
    required: bool = False
    description: str = ""


class NodeSpec(BaseModel):
    type: NodeType
    description: str
    identifier: str = "id"
    properties: List[PropertySpec]


class EdgeSpec(BaseModel):
    type: EdgeType
    source: NodeType
    target: NodeType
    cardinality: str = "many-to-many"
    description: str
    properties: List[PropertySpec] = Field(default_factory=list)


_LINEAGE_PROPS = [
    PropertySpec(name="source", type="string", description="Form / signal / rule of origin."),
    PropertySpec(name="source_id", type="string", description="Originating record id."),
    PropertySpec(name="created_at", type="datetime"),
    PropertySpec(name="ingester", type="string", description="manual | extractor:v1 | rule:safety"),
    PropertySpec(name="confidence", type="float", description="0..1"),
]


def node_catalogue() -> List[NodeSpec]:
    """Documented node types with their properties."""
    return [
        NodeSpec(
            type=NodeType.MEMBER,
            description="A synthetic coaching client. Real data is forbidden.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="name", type="string", required=True),
                PropertySpec(name="persona", type="string"),
                PropertySpec(name="training_days_per_week", type="int"),
                PropertySpec(name="skill_level", type="string"),
                PropertySpec(name="age_range", type="string"),
                PropertySpec(name="notes", type="string"),
                *_LINEAGE_PROPS,
            ],
        ),
        NodeSpec(
            type=NodeType.GOAL,
            description="Training goal stated by a member.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="label", type="string", required=True),
                PropertySpec(name="priority", type="int"),
                *_LINEAGE_PROPS,
            ],
        ),
        NodeSpec(
            type=NodeType.PREFERENCE,
            description="Stated like/dislike, e.g. 'prefer dumbbells'.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="label", type="string", required=True),
                PropertySpec(name="polarity", type="string", description="prefer | avoid"),
                *_LINEAGE_PROPS,
            ],
        ),
        NodeSpec(
            type=NodeType.EQUIPMENT,
            description="A piece of equipment.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="name", type="string", required=True),
            ],
        ),
        NodeSpec(
            type=NodeType.INJURY,
            description="An active or historical condition that may constrain exercise selection.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="label", type="string"),
                PropertySpec(name="severity", type="int"),
                PropertySpec(name="status", type="string", description="active | improving | resolved"),
                PropertySpec(name="noted_at", type="date"),
                *_LINEAGE_PROPS,
            ],
        ),
        NodeSpec(
            type=NodeType.JOINT,
            description="A joint that can be loaded by an exercise.",
            properties=[PropertySpec(name="name", type="string", required=True)],
        ),
        NodeSpec(
            type=NodeType.EXERCISE,
            description="One row from exercises.json.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="name", type="string", required=True),
                PropertySpec(name="priority_tier", type="int"),
                PropertySpec(name="is_bilateral", type="bool"),
                PropertySpec(name="side", type="string"),
                PropertySpec(name="supports_weight", type="bool"),
                PropertySpec(name="is_reps", type="bool"),
                PropertySpec(name="is_duration", type="bool"),
                PropertySpec(name="estimated_rep_duration", type="float"),
                PropertySpec(name="bilateral_pair_id", type="string"),
            ],
        ),
        NodeSpec(
            type=NodeType.MUSCLE_GROUP,
            description="A trained muscle group.",
            properties=[PropertySpec(name="name", type="string", required=True)],
        ),
        NodeSpec(
            type=NodeType.MOVEMENT_PATTERN,
            description="A movement pattern, e.g. 'upper push - horizontal'.",
            properties=[PropertySpec(name="name", type="string", required=True)],
        ),
        NodeSpec(
            type=NodeType.WORKOUT,
            description="A planned or generated workout.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="title", type="string"),
                PropertySpec(name="generated_at", type="datetime"),
            ],
        ),
        NodeSpec(
            type=NodeType.WORKOUT_LOG,
            description="A completed-workout record (from the logger sub-agent).",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="logged_at", type="datetime"),
            ],
        ),
        NodeSpec(
            type=NodeType.CONTEXT_SIGNAL,
            description="Raw chat snippet, transcript line, coach note, or biometric summary.",
            properties=[
                PropertySpec(name="id", type="string", required=True),
                PropertySpec(name="text", type="string", required=True),
                PropertySpec(name="signal_type", type="string"),
                PropertySpec(name="captured_at", type="datetime"),
                *_LINEAGE_PROPS,
            ],
        ),
    ]


def edge_catalogue() -> List[EdgeSpec]:
    """Documented edge types with semantic descriptions.

    Each edge carries lineage properties (source, created_at, confidence)
    just like nodes. They are omitted here for brevity but are stored at
    write time.
    """
    return [
        EdgeSpec(
            type=EdgeType.HAS_GOAL,
            source=NodeType.MEMBER,
            target=NodeType.GOAL,
            description="A member's stated training goal.",
        ),
        EdgeSpec(
            type=EdgeType.PREFERS,
            source=NodeType.MEMBER,
            target=NodeType.PREFERENCE,
            description="A like/dislike that biases recommendations.",
        ),
        EdgeSpec(
            type=EdgeType.HAS_EQUIPMENT,
            source=NodeType.MEMBER,
            target=NodeType.EQUIPMENT,
            description="Equipment the member can access.",
        ),
        EdgeSpec(
            type=EdgeType.HAS_INJURY,
            source=NodeType.MEMBER,
            target=NodeType.INJURY,
            description="Member has this injury or condition.",
        ),
        EdgeSpec(
            type=EdgeType.AFFECTS_JOINT,
            source=NodeType.INJURY,
            target=NodeType.JOINT,
            description="Injury localises to this joint. Drives safety filtering.",
        ),
        EdgeSpec(
            type=EdgeType.LOADS_JOINT,
            source=NodeType.EXERCISE,
            target=NodeType.JOINT,
            description="Exercise loads this joint (from exercises.json joints_loaded).",
        ),
        EdgeSpec(
            type=EdgeType.TRAINS_MUSCLE,
            source=NodeType.EXERCISE,
            target=NodeType.MUSCLE_GROUP,
            description="Exercise targets this muscle group.",
        ),
        EdgeSpec(
            type=EdgeType.USES_EQUIPMENT,
            source=NodeType.EXERCISE,
            target=NodeType.EQUIPMENT,
            description="Equipment required by the exercise.",
        ),
        EdgeSpec(
            type=EdgeType.HAS_MOVEMENT_PATTERN,
            source=NodeType.EXERCISE,
            target=NodeType.MOVEMENT_PATTERN,
            description="Movement-pattern classification for the exercise.",
        ),
        EdgeSpec(
            type=EdgeType.COMPLETED_WORKOUT,
            source=NodeType.MEMBER,
            target=NodeType.WORKOUT_LOG,
            description="Member completed this workout.",
        ),
        EdgeSpec(
            type=EdgeType.MENTIONED_IN,
            source=NodeType.JOINT,
            target=NodeType.CONTEXT_SIGNAL,
            description="A joint/injury is mentioned in a chat or note. Lineage for safety facts.",
        ),
        EdgeSpec(
            type=EdgeType.CONTRAINDICATES,
            source=NodeType.INJURY,
            target=NodeType.EXERCISE,
            description="Optional materialised contraindication edge. Computed at recommend time.",
        ),
        EdgeSpec(
            type=EdgeType.HAS_BILATERAL_PAIR,
            source=NodeType.EXERCISE,
            target=NodeType.EXERCISE,
            description="Single-side exercise paired to its other-side counterpart.",
        ),
    ]


class SchemaInvariant(BaseModel):
    name: str
    description: str
    cypher_check: Optional[str] = None


def invariants() -> List[SchemaInvariant]:
    """Invariants that the live graph must satisfy. Reported by ``GET /graph/schema``."""
    return [
        SchemaInvariant(
            name="active_injury_must_affect_joint",
            description="An active Injury must have at least one AFFECTS_JOINT edge — otherwise safety filtering is meaningless.",
            cypher_check=(
                "MATCH (i:Injury {status:'active'}) "
                "WHERE NOT (i)-[:AFFECTS_JOINT]->(:Joint) "
                "RETURN count(i) AS violations"
            ),
        ),
        SchemaInvariant(
            name="bilateral_pair_symmetry",
            description="HAS_BILATERAL_PAIR should be reciprocal.",
            cypher_check=(
                "MATCH (a:Exercise)-[:HAS_BILATERAL_PAIR]->(b:Exercise) "
                "WHERE NOT (b)-[:HAS_BILATERAL_PAIR]->(a) "
                "RETURN count(a) AS violations"
            ),
        ),
        SchemaInvariant(
            name="exercise_must_have_id",
            description="Every Exercise node must have a non-null id.",
            cypher_check="MATCH (e:Exercise) WHERE e.id IS NULL RETURN count(e) AS violations",
        ),
    ]
