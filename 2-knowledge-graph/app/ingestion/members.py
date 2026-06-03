"""Synthetic member generation and ingestion."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import List, Optional

from app.graph.client import Edge, GraphClient, Node
from app.graph.schema import EdgeType, NodeType
from app.schemas.common import Lineage
from app.schemas.injury import Injury, InjuryStatus, JointArea
from app.schemas.member import Equipment, Goal, Member, Preference


@dataclass
class SyntheticPersona:
    """Reusable persona spec for the demo seed."""

    name: str
    persona: str
    goals: List[str] = field(default_factory=list)
    equipment: List[str] = field(default_factory=list)
    preferences: List[str] = field(default_factory=list)
    injuries: List[Injury] = field(default_factory=list)
    training_days_per_week: int = 3
    skill_level: str = "intermediate"
    notes: Optional[str] = None


def _injury(label: str, joints: list[JointArea], severity: int = 2) -> Injury:
    return Injury(
        id=str(uuid.uuid4()),
        label=label,
        joints=joints,
        severity=severity,
        status=InjuryStatus.ACTIVE,
        contraindicated_patterns=[],
        lineage=Lineage(source="synthetic-seed", ingester="seed"),
    )


SYNTHETIC_PERSONAS: List[SyntheticPersona] = [
    SyntheticPersona(
        name="Synth-Alex",
        persona="Returning runner with right knee history, dumbbell access only.",
        goals=["build lower-body strength", "stay injury-free"],
        equipment=["Dumbbell", "Yoga Mat", "Adjustable Bench - Flat"],
        preferences=["prefer dumbbells"],
        injuries=[_injury("right knee pain after lunges", [JointArea.KNEE], severity=3)],
        training_days_per_week=4,
        skill_level="intermediate",
        notes="Knee aggravated by repeated knee flexion under load. Prefers low-impact alternatives.",
    ),
    SyntheticPersona(
        name="Synth-Jordan",
        persona="Bodyweight-only commuter, mild shoulder restriction.",
        goals=["maintain upper-body conditioning"],
        equipment=["Yoga Mat"],
        preferences=["prefer bodyweight", "avoid overhead pressing"],
        injuries=[_injury("left shoulder impingement", [JointArea.SHOULDER], severity=2)],
        training_days_per_week=3,
        skill_level="beginner",
    ),
    SyntheticPersona(
        name="Synth-Sam",
        persona="Full gym access, no current injuries, intermediate lifter.",
        goals=["increase main lift loads"],
        equipment=["Barbell", "Plate", "Rack", "Dumbbell", "Adjustable Bench - Flat", "Adjustable Bench - Incline", "Adjustable Bench - Decline"],
        preferences=["prefer compound lifts"],
        injuries=[],
        training_days_per_week=5,
        skill_level="advanced",
    ),
]


def create_member(persona: SyntheticPersona, member_id: Optional[str] = None) -> Member:
    return Member(
        id=member_id or f"demo-{persona.name.lower().replace(' ', '-')}",
        name=persona.name,
        persona=persona.persona,
        training_days_per_week=persona.training_days_per_week,
        skill_level=persona.skill_level,
        goals=[Goal(label=g) for g in persona.goals],
        preferences=[
            Preference(label=p, polarity="avoid" if p.startswith("avoid") else "prefer")
            for p in persona.preferences
        ],
        equipment=[Equipment(name=e) for e in persona.equipment],
        injuries=persona.injuries,
        notes=persona.notes,
    )


async def ingest_member(client: GraphClient, member: Member) -> Member:
    lineage = Lineage(source="member-form", ingester="ingest_member").model_dump(mode="json")

    await client.upsert_node(
        Node(
            type=NodeType.MEMBER,
            key=member.id,
            properties={
                "name": member.name,
                "persona": member.persona,
                "training_days_per_week": member.training_days_per_week,
                "skill_level": member.skill_level,
                "age_range": member.age_range,
                "notes": member.notes,
                **lineage,
            },
        )
    )

    for goal in member.goals:
        gid = f"{member.id}::goal::{_slug(goal.label)}"
        await client.upsert_node(
            Node(type=NodeType.GOAL, key=gid, properties={"label": goal.label, "priority": goal.priority, **lineage})
        )
        await client.upsert_edge(
            Edge(
                type=EdgeType.HAS_GOAL,
                source_type=NodeType.MEMBER,
                source_key=member.id,
                target_type=NodeType.GOAL,
                target_key=gid,
                properties=lineage,
            )
        )
    for pref in member.preferences:
        pid = f"{member.id}::pref::{_slug(pref.label)}"
        await client.upsert_node(
            Node(type=NodeType.PREFERENCE, key=pid, properties={"label": pref.label, "polarity": pref.polarity, **lineage})
        )
        await client.upsert_edge(
            Edge(
                type=EdgeType.PREFERS,
                source_type=NodeType.MEMBER,
                source_key=member.id,
                target_type=NodeType.PREFERENCE,
                target_key=pid,
                properties=lineage,
            )
        )
    for equip in member.equipment:
        await client.upsert_node(
            Node(type=NodeType.EQUIPMENT, key=equip.name, properties={"name": equip.name})
        )
        await client.upsert_edge(
            Edge(
                type=EdgeType.HAS_EQUIPMENT,
                source_type=NodeType.MEMBER,
                source_key=member.id,
                target_type=NodeType.EQUIPMENT,
                target_key=equip.name,
                properties=lineage,
            )
        )
    for injury in member.injuries:
        await ingest_injury(client, member.id, injury)

    return member


async def ingest_injury(client: GraphClient, member_id: str, injury: Injury) -> Injury:
    lineage = (injury.lineage or Lineage(source="injury-form", ingester="ingest_injury")).model_dump(mode="json")
    await client.upsert_node(
        Node(
            type=NodeType.INJURY,
            key=injury.id,
            properties={
                "label": injury.label,
                "severity": injury.severity,
                "status": injury.status.value,
                "noted_at": injury.noted_at,
                "source_signal_id": injury.source_signal_id,
                **lineage,
            },
        )
    )
    await client.upsert_edge(
        Edge(
            type=EdgeType.HAS_INJURY,
            source_type=NodeType.MEMBER,
            source_key=member_id,
            target_type=NodeType.INJURY,
            target_key=injury.id,
            properties=lineage,
        )
    )
    for joint in injury.joints:
        await client.upsert_node(
            Node(type=NodeType.JOINT, key=joint.value, properties={"name": joint.value})
        )
        await client.upsert_edge(
            Edge(
                type=EdgeType.AFFECTS_JOINT,
                source_type=NodeType.INJURY,
                source_key=injury.id,
                target_type=NodeType.JOINT,
                target_key=joint.value,
                properties=lineage,
            )
        )
    return injury


def _slug(text: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in text.lower()).strip("-")
